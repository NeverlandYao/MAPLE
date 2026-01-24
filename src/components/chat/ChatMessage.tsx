'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn, preprocessLaTeX } from '@/lib/utils';

import { AGENTS } from '@/lib/ai/agents';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  type?: 'text' | 'agent_switch';
}

export const ChatMessage = ({ role, content, agentId, type = 'text' }: ChatMessageProps) => {
  const isAssistant = role === 'assistant';
  const isAgentSwitch = type === 'agent_switch';
  const agent = (isAgentSwitch ? AGENTS[content] : (agentId ? AGENTS[agentId] : AGENTS.general)) || AGENTS.general;

  if (isAgentSwitch) {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className={cn(
          "flex items-center gap-2 bg-surface-dark border px-4 py-2 rounded-full shadow-lg",
          agent.border_color
        )}>
          <span className={cn("material-symbols-outlined text-sm", agent.color)}>swap_horiz</span>
          <span className="text-xs text-gray-300">Switching to <span className={cn("font-bold", agent.color)}>{agent.name}</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-start gap-4 animate-fade-in",
      !isAssistant && "flex-row-reverse"
    )}>
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center shrink-0 shadow-lg relative group",
        isAssistant ? cn("bg-surface-dark border", agent.border_color) : "bg-gradient-to-br from-orange-400 to-yellow-600"
      )}>
        {isAssistant ? (
          <>
            <span className={cn("material-symbols-outlined text-xl", agent.color)}>{agent.avatar_icon}</span>
            <div className="absolute -bottom-1 -right-1 size-3 bg-surface-dark rounded-full border border-surface-border flex items-center justify-center">
              <span className={cn("size-1.5 rounded-full", agent.color.replace('text-', 'bg-'))}></span>
            </div>
          </>
        ) : null}
      </div>

      <div className={cn(
        "flex flex-col gap-1.5 max-w-[85%]",
        !isAssistant && "items-end"
      )}>
        <div className={cn("flex items-baseline justify-between gap-4", !isAssistant && "justify-end")}>
           <span className="text-sm font-bold text-white flex items-center gap-2">
            {isAssistant ? (
              <>
                {agent.name}
                <span className={cn(
                  "text-[10px] font-normal px-1.5 py-0.5 rounded-full border bg-surface-dark/50 uppercase tracking-wider",
                  agent.border_color,
                  agent.color
                )}>
                  {agent.role}
                </span>
              </>
            ) : '你'}
           </span>
        </div>
        
        <div className={cn(
          "px-5 py-4 rounded-2xl shadow-sm leading-relaxed message-content overflow-hidden",
          isAssistant 
            ? "bg-surface-dark text-gray-100 rounded-tl-none border border-surface-border" 
            : "bg-primary text-background-dark rounded-tr-none font-medium"
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              code: ({ className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match && !className?.includes('block');
                
                return !isInline ? (
                  <div className="relative group/code my-2">
                    <pre className={cn(
                      "overflow-x-auto p-4 rounded-xl bg-background-dark border border-surface-border font-mono text-sm",
                      className
                    )}>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <code className="bg-black/30 px-1.5 py-0.5 rounded text-primary font-mono text-sm" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {preprocessLaTeX(content)}
          </ReactMarkdown>
        </div>

        {isAssistant && (
          <div className="flex gap-2 mt-1">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dark hover:bg-surface-border text-xs font-medium text-gray-400 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[16px]">thumb_up</span>
              <span>有帮助</span>
            </button>
            <button 
              onClick={() => navigator.clipboard.writeText(content)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dark hover:bg-surface-border text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              <span>复制</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
