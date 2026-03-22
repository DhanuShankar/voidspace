import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Sparkles, Cloud, Cpu, FileCode2, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export const OnboardingFlow: React.FC = () => {
  const { showOnboarding, setShowOnboarding, setVibeMode, toggleChat } = useStore();
  const [step, setStep] = useState(1);
  const [setupProgress, setSetupProgress] = useState(0);

  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setSetupProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStep(3), 500);
            return 100;
          }
          return prev + 25;
        });
      }, 800);
      return () => clearInterval(interval);
    }
  }, [step]);

  if (!showOnboarding) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-void-panel border border-void-border rounded-2xl w-full max-w-2xl shadow-[0_0_50px_rgba(124,58,237,0.15)] overflow-hidden flex flex-col relative">
        
        {/* Step 1: Landing */}
        {step === 1 && (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-void-violet to-void-cyan rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.5)] mb-8">
              <span className="text-white font-black text-4xl italic">V</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white italic mb-4">VOID</h1>
            <p className="text-xl text-zinc-400 mb-12 font-medium">Code from anywhere. No setup. No fear.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full">
              <div className="bg-void-bg border border-void-border p-6 rounded-xl flex flex-col items-center text-center">
                <Cloud size={32} className="text-void-cyan mb-4" />
                <h3 className="font-bold text-zinc-200 mb-2">Files in Drive</h3>
                <p className="text-xs text-zinc-500">Your code lives securely in your Google Drive.</p>
              </div>
              <div className="bg-void-bg border border-void-border p-6 rounded-xl flex flex-col items-center text-center">
                <Sparkles size={32} className="text-void-violet mb-4" />
                <h3 className="font-bold text-zinc-200 mb-2">AI Builds For You</h3>
                <p className="text-xs text-zinc-500">Describe your app, and VOID writes the code.</p>
              </div>
              <div className="bg-void-bg border border-void-border p-6 rounded-xl flex flex-col items-center text-center">
                <Cpu size={32} className="text-emerald-400 mb-4" />
                <h3 className="font-bold text-zinc-200 mb-2">Cloud Compute</h3>
                <p className="text-xs text-zinc-500">Run terminal commands via Google Colab.</p>
              </div>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="bg-white text-black hover:bg-zinc-200 px-8 py-4 rounded-xl font-black text-lg transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Start Coding Free <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Step 2: Setup Workspace */}
        {step === 2 && (
          <div className="p-12 flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold text-white mb-8">Setting up your workspace...</h2>
            
            <div className="w-full max-w-md space-y-6 text-left">
              <div className="flex items-center gap-4">
                {setupProgress >= 25 ? <CheckCircle2 className="text-void-cyan" /> : <Loader2 className="animate-spin text-zinc-500" />}
                <span className={cn("font-medium", setupProgress >= 25 ? "text-zinc-200" : "text-zinc-500")}>Connecting to Google Drive</span>
              </div>
              <div className="flex items-center gap-4">
                {setupProgress >= 50 ? <CheckCircle2 className="text-void-cyan" /> : setupProgress >= 25 ? <Loader2 className="animate-spin text-zinc-500" /> : <div className="w-6 h-6 rounded-full border-2 border-void-border" />}
                <span className={cn("font-medium", setupProgress >= 50 ? "text-zinc-200" : "text-zinc-500")}>Creating VOID Projects folder</span>
              </div>
              <div className="flex items-center gap-4">
                {setupProgress >= 75 ? <CheckCircle2 className="text-void-cyan" /> : setupProgress >= 50 ? <Loader2 className="animate-spin text-zinc-500" /> : <div className="w-6 h-6 rounded-full border-2 border-void-border" />}
                <span className={cn("font-medium", setupProgress >= 75 ? "text-zinc-200" : "text-zinc-500")}>Setting up command queue</span>
              </div>
              <div className="flex items-center gap-4">
                {setupProgress >= 100 ? <CheckCircle2 className="text-void-cyan" /> : setupProgress >= 75 ? <Loader2 className="animate-spin text-zinc-500" /> : <div className="w-6 h-6 rounded-full border-2 border-void-border" />}
                <span className={cn("font-medium", setupProgress >= 100 ? "text-zinc-200" : "text-zinc-500")}>Deploying backend (Apps Script)</span>
              </div>
            </div>

            <div className="w-full max-w-md h-2 bg-void-bg rounded-full mt-12 overflow-hidden border border-void-border">
              <div 
                className="h-full bg-gradient-to-r from-void-violet to-void-cyan transition-all duration-500 ease-out"
                style={{ width: `${setupProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Step 3: Compute Setup */}
        {step === 3 && (
          <div className="p-12 flex flex-col items-center text-center">
            <Cpu size={48} className="text-void-cyan mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Want to run code?</h2>
            <p className="text-zinc-400 mb-8 max-w-md">
              Connect a free Google Colab notebook to run terminal commands, install packages, and start servers.
            </p>
            
            <div className="bg-void-bg border border-void-border p-6 rounded-xl w-full max-w-md text-left mb-8">
              <ol className="list-decimal list-inside space-y-3 text-sm text-zinc-300">
                <li>Click the button below to open the template.</li>
                <li>In Colab, click <strong>Runtime → Run all</strong>.</li>
                <li>Return here when it says "Connected".</li>
              </ol>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-md">
              <button 
                onClick={() => setStep(4)}
                className="bg-void-cyan hover:bg-cyan-400 text-black px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                Open Colab Notebook <ArrowRight size={18} />
              </button>
              <button 
                onClick={() => setStep(4)}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>
        )}

        {/* Step 4: First Project */}
        {step === 4 && (
          <div className="p-12 flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold text-white mb-8">Start your first project</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              <button 
                onClick={() => {
                  setVibeMode(true);
                  if (!useStore.getState().chatVisible) toggleChat();
                  setShowOnboarding(false);
                }}
                className="bg-void-bg border border-void-border hover:border-void-violet p-8 rounded-2xl flex flex-col items-center text-center group transition-all"
              >
                <div className="w-16 h-16 bg-void-violet/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Sparkles size={32} className="text-void-violet" />
                </div>
                <h3 className="font-bold text-zinc-200 mb-2 text-lg">Let AI build it</h3>
                <p className="text-sm text-zinc-500">Describe what you want in plain English (Vibe Mode).</p>
              </button>

              <button 
                onClick={() => setShowOnboarding(false)}
                className="bg-void-bg border border-void-border hover:border-void-cyan p-8 rounded-2xl flex flex-col items-center text-center group transition-all"
              >
                <div className="w-16 h-16 bg-void-cyan/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Cloud size={32} className="text-void-cyan" />
                </div>
                <h3 className="font-bold text-zinc-200 mb-2 text-lg">Open from Drive</h3>
                <p className="text-sm text-zinc-500">Continue working on an existing project.</p>
              </button>

              <button 
                onClick={() => setShowOnboarding(false)}
                className="bg-void-bg border border-void-border hover:border-zinc-400 p-8 rounded-2xl flex flex-col items-center text-center group transition-all"
              >
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FileCode2 size={32} className="text-zinc-400" />
                </div>
                <h3 className="font-bold text-zinc-200 mb-2 text-lg">Blank Project</h3>
                <p className="text-sm text-zinc-500">Start from scratch with an empty workspace.</p>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
