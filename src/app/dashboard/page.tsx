'use client';

import React, { useState } from 'react';
import { useChatStore, Session } from '@/store/useChatStore';
import { RadarChart } from '@/components/charts/RadarChart';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function DashboardPage() {
  const { sessions, updateSessionAnalysis } = useChatStore();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sortedSessions = Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp);
  const selectedSession = selectedSessionId ? sessions[selectedSessionId] : null;

  const handleAnalyze = async (session: Session) => {
    if (analyzingId) return;
    setAnalyzingId(session.id);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: session.messages }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      updateSessionAnalysis(session.id, result);
      setSelectedSessionId(session.id);
    } catch (error) {
      console.error(error);
      alert('分析失败，请重试');
    } finally {
      setAnalyzingId(null);
    }
  };

  const currentAnalysis = selectedSession?.lastAnalysis;
  const radarData = currentAnalysis?.radar_data || [0, 0, 0, 0];
  const totalScore = radarData.reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="flex flex-1 overflow-hidden h-screen bg-[#102217]">
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar p-6 lg:p-10 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#9db9a8] text-sm font-medium uppercase tracking-wider">AI素养评估</span>
              <span className="bg-[#ffe066]/10 text-[#ffe066] text-xs px-2 py-0.5 rounded-full border border-[#ffe066]/20">进行中</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">学生表现概览</h1>
          </div>
          <div className="flex gap-2 bg-[#1c2a23] p-1.5 rounded-full border border-[#28392f]">
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ffe066] text-[#111814] text-sm font-bold shadow-lg shadow-[#ffe066]/20">
              <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
              本次会话
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[#9db9a8] hover:text-white hover:bg-[#28392f] text-sm font-medium transition-colors">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              本学期
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[#9db9a8] hover:text-white hover:bg-[#28392f] text-sm font-medium transition-colors">
              <span className="material-symbols-outlined text-[14px]">history</span>
              历史记录
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-[500px]">
          {/* Radar Analysis */}
          <div className="xl:col-span-2 bg-[#1c2a23] border border-[#28392f] rounded-[2rem] p-8 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffe066]/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="flex justify-between items-start mb-6 z-10">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Maple雷达分析</h3>
                <p className="text-[#9db9a8] text-sm">人机协作五维可视化</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-4xl font-bold text-white tracking-tighter">
                  {totalScore}<span className="text-lg text-[#9db9a8] font-normal">/100</span>
                </span>
                <div className="flex items-center text-[#ffe066] text-sm font-medium mt-1">
                  <span className="material-symbols-outlined text-[14px] mr-1">trending_up</span>
                  AI 实时评估
                </div>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center relative min-h-[350px]">
              <div className="relative w-full max-w-[500px] aspect-square">
                <RadarChart 
                  data={radarData} 
                  labels={['技术驾驭', '知识理解', '评估创造', '伦理责任']} 
                />
              </div>
            </div>
          </div>

          {/* Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-1 gap-4 content-start">
            <ScoreCard 
              title="技术驾驭" 
              score={currentAnalysis?.scores?.use_apply ?? '--'} 
              subtitle="提示词工程能力" 
              icon={<span className="material-symbols-outlined text-[18px]">code</span>} 
            />
            <ScoreCard 
              title="知识理解" 
              score={currentAnalysis?.scores?.know_understand ?? '--'} 
              subtitle="AI 原理掌握" 
              icon={<span className="material-symbols-outlined text-[18px]">verified_user</span>} 
              active
            />
            <ScoreCard 
              title="协同创造" 
              score={currentAnalysis?.scores?.evaluate_create ?? '--'} 
              subtitle="思维拓展指标" 
              icon={<span className="material-symbols-outlined text-[18px]">lightbulb</span>} 
            />
            <ScoreCard 
              title="伦理责任" 
              score={currentAnalysis?.scores?.ethics ?? '--'} 
              subtitle="合规使用与安全" 
              icon={<span className="material-symbols-outlined text-[18px]">balance</span>} 
              className="hidden xl:flex"
            />
          </div>
        </div>
      </main>

      {/* Right Sidebar - AI Comments & Session List */}
      <aside className="w-full md:w-[400px] lg:w-[440px] bg-[#1c2a23] border-l border-[#28392f] flex flex-col h-full shadow-2xl z-20">
        <div className="p-6 border-b border-[#28392f]">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#ffe066]/20 p-2 rounded-lg text-[#ffe066]">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </div>
            <h2 className="text-xl font-bold text-white">AI 评价</h2>
          </div>
          <p className="text-[#9db9a8] text-sm leading-relaxed">
            基于最近一次对话的素养分析。
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="bg-[#ffe066]/5 border border-[#ffe066]/20 rounded-2xl p-5 relative">
            <span className="absolute -top-3 left-4 bg-[#28392f] text-[#ffe066] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-[#ffe066]/20">AI 总结</span>
            <p className="text-white text-sm leading-6">
              {currentAnalysis?.comments || '请从下方列表选择一个会话进行分析。'}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-white text-sm font-bold">最近会话</h3>
            <div className="space-y-2">
              {sortedSessions.map((session) => (
                <div 
                  key={session.id}
                  onClick={() => handleAnalyze(session)}
                  className={cn(
                    "bg-[#28392f]/50 hover:bg-[#28392f] border border-[#28392f] hover:border-[#ffe066]/30 rounded-xl p-3 cursor-pointer transition-all group",
                    selectedSessionId === session.id && "bg-[#ffe066]/10 border-[#ffe066]"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-white text-xs font-bold truncate w-2/3">{session.title}</span>
                    <span className="text-[#9db9a8] text-[10px]">
                      {format(session.timestamp, 'MM-dd HH:mm', { locale: zhCN })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-xs line-clamp-1 group-hover:text-gray-300 transition-colors flex-1">
                      {session.messages[session.messages.length - 1]?.content || '暂无消息'}
                    </p>
                    {analyzingId === session.id && (
                      <span className="material-symbols-outlined text-[12px] text-[#ffe066] animate-spin ml-2">refresh</span>
                    )}
                    {session.lastAnalysis && analyzingId !== session.id && (
                      <span className="material-symbols-outlined text-[12px] text-[#ffe066] ml-2">check_circle</span>
                    )}
                  </div>
                </div>
              ))}
              {sortedSessions.length === 0 && (
                <p className="text-gray-500 text-xs">暂无历史会话</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ScoreCard({ title, score, subtitle, icon, active, className }: any) {
  return (
    <div className={cn(
      "bg-[#1c2a23] hover:bg-[#25352d] transition-colors border rounded-2xl p-5 flex flex-col gap-1 group cursor-pointer",
      active ? "border-[#ffe066]/40 shadow-[0_0_15px_rgba(255,224,102,0.1)]" : "border-[#28392f]",
      className
    )}>
      <div className="flex justify-between items-center">
        <p className={cn("text-xs font-bold uppercase tracking-wider", active ? "text-[#ffe066]" : "text-[#9db9a8]")}>
          {title}
        </p>
        <span className={cn(active ? "text-[#ffe066]" : "text-[#9db9a8] group-hover:text-[#ffe066]")}>
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-white text-2xl font-bold">{score}</span>
      </div>
      <p className="text-[#9db9a8]/70 text-xs mt-1">{subtitle}</p>
    </div>
  );
}
