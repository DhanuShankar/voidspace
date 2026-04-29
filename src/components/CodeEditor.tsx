import React, { useRef, useState, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, CornerDownLeft, Sparkles, Loader2, AlignLeft, WrapText, Map } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { MonacoSetup } from '../editor/MonacoSetup';

export const CodeEditor: React.FC = () => {
  const { 
    files, activeFileId, updateFileContent, saveFile,
    fontSize, tabSize, wordWrap, showMinimap, showLineNumbers, autoSave,
    setWordWrap, setShowMinimap
  } = useStore();
  const activeFile = files.find(f => f.id === activeFileId);
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiEditing, setIsAiEditing] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Initialize Monaco extension system
  useEffect(() => {
    let monacoSetup: MonacoSetup | null = null;

    if (monaco && activeFile) {
      // Initialize extension system
      monacoSetup = new MonacoSetup({
        container: document.getElementById('monaco-container')!,
        theme: 'void-dark',
        language: getLanguage(activeFile.name),
        value: activeFile.content,
        autoUpdate: true,
      });

      monacoSetup.initialize().then(() => {
        console.log('Monaco extension system initialized');
      });

      return () => {
        monacoSetup?.dispose();
      };
    }
  }, [monaco, activeFile]);

  useEffect(() => {
    if (autoSave && activeFile?.isDirty) {
      const timer = setTimeout(() => {
        saveFile(activeFile.id);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeFile?.content, autoSave, activeFile?.id, activeFile?.isDirty, saveFile]);

  React.useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('void-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { background: '0a0a0f', token: '' }
        ],
        colors: {
          'editor.background': '#0a0a0f',
          'editor.lineHighlightBackground': '#12121a',
          'editorLineNumber.foreground': '#4b5563',
          'editorIndentGuide.background': '#1f1f2e',
          'editorIndentGuide.activeBackground': '#374151',
          'editor.selectionBackground': '#7c3aed40',
        }
      });
      monaco.editor.setTheme('void-dark');
    }
  }, [monaco]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, () => {
      setShowAiEdit(true);
      setTimeout(() => aiInputRef.current?.focus(), 50);
    });
  };

  const handleAiEdit = async () => {
    if (!aiPrompt.trim() || !editorRef.current || !activeFile) return;
    
    const selection = editorRef.current.getSelection();
    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    
    if (!selectedText) {
      alert("Please select some code to edit with AI.");
      setShowAiEdit(false);
      return;
    }

    setIsAiEditing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || '' });
      const prompt = `You are an expert coder. The user wants to modify the following code snippet:
\`\`\`
${selectedText}
\`\`\`

Instruction: ${aiPrompt}

Return ONLY the modified code. Do not include markdown formatting like \`\`\`javascript or any explanations. Just the raw code.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      let newText = response.text || '';
      newText = newText.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');

      editorRef.current.executeEdits('ai-edit', [{
        range: selection,
        text: newText,
        forceMoveMarkers: true
      }]);
      
      updateFileContent(activeFile.id, editorRef.current.getValue());
    } catch (error) {
      console.error("AI Edit failed:", error);
    } finally {
      setIsAiEditing(false);
      setShowAiEdit(false);
      setAiPrompt('');
      editorRef.current.focus();
    }
  };

  const insertText = (text: string) => {
    if (editorRef.current && monaco) {
      const position = editorRef.current.getPosition();
      editorRef.current.executeEdits('toolbar', [{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: text,
        forceMoveMarkers: true
      }]);
      editorRef.current.focus();
    }
  };

  const moveCursor = (direction: 'left' | 'right') => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      editorRef.current.setPosition({
        lineNumber: position.lineNumber,
        column: position.column + (direction === 'left' ? -1 : 1)
      });
      editorRef.current.focus();
    }
  };

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-void-bg text-zinc-500 font-mono italic">
        Select a file to start coding
      </div>
    );
  }

  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop();
    switch (ext) {
      case 'ts':
      case 'tsx': return 'typescript';
      case 'js':
      case 'jsx': return 'javascript';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'json': return 'json';
      default: return 'plaintext';
    }
  };

  const mobileKeys = ['{', '}', '(', ')', '[', ']', '<', '>', '/', '\\', '|', '&', '*', '+', '=', '-', '_', '$', '@', '!', '?', ':', ';', '"', "'", '`'];

  const formatDocument = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  return (
    <div className="h-full w-full bg-void-bg flex flex-col overflow-hidden relative">
      <div className="h-8 bg-void-panel border-b border-void-border flex items-center px-2 gap-2 shrink-0">
        <button 
          onClick={formatDocument}
          className="p-1 rounded hover:bg-void-border text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Format Document (Shift+Alt+F)"
        >
          <AlignLeft size={14} />
        </button>
        <div className="w-px h-4 bg-void-border mx-1" />
        <button 
          onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
          className={`p-1 rounded transition-colors ${wordWrap === 'on' ? 'bg-void-violet/20 text-void-violet' : 'hover:bg-void-border text-zinc-400 hover:text-zinc-200'}`}
          title="Toggle Word Wrap"
        >
          <WrapText size={14} />
        </button>
        <button 
          onClick={() => setShowMinimap(!showMinimap)}
          className={`p-1 rounded transition-colors ${showMinimap ? 'bg-void-violet/20 text-void-violet' : 'hover:bg-void-border text-zinc-400 hover:text-zinc-200'}`}
          title="Toggle Minimap"
        >
          <Map size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative" id="monaco-container">
        {showAiEdit && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[400px] bg-void-panel border border-void-violet rounded-lg shadow-[0_0_30px_rgba(124,58,237,0.3)] p-2 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 bg-void-bg border border-void-border rounded px-3 py-2">
              <Sparkles size={16} className="text-void-violet" />
              <input
                ref={aiInputRef}
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAiEdit();
                  if (e.key === 'Escape') setShowAiEdit(false);
                }}
                placeholder="Ask AI to edit selected code..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-200 outline-none"
                disabled={isAiEditing}
              />
              {isAiEditing && <Loader2 size={16} className="animate-spin text-void-cyan" />}
            </div>
            <div className="text-[10px] text-zinc-500 mt-2 px-1 flex justify-between">
              <span>Press <kbd className="bg-void-bg px-1 rounded border border-void-border">Enter</kbd> to edit</span>
              <span>Press <kbd className="bg-void-bg px-1 rounded border border-void-border">Esc</kbd> to cancel</span>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          theme="void-dark"
          language={getLanguage(activeFile.name)}
          value={activeFile.content}
          onChange={(value) => updateFileContent(activeFile.id, value || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: showMinimap },
            fontSize: fontSize,
            tabSize: tabSize,
            wordWrap: wordWrap,
            lineNumbers: showLineNumbers ? 'on' : 'off',
            fontFamily: "'JetBrains Mono', monospace",
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            padding: { top: 16 },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            formatOnPaste: true,
          }}
        />
      </div>

      {/* Mobile Keyboard Toolbar */}
      <div className="md:hidden h-10 bg-void-panel border-t border-void-border flex items-center px-1 overflow-x-auto shrink-0 no-scrollbar">
        <button onClick={() => insertText('  ')} className="px-3 py-1.5 mx-0.5 bg-void-bg border border-void-border rounded text-zinc-300 text-xs font-mono active:bg-void-violet/20 shrink-0">
          Tab
        </button>
        {mobileKeys.map(key => (
          <button 
            key={key} 
            onClick={() => insertText(key)} 
            className="px-3 py-1.5 mx-0.5 bg-void-bg border border-void-border rounded text-zinc-300 text-xs font-mono active:bg-void-violet/20 shrink-0"
          >
            {key}
          </button>
        ))}
        <button onClick={() => moveCursor('left')} className="px-3 py-1.5 mx-0.5 bg-void-bg border border-void-border rounded text-zinc-300 text-xs font-mono active:bg-void-violet/20 shrink-0">
          <ChevronLeft size={14} />
        </button>
        <button onClick={() => moveCursor('right')} className="px-3 py-1.5 mx-0.5 bg-void-bg border border-void-border rounded text-zinc-300 text-xs font-mono active:bg-void-violet/20 shrink-0">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => insertText('\n')} className="px-3 py-1.5 mx-0.5 bg-void-bg border border-void-border rounded text-zinc-300 text-xs font-mono active:bg-void-violet/20 shrink-0">
          <CornerDownLeft size={14} />
        </button>
      </div>
    </div>
  );
};
