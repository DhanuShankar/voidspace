export interface CodeCompletionRequest {
  code: string;
  language: string;
  context: string;
  cursorPosition: number;
}

export interface CodeCompletionResponse {
  suggestions: string[];
  bestMatch: string;
  score: number;
  documentation?: string;
}

export interface CodeGenerationRequest {
  prompt: string;
  language: string;
  context?: string;
}

export interface CodeGenerationResponse {
  code: string;
  explanation: string;
  language: string;
}

export class AICodeCompletionService {
  private baseUrl = '/api/ai';

  /**
   * Get code completion suggestions
   */
  async getCompletions(request: CodeCompletionRequest): Promise<CodeCompletionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) throw new Error('Completion request failed');

      return response.json();
    } catch (error) {
      console.error('Completion error:', error);
      throw error;
    }
  }

  /**
   * Generate code from comment/prompt
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    try {
      const systemPrompt = `You are an expert code generator. Generate clean, well-structured, and efficient ${request.language} code.`;

      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: request.prompt }],
          system: systemPrompt,
        }),
      });

      if (!response.ok) throw new Error('Generation request failed');

      // Handle streaming response
      const reader = response.body?.getReader();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              fullResponse += data.text || '';
            }
          }
        }
      }

      return {
        code: fullResponse,
        explanation: `Generated ${request.language} code from prompt`,
        language: request.language,
      };
    } catch (error) {
      console.error('Generation error:', error);
      throw error;
    }
  }

  /**
   * Get code explanation
   */
  async explainCode(code: string, language: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Explain this ${language} code in detail:\n\n${code}`,
            },
          ],
          system: 'You are a code explanation expert. Provide clear, detailed explanations.',
        }),
      });

      if (!response.ok) throw new Error('Explanation request failed');

      const reader = response.body?.getReader();
      let explanation = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              explanation += data.text || '';
            }
          }
        }
      }

      return explanation;
    } catch (error) {
      console.error('Explanation error:', error);
      throw error;
    }
  }

  /**
   * Fix code errors
   */
  async fixCode(code: string, language: string, error: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Fix this ${language} code error:\n\nCode:\n${code}\n\nError:\n${error}`,
            },
          ],
          system: 'You are a code debugger. Fix the error and return only the corrected code.',
        }),
      });

      if (!response.ok) throw new Error('Fix request failed');

      const reader = response.body?.getReader();
      let fixedCode = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              fixedCode += data.text || '';
            }
          }
        }
      }

      return fixedCode;
    } catch (error) {
      console.error('Fix error:', error);
      throw error;
    }
  }

  /**
   * Generate commit message from code changes
   */
  async generateCommitMessage(diff: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate a concise, professional Git commit message for this diff:\n\n${diff}`,
            },
          ],
          system: 'Generate a short, meaningful commit message (under 50 chars for subject line).',
        }),
      });

      if (!response.ok) throw new Error('Commit message generation failed');

      const reader = response.body?.getReader();
      let message = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              message += data.text || '';
            }
          }
        }
      }

      return message.trim();
    } catch (error) {
      console.error('Commit message error:', error);
      throw error;
    }
  }

  /**
   * Optimize code for performance
   */
  async optimizeCode(code: string, language: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Optimize this ${language} code for performance and readability:\n\n${code}`,
            },
          ],
          system:
            'You are a code optimization expert. Return only the optimized code without explanation.',
        }),
      });

      if (!response.ok) throw new Error('Optimization request failed');

      const reader = response.body?.getReader();
      let optimized = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              optimized += data.text || '';
            }
          }
        }
      }

      return optimized;
    } catch (error) {
      console.error('Optimization error:', error);
      throw error;
    }
  }

  /**
   * Generate unit tests
   */
  async generateTests(code: string, language: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate comprehensive unit tests for this ${language} code:\n\n${code}`,
            },
          ],
          system: `Generate unit tests in ${language} using appropriate testing frameworks.`,
        }),
      });

      if (!response.ok) throw new Error('Test generation failed');

      const reader = response.body?.getReader();
      let tests = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              tests += data.text || '';
            }
          }
        }
      }

      return tests;
    } catch (error) {
      console.error('Test generation error:', error);
      throw error;
    }
  }
}

export const aiCompletion = new AICodeCompletionService();
