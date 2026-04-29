import type { Extension, ExtensionContext } from './types';

export class ExtensionStorage {
  private readonly STORAGE_KEY_EXTENSIONS = 'monaco_extensions';
  private readonly STORAGE_KEY_DATA = 'extension_data';
  private readonly STORAGE_KEY_CONFIG = 'extension_config';

  private extensions: Map<string, Extension> = new Map();
  private extensionData: Map<string, any> = new Map();
  private configurations: Map<string, any> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  async storeExtension(extension: Extension): Promise<void> {
    this.extensions.set(extension.id, extension);
    await this.saveToStorage();
  }

  async removeExtension(extensionId: string): Promise<void> {
    this.extensions.delete(extensionId);
    this.extensionData.delete(extensionId);
    this.configurations.delete(extensionId);
    await this.saveToStorage();
  }

  async getAllExtensions(): Promise<Extension[]> {
    return Array.from(this.extensions.values());
  }

  getExtension(extensionId: string): Extension | undefined {
    return this.extensions.get(extensionId);
  }

  async storeConfiguration(extensionId: string, config: any): Promise<void> {
    this.configurations.set(extensionId, config);
    await this.saveToStorage();
  }

  getExtensionConfiguration(extensionId: string): any {
    return this.configurations.get(extensionId);
  }

  async setExtensionData(extensionId: string, key: string, value: any): Promise<void> {
    const data = this.extensionData.get(extensionId) || {};
    data[key] = value;
    this.extensionData.set(extensionId, data);
    await this.saveToStorage();
  }

  getExtensionData(extensionId: string, key?: string): any {
    const data = this.extensionData.get(extensionId);
    if (!data) return undefined;
    return key ? data[key] : data;
  }

  async clearExtensionData(extensionId: string): Promise<void> {
    this.extensionData.delete(extensionId);
    await this.saveToStorage();
  }

  getExtensionStoragePath(extensionId: string): string {
    // Return a virtual path for extension storage
    return `/extensions/${extensionId}/storage`;
  }

  getExtensionGlobalState(extensionId: string): any {
    return this.getExtensionData(extensionId, '__global_state__');
  }

  setExtensionGlobalState(extensionId: string, state: any): void {
    this.extensionData.set(extensionId, {
      ...this.extensionData.get(extensionId),
      '__global_state__': state,
    });
  }

  private loadFromStorage(): void {
    try {
      // Load extensions
      const stored = localStorage.getItem(this.STORAGE_KEY_EXTENSIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.extensions = new Map(parsed);
      }

      // Load extension data
      const data = localStorage.getItem(this.STORAGE_KEY_DATA);
      if (data) {
        const parsed = JSON.parse(data);
        this.extensionData = new Map(parsed);
      }

      // Load configurations
      const config = localStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (config) {
        const parsed = JSON.parse(config);
        this.configurations = new Map(parsed);
      }
    } catch (error) {
      console.error('Failed to load extension storage:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        requestIdleCallback(() => {
          // Save extensions
          const extensionsArray = Array.from(this.extensions.entries());
          localStorage.setItem(this.STORAGE_KEY_EXTENSIONS, JSON.stringify(extensionsArray));

          // Save extension data
          const dataArray = Array.from(this.extensionData.entries());
          localStorage.setItem(this.STORAGE_KEY_DATA, JSON.stringify(dataArray));

          // Save configurations
          const configArray = Array.from(this.configurations.entries());
          localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(configArray));

          resolve();
        });
      });
    } catch (error) {
      console.error('Failed to save extension storage:', error);
    }
  }

  // In-memory storage for demo/testing
  private memoryStorage: Map<string, any> = new Map();

  async storeToMemory(key: string, value: any): Promise<void> {
    this.memoryStorage.set(key, value);
  }

  getFromMemory(key: string): any {
    return this.memoryStorage.get(key);
  }

  clearMemory(): void {
    this.memoryStorage.clear();
  }
}
