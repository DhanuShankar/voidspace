export interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  publisher: string;
  icon?: string;
  entryPoint: string; // URL or path to extension bundle
  manifest: ExtensionManifest;
  installedAt: Date;
  enabled: boolean;
  dependencies?: string[];
  repository?: string;
  bugs?: string;
  homepage?: string;
  readme?: string;
  changelog?: string;
  size: number;
  downloads: number;
  rating: number;
  reviews: number;
  lastUpdated: Date;
  categories: string[];
  tags: string[];
  isBuiltin?: boolean;
  path?: string; // Local filesystem path
}

export interface ExtensionManifest {
  version: string;
  engines: { vscode: string };
  activationEvents: ActivationEvent[];
  main: string;
  contributes?: {
    commands?: CommandContribution[];
    menus?: MenuContribution[];
    keybindings?: KeybindingContribution[];
    languages?: LanguageContribution[];
    grammars?: GrammarContribution[];
    themes?: ThemeContribution[];
    configuration?: ConfigurationContribution;
    snippets?: SnippetContribution[];
    debuggers?: DebuggerContribution[];
    problemMatchers?: ProblemMatcherContribution[];
  };
  capabilities?: ExtensionCapabilities;
  extensionDependencies?: ExtensionDependency[];
  extensionPack?: string[];
  extensionKind?: 'workspace' | 'ui';
  icon?: string;
  badges?: Badge[];
  displayName?: string;
  description?: string;
  publisher: string;
  license?: string;
  repository?: { url: string; type: string };
  bugs?: { url: string };
  homepage?: string;
  keywords?: string[];
  categories?: string[];
  preview?: boolean;
  qna?: string;
  sponsors?: { url: string }[];
}

export interface ActivationEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLanguage?: string | any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCommand?: string | any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDebug?: boolean | any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onView?: string | any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  '*': boolean | any[];
  [key: string]: any;
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: { id: string };
  tooltip?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  when?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments?: any[];
}

export interface MenuContribution {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  when?: any;
  groups?: { id: string; order?: number }[];
  items?: string[];
}

export interface KeybindingContribution {
  command: string;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  when?: any;
  mac?: string;
  linux?: string;
  win?: string;
}

export interface LanguageContribution {
  id: string;
  extensions: string[];
  aliases?: string[];
  configuration?: string;
  icon?: { id: string; dark?: string; light?: string };
}

export interface GrammarContribution {
  language: string;
  scopeName: string;
  path: string;
  injectTo?: string[];
  embeddedLanguages?: { [scope: string]: string };
}

export interface ThemeContribution {
  id: string;
  label: string;
  path: string;
  description?: string;
}

export interface ConfigurationContribution {
  properties: { [key: string]: ConfigurationProperty };
  type: 'object';
}

export interface ConfigurationProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: any;
  description?: string;
  enum?: any[];
  format?: string;
  items?: { type: string };
  properties?: { [key: string]: ConfigurationProperty };
}

export interface SnippetContribution {
  language: string;
  path: string;
}

export interface DebuggerContribution {
  type: string;
  label: string;
  program: string;
  runtime?: string;
  configurationAttributes: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface ProblemMatcherContribution {
  name: string;
  owner: string;
  fileLocation?: string;
  pattern: {
    regexp: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  } | { regexp: string; file?: number; line?: number; column?: number; message?: number; code?: number; severity?: number }[];
  severity?: string;
  background?: {
    activeOnStart?: string;
    beginsOnStart?: string;
    endsOnStart?: string;
    beginsPattern?: { regexp: string };
    endsPattern?: { regexp: string };
  };
  watcher?: {
    activeOnStart?: boolean;
    beginOnStart?: string;
    endOnStart?: string;
    beginPattern?: { regexp: string };
    endPattern?: { regexp: string };
  };
}

export interface ExtensionCapabilities {
  virtualWorkspaces?: boolean;
  untrustedWorkspaces?: boolean;
  workspaceTrust?: boolean;
}

export interface ExtensionDependency {
  extensionId: string;
  version: string;
}

export interface Badge {
  url: string;
  href?: string;
  description?: string;
}

export interface ExtensionContext {
  extension: Extension;
  subscriptions: (() => void)[];
  extensionMode: 'development' | 'production';
  globalState: Map<string, any>;
  workspaceState: Map<string, any>;
  extensionUri: any; // vscode-like URI
  storagePath: string;

  getStorageValue(key: string): any;
  setStorageValue(key: string, value: any): void;
  dispose(): void;
}

export interface LanguageServer {
  id: string;
  name: string;
  command: string;
  initializationOptions?: any;
  settings?: any;
  client?: any; // Language server client instance
}

export interface DebugAdapter {
  type: string;
  label: string;
  implementation: new () => DebugAdapterDescriptor;
}

export interface DebugAdapterDescriptor {
  implementProtocol: (options: any) => DebugAdapterServer;
}

export interface DebugAdapterServer {
  start(): void;
  stop(): void;
  on(event: string, handler: (...args: any[]) => void): void;
}

export interface MarketplaceExtension {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  downloads: number;
  rating: number;
  iconUrl?: string;
  versionHistory?: string[];
  installCount: number;
  averageRating: number;
  averageRatingBreakdown: {
    [key: number]: number; // 1-5 stars
  };
  file: {
    size: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  lastUpdated: Date;
  categories: string[];
  tags: string[];
  screenshots?: { url: string; label?: string }[];
  repository?: string;
  license?: string;
  sponsor?: string;
}

export interface MarketplaceSearchOptions {
  text?: string;
  category?: string;
  tag?: string;
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'updated';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ExtensionUpdate {
  id: string;
  version: string;
  downloadUrl: string;
  changelog?: string;
  publishedDate: Date;
}

export interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark' | 'hc';
  colors: { [key: string]: string };
  tokenColors?: Array<{ scope: string; settings: { [key: string]: string } }>;
}

export interface Keybinding {
  id: string;
  command: string;
  keybinding: string;
  when?: string;
  mac?: string;
  linux?: string;
  win?: string;
}
