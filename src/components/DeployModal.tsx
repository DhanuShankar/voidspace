import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, CloudUpload, Github, Globe, CheckCircle2, Loader2, ArrowRight, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

export const DeployModal: React.FC = () => {
  const { showDeployModal, setShowDeployModal } = useStore();
  const [step, setStep] = useState(1);
  const [deployProgress, setDeployProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const deployUrl = "https://void-app-x7y9.vercel.app";

  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setDeployProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStep(3), 500);
            return 100;
          }
          return prev + 15;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleCopy = () => {
    navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showDeployModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-void-panel border border-void-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-void-border">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <CloudUpload className="text-void-cyan" />
            Deploy to Vercel
          </h2>
          <button onClick={() => setShowDeployModal(false)} className="text-zinc-500 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
                <svg width="32" height="32" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#000000"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connect Vercel</h3>
              <p className="text-zinc-400 text-sm mb-8">
                Deploy your VOID project directly to Vercel. We'll create a new GitHub repository and link it automatically.
              </p>
              
              <button 
                onClick={() => setStep(2)}
                className="w-full bg-white text-black hover:bg-zinc-200 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Github size={20} /> Continue with GitHub
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center text-center py-4">
              <h3 className="text-lg font-bold text-white mb-6">Deploying Project...</h3>
              
              <div className="w-full space-y-4 text-left mb-8">
                <div className="flex items-center gap-3 text-sm">
                  {deployProgress >= 25 ? <CheckCircle2 size={16} className="text-void-cyan" /> : <Loader2 size={16} className="animate-spin text-zinc-500" />}
                  <span className={cn(deployProgress >= 25 ? "text-zinc-200" : "text-zinc-500")}>Creating GitHub repository</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {deployProgress >= 50 ? <CheckCircle2 size={16} className="text-void-cyan" /> : deployProgress >= 25 ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <div className="w-4 h-4 rounded-full border-2 border-void-border" />}
                  <span className={cn(deployProgress >= 50 ? "text-zinc-200" : "text-zinc-500")}>Pushing code to main branch</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {deployProgress >= 75 ? <CheckCircle2 size={16} className="text-void-cyan" /> : deployProgress >= 50 ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <div className="w-4 h-4 rounded-full border-2 border-void-border" />}
                  <span className={cn(deployProgress >= 75 ? "text-zinc-200" : "text-zinc-500")}>Building project on Vercel</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {deployProgress >= 100 ? <CheckCircle2 size={16} className="text-void-cyan" /> : deployProgress >= 75 ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <div className="w-4 h-4 rounded-full border-2 border-void-border" />}
                  <span className={cn(deployProgress >= 100 ? "text-zinc-200" : "text-zinc-500")}>Assigning domains</span>
                </div>
              </div>

              <div className="w-full h-1.5 bg-void-bg rounded-full overflow-hidden border border-void-border">
                <div 
                  className="h-full bg-void-cyan transition-all duration-500 ease-out"
                  style={{ width: `${deployProgress}%` }}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 bg-void-cyan/20 rounded-full flex items-center justify-center mb-6 border border-void-cyan/50">
                <Globe size={32} className="text-void-cyan" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Deployment Successful!</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Your project is now live and accessible on the internet.
              </p>
              
              <div className="w-full bg-void-bg border border-void-border rounded-lg p-3 flex items-center justify-between mb-8">
                <span className="text-sm text-zinc-300 font-mono truncate mr-4">{deployUrl}</span>
                <button 
                  onClick={handleCopy}
                  className="text-zinc-400 hover:text-white transition-colors p-1"
                  title="Copy URL"
                >
                  {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>

              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowDeployModal(false)}
                  className="flex-1 bg-void-bg border border-void-border hover:bg-void-border text-white py-2.5 rounded-lg font-bold transition-colors text-sm"
                >
                  Close
                </button>
                <a 
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-void-cyan hover:bg-cyan-400 text-black py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  Visit Site <ArrowRight size={16} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
