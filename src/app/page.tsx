'use client';

import React, { useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { PortalView } from '@/components/chat/PortalView';
import { ChatView } from '@/components/chat/ChatView';

export default function Home() {
  const { 
    sessions, 
    currentSessionId, 
    addMessage, 
    addSession,
    setCurrentSession,
    updateMessageContent
  } = useChatStore();

  const currentSession = currentSessionId ? sessions[currentSessionId] : null;

  // Initial session setup
  useEffect(() => {
    // If no session exists at all, we might not want to create one immediately until user types in PortalView.
    // However, ChatView needs a session.
    // Let's say: 
    // - If currentSessionId is null, show PortalView.
    // - If user sends message from PortalView, create session and switch to ChatView (or just add to current if we create one hidden).
    
    // Actually, PortalView "Where should we start?" implies starting a new thread.
    
    if (!currentSessionId) {
      const sessionIds = Object.keys(sessions);
      if (sessionIds.length > 0) {
        // If there are sessions, select the most recent one? 
        // Or keep it null to show PortalView? 
        // The old HTML shows PortalView by default if "no active chat" or just "home".
        // Let's assume if no session selected, show PortalView.
      }
    }
  }, [currentSessionId, sessions]);

  const handleSendMessage = async (content: string) => {
    let sessionId = currentSessionId;

    if (!sessionId) {
      // Create new session if none active
      sessionId = addSession(content.slice(0, 20) + '...');
      setCurrentSession(sessionId);
    }

    // Add User Message
    addMessage(sessionId, { role: 'user', content });

    try {
      // Get the latest messages for context
      const session = useChatStore.getState().sessions[sessionId];
      const messages = session.messages;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messages 
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      // Create an initial empty assistant message
      addMessage(sessionId, { role: 'assistant', content: '' });
      const assistantMessageIndex = useChatStore.getState().sessions[sessionId].messages.length - 1;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          
          // Update the message content in store
          updateMessageContent(sessionId, assistantMessageIndex, accumulatedContent);
        }
      }
    } catch (error) {
      console.error(error);
      addMessage(sessionId, { 
        role: 'system', 
        content: '抱歉，发生了错误，请稍后再试。' 
      });
    }
  };

  // Logic to determine View
  // If no current session, OR current session has no messages => PortalView
  // Else => ChatView
  
  const showPortal = !currentSession || currentSession.messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full relative min-w-0 bg-background-dark">
      {showPortal ? (
        <PortalView onSendMessage={handleSendMessage} />
      ) : (
        <ChatView 
          sessionTitle={currentSession?.title || '新会话'} 
          messages={currentSession?.messages || []} 
          onSendMessage={handleSendMessage} 
        />
      )}
    </div>
  );
}
