'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { Sparkles, Bot } from 'lucide-react';

export default function ChatPage() {
  const { 
    sessions, 
    currentSessionId, 
    addMessage, 
    addSession,
    setCurrentSession 
  } = useChatStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentSession = currentSessionId ? sessions[currentSessionId] : null;

  // 如果没有当前会话且有会话列表，默认选择第一个
  useEffect(() => {
    if (!currentSessionId) {
      const sessionIds = Object.keys(sessions);
      if (sessionIds.length > 0) {
        setCurrentSession(sessionIds[0]);
      } else {
        // 如果完全没有会话，创建一个
        addSession('新会话');
      }
    }
  }, [currentSessionId, sessions, setCurrentSession, addSession]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const handleSendMessage = async (content: string) => {
    if (!currentSessionId) return;

    // 添加用户消息
    addMessage(currentSessionId, { role: 'user', content });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...(currentSession?.messages || []), { role: 'user', content }] 
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();
      
      // 添加助手回复
      addMessage(currentSessionId, { 
        role: 'assistant', 
        content: data.response 
      });
    } catch (error) {
      console.error(error);
      addMessage(currentSessionId, { 
        role: 'system', 
        content: '抱歉，发生了错误，请稍后再试。' 
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1c1917]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {currentSession?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-fade-in">
              <div className="size-20 rounded-full bg-[#ffe066]/10 border border-[#ffe066]/20 flex items-center justify-center shadow-2xl">
                <span className="material-symbols-outlined text-[#ffe066] text-4xl animate-pulse">eco</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">你好！我是 MAPLE</h2>
                <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
                  你的 AI 素养助手。我们可以聊聊如何更好地使用 AI，或者探讨任何你感兴趣的话题。
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                <ExampleTag text="如何写好提示词？" />
                <ExampleTag text="帮我解释量子纠缠" />
                <ExampleTag text="写一个贪吃蛇游戏" />
              </div>
            </div>
          ) : (
            currentSession?.messages.map((msg, idx) => (
              <ChatMessage key={idx} role={msg.role} content={msg.content} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 bg-gradient-to-t from-[#1c1917] via-[#1c1917] to-transparent">
        <ChatInput onSendMessage={handleSendMessage} />
        <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-[0.2em]">
          AI-Powered Literacy Evaluation System
        </p>
      </div>
    </div>
  );
}

function ExampleTag({ text }: { text: string }) {
  return (
    <button className="px-4 py-2 rounded-full bg-[#292524] border border-[#44403c] text-sm text-gray-400 hover:text-[#ffe066] hover:border-[#ffe066]/50 transition-all">
      {text}
    </button>
  );
}
