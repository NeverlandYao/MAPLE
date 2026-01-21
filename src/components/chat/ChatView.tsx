import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatViewProps {
  sessionTitle: string;
  messages: Message[];
  onSendMessage: (message: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ sessionTitle, messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const [startTime, setStartTime] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    const timeStr = format(now, 'a hh:mm', { locale: zhCN });
    setStartTime(`今天, ${timeStr}`);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="flex-none h-16 border-b border-surface-border flex items-center justify-between px-6 lg:px-10 bg-background-dark/95 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <h2 className="text-white text-lg font-bold">{sessionTitle}</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-dark border border-surface-border text-gray-400 uppercase tracking-wide">数学-101</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-surface-dark rounded-full p-1 pl-4 border border-surface-border">
            <span className="text-xs font-medium text-gray-300">学习模式</span>
            <button className="bg-primary text-background-dark rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[16px]">school</span>
              活跃
            </button>
          </div>
          <button className="size-10 flex items-center justify-center rounded-full bg-surface-dark text-white hover:bg-surface-border transition-colors">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar" id="chat-container">
        <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-4">
           {/* Date Separator */}
           <div className="flex justify-center">
            <span className="text-xs font-medium text-gray-500 bg-surface-dark/50 px-3 py-1 rounded-full">
              {startTime || '加载中...'}
            </span>
          </div>

          {messages.map((msg, idx) => (
            <ChatMessage key={idx} role={msg.role} content={msg.content} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none p-6 pt-0 relative">
        <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-background-dark to-transparent pointer-events-none"></div>
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {/* Quick Actions / Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar mask-image-linear">
            <button className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-full bg-surface-dark border border-surface-border hover:border-primary/50 hover:bg-surface-border transition-all group" onClick={() => onSendMessage('解释这个概念')}>
              <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
              <span className="text-sm font-medium text-gray-200 group-hover:text-white">概念解释</span>
            </button>
            <button className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-full bg-surface-dark border border-surface-border hover:border-primary/50 hover:bg-surface-border transition-all group" onClick={() => onSendMessage('举个现实例子')}>
              <span className="material-symbols-outlined text-primary text-lg">public</span>
              <span className="text-sm font-medium text-gray-200 group-hover:text-white">举个现实例子</span>
            </button>
            <button className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-full bg-surface-dark border border-surface-border hover:border-primary/50 hover:bg-surface-border transition-all group" onClick={() => onSendMessage('考考我')}>
              <span className="material-symbols-outlined text-primary text-lg">quiz</span>
              <span className="text-sm font-medium text-gray-200 group-hover:text-white">考考我</span>
            </button>
          </div>

          {/* Input Box */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-orange-500/20 rounded-full opacity-50 blur transition duration-500 group-hover:opacity-100"></div>
            <div className="relative flex items-center gap-2 bg-surface-dark rounded-full p-2 pl-5 pr-2 border border-surface-border shadow-2xl transition-all focus-within:border-primary/50 focus-within:bg-surface-dark-hover">
              <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
              </button>
              <input 
                className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-base py-3 px-2 font-display outline-none" 
                placeholder="向 MAPLE 提问..." 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>
              <button 
                onClick={() => handleSubmit()}
                className="bg-primary text-background-dark p-3 rounded-full hover:bg-white hover:text-background-dark transition-all duration-300 shadow-[0_0_10px_rgba(250,204,21,0.3)] hover:shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">arrow_upward</span>
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-gray-600 font-medium">MAPLE 可能会犯错。请核查重要信息。</p>
        </div>
      </div>
    </div>
  );
};
