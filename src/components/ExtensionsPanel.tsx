import React, { useState } from 'react';
import { useStore } from '../store';
import { Blocks, Search, Download, CheckCircle2, Loader2, Star } from 'lucide-react';
import { cn } from '../lib/utils';

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  downloads: string;
  rating: number;
  installed: boolean;
  installing: boolean;
}

export const ExtensionsPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [extensions, setExtensions] = useState<Extension[]>([
    { id: 'prettier', name: 'Prettier - Code formatter', description: 'Code formatter using prettier', author: 'Prettier', downloads: '38M', rating: 4.5, installed: true, installing: false },
    { id: 'eslint', name: 'ESLint', description: 'Integrates ESLint JavaScript into VS Code.', author: 'Microsoft', downloads: '30M', rating: 4.8, installed: false, installing: false },
    { id: 'python', name: 'Python', description: 'IntelliSense (Pylance), Linting, Debugging (multi-threaded, remote), Jupyter Notebooks, code formatting, refactoring, unit tests, and more.', author: 'Microsoft', downloads: '100M', rating: 4.6, installed: false, installing: false },
    { id: 'gitlens', name: 'GitLens — Git supercharged', description: 'Supercharge Git within VS Code — Visualize code authorship at a glance via Git blame annotations and CodeLens, seamlessly navigate and explore Git repositories, gain valuable insights via rich visualizations and powerful comparison commands, and so much more', author: 'GitKraken', downloads: '25M', rating: 4.9, installed: false, installing: false },
    { id: 'live-server', name: 'Live Server', description: 'Launch a development local Server with live reload feature for static & dynamic pages', author: 'Ritwick Dey', downloads: '35M', rating: 4.7, installed: false, installing: false },
  ]);

  const handleInstall = (id: string) => {
    setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installing: true } : ext));
    setTimeout(() => {
      setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installed: true, installing: false } : ext));
    }, 1500);
  };

  const handleUninstall = (id: string) => {
    setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installed: false } : ext));
  };

  const filteredExtensions = extensions.filter(ext => 
    ext.name.toLowerCase().includes(search.toLowerCase()) || 
    ext.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-void-bg text-zinc-300 flex flex-col border-r border-void-border">
      <div className="p-3 text-xs font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center border-b border-void-border">
        <span>Extensions</span>
        <div className="flex gap-2">
          <Blocks size={14} className="cursor-pointer hover:text-white" />
        </div>
      </div>
      
      <div className="p-3 border-b border-void-border">
        <div className="flex items-center gap-2 bg-void-panel border border-void-border rounded px-2 py-1 focus-within:border-void-cyan transition-colors">
          <Search size={14} className="text-zinc-500" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Extensions in Marketplace"
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-200 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {filteredExtensions.map(ext => (
          <div key={ext.id} className="p-3 border-b border-void-border/50 hover:bg-void-violet/5 transition-colors group">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-void-panel rounded flex items-center justify-center shrink-0 border border-void-border">
                <Blocks size={20} className="text-void-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-200 truncate">{ext.name}</h4>
                  {ext.installed ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-void-cyan shrink-0" />
                      <button 
                        onClick={() => handleUninstall(ext.id)}
                        className="bg-void-panel hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100 border border-void-border hover:border-red-500/50"
                      >
                        Uninstall
                      </button>
                    </div>
                  ) : ext.installing ? (
                    <Loader2 size={14} className="animate-spin text-void-violet shrink-0" />
                  ) : (
                    <button 
                      onClick={() => handleInstall(ext.id)}
                      className="bg-void-violet hover:bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      Install
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{ext.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-600 font-mono">
                  <span className="truncate">{ext.author}</span>
                  <span className="flex items-center gap-1"><Download size={10} /> {ext.downloads}</span>
                  <span className="flex items-center gap-1"><Star size={10} className="text-yellow-500" /> {ext.rating}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
