import type { Extension } from './types';
import { ExtensionContext } from './ExtensionContext';
import { ExtensionSandbox } from './ExtensionSandbox';

export class ExtensionHost {
  private extensions: Map<string, Extension> = new Map();
  private activatedExtensions: Map<string, ExtensionContext> = new Map();
  private sandbox: ExtensionSandbox;
  private commandHandlers: Map<string, (...args: any[]) => void> = new Map();
  private disposables: (() => void)[] = [];

  constructor() {
    this.sandbox = new ExtensionSandbox();
  }

  async activateExtension(extension: Extension): Promise<void> {
    if (this.activatedExtensions.has(extension.id)) {
      return; // Already activated
    }

    try {
      // Create extension context
      const context = new ExtensionContext(extension, this.sandbox);

      // Load extension main module in sandbox
      const extensionModule = await this.sandbox.execute(extension.entryPoint, context);

      // Store activated extension
      this.activatedExtensions.set(extension.id, context);
      this.extensions.set(extension.id, extension);

      // Call extension's activate function
      if (extensionModule && extensionModule.activate) {
        await extensionModule.activate(context, this.getVSCodeAPI(context));
      }

      // Register extension commands
      this.registerExtensionCommands(extension, extensionModule);

      // Emit activation event
      this.emitEvent('extensionActivated', extension);
    } catch (error) {
      console.error(`Failed to activate extension ${extension.id}:`, error);
      throw error;
    }
  }

  deactivateExtension(extensionId: string): void {
    const context = this.activatedExtensions.get(extensionId);
    if (!context) return;

    try {
      // Call extension's deactivate function
      const extension = this.extensions.get(extensionId);
      if (extension && context.extensionModule?.deactivate) {
        context.extensionModule.deactivate();
      }

      // Clean up
      this.activatedExtensions.delete(extensionId);
      context.dispose();

      // Emit deactivation event
      this.emitEvent('extensionDeactivated', extension);
    } catch (error) {
      console.error(`Failed to deactivate extension ${extensionId}:`, error);
    }
  }

  getExtension(extensionId: string): Extension | undefined {
    return this.extensions.get(extensionId);
  }

  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  registerCommand(command: string, handler: (...args: any[]) => void, target?: any): void {
    this.commandHandlers.set(command, handler.bind(target));

    // Register with VSCode command service simulation
    this.emitEvent('commandRegistered', { command, handler });
  }

  async executeCommand(command: string, ...args: any[]): Promise<any> {
    const handler = this.commandHandlers.get(command);
    if (!handler) {
      console.warn(`Command not found: ${command}`);
      return undefined;
    }

    try {
      return await handler(...args);
    } catch (error) {
      console.error(`Error executing command ${command}:`, error);
      throw error;
    }
  }

  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return new Promise((resolve) => {
      // Use browser's native dialog or custom modal
      if (confirm(`${message}\n\nItems: ${items.join(', ')}`)) {
        resolve(items[0] || 'OK');
      } else {
        resolve(undefined);
      }
    });
  }

  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return new Promise((resolve) => {
      console.warn(`[WARNING] ${message}`);
      if (confirm(`${message}\n\nItems: ${items.join(', ')}`)) {
        resolve(items[0] || 'OK');
      } else {
        resolve(undefined);
      }
    });
  }

  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return new Promise((resolve) => {
      alert(`[ERROR] ${message}`);
      if (confirm(`${message}\n\nItems: ${items.join(', ')}`)) {
        resolve(items[0] || 'OK');
      } else {
        resolve(undefined);
      }
    });
  }

  showInputBox(options?: { prompt?: string; value?: string; placeHolder?: string }): Promise<string | undefined> {
    return new Promise((resolve) => {
      const input = prompt(options?.prompt || 'Enter value:', options?.value || '');
      resolve(input);
    });
  }

  private registerExtensionCommands(extension: Extension, module: any): void {
    if (module?.contributes?.commands) {
      for (const command of module.contributes.commands) {
        if (command.command && command.callback) {
          this.registerCommand(command.command, command.callback);
        }
      }
    }
  }

  private getVSCodeAPI(context: ExtensionContext): any {
    return {
      // Provide extension context
      extension: context,

      // Command registration
      commands: {
        registerCommand: (command: string, handler: Function, thisArg?: any) =>
          this.registerCommand(command, handler, thisArg),
        executeCommand: (command: string, ...args: any[]) =>
          this.executeCommand(command, ...args),
      },

      // Window API
      window: {
        showInformationMessage: this.showInformationMessage.bind(this),
        showWarningMessage: this.showWarningMessage.bind(this),
        showErrorMessage: this.showErrorMessage.bind(this),
        showInputBox: this.showInputBox.bind(this),
      },

      // Storage
      storage: {
        get: (key: string) => context.getStorageValue(key),
        set: (key: string, value: any) => context.setStorageValue(key, value),
      },

      // Event emitter
      emitter: context.emitter,

      // Dispose
      dispose: () => this.deactivateExtension(extension.id),
    };
  }

  private emitEvent(event: string, data: any): void {
    const emitter = (window as any).vscodeExtensionEventEmitter;
    if (emitter) {
      emitter.emit(event, data);
    }
  }

  dispose(): void {
    for (const [id] of this.activatedExtensions) {
      this.deactivateExtension(id);
    }
    this.sandbox.dispose();
    this.disposables.forEach(dispose => dispose());
    this.disposables = [];
  }
}
