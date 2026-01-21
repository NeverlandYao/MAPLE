'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/lib/utils';

export const ChatSidebar = () => {
  const router = useRouter();
  const { sessions, currentSessionId, addSession, setCurrentSession, deleteSession } = useChatStore();

  const sortedSessions = Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp);

  const handleNewChat = () => {
    const id = addSession('新会话');
    setCurrentSession(id);
    router.push('/');
  };

  return (
    <aside className="hidden md:flex w-72 flex-col justify-between border-r border-surface-border bg-[#171512] h-full transition-all duration-300">
      <div className="flex flex-col gap-6 p-6">
        {/* Header Status */}
        <div className="flex items-center gap-4 group cursor-help">
          <div className="relative flex items-center justify-center size-12 rounded-full bg-primary/10 border border-primary/20 transition-all duration-500 group-hover:bg-primary/20 group-hover:scale-105">
            <span className="material-symbols-outlined text-primary text-3xl transition-transform duration-500 group-hover:rotate-12">eco</span>
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-20"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-base font-bold leading-tight">MAPLE 实时状态</h1>
            <p className="text-primary text-xs font-medium uppercase tracking-wider flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-primary inline-block"></span>
              高质量
            </p>
          </div>
        </div>

        {/* New Chat Button */}
        <button 
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-full h-12 bg-primary text-background-dark text-sm font-bold shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:scale-[1.02] transition-all duration-200"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>新会话</span>
        </button>

        {/* Navigation / Sessions */}
        <nav className="flex flex-col gap-2 mt-2 overflow-hidden flex-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">今天</div>
          
          <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-2">
            {sortedSessions.length > 0 ? (
              sortedSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setCurrentSession(session.id);
                    router.push('/');
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-full transition-colors w-full text-left group relative",
                    currentSessionId === session.id 
                      ? "bg-surface-dark border border-surface-border text-white" 
                      : "text-gray-400 hover:bg-surface-dark/50 hover:text-white"
                  )}
                >
                  <span className={cn(
                    "material-symbols-outlined text-[20px]",
                    currentSessionId === session.id ? "text-primary" : ""
                  )}>
                    chat_bubble_outline
                  </span>
                  <span className="text-sm font-medium truncate flex-1">
                    {session.messages.find((m) => m.role === 'user')?.content || session.title}
                  </span>
                  
                  {/* Delete Button (Hidden by default, show on hover) */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-dark/80 rounded-full"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2">history</span>
                <span className="text-xs">暂无历史记录</span>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-surface-border flex flex-col gap-2">
        <button className="flex items-center gap-3 px-4 py-3 rounded-full text-gray-400 hover:bg-surface-dark/50 hover:text-white transition-colors w-full text-left">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-sm font-medium">设置</span>
        </button>
        <div className="flex items-center gap-3 px-4 py-3 rounded-full hover:bg-surface-dark/50 cursor-pointer transition-colors">
          <div className="size-8 rounded-full bg-gradient-to-br from-orange-400 to-yellow-600" data-alt="User avatar with gradient"></div>
          <div className="flex flex-col">
            <p className="text-white text-sm font-medium">Hi！Yao</p>
            <p className="text-xs text-gray-500">For Free</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
