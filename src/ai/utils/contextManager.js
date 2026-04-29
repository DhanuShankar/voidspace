/**
 * Context Manager - Manages AI context window and file indexing
 */

export class ContextManager {
  constructor(config = {}) {
    this.config = {
      maxContextSize: config.maxContextSize || 16384,
      compressionEnabled: config.compressionEnabled !== undefined ? config.compressionEnabled : true,
      similarityThreshold: config.similarityThreshold || 0.7,
      ...config
    };

    this.fileIndex = new Map();
    this.contextCache = new Map();
    this.tokenEstimates = new Map();
  }

  /**
   * Load and index files for context
   */
  async loadContext(filePaths) {
    const files = await this.readFiles(filePaths);
    const indexed = await this.indexFiles(files);
    return this.buildContext(indexed);
  }

  /**
   * Read files
   */
  async readFiles(filePaths) {
    const files = [];
    
    for (const filePath of filePaths) {
      try {
        // This would use actual file system in implementation
        const content = await this.fetchFileContent(filePath);
        files.push({
          path: filePath,
          content,
          language: this.detectLanguage(filePath),
          size: content.length,
          tokens: this.estimateTokens(content)
        });
      } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error);
      }
    }

    return files;
  }

  /**
   * Index files for similarity search
   */
  async indexFiles(files) {
    const indexed = [];

    for (const file of files) {
      const chunks = this.chunkContent(file.content, 512);
      const embeddings = await this.embedChunks(chunks);
      
      this.fileIndex.set(file.path, {
        file,
        chunks,
        embeddings,
        indexedAt: Date.now()
      });

      indexed.push({
        path: file.path,
        file,
        chunkCount: chunks.length
      });
    }

    return indexed;
  }

  /**
   * Build context string
   */
  buildContext(indexedFiles) {
    const context = [];

    for (const indexed of indexedFiles) {
      context.push(`\n=== File: ${indexed.path} ===\n`);
      context.push(this.truncateContent(indexed.file.content, 1000));
    }

    return context.join('\n');
  }

  /**
   * Find relevant context for query
   */
  async findRelevantContext(query, maxTokens = 1024) {
    const relevantChunks = [];
    let totalTokens = 0;

    const queryEmbedding = await this.embed(query);

    for (const [path, index] of this.fileIndex) {
      for (let i = 0; i < index.chunks.length; i++) {
        const similarity = this.cosineSimilarity(queryEmbedding, index.embeddings[i]);
        
        if (similarity > this.config.similarityThreshold) {
          const chunkTokens = this.estimateTokens(index.chunks[i]);
          
          if (totalTokens + chunkTokens <= maxTokens) {
            relevantChunks.push({
              path,
              chunk: index.chunks[i],
              similarity,
              tokens: chunkTokens
            });
            totalTokens += chunkTokens;
          }
        }
      }
    }

    relevantChunks.sort((a, b) => b.similarity - a.similarity);

    return {
      chunks: relevantChunks,
      totalTokens,
      context: this.formatRelevantChunks(relevantChunks)
    };
  }

  /**
   * Compress context
   */
  compressContext(context, targetTokens) {
    if (!this.config.compressionEnabled) return context;

    const currentTokens = this.estimateTokens(context);
    if (currentTokens <= targetTokens) return context;

    const ratio = targetTokens / currentTokens;
    const compressed = this.truncateContent(context, Math.floor(context.length * ratio));

    return compressed;
  }

  /**
   * Manage context window
   */
  manageContextWindow(messages, maxTokens) {
    let totalTokens = this.estimateContextTokens(messages);

    if (totalTokens <= maxTokens) {
      return messages;
    }

    // Compress older messages
    const managed = [...messages];
    
    for (let i = 0; i < managed.length; i++) {
      if (totalTokens <= maxTokens) break;

      const msg = managed[i];
      if (msg.role !== 'system') {
        const originalTokens = this.estimateTokens(msg.content);
        const compressed = this.compressContext(msg.content, Math.floor(originalTokens * 0.5));
        const newTokens = this.estimateTokens(compressed);
        
        msg.content = compressed;
        msg.compressed = true;
        totalTokens -= (originalTokens - newTokens);
      }
    }

    // If still too large, remove oldest messages
    while (totalTokens > maxTokens && managed.length > 2) {
      const removed = managed.splice(1, 1)[0]; // Keep system message
      totalTokens -= this.estimateTokens(removed.content);
    }

    return managed;
  }

  /**
   * Add to cache
   */
  addToCache(key, value, maxAge = 3600000) {
    this.contextCache.set(key, {
      value,
      timestamp: Date.now(),
      maxAge
    });
  }

  /**
   * Get from cache
   */
  getFromCache(key) {
    const cached = this.contextCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.maxAge) {
      this.contextCache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.contextCache.clear();
  }

  /**
   * Estimate tokens
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate context tokens
   */
  estimateContextTokens(messages) {
    return messages.reduce((total, msg) => total + this.estimateTokens(msg.content), 0);
  }

  /**
   * Chunk content
   */
  chunkContent(content, maxChunkSize) {
    const chunks = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if (this.estimateTokens(currentChunk + line) > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      currentChunk += line + '\n';
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Truncate content
   */
  truncateContent(content, maxLength) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '\n... [truncated]';
  }

  /**
   * Format relevant chunks
   */
  formatRelevantChunks(chunks) {
    return chunks.map(c => `\n[${c.path}] (${c.similarity.toFixed(2)})\n${c.chunk}`).join('\n');
  }

  /**
   * Cosine similarity
   */
  cosineSimilarity(a, b) {
    if (!a || !b) return 0;
    const dot = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB) || 0;
  }

  /**
   * Embed text (placeholder for actual embedding)
   */
  async embed(text) {
    // Placeholder for actual embedding generation
    const hash = this.hashString(text);
    const embedding = [];
    for (let i = 0; i < 384; i++) {
      embedding.push(((hash >> i) & 1) * 2 - 1);
    }
    return embedding;
  }

  /**
   * Embed chunks
   */
  async embedChunks(chunks) {
    const embeddings = [];
    for (const chunk of chunks) {
      embeddings.push(await this.embed(chunk));
    }
    return embeddings;
  }

  /**
   * Detect language
   */
  detectLanguage(filePath) {
    const ext = filePath.split('.').pop();
    const langMap = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'c++',
      c: 'c',
      cs: 'c#',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin'
    };
    return langMap[ext] || 'text';
  }

  /**
   * Hash string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Fetch file content (placeholder)
   */
  async fetchFileContent(filePath) {
    // This would use fs.readFile in actual implementation
    return `// Content of ${filePath}\n// Placeholder for file content`;
  }

  /**
   * Clear index
   */
  clearIndex() {
    this.fileIndex.clear();
    this.contextCache.clear();
  }

  /**
   * Remove file from index
   */
  removeFromIndex(filePath) {
    this.fileIndex.delete(filePath);
  }

  /**
   * Get index stats
   */
  getIndexStats() {
    let totalFiles = 0;
    let totalChunks = 0;
    let totalTokens = 0;

    for (const [path, index] of this.fileIndex) {
      totalFiles++;
      totalChunks += index.chunks.length;
      totalTokens += this.estimateTokens(index.file.content);
    }

    return {
      files: totalFiles,
      chunks: totalChunks,
      estimatedTokens: totalTokens,
      cacheSize: this.contextCache.size
    };
  }
}

export default ContextManager;