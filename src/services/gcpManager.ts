import { google, Auth } from 'googleapis';
import { getAuthClient, generateAuthUrl, getTokenFromCode } from './googleAuth';
import { ColabSessionManager } from './colabSessionManager';
import { GoogleDriveSyncManager } from './googleDriveSync';
import { GatewayManager } from './gatewayManager';

export interface GCPProject {
  projectId: string;
  projectNumber: string;
  name: string;
  lifecycleState: 'ACTIVE' | 'DELETE_REQUESTED' | 'DELETE_IN_PROGRESS' | 'UNSPECIFIED';
  createTime: string;
}

export interface GCPResource {
  id: string;
  name: string;
  type: string;
  zone?: string;
  region?: string;
  status: string;
  createdAt: string;
}

export interface GCPQuota {
  metric: string;
  limit: number;
  usage: number;
  unit: string;
}

export interface GCPInstanceConfig {
  machineType: string;
  zone: string;
  diskSizeGb: number;
  gpuType?: string;
  gpuCount?: number;
  preemptible?: boolean;
}

export interface GCPColabConfig {
  enableT4GPU: boolean;
  runtimeDurationHours: number;
  autoMountDrive: boolean;
  workspaceName: string;
}

interface MultiTask {
  id: string;
  type: 'colab' | 'compute' | 'storage' | 'ai';
  code?: string;
  language?: string;
  config?: any;
  dependencies?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

/**
 * Google Cloud Platform Manager
 * Handles GCP project management, resource provisioning, and multi-task execution
 */
export class GCPManager {
  private authClient: Auth.OAuth2Client;
  private compute: any;
  private projects: any;
  private colabManager: ColabSessionManager;
  private driveSync: GoogleDriveSyncManager;
  private gatewayManager: GatewayManager;
  private activeTasks: Map<string, MultiTask> = new Map();
  private taskQueue: MultiTask[] = [];
  private maxConcurrentTasks: number = 5;
  private isProcessing: boolean = false;

  constructor() {
    this.authClient = getAuthClient();
    this.compute = google.compute({ version: 'v1', auth: this.authClient });
    this.projects = google.cloudresourcemanager({ version: 'v1', auth: this.authClient });
    this.colabManager = new ColabSessionManager();
    this.driveSync = new GoogleDriveSyncManager();
    this.gatewayManager = new GatewayManager();
  }

  /**
   * Initialize GCP manager with authenticated client
   */
  async initialize(accessToken?: string): Promise<void> {
    if (accessToken) {
      this.authClient.setCredentials({ access_token: accessToken });
    }
    
    try {
      await this.colabManager.initialize();
      console.log('✓ GCP Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GCP Manager:', error);
      throw error;
    }
  }

  /**
   * Generate Google OAuth authorization URL
   */
  generateAuthUrl(): string {
    return generateAuthUrl();
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<Auth.TokenResponse> {
    const tokens = await getTokenFromCode(code);
    this.authClient.setCredentials(tokens);
    return tokens;
  }

  /**
   * List all accessible GCP projects
   */
  async listProjects(): Promise<GCPProject[]> {
    try {
      const response = await this.projects.projects.list({
        filter: 'lifecycleState:ACTIVE',
        pageSize: 100,
      });

      return (response.data.projects || []).map((project: any) => ({
        projectId: project.projectId,
        projectNumber: project.projectNumber,
        name: project.name || project.projectId,
        lifecycleState: project.lifecycleState,
        createTime: project.createTime,
      }));
    } catch (error) {
      console.error('Error listing GCP projects:', error);
      throw error;
    }
  }

  /**
   * Get compute engine instances
   */
  async listInstances(projectId: string, zone: string = 'us-central1-a'): Promise<GCPResource[]> {
    try {
      const response = await this.compute.instances.list({
        project: projectId,
        zone,
      });

      return (response.data.items || []).map((instance: any) => ({
        id: instance.id,
        name: instance.name,
        type: 'compute_instance',
        zone: instance.zone.split('/').pop(),
        status: instance.status,
        createdAt: instance.creationTimestamp,
      }));
    } catch (error: any) {
      // Return empty list if permissions are insufficient
      if (error.code === 403) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get project quotas
   */
  async getQuotas(projectId: string): Promise<GCPQuota[]> {
    try {
      const response = await this.compute.regions.get({
        project: projectId,
        region: 'us-central1',
      });

      const quotas = response.data.quotas || [];
      return quotas.map((q: any) => ({
        metric: q.metric,
        limit: q.limit,
        usage: q.usage,
        unit: q.unit,
      }));
    } catch (error: any) {
      if (error.code === 403) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Create a Colab session with GCP integration
   */
  async createColabSession(config: GCPColabConfig & { userId: string; accessToken: string }): Promise<any> {
    const colabConfig = {
      userId: config.userId,
      accessToken: config.accessToken,
      workspaceName: config.workspaceName,
      enableGPU: config.enableT4GPU,
      autoShutdownMinutes: config.runtimeDurationHours * 60,
    };

    // Initialize Google Drive auto-mounting
    if (config.autoMountDrive) {
      await this.driveSync.initializeRootFolder(config.workspaceName);
    }

    const session = await this.colabManager.start(colabConfig);
    return session;
  }

  /**
   * Provision a compute resource via gstack integration
   */
  async provisionResource(request: GCPInstanceConfig): Promise<GCPResource> {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID environment variable is required');
    }

    const zone = request.zone || 'us-central1-a';
    const instanceName = `void-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    try {
      const response = await this.compute.instances.insert({
        project: projectId,
        zone,
        requestBody: {
          name: instanceName,
          machineType: `zones/${zone}/machineTypes/${request.machineType}`,
          disks: [
            {
              boot: true,
              autoDelete: true,
              initializeParams: {
                diskSizeGb: request.diskSizeGb,
                sourceImage: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts',
              },
            },
          ],
          networkInterfaces: [
            {
              network: 'global/networks/default',
              accessConfigs: [{ type: 'ONE_TO_ONE_NAT', name: 'External NAT' }],
            },
          ],
          ...(request.gpuType && request.gpuCount && {
            guestAccelerators: [
              {
                acceleratorCount: request.gpuCount,
                acceleratorType: `zones/${zone}/acceleratorTypes/${request.gpuType}`,
              },
            ],
            scheduling: {
              onHostMaintenance: 'TERMINATE',
              automaticRestart: false,
            },
          }),
          ...(request.preemptible && {
            scheduling: {
              ...(request.scheduling || {}),
              preemptible: true,
            },
          }),
        },
      });

      return {
        id: response.data.id || '',
        name: response.data.name || instanceName,
        type: 'compute_instance',
        zone,
        status: response.data.status || 'PROVISIONING',
        createdAt: response.data.creationTimestamp || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error provisioning GCP resource:', error);
      throw error;
    }
  }

  /**
   * Enable automatic Drive mounting for a workspace
   */
  async enableAutoDriveMount(workspaceName: string): Promise<{ success: boolean; mountPoint: string }> {
    try {
      const folderId = await this.driveSync.initializeRootFolder(workspaceName);
      
      return {
        success: true,
        mountPoint: `/content/drive/MyDrive/${workspaceName}`,
      };
    } catch (error: any) {
      console.error('Failed to enable auto Drive mount:', error);
      return {
        success: false,
        mountPoint: '',
      };
    }
  }

  /**
   * Add a task to the multi-task execution queue
   */
  async addTask(task: MultiTask): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskWithId = { ...task, id: taskId, status: 'pending' as const };
    
    if (task.dependencies) {
      const depsCompleted = task.dependencies.every(depId => {
        const dep = this.activeTasks.get(depId);
        return dep && dep.status === 'completed';
      });
      
      if (!depsCompleted) {
        taskWithId.status = 'pending';
      }
    }
    
    this.activeTasks.set(taskId, taskWithId);
    this.taskQueue.push(taskWithId);
    
    // Trigger queue processing
    this.processTaskQueue();
    
    return taskId;
  }

  /**
   * Process multi-task execution queue
   */
  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0) {
      const activeCount = Array.from(this.activeTasks.values()).filter(
        t => t.status === 'running'
      ).length;

      if (activeCount >= this.maxConcurrentTasks) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const task = this.taskQueue.shift();
      if (!task) continue;

      // Check dependencies
      if (task.dependencies) {
        const depsCompleted = task.dependencies.every(depId => {
          const dep = this.activeTasks.get(depId);
          return dep && dep.status === 'completed';
        });

        if (!depsCompleted) {
          this.taskQueue.push(task);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
      }

      task.status = 'running';
      this.executeTask(task);
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: MultiTask): Promise<void> {
    try {
      let result: any;

      switch (task.type) {
        case 'colab':
          result = await this.executeColabTask(task);
          break;
        case 'compute':
          result = await this.executeComputeTask(task);
          break;
        case 'storage':
          result = await this.executeStorageTask(task);
          break;
        case 'ai':
          result = await this.executeAITask(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.status = 'completed';
      task.result = result;
      this.notifyTaskComplete(task);
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      this.notifyTaskFailed(task);
    } finally {
      this.processTaskQueue();
    }
  }

  /**
   * Execute Colab task
   */
  private async executeColabTask(task: MultiTask): Promise<any> {
    if (!task.code) {
      throw new Error('No code provided for Colab task');
    }

    // Use gateway manager for Colab execution
    const gateway = this.gatewayManager.getGateway('colab');
    if (!gateway) {
      throw new Error('Colab gateway not available');
    }

    await gateway.initialize();
    const response = await gateway.execute({
      code: task.code,
      language: task.language || 'python',
      timeout: 300,
    });

    if (!response.success) {
      throw new Error(response.error || 'Colab execution failed');
    }

    return {
      output: response.stdout,
      error: response.stderr,
      executionTime: response.executionTime,
    };
  }

  /**
   * Execute compute task via gstack gateway
   */
  private async executeComputeTask(task: MultiTask): Promise<any> {
    if (!task.code) {
      throw new Error('No code provided for compute task');
    }

    const gateway = this.gatewayManager.getGateway('local');
    if (!gateway) {
      throw new Error('Local gateway not available');
    }

    await gateway.initialize();
    const response = await gateway.execute({
      code: task.code,
      language: task.language || 'bash',
      timeout: 300,
    });

    if (!response.success) {
      throw new Error(response.error || 'Compute execution failed');
    }

    return {
      output: response.stdout,
      error: response.stderr,
      executionTime: response.executionTime,
    };
  }

  /**
   * Execute storage task
   */
  private async executeStorageTask(task: MultiTask): Promise<any> {
    // Storage operations would interact with Google Drive
    return await this.driveSync.listProjectFiles();
  }

  /**
   * Execute AI task
   */
  private async executeAITask(task: MultiTask): Promise<any> {
    // AI operations would interact with AI completion service
    return {
      message: 'AI task completed',
      task: task.config,
    };
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): MultiTask | null {
    return this.activeTasks.get(taskId) || null;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): MultiTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get queued tasks
   */
  getQueuedTasks(): MultiTask[] {
    return [...this.taskQueue];
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'pending' || task.status === 'running') {
      task.status = 'failed';
      task.error = 'Task cancelled';
      this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
      return true;
    }

    return false;
  }

  /**
   * Notify task completion
   */
  private notifyTaskComplete(task: MultiTask): void {
    console.log(`✓ Task completed: ${task.id} (${task.type})`);
  }

  /**
   * Notify task failure
   */
  private notifyTaskFailed(task: MultiTask): void {
    console.error(`✗ Task failed: ${task.id} (${task.type}): ${task.error}`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.colabManager.shutdown();
      await this.gatewayManager.cleanupAll();
      console.log('✓ GCP Manager cleaned up');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Singleton instance
export const gcpManager = new GCPManager();

/**
 * gstack Integration - Multi-task execution engine
 * 
 * The gstack integration enables:
 * 1. Automatic Drive mounting on session start
 * 2. Resource provisioning (compute, storage, AI)
 * 3. Multi-task execution with dependency management
 * 4. Priority-based task scheduling
 * 5. Concurrent task execution with configurable limits
 */

export interface GStackTask {
  id: string;
  name: string;
  description?: string;
  tasks: Array<{
    service: 'colab' | 'compute' | 'storage' | 'ai' | 'drive';
    action: string;
    config: any;
    dependsOn?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  parallelExecution?: boolean;
  onComplete?: (results: any[]) => void;
  onError?: (error: Error) => void;
}

export class GStackEngine {
  private gcpManager: GCPManager;

  constructor(gcpManager: GCPManager) {
    this.gcpManager = gcpManager;
  }

  /**
   * Execute a gstack task graph
   */
  async execute(task: GStackTask): Promise<any[]> {
    const taskIds: string[] = [];
    const taskMap = new Map<string, any>();

    // Convert tasks to GCP tasks
    for (const subTask of task.tasks) {
      const gcpTask: MultiTask = {
        id: `${task.id}_${subTask.service}_${Date.now()}`,
        type: this.mapServiceToType(subTask.service),
        config: subTask.config,
        dependencies: subTask.dependsOn?.map(dep => `${task.id}_${dep}`),
        priority: subTask.priority || 'medium',
        status: 'pending',
      };

      taskIds.push(gcpTask.id);
      taskMap.set(gcpTask.id, { subTask, gcpTask });

      // Add to queue
      await this.gcpManager.addTask(gcpTask);
    }

    // Wait for completion
    const results = await this.waitForTasks(taskIds, task.parallelExecution);

    if (task.onComplete) {
      task.onComplete(results);
    }

    return results;
  }

  /**
   * Wait for tasks to complete
   */
  private async waitForTasks(taskIds: string[], parallel: boolean = true): Promise<any[]> {
    const results: any[] = [];
    const maxWait = 300000; // 5 minutes
    const start = Date.now();

    while (taskIds.length > 0) {
      if (Date.now() - start > maxWait) {
        throw new Error('Task execution timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      for (let i = taskIds.length - 1; i >= 0; i--) {
        const taskId = taskIds[i];
        const task = this.gcpManager.getTaskStatus(taskId);

        if (task) {
          if (task.status === 'completed') {
            results.push(task.result);
            taskIds.splice(i, 1);
          } else if (task.status === 'failed') {
            throw new Error(`Task failed: ${task.error}`);
          } else if (!parallel) {
            // Sequential: wait for current task before next
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Map service to GCP task type
   */
  private mapServiceToType(service: string): MultiTask['type'] {
    switch (service) {
      case 'colab': return 'colab';
      case 'compute': return 'compute';
      case 'storage': return 'storage';
      case 'drive': return 'storage';
      case 'ai': return 'ai';
      default: throw new Error(`Unknown service: ${service}`);
    }
  }

  /**
   * Execute Drive mounting and resource provisioning in parallel
   */
  async autoProvision(config: {
    workspaceName: string;
    enableGPU?: boolean;
    runtimeHours?: number;
    provisionCompute?: boolean;
    computeConfig?: GCPInstanceConfig;
  }): Promise<{
    driveMount: { success: boolean; mountPoint: string };
    colabSession?: any;
    computeInstance?: GCPResource;
  }> {
    const tasks: Array<Promise<any>> = [];

    // Always mount Drive
    const driveMountPromise = this.gcpManager.enableAutoDriveMount(config.workspaceName);
    tasks.push(driveMountPromise);

    const results: any = {
      driveMount: await driveMountPromise,
    };

    // Provision Colab session if requested
    if (config.runtimeHours) {
      // Note: Colab session would need user auth token - this is handled separately
      // Placeholder for colab provisioning
      results.colabSession = {
        message: 'Colab session ready (user auth required)',
        config: {
          enableGPU: config.enableGPU,
          runtimeHours: config.runtimeHours,
          workspaceName: config.workspaceName,
        },
      };
    }

    // Provision compute instance if requested
    if (config.provisionCompute && config.computeConfig) {
      try {
        const computeInstance = await this.gcpManager.provisionResource(config.computeConfig);
        results.computeInstance = computeInstance;
      } catch (error: any) {
        // If no permissions, return placeholder
        if (error.code === 403) {
          results.computeInstance = {
            message: 'Compute provisioning requires GCP permissions',
            config: config.computeConfig,
          };
        } else {
          throw error;
        }
      }
    }

    return results;
  }
}
