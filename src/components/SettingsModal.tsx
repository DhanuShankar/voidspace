import React from 'react';
import { useStore } from '../store';
import { X, Settings, Monitor, Cpu, Key, User } from 'lucide-react';
import { cn } from '../lib/utils';

export const SettingsModal: React.FC = () => {
  const { 
    showSettingsModal, setShowSettingsModal,
    fontSize, setFontSize,
    tabSize, setTabSize,
    wordWrap, setWordWrap,
    showMinimap, setShowMinimap,
    showLineNumbers, setShowLineNumbers,
    autoSave, setAutoSave
  } = useStore();
  const [activeTab, setActiveTab] = React.useState<'editor' | 'appearance' | 'ai' | 'compute' | 'account'>('editor');

  if (!showSettingsModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-void-panel border border-void-border rounded-xl w-full max-w-4xl h-[80vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-void-border">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Settings className="text-void-violet" />
            Settings
          </h2>
          <button onClick={() => setShowSettingsModal(false)} className="text-zinc-500 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-void-border bg-void-bg p-4 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('editor')}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all", activeTab === 'editor' ? "bg-void-violet/20 text-void-violet" : "text-zinc-400 hover:bg-void-border hover:text-zinc-200")}
            >
              <Monitor size={16} /> Editor
            </button>
            <button 
              onClick={() => setActiveTab('appearance')}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all", activeTab === 'appearance' ? "bg-void-violet/20 text-void-violet" : "text-zinc-400 hover:bg-void-border hover:text-zinc-200")}
            >
              <Monitor size={16} /> Appearance
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all", activeTab === 'ai' ? "bg-void-violet/20 text-void-violet" : "text-zinc-400 hover:bg-void-border hover:text-zinc-200")}
            >
              <Key size={16} /> AI & Keys
            </button>
            <button 
              onClick={() => setActiveTab('compute')}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all", activeTab === 'compute' ? "bg-void-violet/20 text-void-violet" : "text-zinc-400 hover:bg-void-border hover:text-zinc-200")}
            >
              <Cpu size={16} /> Compute
            </button>
            <button 
              onClick={() => setActiveTab('account')}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all", activeTab === 'account' ? "bg-void-violet/20 text-void-violet" : "text-zinc-400 hover:bg-void-border hover:text-zinc-200")}
            >
              <User size={16} /> Account
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 bg-void-bg">
            {activeTab === 'editor' && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h3 className="text-lg font-bold text-zinc-200 mb-4 border-b border-void-border pb-2">Editor Settings</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-zinc-400 mb-2">Font Size</label>
                      <input 
                        type="number" 
                        value={fontSize} 
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-zinc-400 mb-2">Font Family</label>
                      <input type="text" defaultValue="'JetBrains Mono', 'Fira Code', monospace" className="w-full bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan" />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-400 mb-2">Tab Size</label>
                      <select 
                        value={tabSize}
                        onChange={(e) => setTabSize(Number(e.target.value))}
                        className="w-full bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan"
                      >
                        <option value="2">2</option>
                        <option value="4">4</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-zinc-200">Word Wrap</div>
                        <div className="text-xs text-zinc-500">Controls how lines should wrap.</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={wordWrap === 'on'}
                        onChange={(e) => setWordWrap(e.target.checked ? 'on' : 'off')}
                        className="w-4 h-4 rounded border-void-border text-void-violet focus:ring-void-violet bg-void-panel" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-zinc-200">Minimap</div>
                        <div className="text-xs text-zinc-500">Controls whether the minimap is shown.</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showMinimap}
                        onChange={(e) => setShowMinimap(e.target.checked)}
                        className="w-4 h-4 rounded border-void-border text-void-violet focus:ring-void-violet bg-void-panel" 
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-zinc-200">Line Numbers</div>
                        <div className="text-xs text-zinc-500">Controls the display of line numbers.</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showLineNumbers}
                        onChange={(e) => setShowLineNumbers(e.target.checked)}
                        className="w-4 h-4 rounded border-void-border text-void-violet focus:ring-void-violet bg-void-panel" 
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-zinc-200">Auto Save</div>
                        <div className="text-xs text-zinc-500">Automatically save files after editing.</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={autoSave}
                        onChange={(e) => setAutoSave(e.target.checked)}
                        className="w-4 h-4 rounded border-void-border text-void-violet focus:ring-void-violet bg-void-panel" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="max-w-2xl space-y-8">
                <h3 className="text-lg font-bold text-zinc-200 mb-4 border-b border-void-border pb-2">Appearance</h3>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 mb-2">Color Theme</label>
                  <select className="w-full bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan">
                    <option value="void-dark">VOID Dark (Default)</option>
                    <option value="void-darker">VOID Darker</option>
                    <option value="void-violet">VOID Violet</option>
                    <option value="void-cyan">VOID Cyan</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="max-w-2xl space-y-8">
                <h3 className="text-lg font-bold text-zinc-200 mb-4 border-b border-void-border pb-2">AI Configuration</h3>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 mb-2">AI Model</label>
                  <select className="w-full bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan">
                    <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Default)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                    <option value="claude-3-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 mb-2">API Key (Optional Override)</label>
                  <input type="password" placeholder="sk-..." className="w-full bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan" />
                  <p className="text-xs text-zinc-500 mt-2">Leave blank to use the environment variable.</p>
                </div>
              </div>
            )}

            {activeTab === 'compute' && (
              <div className="max-w-2xl space-y-8">
                <h3 className="text-lg font-bold text-zinc-200 mb-4 border-b border-void-border pb-2">Remote Compute Node</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Connect to a remote machine (like Google Colab) to run terminal commands and extensions.
                </p>
                
                <div className="bg-void-bg border border-void-border rounded-lg p-4 mb-4">
                  <div className="text-xs font-bold text-zinc-400 mb-2">Run this in Google Colab:</div>
                  <pre className="bg-void-panel p-3 rounded text-[10px] text-zinc-300 font-mono overflow-x-auto border border-void-border">
{`!pip install websockets nest_asyncio pyngrok
import nest_asyncio
import asyncio
import websockets
from pyngrok import ngrok
import subprocess

nest_asyncio.apply()

async def terminal_handler(websocket, path):
    while True:
        try:
            cmd = await websocket.recv()
            process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = process.communicate()
            await websocket.send(stdout + stderr)
        except websockets.ConnectionClosed:
            break

start_server = websockets.serve(terminal_handler, "localhost", 8765)
public_url = ngrok.connect(8765, "tcp").public_url
print(f"\\n\\033[92m[VOID] Compute Node Ready!\\033[0m")
print(f"Paste this URL in VOID: \\033[96mws://{public_url.split('tcp://')[1]}\\033[0m\\n")

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()`}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="ws://your-ngrok-url.tcp.ngrok.io"
                    className="flex-1 bg-void-panel border border-void-border rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:border-void-cyan"
                  />
                  <button className="bg-void-cyan hover:bg-cyan-400 text-zinc-950 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                    Connect
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <p>Settings for account coming soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
