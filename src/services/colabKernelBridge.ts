import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface ColabSession {
  id: string;
  notebookId: string;
  accessToken: string;
  executingAt: string;
  expiresAt: string;
  status: 'active' | 'idle' | 'expired';
}

export interface ExecutionResult {
  output: string;
  error: string | null;
  executionTime: number;
  cellId: string;
}

export class ColabKernelBridge {
  private session: ColabSession | null = null;
  private baseUrl = 'https://colab.research.google.com';
  private executionQueue: Array<{ code: string; cellId: string; resolve: Function; reject: Function }> = [];
  private isExecuting = false;

  /**
   * Initialize a Colab session by creating a new notebook
   */
  async initializeSession(accessToken: string): Promise<ColabSession> {
    try {
      // Create a new Colab notebook
      const notebookRes = await axios.post(
        'https://www.googleapis.com/drive/v3/files',
        {
          name: `VOID-Session-${Date.now()}`,
          mimeType: 'application/vnd.google-colaboratory+ipynb',
          parents: ['root'],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const notebookId = notebookRes.data.id;
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      this.session = {
        id: uuidv4(),
        notebookId,
        accessToken,
        executingAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'active',
      };

      console.log(`✓ Colab session initialized: ${this.session.id}`);
      console.log(`✓ Runtime: 4-12 hours (expires at ${expiresAt.toLocaleTimeString()})`);

      return this.session;
    } catch (error) {
      console.error('Failed to initialize Colab session:', error);
      throw error;
    }
  }

  /**
   * Execute Python code in Colab
   */
  async executeCode(code: string, cellId: string = uuidv4()): Promise<ExecutionResult> {
    if (!this.session) {
      throw new Error('Colab session not initialized. Call initializeSession first.');
    }

    // Check session expiration
    if (new Date() > new Date(this.session.expiresAt)) {
      this.session.status = 'expired';
      throw new Error('Colab session expired. Please start a new session.');
    }

    return new Promise((resolve, reject) => {
      // Add to queue
      this.executionQueue.push({ code, cellId, resolve, reject });

      // Process queue if not already executing
      if (!this.isExecuting) {
        this.processQueue();
      }
    });
  }

  /**
   * Process execution queue sequentially
   */
  private async processQueue() {
    if (this.isExecuting || this.executionQueue.length === 0) return;

    this.isExecuting = true;
    const { code, cellId, resolve, reject } = this.executionQueue.shift()!;

    try {
      const startTime = Date.now();

      // Send code to Colab backend
      const response = await axios.post(
        `${this.baseUrl}/api/kernel/execute`,
        {
          code,
          cellId,
          notebookId: this.session!.notebookId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.session!.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30s timeout
        }
      );

      const executionTime = Date.now() - startTime;

      const result: ExecutionResult = {
        output: response.data.output || '',
        error: response.data.error || null,
        executionTime,
        cellId,
      };

      console.log(`✓ Code executed in ${executionTime}ms`);
      resolve(result);
    } catch (error: any) {
      console.error('Execution error:', error.message);
      reject({
        output: '',
        error: error.message || 'Execution failed',
        executionTime: Date.now() - Date.now(),
        cellId,
      });
    } finally {
      this.isExecuting = false;
      // Process next in queue
      if (this.executionQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Execute cell by type (code, markdown)
   */
  async executeCell(cellType: 'code' | 'markdown', content: string, cellId?: string): Promise<ExecutionResult> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    const id = cellId || uuidv4();

    if (cellType === 'code') {
      return this.executeCode(content, id);
    } else {
      // Markdown cells don't execute, just return success
      return {
        output: content,
        error: null,
        executionTime: 0,
        cellId: id,
      };
    }
  }

  /**
   * Install Python package in Colab
   */
  async installPackage(packageName: string): Promise<ExecutionResult> {
    const installCode = `!pip install ${packageName}`;
    return this.executeCode(installCode);
  }

  /**
   * Install multiple packages
   */
  async installPackages(packages: string[]): Promise<ExecutionResult[]> {
    const results = [];
    for (const pkg of packages) {
      const result = await this.installPackage(pkg);
      results.push(result);
    }
    return results;
  }

  /**
   * Get current session info
   */
  getSessionInfo(): ColabSession | null {
    if (!this.session) return null;

    const now = new Date();
    const expiry = new Date(this.session.expiresAt);
    const remainingMs = expiry.getTime() - now.getTime();
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ...this.session,
      status: remainingMs > 0 ? 'active' : 'expired',
    };
  }

  /**
   * Get remaining runtime (in seconds)
   */
  getRemainingTime(): number {
    if (!this.session) return 0;

    const now = new Date();
    const expiry = new Date(this.session.expiresAt);
    const remainingMs = Math.max(0, expiry.getTime() - now.getTime());

    return Math.floor(remainingMs / 1000);
  }

  /**
   * Upload file to Colab via Drive
   */
  async uploadFile(
    fileName: string,
    fileContent: string,
    accessToken: string
  ): Promise<{ fileId: string; downloadUrl: string }> {
    try {
      const res = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          name: fileName,
          parents: [this.session!.notebookId],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        fileId: res.data.id,
        downloadUrl: `https://drive.google.com/uc?id=${res.data.id}`,
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Download file from Colab
   */
  async downloadFile(fileId: string, accessToken: string): Promise<string> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  /**
   * Clear all outputs and restart kernel
   */
  async restartKernel(): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    try {
      await axios.post(
        `${this.baseUrl}/api/kernel/restart`,
        { notebookId: this.session.notebookId },
        {
          headers: {
            Authorization: `Bearer ${this.session.accessToken}`,
          },
        }
      );

      console.log('✓ Kernel restarted');
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      throw error;
    }
  }

  /**
   * Interrupt current execution
   */
  async interrupt(): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    try {
      await axios.post(
        `${this.baseUrl}/api/kernel/interrupt`,
        { notebookId: this.session.notebookId },
        {
          headers: {
            Authorization: `Bearer ${this.session.accessToken}`,
          },
        }
      );

      console.log('✓ Kernel interrupted');
      this.executionQueue = [];
      this.isExecuting = false;
    } catch (error) {
      console.error('Failed to interrupt kernel:', error);
      throw error;
    }
  }

  /**
   * Cleanup session
   */
  async closeSession(): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    try {
      console.log(`✓ Closing Colab session: ${this.session.id}`);
      this.session = null;
      this.executionQueue = [];
      this.isExecuting = false;
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  }

  /**
   * Get runtime environment info (Python version, packages, GPU)
   */
  async getEnvironmentInfo(): Promise<any> {
    const code = `
import sys
import torch
import tensorflow as tf
from google.colab import runtime

info = {
    'python_version': sys.version,
    'torch_version': torch.__version__ if 'torch' in dir() else 'N/A',
    'tf_version': tf.__version__ if 'tf' in dir() else 'N/A',
    'gpu_available': torch.cuda.is_available() if 'torch' in dir() else False,
    'gpu_name': torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A',
}
print(info)
`;

    const result = await this.executeCode(code);
    try {
      return JSON.parse(result.output);
    } catch {
      return result.output;
    }
  }
}

export const colabBridge = new ColabKernelBridge();
