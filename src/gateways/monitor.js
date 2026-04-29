class ResourceMonitor {
  constructor(router, options = {}) {
    this.router = router;
    this.options = {
      collectionInterval: 5000, // 5 seconds
      historySize: 100, // Keep last 100 data points
      ...options
    };
    this.history = new Map(); // gatewayName => array of resource snapshots
    this.collectionIntervalId = null;
  }

  start() {
    if (this.collectionIntervalId) return;
    this.collect(); // Initial collection
    this.collectionIntervalId = setInterval(() => this.collect(), this.options.collectionInterval);
  }

  stop() {
    if (this.collectionIntervalId) {
      clearInterval(this.collectionIntervalId);
      this.collectionIntervalId = null;
    }
  }

  async collect() {
    try {
      const resources = await this.router.getResourcesAll();
      const timestamp = Date.now();
      
      for (const [gatewayName, resourceData] of Object.entries(resources)) {
        if (!this.history.has(gatewayName)) {
          this.history.set(gatewayName, []);
        }
        const gatewayHistory = this.history.get(gatewayName);
        gatewayHistory.push({ timestamp, ...resourceData });
        
        // Limit history size
        if (gatewayHistory.length > this.options.historySize) {
          gatewayHistory.shift();
        }
      }
    } catch (err) {
      console.error('Error collecting resources:', err);
    }
  }

  getCurrentResources() {
    const resources = {};
    for (const [gatewayName, gatewayHistory] of this.history.entries()) {
      const latest = gatewayHistory[gatewayHistory.length - 1];
      resources[gatewayName] = latest || {};
    }
    return resources;
  }

  getResourceHistory(gatewayName, limit) {
    const history = this.history.get(gatewayName) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  getAverageResources(gatewayName, timeWindowMs) {
    const history = this.history.get(gatewayName) || [];
    if (history.length === 0) return {};
    
    const now = Date.now();
    const recent = history.filter(entry => now - entry.timestamp <= timeWindowMs);
    if (recent.length === 0) return {};
    
    const sums = { cpu: 0, memory: 0, disk: 0 };
    let count = 0;
    
    for (const entry of recent) {
      if (entry.cpu !== undefined) { sums.cpu += entry.cpu; count++; }
      if (entry.memory !== undefined) { sums.memory += entry.memory; }
      if (entry.disk !== undefined) { sums.disk += entry.disk; }
    }
    
    return {
      cpu: count > 0 ? sums.cpu / count : 0,
      memory: recent.length > 0 ? sums.memory / recent.length : 0,
      disk: recent.length > 0 ? sums.disk / recent.length : 0,
      samples: recent.length
    };
  }

  checkThresholds(gatewayName, thresholds) {
    const current = this.getCurrentResources()[gatewayName] || {};
    const alerts = [];
    
    if (thresholds.cpu !== undefined && current.cpu > thresholds.cpu) {
      alerts.push({
        type: 'cpu',
        value: current.cpu,
        threshold: thresholds.cpu,
        message: `CPU usage ${current.cpu.toFixed(1)}% exceeds threshold ${thresholds.cpu}%`
      });
    }
    
    if (thresholds.memory !== undefined && current.memory > thresholds.memory) {
      alerts.push({
        type: 'memory',
        value: current.memory,
        threshold: thresholds.memory,
        message: `Memory usage ${current.memory.toFixed(1)}% exceeds threshold ${thresholds.memory}%`
      });
    }
    
    if (thresholds.disk !== undefined && current.disk > thresholds.disk) {
      alerts.push({
        type: 'disk',
        value: current.disk,
        threshold: thresholds.disk,
        message: `Disk usage ${current.disk.toFixed(1)}% exceeds threshold ${thresholds.disk}%`
      });
    }
    
    return alerts;
  }
}

module.exports = ResourceMonitor;