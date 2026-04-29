import { create } from 'zustand';
import type { Extension } from '../extensions/types';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parentId: string | null;
  isOpen?: boolean;
  isDirty?: boolean;
}

interface IDEState {
  files: FileNode[];
  activeFileId: string | null;
  openTabs: string[];
  sidebarVisible: boolean;
  terminalVisible: boolean;
  chatVisible: boolean;
  
  // UI State
  vibeMode: boolean;
  commandPaletteOpen: boolean;
  rightPanelTab: 'chat' | 'preview';
  activeSidebarTab: 'explorer' | 'search' | 'git' | 'extensions';
  showSettingsModal: boolean;
  showOnboarding: boolean;
  showDeployModal: boolean;
  
  // Mobile State
  mobileTab: 'editor' | 'terminal' | 'ai' | 'files';
  deviceType: 'phone' | 'tablet' | 'desktop';
  isLandscape: boolean;
  
  // Cloud & Compute State
  storageProvider: 'local' | 'gdrive' | 'terabox';
  isStorageConnected: boolean;
  computeUrl: string;
  isComputeConnected: boolean;
  ngrokToken: string;
  showSetupModal: boolean;
  
  // Editor Settings
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  showMinimap: boolean;
  showLineNumbers: boolean;
  autoSave: boolean;

  // Extension State
  installedExtensions: Extension[];
  activeExtensions: string[];
  selectedExtensionId: string | null;
  extensionSearchQuery: string;
  autoUpdateEnabled: boolean;

  // Actions...
  setFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
  setWordWrap: (wrap: 'on' | 'off') => void;
  setShowMinimap: (show: boolean) => void;
  setShowLineNumbers: (show: boolean) => void;
  setAutoSave: (auto: boolean) => void;
  
  setVibeMode: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setRightPanelTab: (tab: 'chat' | 'preview') => void;
  setActiveSidebarTab: (tab: 'explorer' | 'search' | 'git' | 'extensions') => void;
  setShowSettingsModal: (show: boolean) => void;
  setShowOnboarding: (show: boolean) => void;
  setShowDeployModal: (show: boolean) => void;
  setFiles: (files: FileNode[]) => void;
  addFile: (name: string, type: 'file' | 'folder', parentId: string | null, content?: string) => string;
  updateFileContent: (id: string, content: string) => void;
  renameFile: (id: string, newName: string) => void;
  toggleFolder: (id: string) => void;
  collapseAllFolders: () => void;
  saveFile: (id: string) => void;
  deleteFile: (id: string) => void;
  setActiveFile: (id: string | null) => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  toggleChat: () => void;
  setMobileTab: (tab: 'editor' | 'terminal' | 'ai' | 'files') => void;
  setDeviceState: (type: 'phone' | 'tablet' | 'desktop', isLandscape: boolean) => void;
  
  // Connection Actions
  setStorageProvider: (provider: 'local' | 'gdrive' | 'terabox') => void;
  setStorageConnected: (connected: boolean) => void;
  setComputeUrl: (url: string) => void;
  setComputeConnected: (connected: boolean) => void;
  setNgrokToken: (token: string) => void;
  setShowSetupModal: (show: boolean) => void;
  
  // Colab Session State
  colabSessionId: string | null;
  colabActive: boolean;
  colabRemainingTime: string;
  colabMetrics: { executedCells: number; totalExecutionTime: number; gpuUtilization?: number } | null;
  setColabSessionId: (id: string | null) => void;
  setColabActive: (active: boolean) => void;
  setColabRemainingTime: (time: string) => void;
  setColabMetrics: (metrics: any) => void;
  
  // Gateway State
  activeGateway: string;
  availableGateways: string[];
  isGatewayConnecting: boolean;
  setActiveGateway: (gateway: string) => void;
  setAvailableGateways: (gateways: string[]) => void;
  setIsGatewayConnecting: (connecting: boolean) => void;
  
  // Collaboration State
  collaborationMode: boolean;
  collaborators: Array<{ id: string; name: string; color: string; cursor?: { line: number; column: number } }>;
  documentId: string | null;
  setCollaborationMode: (mode: boolean) => void;
  setCollaborators: (collaborators: any[]) => void;
  setDocumentId: (id: string | null) => void;
  addCollaborator: (collaborator: any) => void;
  removeCollaborator: (id: string) => void;
  
  // AI State
  aiEnabled: boolean;
  aiModel: 'claude' | 'gpt' | 'gemini';
  aiCompletionEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  setAiModel: (model: 'claude' | 'gpt' | 'gemini') => void;
  setAiCompletionEnabled: (enabled: boolean) => void;
}

const initialFiles: FileNode[] = [
  { id: 'root', name: 'VOID Projects', type: 'folder', parentId: null, isOpen: true },
  { id: '1', name: 'App.tsx', type: 'file', content: 'export default function App() {\n  return <div>Hello VOID</div>;\n}', parentId: 'root' },
  { id: '2', name: 'index.css', type: 'file', content: '@import "tailwindcss";', parentId: 'root' },
];

export const useStore = create<IDEState>((set) => ({
  files: initialFiles,
  activeFileId: '1',
  openTabs: ['1'],
  sidebarVisible: false,
  terminalVisible: false,
  chatVisible: true,
  
  vibeMode: false,
  commandPaletteOpen: false,
  rightPanelTab: 'chat',
  activeSidebarTab: 'explorer',
  showSettingsModal: false,
  showOnboarding: true,
  showDeployModal: false,
  
  mobileTab: 'editor',
  deviceType: 'desktop',
  isLandscape: true,
  
  // Editor Settings Defaults
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  showMinimap: false,
  showLineNumbers: true,
  autoSave: false,

  // Extension State
  installedExtensions: [],
  activeExtensions: [],
  selectedExtensionId: null,
  extensionSearchQuery: '',
  autoUpdateEnabled: true,
  
  storageProvider: 'local',
  isStorageConnected: false,
  computeUrl: '',
  isComputeConnected: false,
  ngrokToken: '',
  showSetupModal: false,
  
  // Colab Defaults
  colabSessionId: null,
  colabActive: false,
  colabRemainingTime: '0h 0m',
  colabMetrics: null,
  
  // Gateway Defaults
  activeGateway: 'colab',
  availableGateways: ['local', 'colab'],
  isGatewayConnecting: false,
  
  // Collaboration Defaults
  collaborationMode: false,
  collaborators: [],
  documentId: null,
  
  // AI Defaults
  aiEnabled: true,
  aiModel: 'claude',
  aiCompletionEnabled: true,

  setFontSize: (size) => set({ fontSize: size }),
  setTabSize: (size) => set({ tabSize: size }),
  setWordWrap: (wrap) => set({ wordWrap: wrap }),
  setShowMinimap: (show) => set({ showMinimap: show }),
  setShowLineNumbers: (show) => set({ showLineNumbers: show }),
  setAutoSave: (auto) => set({ autoSave: auto }),

  setFiles: (files) => set({ files }),
  
  addFile: (name, type, parentId, content = '') => {
    const id = Math.random().toString(36).substring(7);
    const newNode: FileNode = { id, name, type, content, parentId, isOpen: true };
    set((state) => ({ files: [...state.files, newNode] }));
    return id;
  },

  updateFileContent: (id, content) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, content, isDirty: true } : f)
  })),

  renameFile: (id, newName) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, name: newName } : f)
  })),

  toggleFolder: (id) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f)
  })),

  collapseAllFolders: () => set((state) => ({
    files: state.files.map(f => f.type === 'folder' ? { ...f, isOpen: false } : f)
  })),

  saveFile: (id) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, isDirty: false } : f)
  })),

  deleteFile: (id) => set((state) => ({
    files: state.files.filter(f => f.id !== id),
    openTabs: state.openTabs.filter(tid => tid !== id),
    activeFileId: state.activeFileId === id ? null : state.activeFileId
  })),

  setActiveFile: (id) => set((state) => {
    if (!id) return { activeFileId: null };
    const newTabs = state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id];
    return { activeFileId: id, openTabs: newTabs, mobileTab: 'editor' };
  }),

  openTab: (id) => set((state) => ({
    openTabs: state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id],
    activeFileId: id,
    mobileTab: 'editor'
  })),

  closeTab: (id) => set((state) => {
    const newTabs = state.openTabs.filter(tid => tid !== id);
    let newActive = state.activeFileId;
    if (state.activeFileId === id) {
      newActive = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null;
    }
    return { openTabs: newTabs, activeFileId: newActive };
  }),

  closeAllTabs: () => set({ openTabs: [], activeFileId: null }),

  closeOtherTabs: (id) => set({ openTabs: [id], activeFileId: id }),

  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  toggleTerminal: () => set((state) => ({ terminalVisible: !state.terminalVisible })),
  toggleChat: () => set((state) => ({ chatVisible: !state.chatVisible })),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setDeviceState: (type, isLandscape) => set({ deviceType: type, isLandscape }),
  
  setVibeMode: (v) => set({ vibeMode: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),
  setShowDeployModal: (show) => set({ showDeployModal: show }),
  
  setStorageProvider: (provider) => set({ storageProvider: provider }),
  setStorageConnected: (connected) => set({ isStorageConnected: connected }),
  setComputeUrl: (url) => set({ computeUrl: url }),
  setComputeConnected: (connected) => set({ isComputeConnected: connected }),
  setNgrokToken: (token) => set({ ngrokToken: token }),
  setShowSetupModal: (show) => set({ showSetupModal: show }),
  
  // Colab Actions
  setColabSessionId: (id) => set({ colabSessionId: id }),
  setColabActive: (active) => set({ colabActive: active }),
  setColabRemainingTime: (time) => set({ colabRemainingTime: time }),
  setColabMetrics: (metrics) => set({ colabMetrics: metrics }),
  
  // Gateway Actions
  setActiveGateway: (gateway) => set({ activeGateway: gateway }),
  setAvailableGateways: (gateways) => set({ availableGateways: gateways }),
  setIsGatewayConnecting: (connecting) => set({ isGatewayConnecting: connecting }),
  
  // Collaboration Actions
  setCollaborationMode: (mode) => set({ collaborationMode: mode }),
  setCollaborators: (collaborators) => set({ collaborators }),
  setDocumentId: (id) => set({ documentId: id }),
  addCollaborator: (collaborator) => set((state) => ({
    collaborators: [...state.collaborators, collaborator]
  })),
  removeCollaborator: (id) => set((state) => ({
    collaborators: state.collaborators.filter(c => c.id !== id)
  })),
  
  // AI Actions
  setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
  setAiModel: (model) => set({ aiModel: model }),
  setAiCompletionEnabled: (enabled) => set({ aiCompletionEnabled: enabled }),

  // Extension Actions
  setInstalledExtensions: (extensions) => set({ installedExtensions: extensions }),
  addInstalledExtension: (extension) => set((state) => ({
    installedExtensions: [...state.installedExtensions, extension],
    activeExtensions: extension.enabled ? [...state.activeExtensions, extension.id] : state.activeExtensions,
  })),
  removeInstalledExtension: (extensionId) => set((state) => ({
    installedExtensions: state.installedExtensions.filter(e => e.id !== extensionId),
    activeExtensions: state.activeExtensions.filter(id => id !== extensionId),
  })),
  toggleExtensionEnabled: (extensionId) => set((state) => {
    const extension = state.installedExtensions.find(e => e.id === extensionId);
    if (!extension) return state;

    const enabled = !extension.enabled;
    return {
      installedExtensions: state.installedExtensions.map(e =>
        e.id === extensionId ? { ...e, enabled } : e
      ),
      activeExtensions: enabled
        ? [...state.activeExtensions, extensionId]
        : state.activeExtensions.filter(id => id !== extensionId),
    };
  }),
  setSelectedExtension: (id) => set({ selectedExtensionId: id }),
  setExtensionSearchQuery: (query) => set({ extensionSearchQuery: query }),
  setAutoUpdateEnabled: (enabled) => set({ autoUpdateEnabled: enabled }),
}));
