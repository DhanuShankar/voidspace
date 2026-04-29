import { ColabKernelBridge, ColabSession, ExecutionResult } from './colabKernelBridge';
import { GoogleDriveSyncManager } from './googleDriveSync';
import { sessionManager, SessionSnapshot } from './sessionStorage';

export interface ColabSessionConfig {
  userId: string;
  accessToken: string;
  workspaceName: string;
  autoShutdownMinutes?: number;
  enableGPU?: boolean;
  timezone?: string;
}

export interface ColabRuntimeMetrics {
  remainingTime: number;
  executedCells: number;
  totalExecutionTime: number;
  memoryUsed: number;
  gpuUtilization?: number;
}

export class ColabSessionManager {
  private kernel: ColabKernelBridge;
  private driveSync: GoogleDriveSyncManager;
  private config: ColabSessionConfig | null = null;
  private metrics: ColabRuntimeMetrics = {
    remainingTime: 0,
    executedCells: 0,
    totalExecutionTime: 0,
    memoryUsed: 0,
  };
  private shutdownTimer: NodeJS.Timeout | null = null;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private sessionFiles: Map<string, ExecutionResult> = new Map();

  constructor() {
    this.kernel = new ColabKernelBridge();
    this.driveSync = new GoogleDriveSyncManager();
  }

  /**
   * Start a new Colab session with auto-shutdown timer
   */
  async start(config: ColabSessionConfig): Promise<ColabSession> {
    this.config = config;

    try {
      // Initialize kernel bridge
      const session = await this.kernel.initializeSession(config.accessToken);
      console.log(`✓ Colab session started for user: ${config.userId}`);

      // Initialize Google Drive sync
      await this.driveSync.initializeRootFolder(config.workspaceName);
      console.log(`✓ Google Drive folder initialized: ${config.workspaceName}`);

      // Install essential packages
      if (config.enableGPU) {
        await this.setupGPUEnvironment();
      }

      // Start metrics update loop
      this.startMetricsCollection();

      // Setup auto-shutdown timer
      const shutdownMs = (config.autoShutdownMinutes || 720) * 60 * 1000; // Default 12 hours
      this.setupAutoShutdown(shutdownMs);

      // Setup warning timers (notify user at 1hr remaining, 30min, 10min)
      this.setupWarningTimers();

      return session;
    } catch (error) {
      console.error('Failed to start Colab session:', error);
      throw error;
    }
  }

  /**
   * Setup GPU environment for ML/AI workloads
   */
  private async setupGPUEnvironment(): Promise<void> {
    try {
      console.log('🔧 Setting up GPU environment...');

      // Install ML libraries
      await this.kernel.installPackages([
        'torch',
        'torchvision',
        'tensorflow',
        'tensorflow-hub',
        'transformers',
        'numpy',
        'pandas',
        'scipy',
        'scikit-learn',
        'matplotlib',
        'seaborn',
        'jupyter',
        'jupyterlab',
      ]);

      // Verify GPU
      const envInfo = await this.kernel.getEnvironmentInfo();
      console.log('✓ GPU Environment ready:', envInfo);
    } catch (error) {
      console.warn('GPU setup warning:', error);
    }
  }

  /**
   * Execute code in Colab with file tracking
   */
  async executeCode(code: string, language: string = 'python'): Promise<ExecutionResult> {
    if (!this.config) {
      throw new Error('Session not started. Call start() first.');
    }

    try {
      const result = await this.kernel.executeCode(code);

      // Track execution metrics
      this.metrics.executedCells++;
      this.metrics.totalExecutionTime += result.executionTime;
      this.sessionFiles.set(result.cellId, result);

      // Auto-save to Drive every 10 executions
      if (this.metrics.executedCells % 10 === 0) {
        await this.autoSaveSession();
      }

      return result;
    } catch (error) {
      console.error('Execution error:', error);
      throw error;
    }
  }

  /**
   * Upload workspace to Google Drive as backup
   */
  async autoSaveSession(): Promise<string | null> {
    if (!this.config) return null;

    try {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        console.warn('No active session to save');
        return null;
      }

      // Capture all files
      sessionManager.captureFiles([]);

      const snapshot = sessionManager.finalizeSession();
      if (!snapshot) return null;

      // Save to Drive
      const sessionId = await this.driveSync.saveSession({
        sessionId: snapshot.id,
        timestamp: snapshot.timestamp,
        files: snapshot.files.map((f) => ({
          name: f.name,
          content: f.content,
          language: f.language,
        })),
        duration: snapshot.duration,
        notes: snapshot.notes,
      });

      console.log(`✓ Session auto-saved to Drive: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error('Auto-save error:', error);
      return null;
    }
  }

  /**
   * Get current runtime metrics
   */
  async getMetrics(): Promise<ColabRuntimeMetrics> {
    const remaining = this.kernel.getRemainingTime();

    this.metrics.remainingTime = remaining;

    // Get GPU metrics if available
    try {
      const gpuCode = `
import torch
if torch.cuda.is_available():
    print(f"GPU Utilization: {torch.cuda.utilization():.1f}%")
    print(f"Memory Reserved: {torch.cuda.memory_reserved() / 1e9:.2f}GB")
`;
      // Could parse this for GPU metrics
    } catch {}

    return this.metrics;
  }

  /**
   * Get formatted remaining time
   */
  getRemainingTimeFormatted(): string {
    const remaining = this.kernel.getRemainingTime();
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  /**
   * Setup auto-shutdown with warning
   */
  private setupAutoShutdown(ms: number): void {
    this.shutdownTimer = setTimeout(() => {
      console.warn('⚠️  Colab session auto-shutdown triggered');
      this.shutdown();
    }, ms);

    console.log(`✓ Auto-shutdown timer set: ${ms / 1000 / 60} minutes`);
  }

  /**
   * Setup warning notifications at intervals
   */
  private setupWarningTimers(): void {
    const remaining = this.kernel.getRemainingTime();

    // 1 hour warning
    if (remaining > 3600) {
      setTimeout(
        () => console.warn('⚠️  WARNING: 1 hour remaining'),
        (remaining - 3600) * 1000
      );
    }

    // 30 min warning
    if (remaining > 1800) {
      setTimeout(
        () => console.warn('⚠️  WARNING: 30 minutes remaining'),
        (remaining - 1800) * 1000
      );
    }

    // 10 min warning
    if (remaining > 600) {
      setTimeout(
        () => console.warn('⚠️  WARNING: 10 minutes remaining'),
        (remaining - 600) * 1000
      );
    }
  }

  /**
   * Start metrics collection loop
   */
  private startMetricsCollection(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        console.log(`📊 Metrics - Executed: ${metrics.executedCells}, Remaining: ${this.getRemainingTimeFormatted()}`);
      } catch (error) {
        console.warn('Metrics collection error:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Extend session runtime (if possible)
   */
  async extendRuntime(hours: number): Promise<boolean> {
    console.log(`🔄 Session extension requested: +${hours}h`);
    // This would require Colab API support for runtime extension
    // For now, just log the intention
    return false;
  }

  /**
   * Get all session outputs
   */
  getSessionOutputs(): Map<string, ExecutionResult> {
    return this.sessionFiles;
  }

  /**
   * Export session as Jupyter notebook
   */
  async exportAsNotebook(): Promise<string> {
    const notebook = {
      cells: Array.from(this.sessionFiles.values()).map((result) => ({
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [{ output_type: 'stream', name: 'stdout', text: result.output }],
        source: [result.cellId],
      })),
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          version: '3.11.0',
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
    };

    if (this.config && this.driveSync) {
      const notebookJson = JSON.stringify(notebook, null, 2);
      await this.driveSync.saveNotebook(`VOID-Session-${Date.now()}`, notebookJson);
    }

    return JSON.stringify(notebook);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      console.log('🛑 Shutting down Colab session...');

      // Clear intervals
      if (this.shutdownTimer) clearTimeout(this.shutdownTimer);
      if (this.metricsUpdateInterval) clearInterval(this.metricsUpdateInterval);

      // Final save
      await this.autoSaveSession();

      // Restart kernel to free resources
      await this.kernel.restartKernel();

      // Close session
      await this.kernel.closeSession();

      this.config = null;
      this.sessionFiles.clear();

      console.log('✓ Colab session closed');
    } catch (error) {
      console.error('Shutdown error:', error);
    }
  }

  /**
   * Check if session is still active
   */
  isActive(): boolean {
    const info = this.kernel.getSessionInfo();
    return info !== null && info.status === 'active';
  }

  /**
   * Restart kernel and clear outputs
   */
  async restart(): Promise<void> {
    try {
      await this.kernel.restartKernel();
      this.sessionFiles.clear();
      this.metrics.executedCells = 0;
      this.metrics.totalExecutionTime = 0;
      console.log('✓ Kernel restarted and cleared');
    } catch (error) {
      console.error('Restart error:', error);
      throw error;
    }
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    return {
      config: this.config,
      kernelInfo: this.kernel.getSessionInfo(),
      metrics: this.metrics,
      remainingTime: this.getRemainingTimeFormatted(),
      isActive: this.isActive(),
    };
  }
}

export const colabSessionManager = new ColabSessionManager();
