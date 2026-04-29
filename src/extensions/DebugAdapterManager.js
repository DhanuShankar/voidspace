import type * as monaco from 'monaco-editor';
import type { DebugAdapter, DebugAdapterDescriptor, DebugAdapterServer } from './types';

export class DebugAdapterManager {
  private adapters: Map<string, DebugAdapter> = new Map();
  private activeSessions: Map<string, any> = new Map();
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private breakpoints: Map<string, monaco.editor.IModelDataChangedEvent[]> = new Map();

  constructor() {
    this.registerBuiltInAdapters();
  }

  private registerBuiltInAdapters(): void {
    // Register Node.js debug adapter
    this.registerAdapter({
      type: 'node',
      label: 'Node.js',
      implementation: class NodeDebugAdapter implements DebugAdapterDescriptor {
        implementProtocol(): DebugAdapterServer {
          const server: any = {
            start: () => {
              console.log('Node.js debug adapter started');
            },
            stop: () => {
              console.log('Node.js debug adapter stopped');
            },
            on: (event: string, handler: (...args: any[]) => void) => {
              // Handle events
            },
          };
          return server;
        }
      }
    });

    // Register Chrome/Edge debug adapter
    this.registerAdapter({
      type: 'chrome',
      label: 'Chrome',
      implementation: class ChromeDebugAdapter implements DebugAdapterDescriptor {
        implementProtocol(): DebugAdapterServer {
          const server: any = {
            start: () => {
              console.log('Chrome debug adapter started');
            },
            stop: () => {
              console.log('Chrome debug adapter stopped');
            },
            on: (event: string, handler: (...args: any[]) => void) => {
              // Handle events
            },
          };
          return server;
        }
      }
    });

    // Register extension host debug adapter
    this.registerAdapter({
      type: 'extensionHost',
      label: 'Extension Host',
      implementation: class ExtensionHostDebugAdapter implements DebugAdapterDescriptor {
        implementProtocol(): DebugAdapterServer {
          const server: any = {
            start: () => {
              console.log('Extension Host debug adapter started');
            },
            stop: () => {
              console.log('Extension Host debug adapter stopped');
            },
            on: (event: string, handler: (...args: any[]) => void) => {
              // Handle events
            },
          };
          return server;
        }
      }
    });
  }

  async initialize(editor: monaco.editor.IStandaloneCodeEditor): Promise<void> {
    this.editor = editor;
    this.setupBreakpointListeners();
  }

  registerDebugAdapter(type: string, factory: new () => DebugAdapterDescriptor): void {
    const adapter: DebugAdapter = {
      type,
      label: type,
      implementation: factory,
    };
    this.adapters.set(type, adapter);
    console.log(`Registered debug adapter: ${type}`);
  }

  async startDebugging(
    folder: { uri: string } | null,
    configuration: any
  ): Promise<boolean> {
    const adapterType = configuration.type || 'node';

    const adapter = this.adapters.get(adapterType);
    if (!adapter) {
      console.error(`Debug adapter not found: ${adapterType}`);
      return false;
    }

    try {
      // Create adapter instance
      const adapterInstance = new adapter.implementation();
      const server = adapterInstance.implementProtocol({});

      // Start the adapter
      server.start();

      // Create debug session
      const sessionId = `session_${Date.now()}`;
      this.activeSessions.set(sessionId, {
        adapter,
        server,
        configuration,
        folder,
        state: 'starting',
      });

      // Notify via event
      this.emitEvent('debugSessionStarted', {
        sessionId,
        configuration,
      });

      // Load breakpoints
      this.loadBreakpointsForSession(sessionId);

      return true;
    } catch (error) {
      console.error(`Failed to start debugging: ${error}`);
      this.emitEvent('debugSessionFailed', { error });
      return false;
    }
  }

  async stopDebugging(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.server.stop();
      this.activeSessions.delete(sessionId);
      this.clearBreakpointsForSession(sessionId);
      this.emitEvent('debugSessionEnded', { sessionId });
    }
  }

  async sendRequest(
    sessionId: string,
    command: string,
    args: any
  ): Promise<any> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    // Send request to debug adapter
    if (session.server.sendRequest) {
      return session.server.sendRequest(command, args);
    }

    return Promise.resolve(undefined);
  }

  setBreakpoint(
    sessionId: string,
    uri: string,
    line: number,
    column?: number,
    condition?: string
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Store breakpoint
    const breakpoint = {
      uri,
      line,
      column,
      condition,
      verified: true,
      id: Math.random().toString(36),
    };

    // Add to Monaco editor
    this.addEditorBreakpoint(uri, line);

    // Send to debug adapter
    this.sendRequest(sessionId, 'setBreakpoints', {
      source: { path: uri },
      breakpoints: [breakpoint],
    });

    this.emitEvent('breakpointAdded', { sessionId, breakpoint });
  }

  clearBreakpoint(sessionId: string, uri: string, line: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Remove from Monaco editor
    this.removeEditorBreakpoint(uri, line);

    // Remove from debug adapter
    this.sendRequest(sessionId, 'setBreakpoints', {
      source: { path: uri },
      breakpoints: [],
    });

    this.emitEvent('breakpointRemoved', { sessionId, uri, line });
  }

  toggleBreakpoint(sessionId: string, uri: string, line: number): void {
    const hasBreakpoint = this.hasBreakpoint(sessionId, uri, line);
    if (hasBreakpoint) {
      this.clearBreakpoint(sessionId, uri, line);
    } else {
      this.setBreakpoint(sessionId, uri, line);
    }
  }

  private addEditorBreakpoint(uri: string, line: number): void {
    if (!this.editor) return;

    const model = monaco.editor.getModel(monaco.Uri.parse(uri));
    if (!model) return;

    // Add decoration for breakpoint
    const decoration = this.editor.deltaDecorations([], [{
      range: new monaco.Range(line, 1, line, 1),
      options: {
        className: 'breakpoint-decoration',
        glyphMarginClassName: 'breakpoint-glyph',
        glyphMarginHoverMessage: { value: 'Breakpoint' },
      },
    }]);

    if (!this.breakpoints.has(uri)) {
      this.breakpoints.set(uri, []);
    }
    this.breakpoints.get(uri)!.push(...decoration);
  }

  private removeEditorBreakpoint(uri: string, line: number): void {
    if (!this.editor) return;

    const decorations = this.breakpoints.get(uri) || [];
    const toRemove: string[] = [];

    // Find decorations at line
    for (const dec of decorations) {
      if (dec.range.startLineNumber === line) {
        toRemove.push(dec.id);
      }
    }

    this.editor.deltaDecorations(toRemove, []);
  }

  private hasBreakpoint(sessionId: string, uri: string, line: number): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const breakpoints = this.breakpoints.get(uri) || [];
    return breakpoints.some(dec => dec.range.startLineNumber === line);
  }

  private loadBreakpointsForSession(sessionId: string): void {
    // Load saved breakpoints from storage
    try {
      const stored = localStorage.getItem(`breakpoints_${sessionId}`);
      if (stored) {
        const breakpoints = JSON.parse(stored);
        for (const bp of breakpoints) {
          this.setBreakpoint(sessionId, bp.uri, bp.line);
        }
      }
    } catch (error) {
      console.error('Failed to load breakpoints:', error);
    }
  }

  private clearBreakpointsForSession(sessionId: string): void {
    // Remove all breakpoint decorations
    if (this.editor) {
      const allDecorations: string[] = [];
      this.breakpoints.forEach(decs => {
        allDecorations.push(...decs.map(d => d.id));
      });
      this.editor.deltaDecorations(allDecorations, []);
    }
    this.breakpoints.clear();

    // Clear storage
    localStorage.removeItem(`breakpoints_${sessionId}`);
  }

  private setupBreakpointListeners(): void {
    if (!this.editor) return;

    // Handle breakpoint toggle via editor
    this.editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const position = e.target.position;
        if (position) {
          const model = this.editor?.getModel();
          if (model) {
            const uri = model.uri.toString();
            const activeSession = Array.from(this.activeSessions.values())[0];
            if (activeSession) {
              this.toggleBreakpoint(
                Array.from(this.activeSessions.keys())[0],
                uri,
                position.lineNumber
              );
            }
          }
        }
      }
    });
  }

  getActiveSessions(): Array<{ id: string; configuration: any; state: string }> {
    return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
      id,
      configuration: session.configuration,
      state: session.state,
    }));
  }

  getAllAdapters(): DebugAdapter[] {
    return Array.from(this.adapters.values());
  }

  private emitEvent(event: string, data: any): void {
    const emitter = (window as any).vscodeDebugEventEmitter;
    if (emitter) {
      emitter.emit(event, data);
    }
  }

  dispose(): void {
    // Stop all sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.stopDebugging(sessionId);
    }

    this.adapters.clear();
    this.activeSessions.clear();
    this.breakpoints.clear();
  }
}
