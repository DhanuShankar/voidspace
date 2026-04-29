export type GatewayType = 'local' | 'ssh' | 'docker' | 'colab' | 'custom';

export interface GatewayConfig {
  type: GatewayType;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface GatewayExecutionRequest {
  code: string;
  language: string;
  timeout?: number;
  workingDirectory?: string;
  env?: Record<string, string>;
}

export interface GatewayExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
  stdout: string;
  stderr: string;
}

export interface GatewayCapabilities {
  supportsGPU: boolean;
  supportsDocker: boolean;
  maxExecutionTime: number;
  maxMemory: number;
  languages: string[];
  description: string;
}

/**
 * Abstract base gateway - all gateways must implement this interface
 */
export abstract class BaseGateway {
  protected config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse>;
  abstract getCapabilities(): GatewayCapabilities;
  abstract healthCheck(): Promise<boolean>;
  abstract cleanup(): Promise<void>;

  getName(): string {
    return this.config.name;
  }

  getType(): GatewayType {
    return this.config.type;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): GatewayConfig {
    return this.config;
  }

  setConfig(config: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Local Gateway - executes on current machine
 */
export class LocalGateway extends BaseGateway {
  async initialize(): Promise<void> {
    console.log('✓ Local gateway initialized');
  }

  async execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse> {
    const startTime = Date.now();

    try {
      // In Node.js, we'd use child_process
      // For now, return mock response
      return {
        success: true,
        output: `Executed locally: ${request.code}`,
        stdout: `Executed locally: ${request.code}`,
        stderr: '',
        executionTime: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        stdout: '',
        stderr: error.message,
        executionTime: Date.now() - startTime,
        exitCode: 1,
      };
    }
  }

  getCapabilities(): GatewayCapabilities {
    return {
      supportsGPU: false,
      supportsDocker: false,
      maxExecutionTime: 3600,
      maxMemory: 8 * 1024 * 1024 * 1024, // 8GB
      languages: ['python', 'javascript', 'typescript', 'bash'],
      description: 'Execute code on the local machine',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('✓ Local gateway cleaned up');
  }
}

/**
 * SSH Gateway - executes on remote server via SSH
 */
export class SSHGateway extends BaseGateway {
  private sshClient: any = null;

  async initialize(): Promise<void> {
    // SSH2 library would be used here
    console.log('✓ SSH gateway initialized');
  }

  async execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse> {
    const startTime = Date.now();

    try {
      // Would use SSH2 to execute command
      const mockOutput = `Executed via SSH: ${request.code}`;

      return {
        success: true,
        output: mockOutput,
        stdout: mockOutput,
        stderr: '',
        executionTime: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        stdout: '',
        stderr: error.message,
        executionTime: Date.now() - startTime,
        exitCode: 1,
      };
    }
  }

  getCapabilities(): GatewayCapabilities {
    return {
      supportsGPU: true,
      supportsDocker: true,
      maxExecutionTime: 7200,
      maxMemory: 64 * 1024 * 1024 * 1024, // 64GB
      languages: ['python', 'javascript', 'typescript', 'bash', 'java', 'rust', 'go'],
      description: 'Execute code on a remote SSH server',
    };
  }

  async healthCheck(): Promise<boolean> {
    // Would check SSH connection
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('✓ SSH gateway cleaned up');
  }
}

/**
 * Docker Gateway - executes in Docker containers
 */
export class DockerGateway extends BaseGateway {
  private docker: any = null;

  async initialize(): Promise<void> {
    // Docker client would be initialized here
    console.log('✓ Docker gateway initialized');
  }

  async execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse> {
    const startTime = Date.now();

    try {
      // Would use Docker API to create and run container
      const mockOutput = `Executed in Docker: ${request.code}`;

      return {
        success: true,
        output: mockOutput,
        stdout: mockOutput,
        stderr: '',
        executionTime: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        stdout: '',
        stderr: error.message,
        executionTime: Date.now() - startTime,
        exitCode: 1,
      };
    }
  }

  getCapabilities(): GatewayCapabilities {
    return {
      supportsGPU: true,
      supportsDocker: true,
      maxExecutionTime: 3600,
      maxMemory: 16 * 1024 * 1024 * 1024, // 16GB per container
      languages: ['python', 'javascript', 'typescript', 'bash', 'java', 'rust', 'go', 'c', 'cpp'],
      description: 'Execute code inside Docker containers',
    };
  }

  async healthCheck(): Promise<boolean> {
    // Would check Docker daemon status
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('✓ Docker gateway cleaned up');
  }
}

/**
 * Colab Gateway - executes on Google Colab with T4 GPU
 */
export class ColabGateway extends BaseGateway {
  async initialize(): Promise<void> {
    console.log('✓ Colab gateway initialized');
  }

  async execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse> {
    const startTime = Date.now();

    try {
      // Would use ColabKernelBridge to execute code
      const mockOutput = `Executed on Colab T4: ${request.code}`;

      return {
        success: true,
        output: mockOutput,
        stdout: mockOutput,
        stderr: '',
        executionTime: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        stdout: '',
        stderr: error.message,
        executionTime: Date.now() - startTime,
        exitCode: 1,
      };
    }
  }

  getCapabilities(): GatewayCapabilities {
    return {
      supportsGPU: true, // T4 GPU included
      supportsDocker: false,
      maxExecutionTime: 43200, // 12 hours
      maxMemory: 12 * 1024 * 1024 * 1024, // 12GB
      languages: ['python'],
      description: 'Google Colab with T4 GPU (4-12 hours runtime)',
    };
  }

  async healthCheck(): Promise<boolean> {
    // Would check Colab API connectivity
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('✓ Colab gateway cleaned up');
  }
}

/**
 * Custom Gateway - user-defined execution endpoint
 */
export class CustomGateway extends BaseGateway {
  async initialize(): Promise<void> {
    console.log('✓ Custom gateway initialized:', this.config.config.endpoint);
  }

  async execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse> {
    const startTime = Date.now();

    try {
      // Would POST to custom endpoint
      const endpoint = this.config.config.endpoint;
      const mockOutput = `Executed on custom gateway: ${endpoint}`;

      return {
        success: true,
        output: mockOutput,
        stdout: mockOutput,
        stderr: '',
        executionTime: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        stdout: '',
        stderr: error.message,
        executionTime: Date.now() - startTime,
        exitCode: 1,
      };
    }
  }

  getCapabilities(): GatewayCapabilities {
    return {
      supportsGPU: this.config.config.supportsGPU || false,
      supportsDocker: this.config.config.supportsDocker || false,
      maxExecutionTime: this.config.config.maxExecutionTime || 3600,
      maxMemory: this.config.config.maxMemory || 8 * 1024 * 1024 * 1024,
      languages: this.config.config.languages || ['python', 'bash'],
      description: this.config.config.description || 'Custom execution gateway',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('✓ Custom gateway cleaned up');
  }
}

/**
 * Gateway Manager - orchestrates all gateways
 */
export class GatewayManager {
  private gateways: Map<string, BaseGateway> = new Map();
  private activeGateway: BaseGateway | null = null;

  /**
   * Register a gateway
   */
  registerGateway(name: string, gateway: BaseGateway): void {
    this.gateways.set(name, gateway);
    console.log(`✓ Gateway registered: ${name} (${gateway.getType()})`);
  }

  /**
   * Set active gateway
   */
  async setActiveGateway(name: string): Promise<boolean> {
    const gateway = this.gateways.get(name);
    if (!gateway) {
      console.error(`Gateway not found: ${name}`);
      return false;
    }

    if (!gateway.isEnabled()) {
      console.error(`Gateway disabled: ${name}`);
      return false;
    }

    try {
      await gateway.initialize();
      this.activeGateway = gateway;
      console.log(`✓ Active gateway set to: ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to activate gateway ${name}:`, error);
      return false;
    }
  }

  /**
   * Get active gateway
   */
  getActiveGateway(): BaseGateway | null {
    return this.activeGateway;
  }

  /**
   * Execute on active gateway
   */
  async execute(request: GatewayExecutionRequest): Promise<GatewayExecutionResponse> {
    if (!this.activeGateway) {
      return {
        success: false,
        output: '',
        error: 'No active gateway configured',
        stdout: '',
        stderr: 'No active gateway configured',
        executionTime: 0,
        exitCode: 1,
      };
    }

    return this.activeGateway.execute(request);
  }

  /**
   * Get all gateways
   */
  listGateways(): Array<{ name: string; type: GatewayType; enabled: boolean; capabilities: GatewayCapabilities }> {
    return Array.from(this.gateways.entries()).map(([name, gateway]) => ({
      name,
      type: gateway.getType(),
      enabled: gateway.isEnabled(),
      capabilities: gateway.getCapabilities(),
    }));
  }

  /**
   * Get gateway by name
   */
  getGateway(name: string): BaseGateway | undefined {
    return this.gateways.get(name);
  }

  /**
   * Health check all gateways
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, gateway] of this.gateways.entries()) {
      try {
        results[name] = await gateway.healthCheck();
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Cleanup all gateways
   */
  async cleanupAll(): Promise<void> {
    for (const gateway of this.gateways.values()) {
      try {
        await gateway.cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  }

  /**
   * Find best gateway for capabilities
   */
  findBestGateway(requirements: Partial<GatewayCapabilities>): BaseGateway | null {
    let bestGateway: BaseGateway | null = null;
    let bestScore = 0;

    for (const gateway of this.gateways.values()) {
      if (!gateway.isEnabled()) continue;

      const caps = gateway.getCapabilities();
      let score = 0;

      if (requirements.supportsGPU && caps.supportsGPU) score += 10;
      if (requirements.supportsDocker && caps.supportsDocker) score += 5;
      if (requirements.maxExecutionTime && caps.maxExecutionTime >= requirements.maxExecutionTime) score += 3;
      if (
        requirements.languages &&
        requirements.languages.some((lang) => caps.languages.includes(lang))
      )
        score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestGateway = gateway;
      }
    }

    return bestGateway;
  }
}

// Export singleton instance
export const gatewayManager = new GatewayManager();

// Register default gateways
gatewayManager.registerGateway(
  'local',
  new LocalGateway({
    type: 'local',
    name: 'Local Machine',
    description: 'Execute on local machine',
    enabled: true,
    config: {},
  })
);

gatewayManager.registerGateway(
  'colab',
  new ColabGateway({
    type: 'colab',
    name: 'Google Colab (T4 GPU)',
    description: 'Execute on Google Colab with T4 GPU (4-12 hours)',
    enabled: true,
    config: {},
  })
);

gatewayManager.registerGateway(
  'docker',
  new DockerGateway({
    type: 'docker',
    name: 'Docker',
    description: 'Execute in Docker containers',
    enabled: false, // Requires Docker setup
    config: {},
  })
);

gatewayManager.registerGateway(
  'ssh',
  new SSHGateway({
    type: 'ssh',
    name: 'SSH Server',
    description: 'Execute on remote SSH server',
    enabled: false, // Requires SSH configuration
    config: {},
  })
);
