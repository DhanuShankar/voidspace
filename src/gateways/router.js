const SSHGateway = require('./ssh.js');
const DockerGateway = require('./docker.js');
const ColabGateway = require('./colab.js');
const PluginGateway = require('./plugin.js');

class GatewayRouter {
  constructor() {
    this.gateways = new Map();
    this.defaultGateway = null;
  }

  registerGateway(name, gatewayInstance) {
    this.gateways.set(name, gatewayInstance);
  }

  setDefaultGateway(name) {
    if (!this.gateways.has(name)) {
      throw new Error(`Gateway ${name} not registered`);
    }
    this.defaultGateway = name;
  }

  getGateway(name) {
    if (name && this.gateways.has(name)) {
      return this.gateways.get(name);
    }
    if (this.defaultGateway && this.gateways.has(this.defaultGateway)) {
      return this.gateways.get(this.defaultGateway);
    }
    // Return first gateway if no default set
    const firstGateway = this.gateways.values().next().value;
    if (!firstGateway) {
      throw new Error('No gateways registered');
    }
    return firstGateway;
  }

  async healthCheckAll() {
    const results = {};
    for (const [name, gateway] of this.gateways.entries()) {
      try {
        results[name] = await gateway.healthCheck();
      } catch (err) {
        results[name] = false;
      }
    }
    return results;
  }

  async getResourcesAll() {
    const results = {};
    for (const [name, gateway] of this.gateways.entries()) {
      try {
        results[name] = await gateway.getResources();
      } catch (err) {
        results[name] = { error: err.message };
      }
    }
    return results;
  }
}

module.exports = GatewayRouter;