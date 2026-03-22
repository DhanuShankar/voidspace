import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Send, Sparkles, User, Bot, Loader2, Code, Zap, Wand2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { GoogleGenAI } from '@google/genai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isVibe?: boolean;
}

interface PendingEdit {
  filename: string;
  content: string;
}

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "I'm VOID, your AI coding partner. How can I help you build today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { files, updateFileContent, addFile, vibeMode, setVibeMode, setRightPanelTab } = useStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingEdits]);

  const parseAndApplyFileEdits = (content: string) => {
    const fileRegex = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    const edits: PendingEdit[] = [];
    while ((match = fileRegex.exec(content)) !== null) {
      edits.push({
        filename: match[1],
        content: match[2].trim()
      });
    }
    
    if (edits.length > 0) {
      setPendingEdits(edits);
      if (vibeMode) {
        setRightPanelTab('preview');
      }
    }
  };

  const handleAcceptEdits = () => {
    pendingEdits.forEach(edit => {
      const existingFile = files.find(f => f.name === edit.filename && f.type === 'file');
      if (existingFile) {
        updateFileContent(existingFile.id, edit.content);
      } else {
        addFile(edit.filename, 'file', 'root', edit.content);
      }
    });
    setPendingEdits([]);
    setMessages(prev => [...prev, { role: 'assistant', content: `Applied changes to ${pendingEdits.length} file(s).` }]);
  };

  const handleRejectEdits = () => {
    setPendingEdits([]);
    setMessages(prev => [...prev, { role: 'assistant', content: "Changes rejected." }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Prepare context: all files
      const context = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n');
      const systemInstruction = vibeMode 
        ? `You are VOID in VIBE MODE. The user will describe an application in plain English. You must generate the COMPLETE project structure and files.
Context:
${context}

Generate all necessary files wrapped in <file name="path/to/filename.ext">content</file> tags.
Include an index.html, styles, and scripts as needed.
Be creative, thorough, and ensure the app works out of the box.
Use modern, clean UI patterns and ensure the app is fully responsive.`
        : `You are VOID, an expert AI coding agent. You help users build apps without needing to understand terminals or setup. You have access to all project files. 
Context:
${context}

When editing files, return the complete updated file content wrapped in: <file name="filename.ext">content</file> tags. 
When creating projects, scaffold all necessary files using the <file> tags. 
Always write complete, working, beginner-friendly code. Explain what you're doing in simple terms.`;

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
        }
      });

      // Send previous history (simplified for this demo)
      const historyText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const prompt = `${historyText}\nuser: ${input}`;

      const streamResponse = await chat.sendMessageStream({ message: prompt });
      
      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '', isVibe: vibeMode }]);

      for await (const chunk of streamResponse) {
        if (chunk.text) {
          assistantContent += chunk.text;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: assistantContent, isVibe: vibeMode }];
          });
        }
      }

      // After streaming is done, parse and apply any file edits
      parseAndApplyFileEdits(assistantContent);

    } catch (error: any) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message || "Failed to connect to AI."}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "h-full flex flex-col bg-void-panel border-l border-void-border w-full transition-all duration-500",
      vibeMode ? "shadow-[inset_0_0_50px_rgba(124,58,237,0.1)]" : ""
    )}>
      <div className={cn(
        "p-4 border-b border-void-border flex items-center gap-2 transition-colors",
        vibeMode ? "bg-void-violet/5" : ""
      )}>
        <Sparkles size={18} className="text-void-violet" />
        <span className="font-bold text-sm tracking-tight text-zinc-200">VOID AGENT</span>
        <div className="ml-auto flex gap-2">
          <button 
            onClick={() => setVibeMode(!vibeMode)}
            className={cn(
              "px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors border",
              vibeMode 
                ? "bg-void-violet/20 text-void-violet border-void-violet/50" 
                : "bg-void-bg text-zinc-500 border-void-border hover:text-void-violet"
            )}
          >
            <Sparkles size={12} />
            VIBE MODE
          </button>
          <button className="p-1 hover:bg-void-border rounded text-zinc-500 hover:text-void-violet transition-colors">
            <Zap size={14} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-void-border">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              m.role === 'assistant' ? "bg-void-violet/20 text-void-violet" : "bg-void-border text-zinc-400"
            )}>
              {m.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={cn(
              "p-3 rounded-2xl text-sm max-w-[85%] relative",
              m.role === 'assistant' ? "bg-void-bg text-zinc-300 border border-void-border" : "bg-void-violet text-white"
            )}>
              {m.isVibe && (
                <div className="absolute -top-2 -right-2 bg-void-violet text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-white/20">
                  <Sparkles size={8} /> VIBE
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-void-violet/20 text-void-violet flex items-center justify-center animate-pulse">
              <Bot size={16} />
            </div>
            <div className="bg-void-bg border border-void-border p-3 rounded-2xl flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-void-violet" />
              <span className="text-xs text-zinc-500">Thinking...</span>
            </div>
          </div>
        )}
        {pendingEdits.length > 0 && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-void-violet/20 text-void-violet flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-void-bg border border-void-violet/50 p-3 rounded-2xl text-sm max-w-[85%] w-full shadow-[0_0_15px_rgba(124,58,237,0.1)]">
              <div className="font-bold text-void-violet mb-2 flex items-center gap-2">
                <Code size={14} />
                Proposed Changes ({pendingEdits.length} files)
              </div>
              <div className="space-y-2 mb-3">
                {pendingEdits.map((edit, idx) => (
                  <div key={idx} className="text-xs font-mono bg-void-panel px-2 py-1 rounded border border-void-border text-zinc-300">
                    {edit.filename}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleAcceptEdits}
                  className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50 py-1.5 rounded transition-colors text-xs font-bold"
                >
                  <Check size={14} /> Accept
                </button>
                <button 
                  onClick={handleRejectEdits}
                  className="flex-1 flex items-center justify-center gap-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50 py-1.5 rounded transition-colors text-xs font-bold"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-void-border">
        {vibeMode && (
          <div className="mb-2 px-2 py-1 bg-void-violet/10 border border-void-violet/30 rounded text-[10px] text-void-violet font-bold animate-pulse flex items-center gap-1">
            <Sparkles size={10} />
            VIBE MODE ACTIVE: DESCRIBE YOUR APP
          </div>
        )}
        <div className={cn(
          "flex items-center gap-2 bg-void-bg rounded-xl p-2 border transition-all",
          vibeMode ? "border-void-violet/50 shadow-[0_0_15px_rgba(124,58,237,0.2)]" : "border-void-border focus-within:border-void-violet/50"
        )}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={vibeMode ? "Describe the app you want to build..." : "Ask VOID to build..."}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-200 resize-none py-1 px-2 h-10 max-h-32"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2",
              vibeMode 
                ? "bg-void-violet hover:bg-violet-500 text-white px-4" 
                : "bg-void-violet hover:bg-violet-500 text-white"
            )}
          >
            {vibeMode && <span className="text-xs font-bold hidden sm:inline">Build App</span>}
            <Send size={16} />
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button className="whitespace-nowrap px-3 py-1 rounded-full bg-void-bg border border-void-border text-[10px] text-zinc-500 hover:text-void-violet hover:border-void-violet/30 transition-all flex items-center gap-1">
            <Wand2 size={10} /> Scaffolding
          </button>
          <button className="whitespace-nowrap px-3 py-1 rounded-full bg-void-bg border border-void-border text-[10px] text-zinc-500 hover:text-void-violet hover:border-void-violet/30 transition-all flex items-center gap-1">
            <Code size={10} /> Refactor
          </button>
        </div>
      </div>
    </div>
  );
};
