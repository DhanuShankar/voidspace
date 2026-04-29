import type { ExtensionContext } from './ExtensionContext';

interface SandboxedModule {
  activate?: (context: ExtensionContext, vscode: any) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

export class ExtensionSandbox {
  private iframe: HTMLIFrameElement | null = null;
  private sandboxOrigin: string = 'http://extension-sandbox.local';
  private messageQueue: Map<number, { resolve: Function; reject: Function }> = new Map();
  private messageId: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.createSandbox();
  }

  private createSandbox(): void {
    // Create a hidden iframe for sandbox isolation
    this.iframe = document.createElement('iframe');
    this.iframe.style.display = 'none';
    this.iframe.sandbox = 'allow-scripts allow-same-origin';
    this.iframe.src = this.createSandboxHTML();

    document.body.appendChild(this.iframe);

    // Wait for iframe to load
    this.iframe.onload = () => {
      this.initialized = true;
      this.setupMessageListener();
    };
  }

  private createSandboxHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <script>
            // Listen for messages from parent
            window.addEventListener('message', (event) => {
              if (event.data.type === 'execute') {
                const { id, code, context } = event.data;

                try {
                  // Create module scope with limited globals
                  const module = { exports: {} };
                  const require = (name) => {
                    // Limited require implementation for allowed modules
                    const allowed = ['lodash', 'moment', 'axios'];
                    if (allowed.includes(name)) {
                      return window.parent.postMessage({
                        type: 'require',
                        module: name,
                        id
                      }, '*');
                    }
                    throw new Error(\`Module \${name} not allowed\`);
                  };

                  // Safe eval in isolated context
                  const fn = new Function('module', 'exports', 'require', 'context', code);
                  const result = fn(module, module.exports, require, context);

                  // Send result back
                  window.parent.postMessage({
                    type: 'result',
                    id,
                    result: result || module.exports
                  }, '*');
                } catch (error) {
                  window.parent.postMessage({
                    type: 'error',
                    id,
                    error: error.message,
                    stack: error.stack
                  }, '*');
                }
              }
            });
          </script>
        </head>
        <body></body>
      </html>
    `;
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.sandboxOrigin) return;

      const { type, id, result, error } = event.data;

      if (type === 'result') {
        const handler = this.messageQueue.get(id);
        if (handler) {
          handler.resolve(result);
          this.messageQueue.delete(id);
        }
      } else if (type === 'error') {
        const handler = this.messageQueue.get(id);
        if (handler) {
          handler.reject(new Error(error));
          this.messageQueue.delete(id);
        }
      } else if (type === 'require') {
        // Handle module loading
        // In a real implementation, this would load JS modules
        console.log(`Module requested: ${event.data.module}`);
      }
    });
  }

  async execute(entryPoint: string, context: ExtensionContext): Promise<SandboxedModule | null> {
    if (!this.initialized || !this.iframe?.contentWindow) {
      throw new Error('Sandbox not initialized');
    }

    try {
      // Load extension code
      const response = await fetch(entryPoint);
      if (!response.ok) {
        throw new Error(`Failed to load extension: ${response.statusText}`);
      }
      const code = await response.text();

      // Wrap code in extension loader
      const wrappedCode = this.wrapExtensionCode(code);

      // Send to sandbox for execution
      return new Promise((resolve, reject) => {
        const id = ++this.messageId;
        this.messageQueue.set(id, { resolve, reject });

        this.iframe!.contentWindow!.postMessage({
          type: 'execute',
          id,
          code: wrappedCode,
          context: this.serializeContext(context),
        }, this.sandboxOrigin);
      });
    } catch (error) {
      console.error('Sandbox execution error:', error);
      return null;
    }
  }

  private wrapExtensionCode(code: string): string {
    // Wrap extension code to capture exports
    return `
      (function() {
        const module = { exports: {} };
        const exports = module.exports;

        ${code}

        // Return module.exports
        module.exports;
      })()
    `;
  }

  private serializeContext(context: ExtensionContext): any {
    return {
      extensionId: context.extension.id,
      extensionPath: context.storagePath,
      extensionUri: context.extensionUri,
      globalState: Object.fromEntries(context.globalState),
      workspaceState: Object.fromEntries(context.workspaceState),
    };
  }

  // For development / simpler implementation without iframe
  async executeSimple(entryPoint: string, context: ExtensionContext): Promise<SandboxedModule | null> {
    try {
      // Load extension code
      const response = await fetch(entryPoint);
      if (!response.ok) {
        throw new Error(`Failed to load extension: ${response.statusText}`);
      }
      const code = await response.text();

      // Create a safe evaluation context
      const vscodeAPI = this.createLimitedAPI(context);

      // Execute using Function constructor with limited scope
      const module: any = { exports: {} };
      const fn = new Function('module', 'exports', 'require', 'vscode', 'context', code);
      fn(module, module.exports, this.limitedRequire.bind(this), vscodeAPI, context);

      return module;
    } catch (error) {
      console.error('Simple sandbox execution error:', error);
      return null;
    }
  }

  private createLimitedAPI(context: ExtensionContext): any {
    return {
      // Only expose safe, read-only operations
      commands: {
        registerCommand: (command: string, handler: Function) => {
          // Register command through extension host
          (window as any).vscode?.commands?.registerCommand?.(command, handler);
          return { dispose: () => {} };
        },
        executeCommand: (command: string, ...args: any[]) =>
          (window as any).vscode?.commands?.executeCommand?.(command, ...args),
      },
      window: {
        showInformationMessage: (msg: string, ...items: string[]) =>
          (window as any).vscode?.window?.showInformationMessage?.(msg, ...items),
        showWarningMessage: (msg: string, ...items: string[]) =>
          (window as any).vscode?.window?.showWarningMessage?.(msg, ...items),
        showErrorMessage: (msg: string, ...items: string[]) =>
          (window as any).vscode?.window?.showErrorMessage?.(msg, ...items),
        showInputBox: (options?: any) =>
          (window as any).vscode?.window?.showInputBox?.(options),
      },
      workspace: {
        getConfiguration: (section: string) =>
          (window as any).vscode?.workspace?.getConfiguration?.(section),
        getTextDocument: (uri: string) =>
          (window as any).vscode?.workspace?.getTextDocument?.(uri),
      },
      extensions: {
        all: () => (window as any).vscode?.extensions?.all?.(),
        getExtension: (id: string) => (window as any).vscode?.extensions?.getExtension?.(id),
      },
      storage: {
        get: (key: string) => context.getStorageValue(key),
        set: (key: string, value: any) => context.setStorageValue(key, value),
      },
      environment: {
        get: (variable: string) => {
          // Only expose safe environment variables
          const safe = ['NODE_ENV', 'VITE_*'];
          if (safe.some(pattern => variable.match(pattern.replace('*', '.*')))) {
            return (process.env as any)[variable];
          }
          return undefined;
        },
      },
    };
  }

  private limitedRequire(moduleName: string): any {
    // Only allow specific safe modules
    const allowedModules: { [key: string]: any } = {
      // Would load from CDN or local in real implementation
      'lodash': window._,
      'moment': window.moment,
    };

    if (allowedModules[moduleName]) {
      return allowedModules[moduleName];
    }

    throw new Error(`Module '${moduleName}' is not allowed in extension sandbox`);
  }

  dispose(): void {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.messageQueue.clear();
    this.initialized = false;
  }
}
