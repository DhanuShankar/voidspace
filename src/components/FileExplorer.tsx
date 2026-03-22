import React, { useState } from 'react';
import { useStore, FileNode } from '../store';
import { ChevronRight, ChevronDown, File, Folder, Plus, Trash2, Edit2, Cloud, HardDrive, AlertCircle, FileJson, FileCode2, FileText, FileType2, FileImage, Globe, Layout, Palette, Terminal, FileCog, FileCode, FilePlus, FolderPlus, FolderMinus } from 'lucide-react';
import { cn } from '../lib/utils';

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return <FileCode size={14} className="mr-1 text-yellow-400" />;
    case 'ts':
    case 'tsx':
      return <FileCode2 size={14} className="mr-1 text-blue-400" />;
    case 'css':
      return <Palette size={14} className="mr-1 text-pink-400" />;
    case 'html':
      return <Globe size={14} className="mr-1 text-orange-400" />;
    case 'json':
      return <FileJson size={14} className="mr-1 text-green-400" />;
    case 'py':
      return <Terminal size={14} className="mr-1 text-blue-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'ico':
      return <FileImage size={14} className="mr-1 text-purple-400" />;
    case 'md':
    case 'txt':
      return <FileText size={14} className="mr-1 text-zinc-400" />;
    case 'env':
    case 'config':
      return <FileCog size={14} className="mr-1 text-zinc-500" />;
    default:
      return <File size={14} className="mr-1 text-zinc-500" />;
  }
};

export const FileExplorer: React.FC = () => {
  const { files, activeFileId, setActiveFile, addFile, deleteFile, renameFile, toggleFolder, collapseAllFolders, storageProvider, isStorageConnected, setShowSetupModal } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleRename = (id: string, newName: string) => {
    if (newName.trim()) {
      renameFile(id, newName.trim());
    }
    setEditingId(null);
  };

  const renderTree = (parentId: string | null, level: number = 0) => {
    const children = files.filter(f => f.parentId === parentId);
    
    return children.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    }).map(node => (
      <div key={node.id}>
        <div 
          className={cn(
            "flex items-center py-1 px-2 cursor-pointer hover:bg-void-violet/10 group text-sm",
            activeFileId === node.id && "bg-void-violet/20 text-void-cyan border-l-2 border-void-cyan"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'file' && editingId !== node.id) {
              setActiveFile(node.id);
            } else if (node.type === 'folder') {
              toggleFolder(node.id);
            }
          }}
        >
          {node.type === 'folder' ? (
            <ChevronDown size={14} className={cn("mr-1 text-zinc-500 transition-transform", !node.isOpen && "-rotate-90")} />
          ) : (
            getFileIcon(node.name)
          )}
          
          {editingId === node.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node.id, editName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node.id, editName);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="flex-1 bg-void-bg border border-void-cyan text-zinc-200 px-1 outline-none text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className={cn("flex-1 truncate", node.isDirty && "text-yellow-100")}>{node.name}</span>
              {node.isDirty && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-2" />}
            </>
          )}
          
          <div className="hidden group-hover:flex items-center gap-1">
            {node.type === 'folder' && (
              <Plus size={14} className="text-zinc-500 hover:text-white" onClick={(e) => {
                e.stopPropagation();
                addFile('new-file.ts', 'file', node.id);
              }} />
            )}
            <Edit2 size={14} className="text-zinc-500 hover:text-void-cyan" onClick={(e) => {
              e.stopPropagation();
              setEditingId(node.id);
              setEditName(node.name);
            }} />
            <Trash2 size={14} className="text-zinc-500 hover:text-red-400" onClick={(e) => {
              e.stopPropagation();
              deleteFile(node.id);
            }} />
          </div>
        </div>
        {node.type === 'folder' && node.isOpen && renderTree(node.id, level + 1)}
      </div>
    ));
  };

  return (
    <div className="h-full bg-void-bg text-zinc-300 flex flex-col border-r border-void-border">
      <div className="p-3 text-xs font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center border-b border-void-border">
        <span>Explorer</span>
        <div className="flex gap-2">
          <FilePlus size={14} className="cursor-pointer hover:text-white" onClick={() => addFile('new-file.ts', 'file', 'root')} title="New File" />
          <FolderPlus size={14} className="cursor-pointer hover:text-white" onClick={() => addFile('new-folder', 'folder', 'root')} title="New Folder" />
          <FolderMinus size={14} className="cursor-pointer hover:text-white" onClick={collapseAllFolders} title="Collapse All" />
        </div>
      </div>
      
      {/* Storage Status Indicator */}
      <div 
        onClick={() => setShowSetupModal(true)}
        className="px-3 py-2 text-xs flex items-center gap-2 border-b border-void-border cursor-pointer hover:bg-void-bg/50 transition-colors"
      >
        {storageProvider === 'local' ? (
          <HardDrive size={14} className="text-zinc-500" />
        ) : (
          <Cloud size={14} className={isStorageConnected ? "text-void-cyan" : "text-yellow-500"} />
        )}
        <span className="flex-1 truncate text-zinc-400">
          {storageProvider === 'local' ? 'Local Workspace' : 
           storageProvider === 'gdrive' ? 'Google Drive' : 'Terabox'}
        </span>
        {!isStorageConnected && storageProvider !== 'local' && (
          <AlertCircle size={12} className="text-yellow-500" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {renderTree(null)}
      </div>
    </div>
  );
};
