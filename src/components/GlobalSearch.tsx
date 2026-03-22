import React, { useState } from 'react';
import { useStore } from '../store';
import { Search as SearchIcon, File as FileIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export const GlobalSearch: React.FC = () => {
  const { files, setActiveFile } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ fileId: string; line: number; content: string }[]>([]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const newResults: { fileId: string; line: number; content: string }[] = [];
    files.forEach(file => {
      if (file.type === 'file' && file.content) {
        const lines = file.content.split('\n');
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(q.toLowerCase())) {
            newResults.push({
              fileId: file.id,
              line: index + 1,
              content: line.trim()
            });
          }
        });
      }
    });
    setResults(newResults);
  };

  // Group results by file
  const groupedResults = results.reduce<Record<string, { fileId: string; line: number; content: string }[]>>((acc, result) => {
    if (!acc[result.fileId]) acc[result.fileId] = [];
    acc[result.fileId].push(result);
    return acc;
  }, {});

  return (
    <div className="h-full bg-void-bg text-zinc-300 flex flex-col border-r border-void-border">
      <div className="p-3 text-xs font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center border-b border-void-border">
        <span>Search</span>
      </div>
      
      <div className="p-3 border-b border-void-border">
        <div className="flex items-center gap-2 bg-void-panel border border-void-border rounded px-2 py-1 focus-within:border-void-cyan transition-colors">
          <SearchIcon size={14} className="text-zinc-500" />
          <input 
            type="text" 
            value={query}
            onChange={handleSearch}
            placeholder="Search files..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-200 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {query && results.length === 0 && (
          <div className="px-4 py-2 text-xs text-zinc-500">No results found.</div>
        )}
        
        {(Object.entries(groupedResults) as [string, { fileId: string; line: number; content: string }[]][]).map(([fileId, fileResults]) => {
          const file = files.find(f => f.id === fileId);
          if (!file) return null;
          
          return (
            <div key={fileId} className="mb-2">
              <div 
                className="flex items-center py-1 px-2 cursor-pointer hover:bg-void-violet/10 text-sm font-bold text-zinc-300"
                onClick={() => setActiveFile(fileId)}
              >
                <ChevronDown size={14} className="mr-1 text-zinc-500" />
                <FileIcon size={14} className="mr-2 text-zinc-500" />
                <span className="truncate">{file.name}</span>
                <span className="ml-2 text-xs text-zinc-500 bg-void-panel px-1.5 rounded-full">{fileResults.length}</span>
              </div>
              
              {fileResults.map((res, i) => (
                <div 
                  key={i}
                  className="flex items-start py-1 px-2 pl-8 cursor-pointer hover:bg-void-violet/10 text-xs group"
                  onClick={() => setActiveFile(fileId)}
                >
                  <span className="text-zinc-500 w-8 shrink-0 text-right pr-2">{res.line}</span>
                  <span className="truncate text-zinc-400 group-hover:text-zinc-200">
                    {res.content.split(new RegExp(`(${query})`, 'gi')).map((part, index) => 
                      part.toLowerCase() === query.toLowerCase() ? (
                        <span key={index} className="bg-void-violet/40 text-void-cyan rounded px-0.5">{part}</span>
                      ) : (
                        <span key={index}>{part}</span>
                      )
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
