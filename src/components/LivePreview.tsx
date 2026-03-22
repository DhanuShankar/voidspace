import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { RefreshCw, Layout, Play } from 'lucide-react';

export const LivePreview: React.FC = () => {
  const { files, activeFileId } = useStore();
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Find the active file or fallback to index.html
  const activeFile = files.find(f => f.id === activeFileId);
  const indexFile = files.find(f => f.name === 'index.html');
  
  const fileToPreview = (activeFile?.name.endsWith('.html') ? activeFile : indexFile) || null;

  useEffect(() => {
    if (fileToPreview) {
      setHtmlContent(fileToPreview.content || '');
    } else {
      setHtmlContent('');
    }
  }, [fileToPreview, fileToPreview?.content]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!fileToPreview) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-void-panel text-zinc-500 font-mono italic p-6 text-center">
        <Layout size={48} className="mb-4 opacity-20" />
        <p>No HTML file selected.</p>
        <p className="text-xs mt-2 opacity-60">Open an .html file to see the live preview.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white w-full relative">
      <div className="absolute top-0 left-0 right-0 h-8 bg-void-panel border-b border-void-border flex items-center px-3 justify-between z-10">
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Play size={12} className="text-void-cyan" />
          Preview: {fileToPreview.name}
        </div>
        <button 
          onClick={handleRefresh}
          className="p-1 hover:bg-void-bg rounded text-zinc-500 hover:text-void-cyan transition-colors"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 pt-8 bg-white">
        {!isRefreshing && (
          <iframe
            title="Live Preview"
            srcDoc={htmlContent}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
};
