'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Leaf, ArrowRight } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1c1917] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ffe066]/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-2xl w-full text-center space-y-12 z-10 animate-fade-in">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center size-24 rounded-3xl bg-[#ffe066]/10 border border-[#ffe066]/20 shadow-2xl">
            <Leaf className="text-[#ffe066] size-12" />
            <div className="absolute inset-0 rounded-3xl bg-[#ffe066]/10 animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter">
              MAPLE
            </h1>
            <p className="text-[#ffe066] text-sm font-bold uppercase tracking-[0.4em]">
              AI Literacy Evaluation
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-lg mx-auto font-light">
          基于 DeepSeek R1 驱动的智能素养评估系统。<br />
          通过对话，洞察你的 AI 协作潜力。
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => router.push('/chat')}
            className="group flex items-center gap-3 px-8 py-4 rounded-full bg-[#ffe066] text-[#1c1917] text-lg font-bold shadow-[0_0_30px_rgba(250,204,21,0.2)] hover:shadow-[0_0_40px_rgba(250,204,21,0.4)] hover:scale-105 transition-all duration-300"
          >
            开始对话
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
          <button 
            onClick={() => router.push('/dashboard')}
            className="px-8 py-4 rounded-full bg-[#292524] text-white text-lg font-bold border border-[#44403c] hover:bg-[#44403c] transition-all duration-300"
          >
            查看仪表盘
          </button>
        </div>

        <div className="pt-12 grid grid-cols-3 gap-8 border-t border-[#44403c]/50">
          <Stat label="多维评估" value="5维度" />
          <Stat label="模型驱动" value="DeepSeek" />
          <Stat label="实时分析" value="毫秒级" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-gray-500 text-xs uppercase tracking-widest">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}
