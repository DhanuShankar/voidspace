import type { Editor } from 'monaco-editor';
import type { ExtensionContext } from '../ExtensionContext';
import type { Command } from '../commands';
import type { FileSystem } from '../filesystem';
import type { Configuration } from '../configuration';
import type { Extensions } from '../extensions';
import type { Logging } from '../logging';

/**
 * VSCode-like extension API for Monaco Editor
 * This module exports all the extension point APIs that are available to extensions.
 */

export * from './ExtensionContext';
export * from './ExtensionHost';
export * from './ExtensionManager';
export * from './ExtensionStorage';
export * from './ThemeManager';
export * from './KeybindingManager';
export * from './LanguageServerManager';
export * from './DebugAdapterManager';
export * from './types';
export * from './commands';
export * from './filesystem';
export * from './configuration';
export * from './extensions';
export * from './logging';

// Extend Window interface to include VSCode API
declare global {
  interface Window {
    vscode: {
      // Editor
      editor?: any;
      // Workspace
      workspace: {
        getConfiguration(section: string): any;
        getTextDocument(uri: string): any;
        findFiles(include?: string, exclude?: string, maxResults?: number): Promise<any[]>;
        onDidChangeWorkspaceFolders: any;
        getWorkspaceFolders(): any[];
      };
      // Extensions
      extensions: {
        all: () => any[];
        getExtension(id: string): any;
      };
      // Commands
      commands: {
        registerCommand(command: string, handler: (...args: any[]) => any, thisArg?: any): { dispose: () => void };
        executeCommand(command: string, ...args: any[]): Promise<any>;
      };
      // Windows
      window: {
        showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
        showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
        showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
        showInputBox(options?: { prompt?: string; value?: string; placeHolder?: string }): Promise<string | undefined>;
        showOpenDialog(options?: any): Promise<any>;
        showSaveDialog(options?: any): Promise<any>;
      };
      // Storage
      storage: {
        get: (key: string) => any;
        set: (key: string, value: any) => void;
      };
      // Theme
      theme: {
        getColorTheme(): any;
        setColorTheme(theme: string): void;
      };
      // Logging
      logging: {
        getChannel(channel: string): any;
      };
      // Environment
      env: {
        appName: string;
        appRoot: string;
        logPath: string;
        extensionHostKind: 'local' | 'web';
        remoteName: string | undefined;
        uiKind: 'desktop' | 'web';
        device: 'desktop' | 'tablet' | 'phone';
        clipboard: {
          readText(): string | undefined;
          writeText(text: string): Promise<void>;
        };
        shell: {
          openExternal(url: string): Promise<any>;
        };
        machineId: string;
        sessionId: string;
      };
    };
  }
}

export {};
