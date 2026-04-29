const { Client } = require('ssh2');

class SSHGateway extends require('./base.js') {
  constructor(options = {}) {
    super(options);
    this.config = {
      host: options.host || 'localhost',
      port: options.port || 22,
      username: options.username,
      password: options.password,
      privateKey: options.privateKey,
      passphrase: options.passphrase,
      ...options
    };
  }

  async execute(command, options = {}) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          let stdout = '';
          let stderr = '';
          stream.on('close', (code, signal) => {
            conn.end();
            resolve({ code, signal, stdout, stderr });
          }).on('data', (data) => {
            stdout += data;
          }).stderr.on('data', (data) => {
            stderr += data;
          });
        });
      }).on('error', (err) => {
        reject(err);
      }).connect(this.config);
    });
  }

  async healthCheck() {
    try {
      const result = await this.execute('echo "healthcheck"');
      return result.code === 0;
    } catch (err) {
      return false;
    }
  }

  async getResources() {
    try {
      const [cpu, memory, disk] = await Promise.all([
        this.execute('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk "{print 100 - $1}"'),
        this.execute('free | grep Mem | awk "{print $3/$2 * 100.0}"'),
        this.execute('df / | tail -1 | awk "{print $5}" | sed "s/%//"')
      ]);
      return {
        cpu: parseFloat(cpu.stdout.trim()) || 0,
        memory: parseFloat(memory.stdout.trim()) || 0,
        disk: parseFloat(disk.stdout.trim()) || 0
      };
    } catch (err) {
      return { cpu: 0, memory: 0, disk: 0 };
    }
  }

  async persistSession() {
    // SSH connections are not persisted in the same way; we return the config for reconnection
    return this.config;
  }

  async close() {
    // SSH connections are closed per command in execute, but we can add a cleanup if needed
    // For now, we just call super.close()
    await super.close();
  }
}

module.exports = SSHGateway;