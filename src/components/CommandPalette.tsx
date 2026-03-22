import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { Search, Terminal, Files, MessageSquare, File as FileIcon, Layout, Play, Cloud } from 'lucide-react';
import { cn } from '../lib/utils';

export const CommandPalette: React.FC = () => {
  const { 
    commandPaletteOpen, 
    setCommandPaletteOpen, 
    toggleSidebar, 
    toggleTerminal, 
    toggleChat, 
    files, 
    setActiveFile,
    setShowSetupModal
  } = useStore();
  
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const commands = [
    { id: 'toggle-sidebar', title: 'View: Toggle Sidebar', icon: <Layout size={14} />, action: toggleSidebar },
    { id: 'toggle-terminal', title: 'View: Toggle Terminal', icon: <Terminal size={14} />, action: toggleTerminal },
    { id: 'toggle-chat', title: 'View: Toggle AI Chat', icon: <MessageSquare size={14} />, action: toggleChat },
    { id: 'cloud-setup', title: 'VOID: Cloud Setup', icon: <Cloud size={14} />, action: () => setShowSetupModal(true) },
    ...files.filter(f => f.type === 'file').map(f => ({
      id: `file-${f.id}`,
      title: `File: Open ${f.name}`,
      icon: <FileIcon size={14} />,
      action: () => setActiveFile(f.id)
    }))
  ];

  const filteredCommands = commands.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setCommandPaletteOpen(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)}>
      <div 
        className="bg-void-panel border border-void-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-void-border">
          <Search size={18} className="text-zinc-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search files..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">No commands found</div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={cn(
                  "px-4 py-2.5 flex items-center gap-3 cursor-pointer text-sm transition-colors",
                  idx === selectedIndex ? "bg-void-violet/20 text-void-cyan" : "text-zinc-300 hover:bg-void-bg"
                )}
                onClick={() => {
                  cmd.action();
                  setCommandPaletteOpen(false);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className={cn("opacity-70", idx === selectedIndex ? "text-void-cyan" : "text-zinc-500")}>
                  {cmd.icon}
                </span>
                {cmd.title}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
