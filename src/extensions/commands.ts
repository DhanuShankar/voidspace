import { ExtensionHost } from '../extensions/ExtensionHost';

/**
 * Command Registry
 * Manages execution of commands across the IDE
 */

export class CommandRegistry {
  private commands: Map<string, CommandHandler> = new Map();
  private whenClauses: Map<string, WhenClause> = new Map();
  private extensionHost: ExtensionHost;

  constructor(extensionHost: ExtensionHost) {
    this.extensionHost = extensionHost;
    this.registerBuiltInCommands();
  }

  private registerBuiltInCommands(): void {
    // Editor commands
    this.register('editor.action.formatDocument', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'editor.action.formatDocument' } });
      window.dispatchEvent(event);
    });

    this.register('editor.action.commentLine', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'editor.action.commentLine' } });
      window.dispatchEvent(event);
    });

    this.register('editor.action.indentLines', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'editor.action.indentLines' } });
      window.dispatchEvent(event);
    });

    this.register('editor.action.outdentLines', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'editor.action.outdentLines' } });
      window.dispatchEvent(event);
    });

    // File commands
    this.register('workbench.action.files.save', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.files.save' } });
      window.dispatchEvent(event);
    });

    this.register('workbench.action.files.saveAll', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.files.saveAll' } });
      window.dispatchEvent(event);
    });

    this.register('workbench.action.closeActiveEditor', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.closeActiveEditor' } });
      window.dispatchEvent(event);
    });

    // View commands
    this.register('workbench.action.toggleSidebarVisibility', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.toggleSidebarVisibility' } });
      window.dispatchEvent(event);
    });

    this.register('workbench.action.togglePanel', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.togglePanel' } });
      window.dispatchEvent(event);
    });

    // Search commands
    this.register('actions.find', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'actions.find' } });
      window.dispatchEvent(event);
    });

    this.register('actions.replace', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'actions.replace' } });
      window.dispatchEvent(event);
    });

    // Terminal commands
    this.register('workbench.action.terminal.toggleTerminal', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.terminal.toggleTerminal' } });
      window.dispatchEvent(event);
    });

    // Debug commands
    this.register('workbench.view.debug', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.view.debug' } });
      window.dispatchEvent(event);
    });

    this.register('workbench.action.debug.start', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.debug.start' } });
      window.dispatchEvent(event);
    });

    // Settings commands
    this.register('workbench.action.openSettings', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.openSettings' } });
      window.dispatchEvent(event);
    });

    // Command palette
    this.register('workbench.action.showCommands', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'workbench.action.showCommands' } });
      window.dispatchEvent(event);
    });

    // AI commands
    this.register('void.action.aiEdit', () => {
      const event = new CustomEvent('monaco-command', { detail: { command: 'void.action.aiEdit' } });
      window.dispatchEvent(event);
    });

    // Extension commands
    this.register('extensions.installExtension', (extensionId: string) => {
      this.extensionHost.executeCommand('extensions.installExtension', extensionId);
    });

    this.register('extensions.uninstallExtension', (extensionId: string) => {
      this.extensionHost.executeCommand('extensions.uninstallExtension', extensionId);
    });

    this.register('extensions.enableExtension', (extensionId: string) => {
      this.extensionHost.executeCommand('extensions.enableExtension', extensionId);
    });

    this.register('extensions.disableExtension', (extensionId: string) => {
      this.extensionHost.executeCommand('extensions.disableExtension', extensionId);
    });
  }

  register(commandId: string, handler: CommandHandler, thisArg?: any): { dispose: () => void } {
    this.commands.set(commandId, handler.bind(thisArg));

    // Emit registration event
    this.extensionHost.executeCommand('_commands.registered', commandId);

    return {
      dispose: () => this.unregister(commandId),
    };
  }

  unregister(commandId: string): boolean {
    return this.commands.delete(commandId);
  }

  async execute(commandId: string, ...args: any[]): Promise<any> {
    const handler = this.commands.get(commandId);
    if (!handler) {
      // Try extension host
      return await this.extensionHost.executeCommand(commandId, ...args);
    }

    try {
      return await handler(...args);
    } catch (error) {
      console.error(`Error executing command ${commandId}:`, error);
      throw error;
    }
  }

  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  hasCommand(commandId: string): boolean {
    return this.commands.has(commandId);
  }
}

export interface CommandHandler {
  (...args: any[]): any | Promise<any>;
}

export interface WhenClause {
  evaluate(context: any): boolean;
}

export type { CommandHandler, WhenClause };
