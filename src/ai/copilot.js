/**
 * AI Copilot Integration - Main orchestrator
 * Multi-model support with streaming, context management, and cost tracking
 */

import { AICompletion } from './completion.js';
import { AIChat } from './chat.js';
import { TokenTracker } from '../utils/tokenTracker.js';
import { ContextManager } from '../utils/contextManager.js';

export class AICopilot {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'claude', // 'claude' | 'gpt' | 'auto'
      apiKey: config.apiKey,
      model: config.model || this.getDefaultModel(config.provider),
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.2,
      streaming: config.streaming !== undefined ? config.streaming : true,
      privacyMode: config.privacyMode || false,
      customPrompts: config.customPrompts || {},
      costTracking: config.costTracking !== undefined ? config.costTracking : true,
      ...config
    };

    this.tokenTracker = new TokenTracker({
      enabled: this.config.costTracking,
      currency: 'USD',
      models: {
        'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
        'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
        'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
        'gpt-4o-2026-04-29': { input: 0.0025, output: 0.010 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
      }
    });

    this.contextManager = new ContextManager({
      maxContextSize: this.config.maxTokens * 4,
      compressionEnabled: true
    });

    this.completion = new AICompletion(this.config);
    this.chat = new AIChat(this.config);
    this.activeStreams = new Map();
    this.requestHistory = [];
  }

  /**
   * Get default model based on provider
   */
  getDefaultModel(provider) {
    const modelMap = {
      claude: 'claude-3-5-sonnet-20241022',
      gpt: 'gpt-4o-2026-04-29'
    };
    return modelMap[provider] || modelMap.claude;
  }

  /**
   * Auto-select best model based on capabilities and cost
   */
  async selectBestModel(taskType, constraints = {}) {
    const modelScores = {
      'claude-3-5-sonnet-20241022': { reasoning: 9, coding: 10, speed: 7, cost: 6 },
      'claude-3-5-haiku-20241022': { reasoning: 6, coding: 7, speed: 10, cost: 10 },
      'claude-3-opus-20240229': { reasoning: 10, coding: 10, speed: 4, cost: 3 },
      'gpt-4o-2026-04-29': { reasoning: 9, coding: 9, speed: 9, cost: 7 },
      'gpt-4-turbo': { reasoning: 8, coding: 8, speed: 7, cost: 6 },
      'gpt-3.5-turbo': { reasoning: 5, coding: 6, speed: 10, cost: 10 }
    };

    const weights = {
      'completion': { coding: 0.6, speed: 0.3, cost: 0.1 },
      'refactoring': { coding: 0.5, reasoning: 0.4, cost: 0.1 },
      'explanation': { reasoning: 0.5, coding: 0.3, cost: 0.2 },
      'chat': { reasoning: 0.4, speed: 0.4, cost: 0.2 },
      'inline-suggestion': { speed: 0.5, coding: 0.4, cost: 0.1 }
    };

    const taskWeights = weights[taskType] || weights.chat;
    let bestModel = 'claude-3-5-sonnet-20241022';
    let bestScore = 0;

    for (const [model, scores] of Object.entries(modelScores)) {
      let score = 0;
      for (const [factor, weight] of Object.entries(taskWeights)) {
        score += scores[factor] * weight;
      }
      
      // Respect constraints
      if (constraints.maxCost && modelScores[model].cost < constraints.maxCost * 10) {
        continue;
      }
      if (constraints.minSpeed && modelScores[model].speed < constraints.minSpeed) {
        continue;
      }

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    return bestModel;
  }

  /**
   * Generate inline code completion
   */
  async completeInline(prompt, context = {}) {
    const startTime = Date.now();
    const enhancedPrompt = this.buildInlinePrompt(prompt, context);
    
    try {
      const result = await this.completion.generate(enhancedPrompt, {
        maxTokens: context.maxTokens || 128,
        temperature: 0.1,
        stream: this.config.streaming
      });

      if (this.config.costTracking) {
        const duration = Date.now() - startTime;
        this.trackRequest('inline-completion', result.usage, duration);
      }

      return result;
    } catch (error) {
      console.error('Inline completion failed:', error);
      throw error;
    }
  }

  /**
   * Stream inline suggestions
   */
  async streamInlineSuggestions(prompt, context = {}, onChunk) {
    const streamId = context.requestId || `stream_${Date.now()}`;
    const enhancedPrompt = this.buildInlinePrompt(prompt, context);
    
    const stream = await this.completion.stream(enhancedPrompt, {
      maxTokens: context.maxTokens || 128,
      temperature: 0.1
    });

    this.activeStreams.set(streamId, stream);

    try {
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        onChunk(chunk, { fullResponse, streamId });
      }
      
      return { response: fullResponse, streamId };
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Chat-based assistance
   */
  async chatWithAI(messages, context = {}) {
    const startTime = Date.now();
    
    // Add context to messages
    const enhancedMessages = await this.buildChatContext(messages, context);
    
    const result = await this.chat.sendMessage(enhancedMessages, {
      temperature: context.temperature || 0.7,
      maxTokens: context.maxTokens || this.config.maxTokens,
      stream: false
    });

    if (this.config.costTracking) {
      const duration = Date.now() - startTime;
      this.trackRequest('chat', result.usage, duration);
    }

    return result;
  }

  /**
   * Stream chat response
   */
  async streamChat(messages, context = {}, onChunk) {
    const enhancedMessages = await this.buildChatContext(messages, context);
    
    const stream = await this.chat.sendMessage(enhancedMessages, {
      temperature: context.temperature || 0.7,
      maxTokens: context.maxTokens || this.config.maxTokens,
      stream: true
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
      onChunk(chunk, { fullResponse });
    }

    return { response: fullResponse };
  }

  /**
   * Explain code
   */
  async explainCode(code, language, options = {}) {
    const prompt = this.buildExplanationPrompt(code, language, options);
    const result = await this.chatWithAI([
      { role: 'system', content: 'You are an expert code explainer. Break down complex code into simple, understandable explanations.' },
      { role: 'user', content: prompt }
    ], {
      maxTokens: options.maxTokens || 1000,
      temperature: 0.3
    });

    return result;
  }

  /**
   * Auto-refactoring
   */
  async refactorCode(code, language, requirements = {}, options = {}) {
    const prompt = this.buildRefactoringPrompt(code, language, requirements);
    const result = await this.chatWithAI([
      { role: 'system', content: 'You are an expert code refactorer. Improve code quality while maintaining functionality.' },
      { role: 'user', content: prompt }
    ], {
      maxTokens: options.maxTokens || 2000,
      temperature: 0.2
    });

    return result;
  }

  /**
   * Generate code completion with context
   */
  async generateCode(prompt, context = {}) {
    const enhancedPrompt = this.buildCodePrompt(prompt, context);
    const result = await this.completion.generate(enhancedPrompt, {
      maxTokens: context.maxTokens || 512,
      temperature: context.temperature || 0.3,
      stream: this.config.streaming
    });

    return result;
  }

  /**
   * Build inline completion prompt
   */
  buildInlinePrompt(prompt, context) {
    let fullPrompt = `Complete this code:

${prompt}

`;

    if (context.filePath) {
      fullPrompt += `File: ${context.filePath}\n`;
    }
    if (context.language) {
      fullPrompt += `Language: ${context.language}\n`;
    }
    if (context.surroundingCode) {
      fullPrompt += `Context:\n${context.surroundingCode}\n`;
    }

    return fullPrompt.trim();
  }

  /**
   * Build explanation prompt
   */
  buildExplanationPrompt(code, language, options) {
    let prompt = `Explain the following ${language} code:\n\n${code}\n\n`;
    
    if (options.focus) {
      prompt += `Focus on: ${options.focus}\n`;
    }
    if (options.audience) {
      prompt += `Target audience: ${options.audience}\n`;
    }
    if (options.level) {
      prompt += `Explanation level: ${options.level}\n`;
    }

    return prompt.trim();
  }

  /**
   * Build refactoring prompt
   */
  buildRefactoringPrompt(code, language, requirements) {
    let prompt = `Refactor this ${language} code:\n\n${code}\n\n`;
    
    if (requirements.goals) {
      prompt += `Goals:\n${requirements.goals.map(g => `- ${g}`).join('\n')}\n\n`;
    }
    if (requirements.constraints) {
      prompt += `Constraints:\n${requirements.constraints.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    prompt += `Please provide:\n1. Refactored code\n2. Explanation of changes\n3. Benefits of the refactoring`;

    return prompt.trim();
  }

  /**
   * Build code generation prompt
   */
  buildCodePrompt(prompt, context) {
    let fullPrompt = prompt;

    if (context.requirements) {
      fullPrompt += `\n\nRequirements:\n${context.requirements.join('\n')}`;
    }
    if (context.examples) {
      fullPrompt += `\n\nExamples:\n${context.examples.join('\n')}`;
    }

    return fullPrompt.trim();
  }

  /**
   * Build chat context with privacy considerations
   */
  async buildChatContext(messages, context = {}) {
    if (this.config.privacyMode) {
      // Remove or anonymize sensitive information
      messages = messages.map(msg => ({
        ...msg,
        content: this.sanitizeContent(msg.content)
      }));
    }

    // Add context files if provided
    if (context.files && context.files.length > 0) {
      const fileContext = await this.contextManager.loadContext(context.files);
      messages.unshift({
        role: 'system',
        content: `Context files:\n${fileContext}`
      });
    }

    return messages;
  }

  /**
   * Sanitize content for privacy mode
   */
  sanitizeContent(content) {
    // Remove or mask sensitive patterns
    return content
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');
  }

  /**
   * Track request for cost and usage analytics
   */
  trackRequest(type, usage, duration) {
    const request = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      duration,
      model: this.config.model,
      usage,
      cost: this.tokenTracker.calculateCost(usage.inputTokens, usage.outputTokens, this.config.model)
    };

    this.requestHistory.push(request);
    this.tokenTracker.track(request);

    return request;
  }

  /**
   * Cancel active stream
   */
  cancelStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.cancel();
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return this.tokenTracker.getStats();
  }

  /**
   * Get request history
   */
  getRequestHistory(limit = 100) {
    return this.requestHistory.slice(-limit);
  }

  /**
   * Set custom prompt template
   */
  setCustomPrompt(name, template) {
    this.config.customPrompts[name] = template;
  }

  /**
   * Get custom prompt
   */
  getCustomPrompt(name) {
    return this.config.customPrompts[name];
  }

  /**
   * Switch provider/model
   */
  switchProvider(provider, model = null) {
    this.config.provider = provider;
    this.config.model = model || this.getDefaultModel(provider);
    
    // Reinitialize services with new config
    this.completion = new AICompletion(this.config);
    this.chat = new AIChat(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    
    // Reinitialize if provider or model changed
    if (updates.provider || updates.model) {
      this.switchProvider(this.config.provider, this.config.model);
    }
  }

  /**
   * Clear request history
   */
  clearHistory() {
    this.requestHistory = [];
    this.tokenTracker.clear();
  }
}

export default AICopilot;