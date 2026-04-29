const Docker = require('dockerode');

class DockerGateway extends require('./base.js') {
  constructor(options = {}) {
    super(options);
    this.docker = new Docker(options.dockerOptions || {});
    this.container = null;
  }

  async execute(command, options = {}) {
    if (!this.container) {
      throw new Error('No container selected. Use selectContainer() first.');
    }
    return new Promise((resolve, reject) => {
      this.container.exec(command, options, (err, exec) => {
        if (err) return reject(err);
        exec.start((err, stream) => {
          if (err) return reject(err);
          let stdout = '';
          let stderr = '';
          stream.setEncoding('utf8');
          stream.on('data', (data) => {
            stdout += data;
          });
          stream.on('end', () => {
            exec.inspect((err, data) => {
              if (err) return reject(err);
              resolve({
                code: data.ExitCode,
                signal: null,
                stdout,
                stderr
              });
            });
          });
        });
      });
    });
  }

  async selectContainer(containerNameOrId) {
    try {
      this.container = await this.docker.getContainer(containerNameOrId);
      // Verify container exists and is running
      const info = await this.container.inspect();
      if (!info.State.Running) {
        throw new Error('Container is not running');
      }
      return this.container;
    } catch (err) {
      this.container = null;
      throw err;
    }
  }

  async healthCheck() {
    try {
      // If no container selected, check docker daemon
      if (!this.container) {
        await this.docker.ping();
        return true;
      }
      // If container selected, check if it's running
      const info = await this.container.inspect();
      return info.State.Running;
    } catch (err) {
      return false;
    }
  }

  async getResources() {
    try {
      if (!this.container) {
        // Return docker daemon info? Not straightforward. We'll return empty for now.
        return { cpu: 0, memory: 0, disk: 0 };
      }
      const stats = await this.container.stats({ stream: false });
      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      let cpuPercent = 0;
      if (systemDelta > 0) {
        cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
      }
      // Memory usage
      const memoryPercent = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;
      // Disk usage - not directly available in stats, we can use df inside container or skip
      // For simplicity, we'll set disk to 0 or try to get from container's rootfs
      // We'll skip disk for now and set to 0.
      return {
        cpu: parseFloat(cpuPercent.toFixed(2)),
        memory: parseFloat(memoryPercent.toFixed(2)),
        disk: 0
      };
    } catch (err) {
      return { cpu: 0, memory: 0, disk: 0 };
    }
  }

  async persistSession() {
    // For Docker, we might want to persist the container ID or name
    if (this.container) {
      const info = await this.container.inspect();
      return {
        containerId: info.Id,
        containerName: info.Name
      };
    }
    return null;
  }

  async close() {
    // We don't close the dockerode instance, but we can release the container reference
    this.container = null;
    await super.close();
  }
}

module.exports = DockerGateway;