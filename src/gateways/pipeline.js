class CommandPipeline {
  constructor(router, options = {}) {
    this.router = router;
    this.options = {
      retries: 3,
      timeout: 30000, // 30 seconds
      resourceMonitoring: true,
      healthCheckBeforeExec: false,
      ...options
    };
  }

  async execute(command, gatewayName = null, options = {}) {
    const gateway = this.router.getGateway(gatewayName);
    let lastError;
    for (let i = 0; i < this.options.retries; i++) {
      try {
        // Optionally check health before executing
        if (this.options.healthCheckBeforeExec) {
          const healthy = await gateway.healthCheck();
          if (!healthy) {
            throw new Error(`Gateway ${gatewayName || 'default'} is not healthy`);
          }
        }

        // Optionally monitor resources before
        let resourcesBefore = null;
        if (this.options.resourceMonitoring) {
          resourcesBefore = await gateway.getResources();
        }

        // Execute with timeout
        const result = await Promise.race([
          gateway.execute(command, options),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Command execution timeout')), this.options.timeout)
          )
        ]);

        // Optionally monitor resources after
        let resourcesAfter = null;
        if (this.options.resourceMonitoring) {
          resourcesAfter = await gateway.getResources();
        }

        return {
          ...result,
          resourcesBefore,
          resourcesAfter,
          attempts: i + 1,
          gateway: gatewayName || this.router.defaultGateway || 'unknown'
        };
      } catch (err) {
        lastError = err;
        // If this is the last attempt, throw
        if (i === this.options.retries - 1) {
          throw err;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
      }
    }
    throw lastError;
  }

  // Execute a sequence of commands on the same gateway
  async executeSequence(commands, gatewayName = null, options = {}) {
    const results = [];
    for (const command of commands) {
      try {
        const result = await this.execute(command, gatewayName, options);
        results.push(result);
      } catch (err) {
        results.push({ error: err.message, command });
        // Depending on requirements, we might break or continue
        if (options.stopOnError) break;
      }
    }
    return results;
  }
}

module.exports = CommandPipeline;