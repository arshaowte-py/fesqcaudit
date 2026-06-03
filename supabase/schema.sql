-- Run once in the Supabase SQL Editor for project Frido-QC-Audit.

create extension if not exists "pgcrypto";

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  "timestamp" timestamptz not null default now(),
  store_name text not null,
  location text not null default '',
  auditor_name text not null,
  auditee_name text not null default '',
  visit_date text not null,
  section_scores jsonb not null default '{}'::jsonb,
  total_score integer not null default 0,
  -- checkpoints: per Qn — answer, spec, remark; S4/S7 also productName, correctiveAction
  checkpoints jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audits_timestamp_idx on public.audits ("timestamp");
create index if not exists audits_visit_date_idx on public.audits (visit_date desc);
create index if not exists audits_store_name_idx on public.audits (store_name);

alter table public.audits enable row level security;

create policy "Service role full access"
  on public.audits
  for all
  to service_role
  using (true)
  with check (true);
