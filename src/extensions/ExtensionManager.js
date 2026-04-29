import type { Extension, ExtensionManifest } from './types';
import { ExtensionStorage } from './ExtensionStorage';

export class ExtensionManager {
  private extensions: Map<string, Extension> = new Map();
  private storage: ExtensionStorage;
  private configurations: Map<string, any> = new Map();
  private textDocuments: Map<string, any> = new Map();

  constructor(private extensionHost: any) {
    this.storage = new ExtensionStorage();
  }

  async loadExtensions(extensions: Extension[]): Promise<void> {
    for (const extension of extensions) {
      await this.installExtension(extension);
    }
  }

  async installExtension(extension: Extension): Promise<void> {
    // Validate extension manifest
    this.validateManifest(extension.manifest);

    // Store extension in local storage
    await this.storage.storeExtension(extension);

    // Add to extension map
    this.extensions.set(extension.id, extension);

    // Initialize extension configurations
    if (extension.manifest.contributes?.configuration) {
      this.initializeConfiguration(extension.id, extension.manifest.contributes.configuration);
    }

    console.log(`Extension installed: ${extension.name} (${extension.id})`);
  }

  async uninstallExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) return;

    // Deactivate extension
    this.extensionHost.deactivateExtension(extensionId);

    // Remove from storage
    await this.storage.removeExtension(extensionId);

    // Remove from map
    this.extensions.delete(extensionId);

    // Clean up configurations
    this.configurations.delete(extensionId);

    console.log(`Extension uninstalled: ${extension.name}`);
  }

  async updateExtension(extensionId: string, newVersion: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found`);
    }

    // Deactivate old version
    this.extensionHost.deactivateExtension(extensionId);

    // Update version
    extension.version = newVersion;
    extension.lastUpdated = new Date();

    // Store updated extension
    await this.storage.storeExtension(extension);

    // Reactivate
    await this.extensionHost.activateExtension(extension);

    console.log(`Extension updated: ${extension.name} to ${newVersion}`);
  }

  getExtension(extensionId: string): Extension | undefined {
    return this.extensions.get(extensionId);
  }

  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  getEnabledExtensions(): Extension[] {
    return Array.from(this.extensions.values()).filter(ext => ext.enabled);
  }

  getConfiguration(section: string): any {
    const parts = section.split('.');
    const [extensionId, ...configPath] = parts;
    const extensionConfig = this.configurations.get(extensionId);

    if (!extensionConfig) return undefined;

    let value = extensionConfig;
    for (const key of configPath) {
      value = value?.[key];
    }
    return value;
  }

  setConfiguration(section: string, value: any): void {
    const parts = section.split('.');
    const [extensionId, ...configPath] = parts;

    let config = this.configurations.get(extensionId) || {};
    if (configPath.length === 0) {
      config = value;
    } else {
      let current = config;
      for (let i = 0; i < configPath.length - 1; i++) {
        current[configPath[i]] = current[configPath[i]] || {};
        current = current[configPath[i]];
      }
      current[configPath[configPath.length - 1]] = value;
    }

    this.configurations.set(extensionId, config);
    this.storage.storeConfiguration(extensionId, config);

    // Notify extension of configuration change
    this.extensionHost.executeCommand(`_extension.configurationChanged.${extensionId}`, section, value);
  }

  getTextDocument(uri: string): any {
    return this.textDocuments.get(uri);
  }

  setTextDocument(uri: string, content: string, languageId: string): void {
    const document = {
      uri,
      languageId,
      content,
      version: 1,
      isDirty: false,
    };
    this.textDocuments.set(uri, document);
  }

  getAllTextDocuments(): any[] {
    return Array.from(this.textDocuments.values());
  }

  getStorageValue(key: string): any {
    return this.storage.getExtensionData(key);
  }

  setStorageValue(key: string, value: any): void {
    this.storage.setExtensionData(key, value);
  }

  private validateManifest(manifest: ExtensionManifest): void {
    if (!manifest.version) {
      throw new Error('Extension manifest must have a version');
    }
    if (!manifest.engines?.vscode) {
      throw new Error('Extension manifest must specify vscode engine compatibility');
    }
    if (!manifest.main) {
      throw new Error('Extension manifest must specify main entry point');
    }
  }

  private initializeConfiguration(extensionId: string, config: any): void {
    const defaults: any = {};
    if (config.properties) {
      for (const [key, prop] of Object.entries(config.properties)) {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        }
      }
    }
    this.configurations.set(extensionId, defaults);
  }

  async getInstalledExtensions(): Promise<Extension[]> {
    return await this.storage.getAllExtensions();
  }

  isExtensionInstalled(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  getExtensionDependencies(extensionId: string): string[] {
    const extension = this.extensions.get(extensionId);
    return extension?.dependencies || [];
  }

  async resolveDependencies(extensionId: string): Promise<string[]> {
    const dependencies = this.getExtensionDependencies(extensionId);
    const missing: string[] = [];

    for (const dep of dependencies) {
      if (!this.isExtensionInstalled(dep)) {
        missing.push(dep);
      }
    }

    return missing;
  }
}
