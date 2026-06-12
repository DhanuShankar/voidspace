import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { Terminal } from './components/Terminal';
import { AIChat } from './components/AIChat';
import { CloudSetupModal } from './components/CloudSetupModal';
import { CommandPalette } from './components/CommandPalette';
import { LivePreview } from './components/LivePreview';
import { GlobalSearch } from './components/GlobalSearch';
import { GitPanel } from './components/GitPanel';
import { ExtensionsPanel } from './components/ExtensionsPanel';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { DeployModal } from './components/DeployModal';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { useStore } from './store';
import {
  PanelLeft,
  Search,
  Command,
  Sparkles,
  CloudUpload,
  Cloud,
  Play,
  Files,
  GitBranch,
  Blocks,
  Terminal as TerminalIcon,
  MessageSquare,
  Settings,
  Code,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);

  // Check if user is logged in on mount
  React.useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    if (token && userData) {
      setIsLoggedIn(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      // User is already logged in, show IDE
    } else {
      // Show auth modal
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setIsLoggedIn(false);
    setUser(null);
  };

  // Show landing page if not logged in
  if (!isLoggedIn) {
    return (
      <>
        <LandingPage onGetStarted={handleGetStarted} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  // Show IDE if logged in
  return <IDEInterface user={user} onLogout={handleLogout} />;
}

// IDE Interface Component
function IDEInterface({ user, onLogout }: { user: any; onLogout: () => void }) {
  const {
    sidebarVisible,
    terminalVisible,
    chatVisible,
    toggleSidebar,
    toggleTerminal,
    toggleChat,
    openTabs,
    activeFileId,
    setActiveFile,
    closeTab,
    files,
    setShowSetupModal,
    storageProvider,
    isComputeConnected,
    mobileTab,
    setMobileTab,
    rightPanelTab,
    setRightPanelTab,
    setCommandPaletteOpen,
    activeSidebarTab,
    setActiveSidebarTab,
    setShowSettingsModal,
    setShowDeployModal,
    saveFile,
    deviceType,
    isLandscape,
    setDeviceState,
    vibeMode,
    setVibeMode,
    closeAllTabs,
    closeOtherTabs,
  } = useStore();

  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; tabId: string } | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const getDevice = () => {
      const w = window.innerWidth;
      if (w < 640) return 'phone';
      if (w < 1024) return 'tablet';
      return 'desktop';
    };

    const handleResize = () => {
      const type = getDevice();
      const landscape = window.innerWidth > window.innerHeight;
      setDeviceState(type, landscape);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setDeviceState]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFileId) {
          saveFile(activeFileId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, saveFile]);

  return (
    <div className="h-screen w-screen flex flex-col bg-void-bg text-zinc-200 overflow-hidden font-sans selection:bg-void-violet/30">
      <OnboardingFlow />
      <DeployModal />
      <CloudSetupModal />
      <CommandPalette />
      <SettingsModal />

      {contextMenu && (
        <div 
          className="fixed z-[200] bg-void-panel border border-void-border rounded-md shadow-2xl py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button 
            className="w-full text-left px-4 py-1.5 text-xs text-zinc-300 hover:bg-void-violet/20 hover:text-void-cyan transition-colors"
            onClick={() => {
              closeTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close
          </button>
          <button 
            className="w-full text-left px-4 py-1.5 text-xs text-zinc-300 hover:bg-void-violet/20 hover:text-void-cyan transition-colors"
            onClick={() => {
              closeOtherTabs(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close Others
          </button>
          <button 
            className="w-full text-left px-4 py-1.5 text-xs text-zinc-300 hover:bg-void-violet/20 hover:text-void-cyan transition-colors"
            onClick={() => {
              closeAllTabs();
              setContextMenu(null);
            }}
          >
            Close All
          </button>
        </div>
      )}
      
      {/* Top Header */}
      <header className="h-12 border-b border-void-border flex items-center px-4 justify-between bg-void-panel shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-void-violet to-void-cyan rounded flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
              <span className="text-white font-black text-xs">V</span>
            </div>
            <span className="font-black tracking-tighter text-lg italic hidden sm:block">VOID</span>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-500">
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">File</span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">Selection</span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">View</span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">Go</span>
          </nav>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <div 
            onClick={() => setCommandPaletteOpen(true)}
            className="bg-void-bg border border-void-border rounded-md px-3 py-1.5 flex items-center gap-2 text-zinc-500 text-xs cursor-pointer hover:border-void-violet/50 transition-colors"
          >
            <Search size={14} />
            <span className="flex-1">Search project or commands...</span>
            <div className="flex items-center gap-1 opacity-50">
              <Command size={12} />
              <span>Shift+P</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setVibeMode(!vibeMode)}
            className={cn("hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border", vibeMode ? "bg-void-violet/20 border-void-violet text-void-violet shadow-[0_0_10px_rgba(124,58,237,0.3)]" : "bg-void-bg border-void-border text-zinc-500 hover:text-zinc-300")}
            title="Toggle Vibe Mode"
          >
            <Sparkles size={14} className={vibeMode ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">Vibe Mode</span>
          </button>
          <button 
            onClick={() => setShowDeployModal(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-void-cyan hover:bg-cyan-400 text-black rounded-md text-xs font-bold transition-all shadow-[0_0_10px_rgba(34,211,238,0.3)]"
          >
            <CloudUpload size={14} />
            <span className="hidden sm:inline">Deploy</span>
          </button>
          <button 
            onClick={() => setShowSetupModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-void-bg hover:bg-void-border/50 text-zinc-300 rounded-md text-xs font-bold transition-all border border-void-border"
          >
            <Cloud size={14} className={storageProvider !== 'local' ? "text-void-cyan" : ""} />
            <span className="hidden sm:inline">Cloud Setup</span>
          </button>
          <button 
            onClick={() => setRightPanelTab('preview')}
            className="flex items-center gap-2 px-3 py-1.5 bg-void-violet hover:bg-violet-500 text-white rounded-md text-xs font-bold transition-all shadow-[0_0_10px_rgba(124,58,237,0.3)]"
          >
            <Play size={14} fill="currentColor" />
            <span className="hidden sm:inline">Run</span>
          </button>
        </div>
      </header>

      {/* Desktop Layout */}
      <div className="flex-1 hidden md:flex overflow-hidden">
        {/* Left Activity Bar */}
        <aside className="w-12 border-r border-void-border flex flex-col items-center py-4 gap-6 bg-void-panel shrink-0">
          <button 
            onClick={() => {
              if (activeSidebarTab === 'explorer' && sidebarVisible) {
                toggleSidebar();
              } else {
                setActiveSidebarTab('explorer');
                if (!sidebarVisible) toggleSidebar();
              }
            }}
            className={cn("p-2 rounded-lg transition-all", activeSidebarTab === 'explorer' && sidebarVisible ? "text-void-cyan bg-void-cyan/10" : "text-zinc-500 hover:text-zinc-200")}
            title="Explorer (Ctrl+Shift+E)"
          >
            <Files size={20} />
          </button>
          <button 
            onClick={() => {
              if (activeSidebarTab === 'search' && sidebarVisible) {
                toggleSidebar();
              } else {
                setActiveSidebarTab('search');
                if (!sidebarVisible) toggleSidebar();
              }
            }}
            className={cn("p-2 rounded-lg transition-all", activeSidebarTab === 'search' && sidebarVisible ? "text-void-cyan bg-void-cyan/10" : "text-zinc-500 hover:text-zinc-200")}
            title="Search (Ctrl+Shift+F)"
          >
            <Search size={20} />
          </button>
          <button 
            onClick={() => {
              if (activeSidebarTab === 'git' && sidebarVisible) {
                toggleSidebar();
              } else {
                setActiveSidebarTab('git');
                if (!sidebarVisible) toggleSidebar();
              }
            }}
            className={cn("p-2 rounded-lg transition-all", activeSidebarTab === 'git' && sidebarVisible ? "text-void-cyan bg-void-cyan/10" : "text-zinc-500 hover:text-zinc-200")}
            title="Source Control (Ctrl+Shift+G)"
          >
            <GitBranch size={20} />
          </button>
          <button 
            onClick={() => {
              if (activeSidebarTab === 'extensions' && sidebarVisible) {
                toggleSidebar();
              } else {
                setActiveSidebarTab('extensions');
                if (!sidebarVisible) toggleSidebar();
              }
            }}
            className={cn("p-2 rounded-lg transition-all", activeSidebarTab === 'extensions' && sidebarVisible ? "text-void-cyan bg-void-cyan/10" : "text-zinc-500 hover:text-zinc-200")}
            title="Extensions (Ctrl+Shift+X)"
          >
            <Blocks size={20} />
          </button>
          <button 
            onClick={toggleTerminal}
            className={cn("p-2 rounded-lg transition-all mt-auto", terminalVisible ? "text-void-cyan bg-void-cyan/10" : "text-zinc-500 hover:text-zinc-200")}
            title="Toggle Terminal (Ctrl+`)"
          >
            <TerminalIcon size={20} />
          </button>
          <button 
            onClick={toggleChat}
            className={cn("p-2 rounded-lg transition-all", chatVisible ? "text-void-violet bg-void-violet/10" : "text-zinc-500 hover:text-zinc-200")}
            title="Toggle AI Chat (Ctrl+L)"
          >
            <MessageSquare size={20} />
          </button>
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-zinc-500 hover:text-zinc-200 transition-all"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          <PanelGroup direction="horizontal">
            {sidebarVisible && (
              <>
                <Panel defaultSize={15} minSize={10} maxSize={20}>
                  {activeSidebarTab === 'explorer' && <FileExplorer />}
                  {activeSidebarTab === 'search' && <GlobalSearch />}
                  {activeSidebarTab === 'git' && <GitPanel />}
                  {activeSidebarTab === 'extensions' && <ExtensionsPanel />}
                </Panel>
                <PanelResizeHandle className="w-px bg-void-border hover:bg-void-cyan/50 transition-colors" />
              </>
            )}

            <Panel defaultSize={chatVisible ? 20 : 100} minSize={10}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={terminalVisible ? 70 : 100}>
                  <div className="h-full flex flex-col">
                    {/* Tabs Bar */}
                    <div className="h-9 bg-void-panel flex items-center justify-between border-b border-void-border">
                      <div className="flex items-center overflow-x-auto no-scrollbar h-full">
                        {openTabs.map(tabId => {
                          const file = files.find(f => f.id === tabId);
                          if (!file) return null;
                          return (
                            <div 
                              key={tabId}
                              onClick={() => setActiveFile(tabId)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, tabId });
                              }}
                              className={cn(
                                "h-full px-4 flex items-center gap-2 text-xs cursor-pointer border-r border-void-border min-w-[120px] max-w-[200px] transition-all group",
                                activeFileId === tabId ? "bg-void-bg text-void-cyan border-t-2 border-t-void-cyan" : "text-zinc-500 hover:bg-void-bg/50 hover:text-zinc-300"
                              )}
                            >
                              <span className="truncate flex-1">{file.name}</span>
                              {file.isDirty && (
                                <div className="w-2 h-2 rounded-full bg-void-violet shrink-0" />
                              )}
                              <span 
                                className={cn("p-0.5 hover:bg-void-border rounded", file.isDirty ? "opacity-0 group-hover:opacity-100" : "")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeTab(tabId);
                                }}
                              >
                                ×
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {openTabs.length > 0 && (
                        <button 
                          onClick={closeAllTabs}
                          className="px-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="Close All Tabs"
                        >
                          Close All
                        </button>
                      )}
                    </div>
                    <div className="flex-1 relative">
                      <CodeEditor />
                    </div>
                  </div>
                </Panel>
                
                {terminalVisible && (
                  <>
                    <PanelResizeHandle className="h-px bg-void-border hover:bg-void-cyan/50 transition-colors" />
                    <Panel defaultSize={30} minSize={10}>
                      <Terminal />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {chatVisible && (
              <>
                <PanelResizeHandle className="w-px bg-void-border hover:bg-void-violet/50 transition-colors" />
                <Panel defaultSize={80} minSize={30}>
                  <div className="h-full flex flex-col bg-void-panel">
                    <div className="flex border-b border-void-border shrink-0">
                      <button 
                        onClick={() => setRightPanelTab('chat')}
                        className={cn("flex-1 py-2 text-xs font-bold transition-colors border-b-2", rightPanelTab === 'chat' ? "border-void-violet text-void-violet" : "border-transparent text-zinc-500 hover:text-zinc-300")}
                      >
                        AI Chat
                      </button>
                      <button 
                        onClick={() => setRightPanelTab('preview')}
                        className={cn("flex-1 py-2 text-xs font-bold transition-colors border-b-2", rightPanelTab === 'preview' ? "border-void-cyan text-void-cyan" : "border-transparent text-zinc-500 hover:text-zinc-300")}
                      >
                        Live Preview
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      <div className={cn("absolute inset-0 bg-void-panel", rightPanelTab === 'chat' ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none")}>
                        <AIChat />
                      </div>
                      <div className={cn("absolute inset-0 bg-white", rightPanelTab === 'preview' ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none")}>
                        <LivePreview />
                      </div>
                    </div>
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex-1 flex md:hidden overflow-hidden relative">
        <div className={cn("absolute inset-0 transition-opacity duration-300", mobileTab === 'files' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
          <FileExplorer />
        </div>
        <div className={cn("absolute inset-0 transition-opacity duration-300 flex flex-col", mobileTab === 'editor' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
          <div className="h-9 bg-void-panel flex items-center overflow-x-auto no-scrollbar border-b border-void-border shrink-0">
            {openTabs.map(tabId => {
              const file = files.find(f => f.id === tabId);
              if (!file) return null;
              return (
                <div 
                  key={tabId}
                  onClick={() => setActiveFile(tabId)}
                  className={cn(
                    "h-full px-4 flex items-center gap-2 text-xs cursor-pointer border-r border-void-border min-w-[120px] max-w-[200px] transition-all group",
                    activeFileId === tabId ? "bg-void-bg text-void-cyan border-t-2 border-t-void-cyan" : "text-zinc-500 hover:bg-void-bg/50 hover:text-zinc-300"
                  )}
                >
                  <span className="truncate flex-1">{file.name}</span>
                  {file.isDirty && (
                    <div className="w-2 h-2 rounded-full bg-void-violet shrink-0" />
                  )}
                  <span 
                    className={cn("p-0.5 hover:bg-void-border rounded", file.isDirty ? "opacity-0 group-hover:opacity-100" : "")}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tabId);
                    }}
                  >
                    ×
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex-1 relative">
            <CodeEditor />
          </div>
        </div>
        <div className={cn("absolute inset-0 transition-opacity duration-300", mobileTab === 'terminal' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
          <Terminal />
        </div>
        <div className={cn("absolute inset-0 transition-opacity duration-300", mobileTab === 'ai' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
          <AIChat />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="h-14 bg-void-panel border-t border-void-border flex md:hidden items-center justify-around shrink-0 pb-safe">
        <button 
          onClick={() => setMobileTab('files')}
          className={cn("flex flex-col items-center gap-1 p-2 transition-colors", mobileTab === 'files' ? "text-void-cyan" : "text-zinc-500")}
        >
          <Files size={20} />
          <span className="text-[10px] font-medium">Files</span>
        </button>
        <button 
          onClick={() => setMobileTab('editor')}
          className={cn("flex flex-col items-center gap-1 p-2 transition-colors", mobileTab === 'editor' ? "text-void-cyan" : "text-zinc-500")}
        >
          <Code size={20} />
          <span className="text-[10px] font-medium">Editor</span>
        </button>
        <button 
          onClick={() => setMobileTab('terminal')}
          className={cn("flex flex-col items-center gap-1 p-2 transition-colors", mobileTab === 'terminal' ? "text-void-cyan" : "text-zinc-500")}
        >
          <TerminalIcon size={20} />
          <span className="text-[10px] font-medium">Terminal</span>
        </button>
        <button 
          onClick={() => setMobileTab('ai')}
          className={cn("flex flex-col items-center gap-1 p-2 transition-colors", mobileTab === 'ai' ? "text-void-violet" : "text-zinc-500")}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-medium">VOID AI</span>
        </button>
      </nav>

      {/* Bottom Status Bar (Desktop Only) */}
      <footer className="h-6 bg-void-violet text-white hidden md:flex items-center px-3 justify-between text-[10px] font-bold shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleSidebar}
            className={cn("flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors", sidebarVisible ? "bg-white/20" : "")}
            title="Toggle Sidebar"
          >
            <PanelLeft size={10} />
          </button>
          <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <GitBranch size={10} />
            <span>main*</span>
          </div>
          <div className="flex items-center gap-2 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <span className="flex items-center gap-1"><AlertCircle size={10} /> 0</span>
            <span className="flex items-center gap-1"><AlertCircle size={10} className="text-yellow-300" /> 0</span>
          </div>
          <button 
            onClick={toggleTerminal}
            className={cn("flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors", terminalVisible ? "bg-white/20" : "")}
            title="Toggle Terminal"
          >
            <TerminalIcon size={10} />
            <span>Terminal</span>
          </button>
          <button 
            onClick={toggleChat}
            className={cn("flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors", chatVisible ? "bg-white/20" : "")}
            title="Toggle AI Chat"
          >
            <MessageSquare size={10} />
            <span>AI Chat</span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <Cloud size={10} />
            <span>{storageProvider === 'local' ? 'Local' : storageProvider === 'gdrive' ? 'Google Drive' : 'Terabox'}</span>
          </div>
          <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <Zap size={10} />
            <span>{isComputeConnected ? 'Colab Node Active' : 'Local Mock'}</span>
          </div>
          <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">UTF-8</div>
          <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">TypeScript JSX</div>
          <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">Ln 1, Col 1</div>
          <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <Sparkles size={10} />
            <span>Gemini 3.1 Pro</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
