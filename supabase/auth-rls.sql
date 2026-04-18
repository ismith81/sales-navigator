-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — RLS-policies voor auth
-- ════════════════════════════════════════════════════════════════════════════
-- Draai dit script in de Supabase SQL Editor ná het aanzetten van Auth
-- (Authentication → Providers → Email aan) en ná het uitnodigen van de eerste
-- user. Het script:
--   1. Zet RLS aan op de drie app-tabellen
--   2. Dropt bestaande "open" policies (als die er waren)
--   3. Maakt nieuwe policies die alleen authenticated users toelaten
--
-- Na dit script geldt: zonder geldige Supabase-sessie → geen data.
-- De anon key mag gewoon in de frontend blijven; RLS doet het werk.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── cases ─────────────────────────────────────────────────────────────────
alter table public.cases enable row level security;

drop policy if exists "cases open read"   on public.cases;
drop policy if exists "cases open write"  on public.cases;
drop policy if exists "cases open insert" on public.cases;
drop policy if exists "cases open update" on public.cases;
drop policy if exists "cases open delete" on public.cases;

create policy "cases authenticated all"
  on public.cases
  for all
  to authenticated
  using (true)
  with check (true);

-- ─── app_config ────────────────────────────────────────────────────────────
alter table public.app_config enable row level security;

drop policy if exists "app_config open read"   on public.app_config;
drop policy if exists "app_config open write"  on public.app_config;
drop policy if exists "app_config open insert" on public.app_config;
drop policy if exists "app_config open update" on public.app_config;
drop policy if exists "app_config open delete" on public.app_config;

create policy "app_config authenticated all"
  on public.app_config
  for all
  to authenticated
  using (true)
  with check (true);

-- ─── chat_feedback ─────────────────────────────────────────────────────────
-- Feedback is al beschermd via de serverless endpoint (JWT-check), maar
-- RLS aan zetten is een extra vangnet.
alter table public.chat_feedback enable row level security;

drop policy if exists "chat_feedback open insert" on public.chat_feedback;
drop policy if exists "chat_feedback open read"   on public.chat_feedback;

create policy "chat_feedback authenticated insert"
  on public.chat_feedback
  for insert
  to authenticated
  with check (true);

create policy "chat_feedback authenticated read"
  on public.chat_feedback
  for select
  to authenticated
  using (true);

-- ════════════════════════════════════════════════════════════════════════════
-- Verificatie: draai deze queries ná het script om te checken of alles klopt.
-- ════════════════════════════════════════════════════════════════════════════
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public' and tablename in ('cases','app_config','chat_feedback');
--
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename in ('cases','app_config','chat_feedback');
