/**
 * AI Code Completion Service
 * Handles code generation, inline suggestions, and streaming responses
 */

const MODEL_ENDPOINTS = {
  claude: 'https://api.anthropic.com/v1/messages',
  gpt: 'https://api.openai.com/v1/chat/completions'
};

const DEFAULT_HEADERS = {
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
  'content-type': 'application/json'
};

export class AICompletion {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'claude',
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.2,
      topP: config.topP || 0.9,
      frequencyPenalty: config.frequencyPenalty || 0,
      presencePenalty: config.presencePenalty || 0,
      stopSequences: config.stopSequences || [],
      ...config
    };

    this.activeRequests = new Map();
  }

  /**
   * Generate completion
   */
  async generate(prompt, options = {}) {
    const startTime = Date.now();
    const config = { ...this.config, ...options };

    const response = await this.makeRequest(prompt, config);
    
    return {
      text: response.text,
      usage: response.usage,
      model: config.model,
      provider: config.provider,
      duration: Date.now() - startTime
    };
  }

  /**
   * Stream completion
   */
  async stream(prompt, options = {}) {
    const config = { ...this.config, ...options };
    
    if (config.provider === 'claude') {
      return this.streamClaude(prompt, config);
    } else {
      return this.streamOpenAI(prompt, config);
    }
  }

  /**
   * Stream Claude (SSE)
   */
  async *streamClaude(prompt, config) {
    const response = await fetch(MODEL_ENDPOINTS.claude, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'x-api-key': config.apiKey,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

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
            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta') {
                const text = event.delta.text;
                fullText += text;
                yield text;
              } else if (event.type === 'message_stop') {
                return {
                  text: fullText,
                  usage: event.usage
                };
              }
            } catch (e) {
              console.warn('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { text: fullText, done: true };
  }

  /**
   * Stream GPT (OpenAI)
   */
  async *streamOpenAI(prompt, config) {
    const response = await fetch(MODEL_ENDPOINTS.gpt, {
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
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        stream: true,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

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
            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data);
              const choices = event.choices;
              if (choices && choices.length > 0) {
                const delta = choices[0].delta;
                if (delta.content) {
                  fullText += delta.content;
                  yield delta.content;
                }
              }
            } catch (e) {
              console.warn('Failed to parse OpenAI stream event:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { text: fullText, done: true };
  }

  /**
   * Make API request
   */
  async makeRequest(prompt, config) {
    if (config.provider === 'claude') {
      return this.requestClaude(prompt, config);
    } else {
      return this.requestOpenAI(prompt, config);
    }
  }

  /**
   * Request Claude API
   */
  async requestClaude(prompt, config) {
    const response = await fetch(MODEL_ENDPOINTS.claude, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'x-api-key': config.apiKey
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
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
   * Request OpenAI API
   */
  async requestOpenAI(prompt, config) {
    const response = await fetch(MODEL_ENDPOINTS.gpt, {
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
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
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
   * Cancel active request
   */
  cancelRequest(requestId) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      request.controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Get available providers
   */
  getProviders() {
    return Object.keys(MODEL_ENDPOINTS);
  }

  /**
   * Get models for provider
   */
  getModels(provider = this.config.provider) {
    const models = {
      claude: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ],
      gpt: [
        'gpt-4o-2026-04-29',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-4o-mini'
      ]
    };

    return models[provider] || [];
  }
}

export default AICompletion;