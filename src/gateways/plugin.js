// Custom Plugin Gateway - Allows users to plug in their own gateway implementations
class PluginGateway extends require('./base.js') {
  constructor(options = {}) {
    super(options);
    // Expect options to contain a 'plugin' property with the gateway implementation
    this.plugin = options.plugin;
    if (!this.plugin) {
      throw new Error('PluginGateway requires a plugin option');
    }
    // Validate that the plugin has required methods
    if (!this.plugin.execute || typeof this.plugin.execute !== 'function') {
      throw new Error('Plugin must implement execute method');
    }
    if (!this.plugin.healthCheck || typeof this.plugin.healthCheck !== 'function') {
      throw new Error('Plugin must implement healthCheck method');
    }
    if (!this.plugin.getResources || typeof this.plugin.getResources !== 'function') {
      throw new Error('Plugin must implement getResources method');
    }
  }

  async execute(command, options = {}) {
    // Delegate to the plugin
    return await this.plugin.execute(command, options);
  }

  async healthCheck() {
    // Delegate to the plugin
    return await this.plugin.healthCheck();
  }

  async getResources() {
    // Delegate to the plugin
    return await this.plugin.getResources();
  }

  async persistSession() {
    // Delegate to the plugin if it has persistSession, otherwise use base
    if (this.plugin.persistSession && typeof this.plugin.persistSession === 'function') {
      return await this.plugin.persistSession();
    }
    return await super.persistSession();
  }

  async close() {
    // Delegate to the plugin if it has close, otherwise use base
    if (this.plugin.close && typeof this.plugin.close === 'function') {
      await this.plugin.close();
    }
    await super.close();
  }
}

module.exports = PluginGateway;