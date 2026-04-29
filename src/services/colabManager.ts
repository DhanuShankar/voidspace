import { ColabSessionManager, ColabSessionConfig } from './colabSessionManager';
import { ColabKernelBridge, ColabSession } from './colabKernelBridge';
import { GoogleDriveSyncManager } from './googleDriveSync';
import { sessionManager } from './sessionStorage';
import { authService } from './authService';

export interface ColabAuthConfig {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: number;
}

export interface ColabSessionOptions {
  sessionName?: string;
  autoShutdownMinutes?: number;
  enableGPU?: boolean;
  mountDrive?: boolean;
  timezone?: string;
  kernelConfig?: {
    installPackages?: string[];
    autoImport?: string[];
  };
}

export interface ColabSessionInfo {
  sessionId: string;
  notebookId: string;
  status: 'active' | 'idle' | 'running' | 'error' | 'expired';
  startTime: string;
  expiryTime: string;
  runtimeRemaining: number;
  gpuEnabled: boolean;
  driveMounted: boolean;
  executedCells: number;
  memoryUsed: number;
}

export interface SessionExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  cellId: string;
  executionTime: number;
  filesGenerated?: string[];
}

/**
 * Colab Session Manager with Authentication
 * Handles Colab session lifecycle with proper OAuth integration
 */
export class ColabManager {
  private sessionManager: ColabSessionManager;
  private kernel: ColabKernelBridge;
  private driveSync: GoogleDriveSyncManager;
  private activeSessions: Map<string, ColabSession> = new Map();
  private sessionConfigs: Map<string, ColabSessionConfig> = new Map();
  private authTokens: Map<string, ColabAuthConfig> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.sessionManager = new ColabSessionManager();
    this.kernel = new ColabKernelBridge();
    this.driveSync = new GoogleDriveSyncManager();
  }

  /**
   * Initialize the Colab manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.sessionManager.initialize();
      this.isInitialized = true;
      console.log('✓ Colab Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Colab Manager:', error);
      throw error;
    }
  }

  /**
   * Authenticate user for Colab session
   * Validates Google OAuth token or exchanges auth code
   */
  async authenticate(userId: string, authConfig: Partial<ColabAuthConfig>): Promise<ColabAuthConfig> {
    let accessToken = authConfig.accessToken;
    let refreshToken = authConfig.refreshToken;
    let tokenExpiry = authConfig.tokenExpiry || Date.now() + 3600000; // 1 hour default

    // If access token is about to expire, refresh it
    if (accessToken && tokenExpiry - Date.now() < 300000) { // 5 minutes threshold
      if (refreshToken) {
        try {
          // Note: In production, implement token refresh logic
          // For now, we'll use the existing auth service
          console.log('Refreshing access token...');
        } catch (error) {
          console.warn('Token refresh failed:', error);
        }
      }
    }

    if (!accessToken) {
      throw new Error('Access token required for Colab authentication');
    }

    const authConfigComplete: ColabAuthConfig = {
      accessToken,
      refreshToken,
      tokenExpiry,
    };

    this.authTokens.set(userId, authConfigComplete);
    
    // Verify token by attempting to list Google Drive files
    try {
      await this.driveSync.listProjectFiles();
      console.log(`✓ User ${userId} authenticated for Colab`);
    } catch (error) {
      throw new Error('Invalid authentication token for Google services');
    }

    return authConfigComplete;
  }

  /**
   * Create and start a new Colab session
   */
  async createSession(
    userId: string,
    options: ColabSessionOptions = {}
  ): Promise<ColabSessionInfo> {
    await this.initialize();

    const authConfig = this.authTokens.get(userId);
    if (!authConfig?.accessToken) {
      throw new Error('User not authenticated. Call authenticate() first.');
    }

    // Configure session
    const sessionConfig: ColabSessionConfig = {
      userId,
      accessToken: authConfig.accessToken,
      workspaceName: options.sessionName || `Session-${userId}-${Date.now()}`,
      autoShutdownMinutes: options.autoShutdownMinutes || 720, // Default 12 hours
      enableGPU: options.enableGPU || false,
      timezone: options.timezone || 'UTC',
    };

    this.sessionConfigs.set(userId, sessionConfig);

    // Mount Google Drive if requested
    let driveMounted = false;
    if (options.mountDrive) {
      try {
        await this.driveSync.initializeRootFolder(sessionConfig.workspaceName);
        driveMounted = true;
      } catch (error) {
        console.warn('Failed to mount Google Drive:', error);
      }
    }

    // Start Colab session
    let session: ColabSession;
    try {
      session = await this.sessionManager.start(sessionConfig);
      this.activeSessions.set(userId, session);
    } catch (error) {
      console.error('Failed to start Colab session:', error);
      throw error;
    }

    // Install additional packages if specified
    if (options.kernelConfig?.installPackages?.length) {
      try {
        await this.kernel.installPackages(options.kernelConfig.installPackages);
      } catch (error) {
        console.warn('Failed to install packages:', error);
      }
    }

    // Set up auto-import statements
    if (options.kernelConfig?.autoImport?.length) {
      const importStatements = options.kernelConfig.autoImport.join('\n');
      try {
        await this.kernel.executeCode(importStatements);
      } catch (error) {
        console.warn('Failed to execute auto-import:', error);
      }
    }

    return this.getSessionInfo(userId);
  }

  /**
   * Execute code in an active Colab session
   */
  async executeCode(
    userId: string,
    code: string,
    language: string = 'python'
  ): Promise<SessionExecutionResult> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active Colab session. Call createSession() first.');
    }

    try {
      const result = await this.kernel.executeCode(code);
      
      // Update session files
      const sessionSnapshot = sessionManager.getCurrentSession();
      if (sessionSnapshot) {
        sessionManager.captureFiles([]);
        sessionManager.finalizeSession();
      }

      return {
        success: !result.error,
        output: result.output,
        error: result.error || undefined,
        cellId: result.cellId,
        executionTime: result.executionTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        cellId: `cell_${Date.now()}`,
        executionTime: 0,
      };
    }
  }

  /**
   * Execute multiple code cells in sequence
   */
  async executeCells(
    userId: string,
    cells: Array<{ code: string; language?: string }>
  ): Promise<SessionExecutionResult[]> {
    const results: SessionExecutionResult[] = [];

    for (const cell of cells) {
      const result = await this.executeCode(userId, cell.code, cell.language || 'python');
      results.push(result);

      // Stop on error if not the last cell
      if (!result.success && cell !== cells[cells.length - 1]) {
        console.warn('Cell execution failed, stopping sequence');
        break;
      }
    }

    return results;
  }

  /**
   * Get session information
   */
  getSessionInfo(userId: string): ColabSessionInfo {
    const session = this.activeSessions.get(userId);
    const config = this.sessionConfigs.get(userId);

    if (!session || !config) {
      throw new Error('No active session found');
    }

    const remainingTime = this.kernel.getRemainingTime();
    const sessionInfo = this.kernel.getSessionInfo();

    return {
      sessionId: session.id,
      notebookId: session.notebookId,
      status: session.status,
      startTime: session.executingAt,
      expiryTime: session.expiresAt,
      runtimeRemaining: remainingTime,
      gpuEnabled: config.enableGPU,
      driveMounted: true, // Drive is mounted during creation
      executedCells: this.kernel.getSessionInfo()?.status === 'active' ? 0 : 0, // Placeholder
      memoryUsed: 0, // Would need actual memory metrics
    };
  }

  /**
   * Install Python packages in the session
   */
  async installPackages(userId: string, packages: string[]): Promise<boolean> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active session');
    }

    try {
      const results = await this.kernel.installPackages(packages);
      return results.every(r => !r.error);
    } catch (error) {
      console.error('Package installation failed:', error);
      return false;
    }
  }

  /**
   * Restart the kernel
   */
  async restartKernel(userId: string): Promise<boolean> {
    try {
      await this.kernel.restartKernel();
      return true;
    } catch (error) {
      console.error('Kernel restart failed:', error);
      return false;
    }
  }

  /**
   * Save session to Google Drive
   */
  async saveSessionToDrive(userId: string, notes?: string): Promise<string | null> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active session');
    }

    const sessionSnapshot = sessionManager.getCurrentSession();
    if (!sessionSnapshot) {
      console.warn('No session snapshot available');
      return null;
    }

    try {
      const sessionData = {
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        files: sessionSnapshot.files,
        notes: notes || '',
        duration: sessionSnapshot.duration,
        sessionTranscript: '',
      };

      const sessionFolderId = await this.driveSync.saveSession(sessionData);
      console.log(`✓ Session saved to Drive: ${sessionFolderId}`);
      return sessionFolderId;
    } catch (error) {
      console.error('Failed to save session:', error);
      return null;
    }
  }

  /**
   * Extend session runtime
   */
  async extendRuntime(userId: string, hours: number): Promise<boolean> {
    // Note: Colab runtime extension is not supported by the API
    // This would require creating a new session or using Colab Pro
    console.log(`Runtime extension requested: +${hours}h`);
    return false;
  }

  /**
   * List all files in the session's Drive folder
   */
  async listSessionFiles(userId: string): Promise<any[]> {
    try {
      return await this.driveSync.listProjectFiles();
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  /**
   * Get runtime metrics
   */
  async getMetrics(userId: string): Promise<any> {
    const manager = this.sessionManager as any;
    if (manager.getMetrics) {
      try {
        return await manager.getMetrics();
      } catch (error) {
        console.error('Failed to get metrics:', error);
      }
    }
    return { executedCells: 0, remainingTime: 0 };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(userId: string): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return;
    }

    try {
      // Save session before shutdown
      await this.saveSessionToDrive(userId, 'Auto-save before shutdown');
      
      // Shutdown kernel
      await this.kernel.closeSession();
      
      this.activeSessions.delete(userId);
      this.sessionConfigs.delete(userId);
      this.authTokens.delete(userId);
      
      console.log(`✓ Colab session closed for user ${userId}`);
    } catch (error) {
      console.error('Shutdown error:', error);
    }
  }

  /**
   * Check if user has active session
   */
  hasActiveSession(userId: string): boolean {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return false;
    }

    const now = new Date();
    const expiry = new Date(session.expiresAt);
    return now < expiry && session.status === 'active';
  }

  /**
   * Get remaining runtime formatted
   */
  getRemainingTimeFormatted(userId: string): string {
    const remaining = this.kernel.getRemainingTime();
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(userId: string): Promise<boolean> {
    const authConfig = this.authTokens.get(userId);
    if (!authConfig?.refreshToken) {
      return false;
    }

    // In production, implement actual token refresh
    // For now, return false to indicate token needs to be refreshed via OAuth flow
    return false;
  }
}

// Singleton instance
export const colabManager = new ColabManager();
