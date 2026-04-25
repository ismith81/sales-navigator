-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — team_members tabel + Storage-bucket voor CV's
-- ════════════════════════════════════════════════════════════════════════════
-- Per consultant: gestructureerde profielvelden (uit CV-parse) + verwijzing
-- naar de origineel-PDF in Storage. CV's zijn AVG-proof verondersteld
-- (geen NAW/geboortedata/etc.) en worden alleen ge-tagged op skills, sectoren,
-- projectervaring etc. zodat Nova kan matchen.
--
-- Twee onderdelen:
--   1. Tabel `team_members` met RLS voor authenticated users
--   2. Storage-bucket `team-cvs` met policies om de PDFs te beheren
--
-- Draai in de Supabase SQL Editor. Storage-bucket-deel kan ook via UI
-- (Storage → Create bucket "team-cvs", privé), beleid via SQL hieronder.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── tabel team_members ─────────────────────────────────────────────────────
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  -- Gestructureerde profiel-velden (uit CV-parse + handmatige correcties)
  name text not null,
  role text,
  seniority text,
  -- Skills/tech/sector als arrays voor snelle filter/match.
  kernskills text[] not null default '{}'::text[],
  technologies text[] not null default '{}'::text[],
  sectors text[] not null default '{}'::text[],
  -- Projectervaring als jsonb-array van {name, role, description} zodat we
  -- straks kunnen koppelen aan cases (Fase D).
  project_experience jsonb not null default '[]'::jsonb,
  certifications text[] not null default '{}'::text[],
  -- Klantgerichte 2-3 zinnen-samenvatting (door parser of handmatig)
  summary text,
  -- Beschikbaarheid voor sales-gesprekken (eenvoudige toggle in Fase A)
  available_for_sales boolean not null default true,
  -- Verwijzing naar de PDF in Storage (path binnen team-cvs-bucket)
  cv_pdf_path text,
  -- Volledige extracted plain-text van het CV — voor toekomstige semantische
  -- search (Fase C, vector embeddings) en als fallback bij re-parsen.
  cv_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_name_idx on public.team_members (name);
-- GIN-indexen op de array-velden voor snelle filter (skill-match etc.)
create index if not exists team_members_kernskills_idx on public.team_members using gin (kernskills);
create index if not exists team_members_technologies_idx on public.team_members using gin (technologies);
create index if not exists team_members_sectors_idx on public.team_members using gin (sectors);

-- updated_at automatisch laten meebewegen
create or replace function public.set_team_members_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_team_members_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Volgens scope-besluit: alle ingelogde users mogen lezen + schrijven (zelfde
-- patroon als cases / app_config). Geen owner-koppeling in Fase A.
alter table public.team_members enable row level security;

drop policy if exists "team_members authenticated all" on public.team_members;

create policy "team_members authenticated all"
  on public.team_members
  for all
  to authenticated
  using (true)
  with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- Storage-bucket `team-cvs` — privé, alleen authenticated kan up/downloaden.
-- Bucket eerst aanmaken via Storage UI (privé!), dan onderstaande policies.
-- ════════════════════════════════════════════════════════════════════════════

-- Insert (upload) — elke authed user mag PDFs in de bucket plaatsen.
drop policy if exists "team-cvs authenticated upload" on storage.objects;
create policy "team-cvs authenticated upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'team-cvs');

-- Select (download/list) — elke authed user mag PDFs lezen.
drop policy if exists "team-cvs authenticated read" on storage.objects;
create policy "team-cvs authenticated read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'team-cvs');

-- Delete — elke authed user mag PDFs verwijderen (bv. bij update naar nieuwe versie).
drop policy if exists "team-cvs authenticated delete" on storage.objects;
create policy "team-cvs authenticated delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'team-cvs');

-- Update — elke authed user mag overschrijven.
drop policy if exists "team-cvs authenticated update" on storage.objects;
create policy "team-cvs authenticated update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'team-cvs')
  with check (bucket_id = 'team-cvs');

-- ════════════════════════════════════════════════════════════════════════════
-- Verificatie
--
-- Tabel: select schemaname, tablename, rowsecurity from pg_tables
--          where schemaname='public' and tablename='team_members';
--
-- Policies: select policyname, cmd from pg_policies
--             where schemaname='public' and tablename='team_members';
--
-- Bucket bestaat: select id, name, public from storage.buckets where id='team-cvs';
--   (Als deze 0 rows geeft: maak de bucket aan via Storage UI als 'private'.)
-- ════════════════════════════════════════════════════════════════════════════
