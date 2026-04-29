class BaseGateway {
  constructor(options = {}) {
    this.options = options;
    this.session = null;
  }

  async execute(command, options = {}) {
    throw new Error('execute method must be implemented by subclass');
  }

  async healthCheck() {
    throw new Error('healthCheck method must be implemented by subclass');
  }

  async getResources() {
    throw new Error('getResources method must be implemented by subclass');
  }

  async persistSession() {
    // Default implementation - can be overridden
    return this.session;
  }

  async close() {
    // Default implementation - can be overridden
    if this.session && typeof this.session.close === 'function' {
      await this.session.close();
    }
    this.session = null;
  }
}

module.exports = BaseGateway;