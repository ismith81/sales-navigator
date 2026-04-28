-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — Junction-tabel cases ↔ team_members + matching-velden
-- ════════════════════════════════════════════════════════════════════════════
-- Drie wijzigingen in één migratie (alles in één transaction zodat het
-- atomisch slaagt of faalt):
--
--   1. Nieuwe tabel `case_team_members` — bidirectionele mapping (Fase D).
--   2. Nieuwe matching-velden op `cases`: technologies, expertise_areas,
--      sectors, created_at — voor array-overlap matching met team_members.
--   3. Type-conversie van `cases.keywords` van jsonb → text[] zodat array-
--      overlap-queries native werken (consistent met team_members.kernskills).
--
-- VEREISTE: draai eerst de pre-migratie check uit de PR-discussie om te
-- bevestigen dat alle bestaande `cases.keywords` JSON-arrays zijn met string-
-- elementen. Bij niet-array-data wordt die rij in stap 3 leeggemaakt.
--
-- Draaien: Supabase SQL Editor, in één keer plakken.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Junction-tabel case_team_members ────────────────────────────────────
create table if not exists public.case_team_members (
  case_id text not null references public.cases(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  -- Rol die deze consultant op deze case had — vrij tekstveld, bv. "Lead
  -- architect", "Data engineer", "Project lead". Niet uit een dropdown zodat
  -- het past bij hoe sales over de case praat.
  role_on_case text,
  -- Periode in vrije tekst — CV's bevatten vaak ruwweg "Q2 2024 – Q4 2024" of
  -- "2023 – heden". Geen aparte start/end-dates omdat die vrijwel nooit exact
  -- bekend zijn en de granulariteit hier toch grof is.
  period_text text,
  created_at timestamptz not null default now(),
  primary key (case_id, team_member_id)
);

-- Voor de "welke cases heeft consultant X gedaan"-richting van Nova:
create index if not exists case_team_members_team_idx
  on public.case_team_members (team_member_id);

alter table public.case_team_members enable row level security;

drop policy if exists "case_team_members authenticated all" on public.case_team_members;
create policy "case_team_members authenticated all"
  on public.case_team_members
  for all
  to authenticated
  using (true)
  with check (true);

-- ─── 2. Nieuwe matching-velden op cases ─────────────────────────────────────
-- Idempotent: bij hervraging blijven bestaande waarden intact.
alter table public.cases
  add column if not exists technologies    text[] not null default '{}'::text[];
alter table public.cases
  add column if not exists expertise_areas text[] not null default '{}'::text[];
alter table public.cases
  add column if not exists sectors         text[] not null default '{}'::text[];
alter table public.cases
  add column if not exists created_at      timestamptz not null default now();

create index if not exists cases_technologies_idx
  on public.cases using gin (technologies);
create index if not exists cases_expertise_areas_idx
  on public.cases using gin (expertise_areas);
create index if not exists cases_sectors_idx
  on public.cases using gin (sectors);

-- ─── 3. keywords: jsonb → text[] ────────────────────────────────────────────
-- Strategie: nieuwe kolom keywords_arr aanmaken, data overzetten met
-- coalesce(...) zodat niet-array-data (objects/nulls) als lege array eindigt
-- (geen NULL-row, geen migratiefout). Daarna oude kolom drop + rename.
alter table public.cases
  add column if not exists keywords_arr text[] not null default '{}'::text[];

update public.cases
   set keywords_arr = coalesce(
     (
       select array_agg(elem::text)
       from jsonb_array_elements_text(keywords) as elem
     ),
     '{}'::text[]
   )
 where jsonb_typeof(keywords) = 'array';

alter table public.cases drop column keywords;
alter table public.cases rename column keywords_arr to keywords;

create index if not exists cases_keywords_idx
  on public.cases using gin (keywords);

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- Verificatie — draai deze queries ná de migratie:
--
-- 1. Bestaat de junction-tabel met juiste FK's?
--    select column_name, data_type from information_schema.columns
--      where table_schema='public' and table_name='case_team_members';
--
-- 2. Heeft cases de nieuwe kolommen + correcte types?
--    select column_name, data_type, udt_name from information_schema.columns
--      where table_schema='public' and table_name='cases'
--        and column_name in ('technologies','expertise_areas','sectors',
--                            'created_at','keywords');
--    Verwacht voor de _array_ kolommen: data_type='ARRAY', udt_name='_text'.
--
-- 3. Indexen aanwezig?
--    select indexname from pg_indexes
--      where schemaname='public' and tablename in ('cases','case_team_members');
--
-- 4. RLS aan op case_team_members?
--    select tablename, rowsecurity from pg_tables
--      where schemaname='public' and tablename='case_team_members';
-- ════════════════════════════════════════════════════════════════════════════
