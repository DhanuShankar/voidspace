import type { Extension, ExtensionContext as ExtensionContextType } from './types';
import type { ExtensionSandbox } from './ExtensionSandbox';

export class ExtensionContext implements ExtensionContextType {
  public extension: Extension;
  public subscriptions: (() => void)[] = [];
  public extensionMode: 'development' | 'production' = 'production';
  public globalState: Map<string, any> = new Map();
  public workspaceState: Map<string, any> = new Map();
  public extensionUri: any = { scheme: 'extension', authority: this.extension.id, path: '/' };
  public storagePath: string;
  private sandbox: ExtensionSandbox;
  private extensionModule: any;
  private initialized: boolean = false;

  constructor(extension: Extension, sandbox: ExtensionSandbox) {
    this.extension = extension;
    this.sandbox = sandbox;
    this.storagePath = `/extensions/${extension.id}`;
    this.loadStorage();
  }

  async initialize(module: any): Promise<void> {
    this.extensionModule = module;
    this.initialized = true;
  }

  getStorageValue(key: string): any {
    const storage = localStorage.getItem(`extension_${this.extension.id}_${key}`);
    if (storage) {
      try {
        return JSON.parse(storage);
      } catch {
        return storage;
      }
    }
    return undefined;
  }

  setStorageValue(key: string, value: any): void {
    try {
      localStorage.setItem(`extension_${this.extension.id}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to store value for key ${key} in extension ${this.extension.id}:`, error);
    }
  }

  getGlobalState(key: string): any {
    return this.globalState.get(key);
  }

  setGlobalState(key: string, value: any): void {
    this.globalState.set(key, value);
    this.setStorageValue(`__global_${key}`, value);
  }

  getWorkspaceState(key: string): any {
    return this.workspaceState.get(key);
  }

  setWorkspaceState(key: string, value: any): void {
    this.workspaceState.set(key, value);
  }

  asAbsolutePath(relativePath: string): string {
    return `${this.storagePath}/${relativePath}`;
  }

  getExtensionUri(path?: string): any {
    return {
      scheme: 'extension',
      authority: this.extension.id,
      path: path || '/',
    };
  }

  private loadStorage(): void {
    // Load global state from storage
    try {
      const stored = localStorage.getItem(`extension_${this.extension.id}_state`);
      if (stored) {
        const state = JSON.parse(stored);
        this.globalState = new Map(Object.entries(state));
      }
    } catch (error) {
      console.error(`Failed to load storage for extension ${this.extension.id}:`, error);
    }
  }

  private saveStorage(): void {
    try {
      const state: any = {};
      for (const [key, value] of this.globalState) {
        state[key] = value;
      }
      localStorage.setItem(`extension_${this.extension.id}_state`, JSON.stringify(state));
    } catch (error) {
      console.error(`Failed to save storage for extension ${this.extension.id}:`, error);
    }
  }

  dispose(): void {
    // Call subscription disposers
    for (const dispose of this.subscriptions) {
      try {
        dispose();
      } catch (error) {
        console.error('Error disposing subscription:', error);
      }
    }
    this.subscriptions = [];

    // Save state
    this.saveStorage();

    // Call extension's deactivate if available
    if (this.extensionModule?.deactivate) {
      try {
        this.extensionModule.deactivate();
      } catch (error) {
        console.error(`Error deactivating extension ${this.extension.id}:`, error);
      }
    }

    this.initialized = false;
  }

  addDisposable(disposable: () => void): void {
    this.subscriptions.push(disposable);
  }

  get isActivated(): boolean {
    return this.initialized;
  }
}
