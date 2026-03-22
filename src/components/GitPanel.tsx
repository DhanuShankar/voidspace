import React, { useState } from 'react';
import { useStore } from '../store';
import { GitBranch, GitCommit, GitMerge, GitPullRequest, Plus, RefreshCw, Check, X, File as FileIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export const GitPanel: React.FC = () => {
  const { files, saveFile } = useStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  // Use isDirty to determine changed files
  const changedFiles = files.filter(f => f.type === 'file' && f.isDirty);

  const handleCommit = () => {
    if (!commitMessage.trim() || changedFiles.length === 0) return;
    setIsCommitting(true);
    setTimeout(() => {
      // Simulate committing by saving all dirty files
      changedFiles.forEach(file => saveFile(file.id));
      setIsCommitting(false);
      setCommitMessage('');
    }, 1000);
  };

  const handleDiscardAll = () => {
    // In a real app, this would revert to the last commit
    // For now, we just clear the dirty state (which doesn't actually revert content in this mock)
    changedFiles.forEach(file => saveFile(file.id));
  };

  return (
    <div className="h-full bg-void-bg text-zinc-300 flex flex-col border-r border-void-border">
      <div className="p-3 text-xs font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center border-b border-void-border">
        <span>Source Control</span>
        <div className="flex gap-2">
          <RefreshCw size={14} className="cursor-pointer hover:text-white" />
          <GitPullRequest size={14} className="cursor-pointer hover:text-white" />
          <GitCommit size={14} className="cursor-pointer hover:text-white" />
        </div>
      </div>
      
      <div className="p-3 border-b border-void-border flex flex-col gap-2">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message (Ctrl+Enter to commit)"
          className="w-full bg-void-panel border border-void-border rounded p-2 text-sm text-zinc-200 resize-none h-20 focus:outline-none focus:border-void-cyan transition-colors"
        />
        <button 
          onClick={handleCommit}
          disabled={!commitMessage.trim() || isCommitting || changedFiles.length === 0}
          className="w-full bg-void-violet hover:bg-violet-500 disabled:bg-void-border disabled:text-zinc-600 text-white py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-2"
        >
          {isCommitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          Commit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 py-1 flex items-center justify-between group cursor-pointer">
          <div className="flex items-center gap-1 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <ChevronDown size={14} />
            <span>Changes</span>
            <span className="bg-void-panel px-1.5 rounded-full text-[10px] ml-1">{changedFiles.length}</span>
          </div>
          <div className="hidden group-hover:flex gap-1">
            <Plus size={14} className="text-zinc-500 hover:text-white" title="Stage All Changes" />
            <X size={14} className="text-zinc-500 hover:text-white" title="Discard All Changes" onClick={handleDiscardAll} />
          </div>
        </div>
        
        {changedFiles.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            No active changes.
          </div>
        ) : (
          changedFiles.map(file => (
            <div key={file.id} className="flex items-center py-1 px-4 cursor-pointer hover:bg-void-violet/10 group text-sm">
              <FileIcon size={14} className="mr-2 text-zinc-500" />
              <span className="flex-1 truncate text-zinc-300">{file.name}</span>
              <span className="text-xs text-yellow-500 font-mono mr-2">M</span>
              <div className="hidden group-hover:flex gap-1">
                <Plus size={14} className="text-zinc-500 hover:text-white" title="Stage Changes" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Simple ChevronDown component to avoid importing from lucide-react if not needed globally
const ChevronDown = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);
