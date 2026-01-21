'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { 
  Plus, 
  MessageSquare, 
  LayoutDashboard, 
  Settings, 
  Trash2,
  Leaf
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { sessions, currentSessionId, addSession, setCurrentSession, deleteSession } = useChatStore();

  const sortedSessions = Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp);

  const handleNewChat = () => {
    const id = addSession('新会话');
    router.push('/chat');
  };

  return (
    <aside className="hidden md:flex w-72 flex-col justify-between border-r border-[#44403c] bg-[#171512] h-screen transition-all duration-300">
      <div className="flex flex-col gap-6 p-6 overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => router.push('/')}>
          <div className="relative flex items-center justify-center size-12 rounded-full bg-[#ffe066]/10 border border-[#ffe066]/20 transition-all duration-500 group-hover:bg-[#ffe066]/20 group-hover:scale-105">
            <Leaf className="text-[#ffe066] size-6 transition-transform duration-500 group-hover:rotate-12" />
            <div className="absolute inset-0 rounded-full bg-[#ffe066]/20 animate-ping opacity-20"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-base font-bold leading-tight">MAPLE</h1>
            <p className="text-[#ffe066] text-xs font-medium uppercase tracking-wider flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[#ffe066] inline-block"></span>
              高质量
            </p>
          </div>
        </div>

        {/* New Chat Button */}
        <button 
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-full h-12 bg-[#ffe066] text-[#1c1917] text-sm font-bold shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:scale-[1.02] transition-all duration-200"
        >
          <Plus size={18} />
          <span>新会话</span>
        </button>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 mt-2">
          <Link 
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-full transition-colors",
              pathname === '/dashboard' ? "bg-[#292524] text-white border border-[#44403c]" : "text-gray-400 hover:bg-[#292524]/50 hover:text-white"
            )}
          >
            <LayoutDashboard size={20} className={pathname === '/dashboard' ? "text-[#ffe066]" : ""} />
            <span className="text-sm font-medium">仪表盘</span>
          </Link>
          
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">最近会话</div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[40vh] no-scrollbar">
            {sortedSessions.map((session) => (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => {
                    setCurrentSession(session.id);
                    router.push('/chat');
                  }}
                  className={cn(
                    "flex items-center w-full gap-3 px-4 py-3 rounded-full transition-colors text-left",
                    currentSessionId === session.id && pathname === '/chat' 
                      ? "bg-[#292524] text-white border border-[#44403c]" 
                      : "text-gray-400 hover:bg-[#292524]/50 hover:text-white"
                  )}
                >
                  <MessageSquare size={18} className={currentSessionId === session.id && pathname === '/chat' ? "text-[#ffe066]" : ""} />
                  <span className="text-sm font-medium truncate pr-6">{session.title}</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sortedSessions.length === 0 && (
              <p className="text-gray-600 text-xs px-4 py-2 italic">暂无会话</p>
            )}
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[#44403c] flex flex-col gap-2">
        <button className="flex items-center gap-3 px-4 py-3 rounded-full text-gray-400 hover:bg-[#292524]/50 hover:text-white transition-colors w-full text-left">
          <Settings size={20} />
          <span className="text-sm font-medium">设置</span>
        </button>
        <div className="flex items-center gap-3 px-4 py-3 rounded-full hover:bg-[#292524]/50 cursor-pointer transition-colors">
          <div className="size-8 rounded-full bg-gradient-to-br from-orange-400 to-yellow-600"></div>
          <div className="flex flex-col">
            <p className="text-white text-sm font-medium">Hi！Yao</p>
            <p className="text-xs text-gray-500">For Free</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
