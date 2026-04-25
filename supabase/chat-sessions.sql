-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — chat_sessions tabel + RLS
-- ════════════════════════════════════════════════════════════════════════════
-- Persistente chat-geschiedenis per user (Fase 5 Nova-roadmap). Cross-device:
-- één user, één geschiedenis. RLS scoped op auth.uid() = user_id zodat een
-- user nooit andermans sessies kan zien — ook niet via een gemanipuleerde
-- client (anon key + RLS doet het werk).
--
-- Draai dit in de Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nieuw gesprek',
  -- messages: array van {role, content, toolCalls?, groundingSources?, groundingQueries?, feedback?}
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sorting voor de history-dropdown: laatste-actieve eerst per user.
create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, updated_at desc);

-- updated_at automatisch laten meebewegen bij elke update.
create or replace function public.set_chat_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_chat_sessions_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.chat_sessions enable row level security;

drop policy if exists "chat_sessions own select" on public.chat_sessions;
drop policy if exists "chat_sessions own insert" on public.chat_sessions;
drop policy if exists "chat_sessions own update" on public.chat_sessions;
drop policy if exists "chat_sessions own delete" on public.chat_sessions;

-- Een user ziet/manipuleert alléén z'n eigen rijen.
create policy "chat_sessions own select"
  on public.chat_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "chat_sessions own insert"
  on public.chat_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "chat_sessions own update"
  on public.chat_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "chat_sessions own delete"
  on public.chat_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- Verificatie:
-- select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename='chat_sessions';
--
-- select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='chat_sessions';
-- ════════════════════════════════════════════════════════════════════════════
