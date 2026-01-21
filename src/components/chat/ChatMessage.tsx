'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { Copy, ThumbsUp } from 'lucide-react';

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
        isAssistant ? "bg-[#292524] border border-[#44403c]" : "bg-gradient-to-br from-orange-400 to-yellow-600"
      )}>
        {isAssistant ? (
          <span className="material-symbols-outlined text-[#ffe066] text-xl">smart_toy</span>
        ) : (
          <span className="material-symbols-outlined text-white text-xl">person</span>
        )}
      </div>

      <div className={cn(
        "flex flex-col gap-1.5 max-w-[85%]",
        !isAssistant && "items-end"
      )}>
        <span className="text-sm font-bold text-white">
          {isAssistant ? 'MAPLE' : '你'}
        </span>
        
        <div className={cn(
          "px-5 py-4 rounded-2xl shadow-sm leading-relaxed",
          isAssistant 
            ? "bg-[#292524] text-gray-100 rounded-tl-none border border-[#44403c]" 
            : "bg-[#ffe066] text-[#1c1917] rounded-tr-none font-medium"
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              code: ({ node, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                return !props.inline && match ? (
                  <pre className="bg-[#1c1917] p-3 rounded-lg overflow-x-auto my-2 border border-[#44403c]">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                ) : (
                  <code className="bg-black/30 px-1.5 py-0.5 rounded text-[#ffe066] font-mono text-sm" {...props}>
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
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#292524] hover:bg-[#44403c] text-xs font-medium text-gray-400 hover:text-white transition-colors">
              <ThumbsUp size={14} />
              <span>有帮助</span>
            </button>
            <button 
              onClick={() => navigator.clipboard.writeText(content)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#292524] hover:bg-[#44403c] text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              <Copy size={14} />
              <span>复制</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
