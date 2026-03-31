-- MAPLE: conversation logging + dispatcher attribution + LLM-judge results
-- Run directly in Supabase SQL Editor

create extension if not exists pgcrypto;

-- 1) 会话主表（记录用户名字、会话级信息）
create table if not exists public.maple_sessions (
  session_id text primary key,
  user_name text not null,
  source text not null default 'chatbot',
  title text not null default '',
  last_message_preview text not null default '',
  message_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.maple_sessions add column if not exists source text not null default 'chatbot';
alter table public.maple_sessions add column if not exists title text not null default '';
alter table public.maple_sessions add column if not exists last_message_preview text not null default '';
alter table public.maple_sessions add column if not exists message_count integer not null default 0;
alter table public.maple_sessions add column if not exists last_activity_at timestamptz not null default now();

create index if not exists idx_maple_sessions_user_name
  on public.maple_sessions (user_name);

create index if not exists idx_maple_sessions_started_at
  on public.maple_sessions (started_at desc);

create index if not exists idx_maple_sessions_last_activity_at
  on public.maple_sessions (last_activity_at desc);

-- 2) 每轮交互日志（Interaction Logger）
-- round_no = 对话轮次；每轮可有 user / assistant 两条消息
create table if not exists public.maple_interaction_logs (
  log_id bigserial primary key,
  session_id text not null references public.maple_sessions(session_id) on delete cascade,
  round_no integer not null check (round_no > 0),
  role text not null check (role in ('user','assistant','expert')),
  expert_role text null check (expert_role in ('general','tech','pedagogy','ethics')),
  content text not null,
  logged_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.maple_interaction_logs
  add column if not exists expert_role text null;

do $$
begin
  -- Update role constraint to include 'expert'
  if exists (
    select 1
    from pg_constraint
    where conname = 'maple_interaction_logs_role_check'
  ) then
    alter table public.maple_interaction_logs
      drop constraint maple_interaction_logs_role_check;
  end if;
  alter table public.maple_interaction_logs
    add constraint maple_interaction_logs_role_check
    check (role in ('user','assistant','expert'));

  -- Update expert_role constraint
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maple_interaction_logs_expert_role_check'
  ) then
    alter table public.maple_interaction_logs
      add constraint maple_interaction_logs_expert_role_check
      check (expert_role in ('general','tech','pedagogy','ethics'));
  end if;
end $$;

create unique index if not exists uq_maple_interaction_session_round_role
  on public.maple_interaction_logs (session_id, round_no, role);

create index if not exists idx_maple_interaction_session_round
  on public.maple_interaction_logs (session_id, round_no, logged_at);

create index if not exists idx_maple_interaction_logged_at
  on public.maple_interaction_logs (logged_at desc);

create index if not exists idx_maple_interaction_expert_role
  on public.maple_interaction_logs (expert_role);

-- 3) Dispatcher归因结果日志（结构化 + 时间戳）
-- 一般对应每轮用户发言一次归因
create table if not exists public.maple_dispatcher_logs (
  dispatch_id bigserial primary key,
  session_id text not null references public.maple_sessions(session_id) on delete cascade,
  round_no integer not null check (round_no > 0),
  user_utterance text not null,
  assigned_dimension text not null check (
    assigned_dimension in ('know_understand','use_apply','evaluate_create','ethics')
  ),
  confidence numeric(5,4) null check (confidence >= 0 and confidence <= 1),
  reason text not null default '',
  dispatched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_maple_dispatcher_session_round
  on public.maple_dispatcher_logs (session_id, round_no, dispatched_at);

create index if not exists idx_maple_dispatcher_dimension
  on public.maple_dispatcher_logs (assigned_dimension);

-- 4) LLM-as-a-Judge评估结果（四维分数 + 文字反馈）
create table if not exists public.maple_judge_results (
  judge_id uuid primary key default gen_random_uuid(),
  session_id text not null references public.maple_sessions(session_id) on delete cascade,
  judge_model text null,
  know_understand_score numeric(5,2) not null check (know_understand_score >= 0 and know_understand_score <= 25),
  use_apply_score numeric(5,2) not null check (use_apply_score >= 0 and use_apply_score <= 25),
  evaluate_create_score numeric(5,2) not null check (evaluate_create_score >= 0 and evaluate_create_score <= 25),
  ethics_score numeric(5,2) not null check (ethics_score >= 0 and ethics_score <= 25),
  total_score numeric(6,2) generated always as (
    know_understand_score + use_apply_score + evaluate_create_score + ethics_score
  ) stored,
  feedback_text text not null default '',
  reasoning_json jsonb not null default '{}'::jsonb,   -- 每维解释
  radar_data_json jsonb not null default '[]'::jsonb,  -- 兼容前端雷达图
  trajectory_features_json jsonb not null default '{}'::jsonb,
  judged_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.maple_judge_results
  add column if not exists trajectory_features_json jsonb not null default '{}'::jsonb;

create index if not exists idx_maple_judge_session_judged_at
  on public.maple_judge_results (session_id, judged_at desc);

-- 每个session只保留最新一条评估（可选）
-- 如不需要可删除此唯一索引
-- create unique index if not exists uq_maple_judge_latest_per_session
--   on public.maple_judge_results (session_id);

-- 5) 便于后续分析的视图：每个会话最新评估
create or replace view public.v_maple_latest_judge as
select distinct on (j.session_id)
  j.session_id,
  s.user_name,
  j.know_understand_score,
  j.use_apply_score,
  j.evaluate_create_score,
  j.ethics_score,
  j.total_score,
  j.feedback_text,
  j.judged_at
from public.maple_judge_results j
join public.maple_sessions s on s.session_id = j.session_id
order by j.session_id, j.judged_at desc;
