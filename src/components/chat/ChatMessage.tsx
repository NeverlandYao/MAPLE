'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isAssistant = role === 'assistant';

  return (
    <div className={cn(
      "flex items-start gap-4 animate-fade-in",
      !isAssistant && "flex-row-reverse"
    )}>
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center shrink-0 shadow-lg",
        isAssistant ? "bg-surface-dark border border-surface-border" : "bg-gradient-to-br from-orange-400 to-yellow-600"
      )}>
        {isAssistant ? (
          <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
        ) : (
          // User avatar - in old HTML it was empty div with gradient, but we can put an icon or keep empty if we want exact match. 
          // The old HTML had: <div class="size-10 ... bg-gradient..." data-alt="User avatar"></div>
          // So no icon for user.
          null
        )}
      </div>

      <div className={cn(
        "flex flex-col gap-1.5 max-w-[85%]",
        !isAssistant && "items-end"
      )}>
        <div className={cn("flex items-baseline justify-between gap-4", !isAssistant && "justify-end")}>
           <span className="text-sm font-bold text-white">
            {isAssistant ? 'MAPLE' : '你'}
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
            {content}
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
