/**
 * Token Tracker - Usage and cost tracking for AI requests
 */

export class TokenTracker {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled || true,
      currency: config.currency || 'USD',
      models: config.models || {},
      ...config
    };

    this.usage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      totalCost: 0,
      byModel: {},
      byType: {}
    };

    this.dailyUsage = new Map();
    this.resetTime = Date.now();
  }

  /**
   * Track a request
   */
  track(request) {
    if (!this.config.enabled) return;

    const { usage, model, type, cost } = request;

    // Update totals
    this.usage.totalInputTokens += usage.inputTokens || 0;
    this.usage.totalOutputTokens += usage.outputTokens || 0;
    this.usage.totalRequests += 1;
    this.usage.totalCost += cost || 0;

    // Update by model
    if (!this.usage.byModel[model]) {
      this.usage.byModel[model] = {
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        cost: 0
      };
    }
    this.usage.byModel[model].inputTokens += usage.inputTokens || 0;
    this.usage.byModel[model].outputTokens += usage.outputTokens || 0;
    this.usage.byModel[model].requests += 1;
    this.usage.byModel[model].cost += cost || 0;

    // Update by type
    if (!this.usage.byType[type]) {
      this.usage.byType[type] = {
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        cost: 0
      };
    }
    this.usage.byType[type].inputTokens += usage.inputTokens || 0;
    this.usage.byType[type].outputTokens += usage.outputTokens || 0;
    this.usage.byType[type].requests += 1;
    this.usage.byType[type].cost += cost || 0;

    // Track daily usage
    this.trackDaily(request);
  }

  /**
   * Track daily usage
   */
  trackDaily(request) {
    const today = new Date().toDateString();
    if (!this.dailyUsage.has(today)) {
      this.dailyUsage.set(today, {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        totalCost: 0
      });
    }

    const daily = this.dailyUsage.get(today);
    daily.totalInputTokens += request.usage.inputTokens || 0;
    daily.totalOutputTokens += request.usage.outputTokens || 0;
    daily.totalRequests += 1;
    daily.totalCost += request.cost || 0;
  }

  /**
   * Calculate cost
   */
  calculateCost(inputTokens, outputTokens, model) {
    if (!this.config.enabled || !this.config.models[model]) {
      return 0;
    }

    const rates = this.config.models[model];
    const inputCost = (inputTokens / 1000) * (rates.input || 0);
    const outputCost = (outputTokens / 1000) * (rates.output || 0);

    return inputCost + outputCost;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.usage,
      daily: this.getDailyStats(),
      averageCostPerRequest: this.usage.totalRequests > 0 
        ? this.usage.totalCost / this.usage.totalRequests 
        : 0,
      estimatedMonthlyCost: this.estimateMonthlyCost()
    };
  }

  /**
   * Get daily statistics
   */
  getDailyStats() {
    const today = new Date().toDateString();
    return this.dailyUsage.get(today) || {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      totalCost: 0
    };
  }

  /**
   * Estimate monthly cost
   */
  estimateMonthlyCost() {
    const daysRunning = Math.ceil((Date.now() - this.resetTime) / (1000 * 60 * 60 * 24));
    if (daysRunning === 0) return 0;
    
    const dailyAvg = this.usage.totalCost / daysRunning;
    return dailyAvg * 30;
  }

  /**
   * Set cost rates for model
   */
  setRates(model, inputRate, outputRate) {
    this.config.models[model] = { input: inputRate, output: outputRate };
  }

  /**
   * Clear all usage data
   */
  clear() {
    this.usage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      totalCost: 0,
      byModel: {},
      byType: {}
    };
    this.dailyUsage.clear();
    this.resetTime = Date.now();
  }

  /**
   * Reset daily usage
   */
  resetDaily() {
    const today = new Date().toDateString();
    this.dailyUsage.set(today, {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      totalCost: 0
    });
  }

  /**
   * Check if enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Export usage data
   */
  export() {
    return {
      config: this.config,
      usage: this.usage,
      dailyUsage: Object.fromEntries(this.dailyUsage),
      resetTime: this.resetTime
    };
  }

  /**
   * Import usage data
   */
  import(data) {
    this.config = data.config || this.config;
    this.usage = data.usage || this.usage;
    this.dailyUsage = new Map(Object.entries(data.dailyUsage || {}));
    this.resetTime = data.resetTime || this.resetTime;
  }
}

export default TokenTracker;