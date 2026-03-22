import React, { useState } from 'react';
import { useStore } from '../store';
import { Cloud, HardDrive, Server, X, CheckCircle2, Loader2, Copy, Zap, Key, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

export const CloudSetupModal: React.FC = () => {
  const { 
    showSetupModal, 
    setShowSetupModal, 
    storageProvider, 
    setStorageProvider,
    isStorageConnected,
    setStorageConnected,
    computeUrl,
    setComputeUrl,
    isComputeConnected,
    setComputeConnected,
    ngrokToken,
    setNgrokToken
  } = useStore();

  const [connectingStorage, setConnectingStorage] = useState(false);
  const [connectingCompute, setConnectingCompute] = useState(false);
  const [isAutoSettingUp, setIsAutoSettingUp] = useState(false);
  const [tempUrl, setTempUrl] = useState(computeUrl);

  if (!showSetupModal) return null;

  const handleConnectStorage = (provider: 'gdrive' | 'terabox') => {
    setStorageProvider(provider);
    setConnectingStorage(true);
    // Simulate OAuth flow
    setTimeout(() => {
      setConnectingStorage(false);
      setStorageConnected(true);
    }, 1500);
  };

  const handleConnectCompute = () => {
    setConnectingCompute(true);
    setComputeUrl(tempUrl);
    // Simulate WebSocket connection attempt
    setTimeout(() => {
      setConnectingCompute(false);
      setComputeConnected(true);
    }, 1500);
  };

  const handleAutoSetup = () => {
    setIsAutoSettingUp(true);
    setStorageProvider('gdrive');
    
    // Simulate complex setup process
    setTimeout(() => {
      setStorageConnected(true);
      setComputeConnected(true);
      setIsAutoSettingUp(false);
      // In a real app, this would trigger the actual backend setup
    }, 3000);
  };

  const colabScript = `!pip install websockets nest_asyncio pyngrok
import nest_asyncio
import asyncio
import websockets
from pyngrok import ngrok
import subprocess
import os

# Configure ngrok
NGROK_TOKEN = "${ngrokToken || 'YOUR_TOKEN_HERE'}"
if NGROK_TOKEN != "YOUR_TOKEN_HERE":
    ngrok.set_auth_token(NGROK_TOKEN)

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
asyncio.get_event_loop().run_forever()`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-void-panel border border-void-border rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-void-border">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Cloud className="text-void-cyan" />
            VOID Cloud Infrastructure
          </h2>
          <button onClick={() => setShowSetupModal(false)} className="text-zinc-500 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          {/* Auto Setup Banner */}
          <div className="bg-void-violet/10 border border-void-violet/30 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-void-violet/20 rounded-full flex items-center justify-center shrink-0">
              <Zap className="text-void-violet" size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-white mb-1">One-Click Smart Setup</h3>
              <p className="text-sm text-zinc-400 mb-4">Automatically connect Google Drive, configure Colab, and initialize ngrok tunneling.</p>
              <button 
                onClick={handleAutoSetup}
                disabled={isAutoSettingUp}
                className="bg-void-violet hover:bg-violet-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50"
              >
                {isAutoSettingUp ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Configuring Infrastructure...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Start Auto-Setup
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="h-px bg-void-border w-full" />

          {/* Storage Section */}
          <section>
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              1. File Persistence (Google Drive)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => handleConnectStorage('gdrive')}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all relative overflow-hidden",
                  storageProvider === 'gdrive' ? "border-void-cyan bg-void-cyan/10" : "border-void-border bg-void-bg hover:border-void-violet/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Cloud className={cn(storageProvider === 'gdrive' ? "text-void-cyan" : "text-blue-400")} />
                  {isStorageConnected && storageProvider === 'gdrive' && <CheckCircle2 className="text-void-cyan" size={16} />}
                </div>
                <div className="font-bold text-zinc-200">Google Drive</div>
                <div className="text-xs text-zinc-500 mt-1">Sync your workspace to a secure VOID folder in your Drive.</div>
                {connectingStorage && storageProvider === 'gdrive' && (
                  <div className="absolute inset-0 bg-void-bg/80 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-void-cyan" />
                  </div>
                )}
              </button>

              <div className="bg-void-bg border border-void-border p-4 rounded-lg flex flex-col justify-center">
                <div className="text-xs text-zinc-500 mb-2 uppercase font-bold tracking-tighter">Status</div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isStorageConnected ? "bg-emerald-500" : "bg-zinc-700")} />
                  <span className="text-sm font-medium text-zinc-300">
                    {isStorageConnected ? `Connected to ${storageProvider === 'gdrive' ? 'Google Drive' : 'Local Storage'}` : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Compute Section */}
          <section>
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              2. Compute & Tunneling (Colab + ngrok)
            </h3>
            
            <div className="space-y-4">
              {/* ngrok Token */}
              <div className="bg-void-bg border border-void-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                    <Key size={12} /> ngrok Auth Token
                  </label>
                  <a 
                    href="https://dashboard.ngrok.com/get-started/your-authtoken" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-void-cyan hover:underline flex items-center gap-1"
                  >
                    Get Token <ExternalLink size={10} />
                  </a>
                </div>
                <input 
                  type="password"
                  value={ngrokToken}
                  onChange={(e) => setNgrokToken(e.target.value)}
                  placeholder="Paste your ngrok authtoken here..."
                  className="w-full bg-void-panel border border-void-border rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-void-cyan transition-colors"
                />
              </div>

              {/* Colab Script */}
              <div className="bg-void-bg border border-void-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-400">Run this in Google Colab:</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(colabScript)}
                    className="text-xs flex items-center gap-1 text-zinc-500 hover:text-void-cyan transition-colors"
                  >
                    <Copy size={12} /> Copy Script
                  </button>
                </div>
                <pre className="bg-void-panel p-3 rounded text-[10px] text-zinc-300 font-mono overflow-x-auto border border-void-border max-h-32">
                  {colabScript}
                </pre>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input 
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="ws://your-ngrok-url.tcp.ngrok.io"
                    className="w-full bg-void-bg border border-void-border rounded-lg py-2 pl-10 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-void-cyan transition-colors"
                  />
                </div>
                <button 
                  onClick={handleConnectCompute}
                  disabled={!tempUrl || connectingCompute}
                  className="bg-void-cyan hover:bg-cyan-400 text-zinc-950 px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {connectingCompute ? <Loader2 className="animate-spin" size={16} /> : 'Connect Node'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-void-border flex justify-end">
          <button 
            onClick={() => setShowSetupModal(false)}
            className="bg-void-violet hover:bg-violet-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
