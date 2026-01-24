'use client';

import React, { useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { PortalView } from '@/components/chat/PortalView';
import { ChatView } from '@/components/chat/ChatView';

import { detectIntent, AGENTS } from '@/lib/ai/agents';

export default function Home() {
  const { 
    sessions, 
    currentSessionId, 
    currentAgentId,
    addMessage, 
    addSession,
    setCurrentSession,
    setCurrentAgent,
    updateMessageContent
  } = useChatStore();

  const currentSession = currentSessionId ? sessions[currentSessionId] : null;

  const handleSendMessage = async (content: string) => {
    let sessionId = currentSessionId;

    if (!sessionId) {
      // Create new session if none active
      sessionId = addSession(content.slice(0, 20) + '...');
      setCurrentSession(sessionId);
    }

    // 1. Add User Message first
    addMessage(sessionId, { role: 'user', type: 'text', content });

    // 2. Detect Intent and Switch Agent
    const detectedAgentId = detectIntent(content);
    if (detectedAgentId !== currentAgentId) {
      // Add a switch notification message to the store AFTER user message
      addMessage(sessionId, { 
        role: 'system', 
        type: 'agent_switch',
        content: detectedAgentId 
      });
      setCurrentAgent(detectedAgentId);
    }

    try {
      // Get the latest messages for context
      const session = useChatStore.getState().sessions[sessionId];
      const messages = [...session.messages];
      
      // Inject System Prompt for current agent
      const currentAgent = AGENTS[useChatStore.getState().currentAgentId];
      const messagesWithSystem = [
        { role: 'system' as const, content: currentAgent.system_prompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messagesWithSystem 
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      // Create an initial empty assistant message with the current agentId
      addMessage(sessionId, { 
        role: 'assistant', 
        type: 'text',
        content: '', 
        agentId: useChatStore.getState().currentAgentId 
      });
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
