-- Section 8: Database Integration
-- Run in Supabase: Dashboard → SQL Editor → New query
-- 每条语句单独执行，或一次性全选运行

-- 1. 创建表（先执行这条）
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  name text not null,
  size bigint,
  created_at timestamptz default now(),
  summary text,
  updated_at timestamptz default now()
);

-- 2. 创建索引（表创建成功后再执行）
create index if not exists idx_documents_path on public.documents(path);
create index if not exists idx_documents_created_at on public.documents(created_at desc);
