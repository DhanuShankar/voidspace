import type * as monaco from 'monaco-editor';
import type { Keybinding } from './types';

export class KeybindingManager {
  private keybindings: Map<string, Keybinding> = new Map();
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private disposables: monaco.IDisposable[] = [];
  private userKeybindings: Keybinding[] = [];

  constructor() {
    this.loadUserKeybindings();
  }

  private loadUserKeybindings(): void {
    try {
      const stored = localStorage.getItem('user_keybindings');
      if (stored) {
        this.userKeybindings = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load user keybindings:', error);
    }
  }

  private saveUserKeybindings(): void {
    try {
      localStorage.setItem('user_keybindings', JSON.stringify(this.userKeybindings));
    } catch (error) {
      console.error('Failed to save user keybindings:', error);
    }
  }

  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    this.registerAllKeybindings();
  }

  registerKeybinding(
    binding: Keybinding | { command: string; keybinding: string; when?: string },
    handler: () => void,
    editor: monaco.editor.IStandaloneCodeEditor
  ): string {
    const id = `keybinding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const keybinding: Keybinding = {
      id,
      command: binding.command,
      keybinding: binding.keybinding,
      when: binding.when,
      ...binding,
    };

    this.keybindings.set(id, keybinding);

    // Register with Monaco editor
    if (editor) {
      this.registerWithMonaco(keybinding, handler, editor);
    }

    return id;
  }

  private registerWithMonaco(
    keybinding: Keybinding,
    handler: () => void,
    editor: monaco.editor.IStandaloneCodeEditor
  ): monaco.IDisposable {
    // Parse keybinding string
    const keyCode = this.parseKeybinding(keybinding.keybinding);

    if (!keyCode) {
      console.warn(`Invalid keybinding: ${keybinding.keybinding}`);
      return { dispose: () => {} };
    }

    // Register with Monaco
    const disposable = editor.addCommand(keyCode, handler, keybinding.when);

    this.disposables.push(disposable);
    return disposable;
  }

  private parseKeybinding(keybinding: string): monaco.KeyCode | null {
    // Simple conversion of common keybindings to Monaco key codes
    const keyMap: { [key: string]: monaco.KeyCode } = {
      'Ctrl+S': monaco.KeyCode.KeyS | monaco.KeyMod.CtrlCmd,
      'Ctrl+C': monaco.KeyCode.KeyC | monaco.KeyMod.CtrlCmd,
      'Ctrl+V': monaco.KeyCode.KeyV | monaco.KeyMod.CtrlCmd,
      'Ctrl+X': monaco.KeyCode.KeyX | monaco.KeyMod.CtrlCmd,
      'Ctrl+Z': monaco.KeyCode.KeyZ | monaco.KeyMod.CtrlCmd,
      'Ctrl+Y': monaco.KeyCode.KeyY | monaco.KeyMod.CtrlCmd,
      'Ctrl+Shift+Z': monaco.KeyCode.KeyZ | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+F': monaco.KeyCode.KeyF | monaco.KeyMod.CtrlCmd,
      'Ctrl+H': monaco.KeyCode.KeyH | monaco.KeyMod.CtrlCmd,
      'Ctrl+G': monaco.KeyCode.KeyG | monaco.KeyMod.CtrlCmd,
      'F12': monaco.KeyCode.F12,
      'Shift+F12': monaco.KeyCode.F12 | monaco.KeyMod.Shift,
      'Ctrl+Space': monaco.KeyCode.Space | monaco.KeyMod.CtrlCmd,
      'Ctrl+Shift+O': monaco.KeyCode.KeyO | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+Shift+P': monaco.KeyCode.KeyP | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+`': monaco.KeyCode.Backtick | monaco.KeyMod.CtrlCmd,
      'Ctrl+\\': monaco.KeyCode.Backslash | monaco.KeyMod.CtrlCmd,
      'Ctrl+=': monaco.KeyCode.Equal | monaco.KeyMod.CtrlCmd,
      'Ctrl+-': monaco.KeyCode.Minus | monaco.KeyMod.CtrlCmd,
      'Ctrl+0': monaco.KeyCode.Digit0 | monaco.KeyMod.CtrlCmd,
      'Ctrl+1': monaco.KeyCode.Digit1 | monaco.KeyMod.CtrlCmd,
      'Ctrl+2': monaco.KeyCode.Digit2 | monaco.KeyMod.CtrlCmd,
      'Ctrl+3': monaco.KeyCode.Digit3 | monaco.KeyMod.CtrlCmd,
      'Ctrl+4': monaco.KeyCode.Digit4 | monaco.KeyMod.CtrlCmd,
      'Ctrl+5': monaco.KeyCode.Digit5 | monaco.KeyMod.CtrlCmd,
      'Ctrl+6': monaco.KeyCode.Digit6 | monaco.KeyMod.CtrlCmd,
      'Ctrl+7': monaco.KeyCode.Digit7 | monaco.KeyMod.CtrlCmd,
      'Ctrl+8': monaco.KeyCode.Digit8 | monaco.KeyMod.CtrlCmd,
      'Ctrl+9': monaco.KeyCode.Digit9 | monaco.KeyMod.CtrlCmd,
      'Alt+Left': monaco.KeyCode.Left | monaco.KeyMod.Alt,
      'Alt+Right': monaco.KeyCode.Right | monaco.KeyMod.Alt,
      'Alt+Up': monaco.KeyCode.Up | monaco.KeyMod.Alt,
      'Alt+Down': monaco.KeyCode.Down | monaco.KeyMod.Alt,
      'Shift+Alt+F': monaco.KeyCode.KeyF | monaco.KeyMod.Shift | monaco.KeyMod.Alt,
      'Ctrl+Shift+F': monaco.KeyCode.KeyF | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+Shift+I': monaco.KeyCode.KeyI | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+Shift+D': monaco.KeyCode.KeyD | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+Shift+L': monaco.KeyCode.KeyL | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'Ctrl+Shift+U': monaco.KeyCode.KeyU | monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift,
      'F3': monaco.KeyCode.F3,
      'Shift+F3': monaco.KeyCode.F3 | monaco.KeyMod.Shift,
    };

    return keyMap[keybinding] || null;
  }

  private registerAllKeybindings(): void {
    if (!this.editor) return;

    // Clear existing
    this.disposeAll();

    // Register built-in keybindings
    const builtIn = this.getBuiltInKeybindings();
    for (const binding of builtIn) {
      const handler = this.createHandler(binding.command);
      this.registerWithMonaco(binding, handler, this.editor);
    }

    // Register user keybindings
    for (const binding of this.userKeybindings) {
      const handler = this.createHandler(binding.command);
      this.registerWithMonaco(binding, handler, this.editor);
    }
  }

  private getBuiltInKeybindings(): Keybinding[] {
    return [
      {
        id: 'builtin.save',
        command: 'workbench.action.files.save',
        keybinding: 'Ctrl+S',
      },
      {
        id: 'builtin.saveAll',
        command: 'workbench.action.files.saveAll',
        keybinding: 'Ctrl+Shift+S',
      },
      {
        id: 'builtin.find',
        command: 'actions.find',
        keybinding: 'Ctrl+F',
      },
      {
        id: 'builtin.replace',
        command: 'editor.action.replace',
        keybinding: 'Ctrl+H',
      },
      {
        id: 'builtin.format',
        command: 'editor.action.formatDocument',
        keybinding: 'Shift+Alt+F',
      },
      {
        id: 'builtin.gotoDefinition',
        command: 'editor.action.revealDefinition',
        keybinding: 'F12',
      },
      {
        id: 'builtin.quickFix',
        command: 'editor.action.quickFix',
        keybinding: 'Ctrl+.',
      },
      {
        id: 'builtin.comment',
        command: 'editor.action.commentLine',
        keybinding: 'Ctrl+/',
      },
      {
        id: 'builtin.toggleTerminal',
        command: 'workbench.action.terminal.toggleTerminal',
        keybinding: 'Ctrl+`',
      },
      {
        id: 'builtin.showCommandPalette',
        command: 'workbench.action.showCommands',
        keybinding: 'Ctrl+Shift+P',
      },
      {
        id: 'builtin.openSettings',
        command: 'workbench.action.openSettings',
        keybinding: 'Ctrl+,',
      },
    ];
  }

  private createHandler(command: string): () => void {
    return () => {
      // Execute command through VSCode API or internal command registry
      const vscode = (window as any).vscode;
      if (vscode?.commands?.executeCommand) {
        vscode.commands.executeCommand(command);
      } else {
        // Fallback to command registry
        this.executeLocalCommand(command);
      }
    };
  }

  private executeLocalCommand(command: string): void {
    const commandMap: { [key: string]: () => void } = {
      'workbench.action.files.save': () => {
        const event = new CustomEvent('monaco-command', { detail: { command } });
        window.dispatchEvent(event);
      },
      'workbench.action.files.saveAll': () => {
        const event = new CustomEvent('monaco-command', { detail: { command } });
        window.dispatchEvent(event);
      },
      'editor.action.formatDocument': () => {
        const event = new CustomEvent('monaco-command', { detail: { command } });
        window.dispatchEvent(event);
      },
      'actions.find': () => {
        const event = new CustomEvent('monaco-command', { detail: { command } });
        window.dispatchEvent(event);
      },
    };

    if (commandMap[command]) {
      commandMap[command]();
    }
  }

  unregisterKeybinding(id: string): void {
    const binding = this.keybindings.get(id);
    if (binding) {
      // Remove from user keybindings
      this.userKeybindings = this.userKeybindings.filter(k => k.id !== id);
      this.keybindings.delete(id);
      this.saveUserKeybindings();

      // Re-register all
      this.registerAllKeybindings();
    }
  }

  addUserKeybinding(keybinding: Keybinding): void {
    this.userKeybindings.push(keybinding);
    this.saveUserKeybindings();
    this.registerAllKeybindings();
  }

  removeUserKeybinding(command: string): void {
    this.userKeybindings = this.userKeybindings.filter(k => k.command !== command);
    this.saveUserKeybindings();
    this.registerAllKeybindings();
  }

  getKeybindingForCommand(command: string): Keybinding | undefined {
    return [...this.keybindings.values()].find(k => k.command === command);
  }

  getAllKeybindings(): Keybinding[] {
    return [
      ...this.getBuiltInKeybindings(),
      ...this.userKeybindings,
    ];
  }

  resetToDefaults(): void {
    this.userKeybindings = [];
    this.saveUserKeybindings();
    this.registerAllKeybindings();
  }

  exportKeybindings(): string {
    return JSON.stringify(this.userKeybindings, null, 2);
  }

  importKeybindings(json: string): void {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.userKeybindings = imported;
        this.saveUserKeybindings();
        this.registerAllKeybindings();
      }
    } catch (error) {
      console.error('Failed to import keybindings:', error);
    }
  }

  dispose(): void {
    this.disposeAll();
    this.keybindings.clear();
  }

  private disposeAll(): void {
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        // Ignore disposal errors
      }
    }
    this.disposables = [];
  }
}
