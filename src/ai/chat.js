/**
 * AI Chat Service
 * Handles conversational AI with context management and multi-turn dialogues
 */

import { SYSTEM_PROMPTS } from '../config/prompts.js';

export class AIChat {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'claude',
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      topP: config.topP || 0.9,
      ...config
    };

    this.conversations = new Map();
    this.messageHistory = new Map();
  }

  /**
   * Send message and get response
   */
  async sendMessage(messages, options = {}) {
    const config = { ...this.config, ...options };
    const startTime = Date.now();

    // Ensure we have a system prompt
    const hasSystem = messages.some(msg => msg.role === 'system');
    if (!hasSystem && config.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: config.systemPrompt
      });
    } else if (!hasSystem) {
      messages.unshift({
        role: 'system',
        content: SYSTEM_PROMPTS.default
      });
    }

    const response = await this.makeRequest(messages, config);
    
    return {
      text: response.text,
      usage: response.usage,
      model: config.model,
      provider: config.provider,
      duration: Date.now() - startTime
    };
  }

  /**
   * Stream chat response
   */
  async *streamChat(messages, options = {}) {
    const config = { ...this.config, ...options };

    // Add system prompt if not present
    const hasSystem = messages.some(msg => msg.role === 'system');
    if (!hasSystem && config.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: config.systemPrompt
      });
    } else if (!hasSystem) {
      messages.unshift({
        role: 'system',
        content: SYSTEM_PROMPTS.default
      });
    }

    const stream = this.streamRequest(messages, config);
    
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * Start or continue a conversation
   */
  async conversation(conversationId, message, options = {}) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        messages: [],
        createdAt: Date.now(),
        lastUpdate: Date.now()
      });
    }

    const conversation = this.conversations.get(conversationId);
    
    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    // Trim conversation if too long
    this.trimConversation(conversation, options.maxMessages || 50);

    // Get AI response
    const response = await this.sendMessage(conversation.messages, options);

    // Add AI response
    conversation.messages.push({
      role: 'assistant',
      content: response.text,
      timestamp: Date.now()
    });

    conversation.lastUpdate = Date.now();

    return response;
  }

  /**
   * Stream a conversation
   */
  async *streamConversation(conversationId, message, options = {}) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        messages: [],
        createdAt: Date.now(),
        lastUpdate: Date.now()
      });
    }

    const conversation = this.conversations.get(conversationId);
    
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    this.trimConversation(conversation, options.maxMessages || 50);

    const stream = this.streamChat(conversation.messages, options);
    
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
    }

    conversation.messages.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now()
    });

    conversation.lastUpdate = Date.now();
  }

  /**
   * Make API request
   */
  async makeRequest(messages, config) {
    if (config.provider === 'claude') {
      return this.requestClaude(messages, config);
    } else {
      return this.requestOpenAI(messages, config);
    }
  }

  /**
   * Stream request
   */
  async *streamRequest(messages, config) {
    if (config.provider === 'claude') {
      yield* this.streamClaude(messages, config);
    } else {
      yield* this.streamOpenAI(messages, config);
    }
  }

  /**
   * Request Claude
   */
  async requestClaude(messages, config) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      text: data.content[0].text,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  }

  /**
   * Request OpenAI
   */
  async requestOpenAI(messages, config) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      text: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      }
    };
  }

  /**
   * Stream Claude
   */
  async *streamClaude(messages, config) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta.text) {
                yield event.delta.text;
              }
            } catch (e) {
              console.warn('Parse error:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stream OpenAI
   */
  async *streamOpenAI(messages, config) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        stream: true,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              const delta = event.choices[0]?.delta?.content;
              if (delta) {
                yield delta;
              }
            } catch (e) {
              console.warn('Parse error:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Trim conversation history
   */
  trimConversation(conversation, maxMessages) {
    const messageCount = conversation.messages.length;
    if (messageCount > maxMessages) {
      const removeCount = messageCount - maxMessages;
      conversation.messages.splice(0, removeCount);
    }
  }

  /**
   * Clear conversation
   */
  clearConversation(conversationId) {
    this.conversations.delete(conversationId);
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId) {
    return this.conversations.get(conversationId);
  }

  /**
   * Get all conversation IDs
   */
  getConversationIds() {
    return Array.from(this.conversations.keys());
  }

  /**
   * Save message to history
   */
  saveMessage(key, message) {
    if (!this.messageHistory.has(key)) {
      this.messageHistory.set(key, []);
    }
    this.messageHistory.get(key).push({
      ...message,
      timestamp: Date.now()
    });
  }

  /**
   * Get message history
   */
  getMessageHistory(key, limit = 50) {
    const history = this.messageHistory.get(key) || [];
    return history.slice(-limit);
  }

  /**
   * Clear message history
   */
  clearMessageHistory(key) {
    if (key) {
      this.messageHistory.delete(key);
    } else {
      this.messageHistory.clear();
    }
  }

  /**
   * Update system prompt for conversation
   */
  setSystemPrompt(conversationId, systemPrompt) {
    if (this.conversations.has(conversationId)) {
      const conversation = this.conversations.get(conversationId);
      // Replace or add system message
      const systemIndex = conversation.messages.findIndex(m => m.role === 'system');
      if (systemIndex >= 0) {
        conversation.messages[systemIndex].content = systemPrompt;
      } else {
        conversation.messages.unshift({
          role: 'system',
          content: systemPrompt,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Get conversation stats
   */
  getConversationStats(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const userMessages = conversation.messages.filter(m => m.role === 'user').length;
    const assistantMessages = conversation.messages.filter(m => m.role === 'assistant').length;

    return {
      messageCount: conversation.messages.length,
      userMessages,
      assistantMessages,
      createdAt: conversation.createdAt,
      lastUpdate: conversation.lastUpdate,
      age: Date.now() - conversation.createdAt
    };
  }
}

export default AIChat;