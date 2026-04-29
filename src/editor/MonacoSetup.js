import * as monaco from 'monaco-editor';
import { ExtensionHost } from '../extensions/ExtensionHost';
import { ExtensionManager } from '../extensions/ExtensionManager';
import { ThemeManager } from '../extensions/ThemeManager';
import { KeybindingManager } from '../extensions/KeybindingManager';
import { LanguageServerManager } from '../extensions/LanguageServerManager';
import { DebugAdapterManager } from '../extensions/DebugAdapterManager';
import { MarketplaceClient } from '../marketplace/MarketplaceClient';
import { Extension } from '../extensions/types';

export interface MonacoSetupOptions {
  container: HTMLElement;
  theme?: string;
  language?: string;
  value?: string;
  extensions?: Extension[];
  autoUpdate?: boolean;
  marketplaceUrl?: string;
}

export class MonacoSetup {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private monacoInstance: typeof monaco | null = null;
  private extensionHost: ExtensionHost;
  private extensionManager: ExtensionManager;
  private themeManager: ThemeManager;
  private keybindingManager: KeybindingManager;
  private languageServerManager: LanguageServerManager;
  private debugAdapterManager: DebugAdapterManager;
  private marketplaceClient: MarketplaceClient;
  private options: MonacoSetupOptions;

  constructor(options: MonacoSetupOptions) {
    this.options = options;
    this.extensionHost = new ExtensionHost();
    this.extensionManager = new ExtensionManager(this.extensionHost);
    this.themeManager = new ThemeManager();
    this.keybindingManager = new KeybindingManager();
    this.languageServerManager = new LanguageServerManager();
    this.debugAdapterManager = new DebugAdapterManager();
    this.marketplaceClient = new MarketplaceClient(options.marketplaceUrl || 'http://localhost:3001');
  }

  async initialize(): Promise<void> {
    // Initialize Monaco editor
    this.editor = monaco.editor.create(this.options.container, {
      theme: this.options.theme || 'vs-dark',
      language: this.options.language || 'javascript',
      value: this.options.value || '',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
      fontLigatures: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      formatOnPaste: true,
      padding: { top: 16 },
      roundedSelection: false,
      scrollBeyondLastLine: false,
    });

    this.monacoInstance = monaco;

    // Initialize extension system
    await this.initializeExtensionSystem();

    // Setup VSCode API compatibility
    this.setupVSCodeAPI();

    // Register built-in themes
    this.themeManager.registerBuiltInThemes(monaco);

    // Load installed extensions
    if (this.options.extensions) {
      await this.extensionManager.loadExtensions(this.options.extensions);
    }

    // Initialize language servers
    await this.languageServerManager.initialize(this.editor, this.extensionHost);

    // Initialize debug adapters
    await this.debugAdapterManager.initialize(this.editor);

    // Setup auto-updates if enabled
    if (this.options.autoUpdate) {
      this.setupAutoUpdates();
    }
  }

  private async initializeExtensionSystem(): Promise<void> {
    // Load extension metadata from storage
    const installedExtensions = await this.extensionManager.getInstalledExtensions();

    // Initialize each extension in sandbox
    for (const ext of installedExtensions) {
      try {
        await this.extensionHost.activateExtension(ext);
      } catch (error) {
        console.error(`Failed to activate extension ${ext.id}:`, error);
      }
    }
  }

  private setupVSCodeAPI(): void {
    // Expose vscode-like API to extensions
    const vscodeAPI = {
      // Editor API
      editor: {
        getCurrentEditor: () => this.editor,
        getMonaco: () => this.monacoInstance,
        getSelection: () => this.editor?.getSelection(),
        getSelectedText: () => this.editor?.getModel()?.getValueInRange(this.editor?.getSelection() || new monaco.Range(0,0,0,0)),
      },

      // Workspace API
      workspace: {
        getWorkspaceFolder: () => ({ uri: 'file:///workspace' }),
        getConfiguration: (section: string) => this.extensionManager.getConfiguration(section),
        getTextDocument: (uri: string) => this.extensionManager.getTextDocument(uri),
      },

      // Extension API
      extensions: {
        all: () => this.extensionManager.getAllExtensions(),
        getExtension: (id: string) => this.extensionManager.getExtension(id),
      },

      // Theme API
      theme: {
        getColorTheme: () => this.themeManager.getCurrentTheme(),
        setColorTheme: (theme: string) => this.themeManager.setTheme(theme, this.monacoInstance),
      },

      // Keybinding API
      keybindings: {
        registerKeybinding: (binding: any, handler: () => void) =>
          this.keybindingManager.registerKeybinding(binding, handler, this.editor),
        unregisterKeybinding: (id: string) => this.keybindingManager.unregisterKeybinding(id),
      },

      // Commands API
      commands: {
        registerCommand: (command: string, handler: (...args: any[]) => void, thisArg?: any) =>
          this.extensionHost.registerCommand(command, handler, thisArg),
        executeCommand: (command: string, ...args: any[]) =>
          this.extensionHost.executeCommand(command, ...args),
      },

      // Window API
      window: {
        showInformationMessage: (message: string, ...items: string[]) =>
          this.extensionHost.showInformationMessage(message, ...items),
        showWarningMessage: (message: string, ...items: string[]) =>
          this.extensionHost.showWarningMessage(message, ...items),
        showErrorMessage: (message: string, ...items: string[]) =>
          this.extensionHost.showErrorMessage(message, ...items),
        showInputBox: (options?: any) => this.extensionHost.showInputBox(options),
      },

      // Storage API
      storage: {
        get: (key: string) => this.extensionManager.getStorageValue(key),
        set: (key: string, value: any) => this.extensionManager.setStorageValue(key, value),
      },

      // Language Server API
      languages: {
        registerCompletionItemProvider: (selector: any, provider: any) =>
          this.languageServerManager.registerCompletionProvider(selector, provider),
        registerHoverProvider: (selector: any, provider: any) =>
          this.languageServerManager.registerHoverProvider(selector, provider),
        registerDocumentFormattingEditProvider: (selector: any, provider: any) =>
          this.languageServerManager.registerFormattingProvider(selector, provider),
      },

      // Debug API
      debug: {
        registerDebugAdapter: (type: string, factory: any) =>
          this.debugAdapterManager.registerDebugAdapter(type, factory),
        startDebugging: (folder: any, config: any) =>
          this.debugAdapterManager.startDebugging(folder, config),
      },
    };

    // Expose to window for extension sandbox
    (window as any).vscode = vscodeAPI;
    (window as any).monacoExtensionAPI = vscodeAPI;
  }

  private setupAutoUpdates(): void {
    setInterval(async () => {
      const updates = await this.marketplaceClient.checkForUpdates();
      for (const update of updates) {
        await this.extensionManager.updateExtension(update.id, update.version);
      }
    }, 3600000); // Check every hour
  }

  // Public API methods
  async installExtension(extensionId: string): Promise<void> {
    const extension = await this.marketplaceClient.downloadExtension(extensionId);
    await this.extensionManager.installExtension(extension);
    await this.extensionHost.activateExtension(extension);
  }

  async uninstallExtension(extensionId: string): Promise<void> {
    await this.extensionManager.uninstallExtension(extensionId);
    this.extensionHost.deactivateExtension(extensionId);
  }

  async updateExtension(extensionId: string): Promise<void> {
    const update = await this.marketplaceClient.getLatestVersion(extensionId);
    await this.extensionManager.updateExtension(extensionId, update.version);
  }

  setTheme(themeName: string): void {
    this.themeManager.setTheme(themeName, this.monacoInstance);
    this.editor?.updateOptions({ theme: themeName });
  }

  getAvailableThemes(): string[] {
    return this.themeManager.getAvailableThemes();
  }

  registerKeybinding(keybinding: any, handler: () => void): string {
    return this.keybindingManager.registerKeybinding(keybinding, handler, this.editor);
  }

  dispose(): void {
    this.editor?.dispose();
    this.extensionHost.dispose();
    this.languageServerManager.dispose();
    this.debugAdapterManager.dispose();
  }
}
