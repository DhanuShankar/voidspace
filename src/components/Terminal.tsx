import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useStore } from '../store';
import { Server, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import 'xterm/css/xterm.css';

export const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { computeUrl, isComputeConnected, setShowSetupModal, toggleChat } = useStore();
  const [hasError, setHasError] = useState(false);
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0a0a0f',
        foreground: '#06b6d4',
        cursor: '#06b6d4',
        selectionBackground: '#06b6d433',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    const checkError = (text: string) => {
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
        setHasError(true);
        setLastError(text);
      }
    };

    if (isComputeConnected && computeUrl) {
      term.writeln('\x1b[1;36mConnecting to remote compute node...\x1b[0m');
      try {
        const ws = new WebSocket(computeUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          term.writeln('\x1b[1;32mBuild Render Start Log "CONNECTED"\x1b[0m');
          term.writeln('\x1b[1;34mBuild Render End Debug "[vite] connecting..."\x1b[0m');
          term.writeln('\x1b[1;36mConnected to remote node successfully.\x1b[0m');
          term.write('\r\n$ ');
        };

        ws.onmessage = (event) => {
          const data = event.data.replace(/\n/g, '\r\n');
          term.write(data);
          checkError(data);
          term.write('\r\n$ ');
        };

        ws.onerror = () => {
          term.writeln('\x1b[1;31mWebSocket connection error.\x1b[0m');
        };

        ws.onclose = () => {
          term.writeln('\x1b[1;33mConnection closed.\x1b[0m');
        };

        let currentLine = '';
        term.onData(data => {
          const code = data.charCodeAt(0);
          if (code === 13) { // Enter
            term.write('\r\n');
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(currentLine);
            }
            currentLine = '';
          } else if (code === 127) { // Backspace
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1);
              term.write('\b \b');
            }
          } else {
            currentLine += data;
            term.write(data);
          }
        });

      } catch (e) {
        term.writeln('\x1b[1;31mFailed to establish WebSocket connection.\x1b[0m');
      }
    } else {
      // Local Mock Mode
      term.writeln('\x1b[1;33m[LOCAL MODE] No compute node connected.\x1b[0m');
      term.writeln('Commands will be simulated. Connect a Colab node for real execution.');
      term.write('\r\n$ ');

      let currentLine = '';
      term.onData(data => {
        const code = data.charCodeAt(0);
        if (code === 13) { // Enter
          term.write('\r\n');
          handleLocalCommand(currentLine, term);
          currentLine = '';
          term.write('$ ');
        } else if (code === 127) { // Backspace
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
          }
        } else {
          currentLine += data;
          term.write(data);
        }
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) wsRef.current.close();
      term.dispose();
    };
  }, [computeUrl, isComputeConnected]);

  const handleLocalCommand = (cmd: string, term: XTerm) => {
    const command = cmd.trim().toLowerCase();
    if (command === 'help') {
      term.writeln('Available: help, clear, ls, echo, error');
    } else if (command === 'clear') {
      term.clear();
      setHasError(false);
    } else if (command === 'ls') {
      term.writeln('src/  package.json  tsconfig.json  vite.config.ts');
    } else if (command.startsWith('echo ')) {
      term.writeln(cmd.slice(5));
    } else if (command === 'error') {
      const errMsg = 'TypeError: Cannot read properties of undefined (reading \'map\')\n    at App (App.tsx:42:15)';
      term.writeln(`\x1b[1;31m${errMsg}\x1b[0m`);
      setHasError(true);
      setLastError(errMsg);
    } else if (command !== '') {
      term.writeln(`Command not found: ${command}`);
    }
  };

  const handleFixWithAI = () => {
    if (!useStore.getState().chatVisible) {
      toggleChat();
    }
    // In a real app, we would pre-fill the chat input with the error
    // For now, we just open the chat panel
    setHasError(false);
  };

  return (
    <div className="h-full w-full bg-void-bg border-t border-void-border flex flex-col relative">
      <div className="flex items-center justify-between px-4 py-1 bg-void-panel border-b border-void-border">
        <span className="text-zinc-500 text-xs font-mono">TERMINAL</span>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear();
                setHasError(false);
                setLastError('');
              }
            }}
            className="text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 text-[10px] rounded hover:bg-white/5"
            title="Clear Terminal"
          >
            Clear
          </button>
          {hasError && (
            <button 
              onClick={handleFixWithAI}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-void-violet/20 text-void-violet hover:bg-void-violet/30 transition-colors border border-void-violet/50 animate-pulse"
            >
              <Sparkles size={10} />
              <span>Fix with AI</span>
            </button>
          )}
          <button 
            onClick={() => setShowSetupModal(true)}
            className={cn(
              "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors",
              isComputeConnected ? "bg-void-cyan/10 text-void-cyan" : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
            )}
          >
            {isComputeConnected ? (
              <>
                <Server size={10} />
                <span>Colab Connected</span>
              </>
            ) : (
              <>
                <AlertCircle size={10} />
                <span>Connect Compute Node</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 w-full p-2" />
    </div>
  );
};
