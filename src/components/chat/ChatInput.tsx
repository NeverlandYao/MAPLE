'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, disabled }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleQuickPrompt = (label: string) => {
    if (!disabled) {
      onSendMessage(label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <QuickPrompt label="概念解释" icon="lightbulb" onClick={() => handleQuickPrompt("请帮我解释一下这个概念")} />
        <QuickPrompt label="举个现实例子" icon="public" onClick={() => handleQuickPrompt("能给我举个实际生活中的例子吗？")} />
        <QuickPrompt label="考考我" icon="quiz" onClick={() => handleQuickPrompt("针对刚才的内容考考我吧")} />
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#ffe066]/20 to-orange-500/20 rounded-3xl opacity-50 blur transition duration-500 group-hover:opacity-100"></div>
        <form 
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2 bg-[#292524] rounded-3xl p-2 pl-5 pr-2 border border-[#44403c] shadow-2xl transition-all focus-within:border-[#ffe066]/50 focus-within:bg-[#44403c]"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask MAPLE..."
            className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-base py-2 resize-none max-h-[200px] outline-none"
            disabled={disabled}
          />
          
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
            <button 
              type="submit"
              disabled={!input.trim() || disabled}
              className="p-2.5 rounded-full bg-[#ffe066] text-[#1c1917] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function QuickPrompt({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-full bg-[#292524] border border-[#44403c] hover:border-[#ffe066]/50 hover:bg-[#44403c] transition-all group"
    >
      <span className="material-symbols-outlined text-[#ffe066] text-lg">{icon}</span>
      <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
    </button>
  );
}
