import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Blocks, Search, Download, CheckCircle2, Loader2, Star, RefreshCw, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Extension } from '../extensions/types';
import { MonacoSetup } from '../editor/MonacoSetup';

export const ExtensionsPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'installed' | 'marketplace'>('installed');
  const [loading, setLoading] = useState(false);
  
  const {
    installedExtensions,
    extensionSearchQuery,
    autoUpdateEnabled,
    setInstalledExtensions,
    addInstalledExtension,
    removeInstalledExtension,
    toggleExtensionEnabled,
    setExtensionSearchQuery,
    setSelectedExtension,
    selectedExtensionId,
  } = useStore();

  // Initialize extension system
  const [marketplaceExtensions, setMarketplaceExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    loadExtensions();
  }, []);

  const loadExtensions = async () => {
    setLoading(true);
    try {
      // Load installed extensions from storage
      const stored = localStorage.getItem('monaco_extensions');
      if (stored) {
        const parsed: Extension[] = JSON.parse(stored);
        setInstalledExtensions(parsed);
      }

      // Load marketplace extensions from API or fallback to mock
      const mockExtensions: Extension[] = [
        {
          id: 'prettier',
          name: 'Prettier - Code formatter',
          description: 'Code formatter using prettier',
          author: 'Prettier',
          publisher: 'Prettier',
          version: '10.2.1',
          downloads: '38M',
          rating: 4.5,
          installed: true,
          installing: false,
          enabled: true,
          size: 2048000,
          lastUpdated: new Date('2024-01-15'),
          categories: ['Formatters'],
          tags: ['prettier'],
          manifest: { version: '10.2.1', engines: { vscode: '^1.70.0' }, main: 'dist/extension.js' },
          installedAt: new Date(),
        },
        {
          id: 'eslint',
          name: 'ESLint',
          description: 'Integrates ESLint JavaScript into VS Code.',
          author: 'Microsoft',
          publisher: 'Microsoft',
          version: '2.3.1',
          downloads: '30M',
          rating: 4.8,
          installed: false,
          installing: false,
          enabled: false,
          size: 3072000,
          lastUpdated: new Date('2024-01-10'),
          categories: ['Linters'],
          tags: ['eslint', 'lint'],
          manifest: { version: '2.3.1', engines: { vscode: '^1.70.0' }, main: 'dist/extension.js' },
          installedAt: new Date(),
        },
        {
          id: 'python',
          name: 'Python',
          description: 'IntelliSense (Pylance), Linting, Debugging (multi-threaded, remote), Jupyter Notebooks, code formatting, refactoring, unit tests, and more.',
          author: 'Microsoft',
          publisher: 'Microsoft',
          version: '2024.2.0',
          downloads: '100M',
          rating: 4.6,
          installed: false,
          installing: false,
          enabled: false,
          size: 10240000,
          lastUpdated: new Date('2024-01-20'),
          categories: ['Programming Languages'],
          tags: ['python', 'jupyter', 'pylance'],
          manifest: { version: '2024.2.0', engines: { vscode: '^1.70.0' }, main: 'dist/extension.js' },
          installedAt: new Date(),
        },
        {
          id: 'gitlens',
          name: 'GitLens — Git supercharged',
          description: 'Supercharge Git within VS Code — Visualize code authorship at a glance via Git blame annotations and code lens, seamlessly navigate and explore git repositories.',
          author: 'GitKraken',
          publisher: 'GitKraken',
          version: '13.4.0',
          downloads: '25M',
          rating: 4.9,
          installed: false,
          installing: false,
          enabled: false,
          size: 4096000,
          lastUpdated: new Date('2024-01-18'),
          categories: ['Git'],
          tags: ['git', 'gitlens'],
          manifest: { version: '13.4.0', engines: { vscode: '^1.70.0' }, main: 'dist/extension.js' },
          installedAt: new Date(),
        },
        {
          id: 'live-server',
          name: 'Live Server',
          description: 'Launch a development local Server with live reload feature for static & dynamic pages',
          author: 'Ritwick Dey',
          publisher: 'Ritwick Dey',
          version: '5.7.9',
          downloads: '35M',
          rating: 4.7,
          installed: false,
          installing: false,
          enabled: false,
          size: 1024000,
          lastUpdated: new Date('2024-01-05'),
          categories: ['Tools'],
          tags: ['live server', 'http'],
          manifest: { version: '5.7.9', engines: { vscode: '^1.70.0' }, main: 'dist/extension.js' },
          installedAt: new Date(),
        },
      ];
      setMarketplaceExtensions(mockExtensions);
    } catch (error) {
      console.error('Failed to load extensions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (ext: Extension) => {
    // Find extension data
    const extensionData = mockExtensions.find(e => e.id === ext.id);
    if (!extensionData) return;

    // Mark as installing
    setMarketplaceExtensions(prev => prev.map(e =>
      e.id === ext.id ? { ...e, installing: true } : e
    ));

    try {
      // Simulate download and installation
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create installed extension
      const installedExt: Extension = {
        ...extensionData,
        installed: true,
        installing: false,
        enabled: true,
        installedAt: new Date(),
      };

      // Add to installed list
      addInstalledExtension(installedExt);

      // Save to localStorage
      const current = [...installedExtensions, installedExt];
      localStorage.setItem('monaco_extensions', JSON.stringify(current));

      // Update marketplace list
      setMarketplaceExtensions(prev => prev.map(e =>
        e.id === ext.id ? { ...e, installed: true, installing: false } : e
      ));

      // Activate extension in editor (this would happen through MonacoSetup)
      console.log(`Extension installed: ${ext.name}`);
    } catch (error) {
      console.error('Installation failed:', error);
      setMarketplaceExtensions(prev => prev.map(e =>
        e.id === ext.id ? { ...e, installing: false } : e
      ));
    }
  };

  const handleUninstall = async (ext: Extension) => {
    try {
      removeInstalledExtension(ext.id);
      
      // Update localStorage
      const current = installedExtensions.filter(e => e.id !== ext.id);
      localStorage.setItem('monaco_extensions', JSON.stringify(current));

      // Update marketplace list
      setMarketplaceExtensions(prev => prev.map(e =>
        e.id === ext.id ? { ...e, installed: false } : e
      ));

      console.log(`Extension uninstalled: ${ext.name}`);
    } catch (error) {
      console.error('Uninstall failed:', error);
    }
  };

  const handleEnableDisable = (ext: Extension) => {
    toggleExtensionEnabled(ext.id);
    
    // Update localStorage
    const current = installedExtensions.map(e =>
      e.id === ext.id ? { ...e, enabled: !e.enabled } : e
    );
    localStorage.setItem('monaco_extensions', JSON.stringify(current));

    // Update marketplace list
    setMarketplaceExtensions(prev => prev.map(e =>
      e.id === ext.id ? { ...e, enabled: !e.enabled } : e
    ));
  };

  const handleCheckUpdates = async () => {
    setLoading(true);
    try {
      // Simulate checking for updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show notification
      alert('All extensions are up to date!');
    } finally {
      setLoading(false);
    }
  };

  const mockExtensions = [
    { id: 'prettier', name: 'Prettier - Code formatter', description: 'Code formatter using prettier', author: 'Prettier' },
    { id: 'eslint', name: 'ESLint', description: 'Integrates ESLint JavaScript into VS Code.', author: 'Microsoft' },
    { id: 'python', name: 'Python', description: 'IntelliSense (Pylance), Linting, Debugging', author: 'Microsoft' },
    { id: 'gitlens', name: 'GitLens — Git supercharged', description: 'Supercharge Git within VS Code', author: 'GitKraken' },
    { id: 'live-server', name: 'Live Server', description: 'Launch a development local Server with live reload', author: 'Ritwick Dey' },
  ];

  const displayedExtensions = viewMode === 'installed'
    ? mockExtensions.filter(ext => installedExtensions.some(ie => ie.id === ext.id))
    : mockExtensions;

  const filteredExtensions = displayedExtensions.filter(ext =>
    ext.name.toLowerCase().includes(search.toLowerCase()) ||
    ext.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-void-bg text-zinc-300 flex flex-col border-r border-void-border">
      <div className="p-3 text-xs font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center border-b border-void-border">
        <span>Extensions</span>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode('installed')}
            className={cn("text-[10px] px-2 py-1 rounded", viewMode === 'installed' ? "bg-void-violet/20 text-void-violet" : "text-zinc-500 hover:text-white")}
          >
            Installed
          </button>
          <button 
            onClick={() => setViewMode('marketplace')}
            className={cn("text-[10px] px-2 py-1 rounded", viewMode === 'marketplace' ? "bg-void-cyan/20 text-void-cyan" : "text-zinc-500 hover:text-white")}
          >
            Marketplace
          </button>
        </div>
      </div>
      
      <div className="p-3 border-b border-void-border">
        <div className="flex items-center gap-2 bg-void-panel border border-void-border rounded px-2 py-1 focus-within:border-void-cyan transition-colors mb-2">
          <Search size={14} className="text-zinc-500" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setExtensionSearchQuery(e.target.value); }}
            placeholder="Search Extensions"
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-200 outline-none"
          />
        </div>
        {viewMode === 'installed' && (
          <button
            onClick={handleCheckUpdates}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-void-panel hover:bg-void-border border border-void-border rounded px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Check for Updates
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {filteredExtensions.map(ext => {
          const isInstalled = installedExtensions.some(ie => ie.id === ext.id);
          const installedExt = installedExtensions.find(ie => ie.id === ext.id);

          return (
            <div 
              key={ext.id} 
              className={cn(
                "p-3 border-b border-void-border/50 hover:bg-void-violet/5 transition-colors group cursor-pointer",
                selectedExtensionId === ext.id && "bg-void-violet/10"
              )}
              onClick={() => setSelectedExtension(ext.id)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-void-panel rounded flex items-center justify-center shrink-0 border border-void-border">
                  <Blocks size={20} className="text-void-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-200 truncate">{ext.name}</h4>
                    <div className="flex items-center gap-2">
                      {isInstalled ? (
                        <>
                          {installedExt?.enabled !== false ? (
                            <CheckCircle2 size={14} className="text-void-cyan shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-void-cyan shrink-0" />
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEnableDisable(ext); }}
                              className="p-1 rounded hover:bg-void-border shrink-0"
                              title={installedExt?.enabled ? 'Disable' : 'Enable'}
                            >
                              <Settings size={12} />
                            </button>
                            {ext.installing ? (
                              <Loader2 size={14} className="animate-spin text-void-violet shrink-0" />
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUninstall(ext); }}
                                className="bg-void-panel hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded transition-colors shrink-0 border border-void-border hover:border-red-500/50"
                              >
                                Uninstall
                              </button>
                            )}
                          </div>
                        </>
                      ) : ext.installing ? (
                        <Loader2 size={14} className="animate-spin text-void-violet shrink-0" />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleInstall(ext); }}
                          className="bg-void-violet hover:bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded transition-colors shrink-0"
                        >
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{ext.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-600 font-mono">
                    <span className="truncate">{ext.author}</span>
                    <span className="flex items-center gap-1"><Download size={10} /> {ext.downloads}</span>
                    <span className="flex items-center gap-1"><Star size={10} className="text-yellow-500" /> {ext.rating}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {autoUpdateEnabled && (
        <div className="px-3 py-2 border-t border-void-border text-[10px] text-zinc-600 flex items-center gap-2">
          <span>Auto-updates enabled</span>
          <RefreshCw size={10} />
        </div>
      )}
    </div>
  );
};
