import React, { useState } from 'react';

interface PortalViewProps {
  onSendMessage: (message: string) => void;
}

export const PortalView: React.FC<PortalViewProps> = ({ onSendMessage }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-6 animate-fade-in">
      <div className="w-full max-w-3xl flex flex-col gap-10">
        {/* Greeting */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-4xl text-primary animate-pulse">sparkle</span>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-primary bg-clip-text text-transparent">Hi Yao</h1>
          </div>
          <h2 className="text-4xl font-semibold text-gray-400">Where should we start?</h2>
        </div>

        {/* Input Area */}
        <div className="relative group w-full">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-[2rem] opacity-50 blur transition duration-500 group-hover:opacity-100"></div>
          <div className="relative flex flex-col bg-surface-dark rounded-[2rem] p-4 border border-surface-border shadow-2xl transition-all focus-within:border-primary/50 focus-within:bg-background-dark">
            <input 
              className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-xl px-4 py-4 font-display outline-none" 
              placeholder="Ask MAPLE..." 
              type="text" 
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            
            <div className="flex items-center justify-between px-2 mt-2">
              <div className="flex gap-2">
                <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm font-medium">
                  <span className="material-symbols-outlined text-[18px]">extension</span>
                  <span>Tools</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-gray-500 text-sm font-medium">
                  <span>Thinking</span>
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </div>
                <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Prompts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <button 
            className="text-left p-4 rounded-2xl bg-surface-dark border border-surface-border hover:bg-surface-dark-hover hover:border-primary/30 transition-all group" 
            onClick={() => onSendMessage('解释微积分中的导数概念')}
          >
            <span className="material-symbols-outlined text-primary mb-2">school</span>
            <p className="text-gray-200 font-medium">解释导数</p>
            <p className="text-gray-500 text-xs mt-1">微积分基础概念</p>
          </button>
          <button 
            className="text-left p-4 rounded-2xl bg-surface-dark border border-surface-border hover:bg-surface-dark-hover hover:border-primary/30 transition-all group" 
            onClick={() => onSendMessage('帮我构思一篇关于AI的论文')}
          >
            <span className="material-symbols-outlined text-blue-400 mb-2">edit_note</span>
            <p className="text-gray-200 font-medium">论文构思</p>
            <p className="text-gray-500 text-xs mt-1">AI 与教育</p>
          </button>
          <button 
            className="text-left p-4 rounded-2xl bg-surface-dark border border-surface-border hover:bg-surface-dark-hover hover:border-primary/30 transition-all group" 
            onClick={() => onSendMessage('罗马帝国衰落的原因是什么？')}
          >
            <span className="material-symbols-outlined text-orange-400 mb-2">history_edu</span>
            <p className="text-gray-200 font-medium">历史问答</p>
            <p className="text-gray-500 text-xs mt-1">罗马帝国</p>
          </button>
        </div>
      </div>
    </div>
  );
};
