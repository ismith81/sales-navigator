-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — Certificeringsstandaard + gap-analyse per consultant
-- ════════════════════════════════════════════════════════════════════════════
-- Implementeert de 14-cert standaard (9 baseline + 5 specialistisch) gedefinieerd
-- in src/data/certifications.json. Doel: per consultant zien welke certs
-- behaald zijn en welke ontbreken op basis van specialisatie (AE/DE/DSA) en tier.
--
-- Architectonische keuzes:
--   - specializations als eigen tabel (niet CHECK-constraint) zodat
--     competentie-leads via UI nieuwe specialisaties kunnen toevoegen
--   - tier zit op de cert (eigenschap van de cert), niet op de consultant
--   - role_relevance is een aparte tabel zodat per cert per specialisatie
--     kan afwijken
--   - consultant_certifications is een junction (binair achieved-status, geen
--     in-progress, geen datum-tracking — bewust simpel; later uitbreidbaar)
--   - other_certifications is een text[]-kolom op team_members (geen aparte
--     tabel) — past in bestaande array-patroon (kernskills/technologies/sectors)
--   - url-veld op certifications zodat naam in beheer-UI clickable is naar
--     vendor-leerpad / examenpagina
--
-- Naast junction blijft team_members.certifications text[] bestaan voor Nova's
-- bestaande match-flow. Junction is voor gap-analyse; array voor matching/
-- vermelding. Beide bronnen worden bij migratie consistent gemaakt.
--
-- Idempotent: alle statements gebruiken `if not exists` / `or replace`.

begin;

-- ─── 1. specializations master-tabel ─────────────────────────────────────
-- Specialisaties (AE / DE / DSA en eventuele toekomstige) als eigen tabel
-- i.p.v. CHECK-constraint. Voordeel: competentie-leads kunnen via de Beheer-
-- UI specialisaties toevoegen / hernoemen / deactiveren zonder ALTER TABLE.
-- `code` is de stabiele key (FK uit team_members + role_relevance);
-- `label` en `full_name` zijn vrij hernoembaar.
create table if not exists public.specializations (
  code text primary key,
  label text not null,
  full_name text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bootstrap met de 3 huidige specialisaties. on conflict do nothing zodat
-- re-run veilig is.
insert into public.specializations (code, label, full_name, sort_order) values
  ('AE',  'Analytics Engineer',      'Data Consultant - Analytics Engineer',      1),
  ('DE',  'Data Engineer',           'Data Consultant - Data Engineer',           2),
  ('DSA', 'Data Solution Architect', 'Data Consultant - Data Solution Architect', 3)
on conflict (code) do nothing;

-- ─── 2. team_members krijgt role_code + other_certifications kolommen ──────
-- role_code: FK naar specializations(code) — de *interne* specialisatie van
-- de consultant. De vrije `role`-tekst blijft voor de *externe* CV-laag
-- (varieert per project, drijft Nova's match-flow). Sales kiest role_code
-- expliciet per consultant in de migratie-wizard; geen auto-guess op de
-- vrije role-tekst (die kan letterlijk "Data Consultant" zijn en is geen
-- betrouwbare bron voor specialisatie).
alter table public.team_members
  add column if not exists role_code text
  references public.specializations(code) on update cascade;

-- other_certifications: vrije-tekst extras die niet in de master-lijst staan
-- (bv. AWS Solutions Architect Associate, niet-Microsoft-certs).
alter table public.team_members
  add column if not exists other_certifications text[] not null default '{}'::text[];

-- ─── 3. certifications master-tabel ───────────────────────────────────────
-- Cert-IDs zijn de canonical strings uit certifications_seed.json (bv. "DP-700",
-- "PL-300"). Tekst i.p.v. uuid omdat de IDs zelf domain-betekenis hebben en
-- direct in CV-text-blobs voorkomen — vergemakkelijkt fuzzy matching.
create table if not exists public.certifications (
  id text primary key,
  name text not null,
  vendor text not null,
  tier text not null check (tier in ('baseline', 'specialist', 'overig')),
  active boolean not null default true,
  notes text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- url-kolom voor bestaande tabellen die zonder de kolom zijn aangemaakt.
alter table public.certifications add column if not exists url text;

-- Tier-CHECK update: bij oudere installs stond ('baseline','specialist').
-- Drop + recreate idempotent om 'overig' toe te voegen.
alter table public.certifications
  drop constraint if exists certifications_tier_check;
alter table public.certifications
  add constraint certifications_tier_check
  check (tier in ('baseline', 'specialist', 'overig'));

-- ─── 4. certification_role_relevance ──────────────────────────────────────
-- Per cert per specialisatie een relevance-niveau. Aparte tabel zodat de
-- relevance per specialisatie kan afwijken zonder de cert-master vol te
-- stoppen met enum-velden. `role` is FK naar specializations(code) zodat
-- nieuwe specialisaties automatisch werken.
create table if not exists public.certification_role_relevance (
  cert_id text not null references public.certifications(id) on delete cascade,
  role text not null references public.specializations(code) on update cascade on delete cascade,
  relevance text not null check (relevance in ('expected', 'recommended', 'not_applicable')),
  primary key (cert_id, role)
);

-- ─── 5. consultant_certifications junction ───────────────────────────────
-- Wie heeft welke cert behaald. Binair (achieved true/false). Geen "in
-- progress" status. Geen datum-tracking nu — wordt aparte uitbreiding als
-- die later nodig is.
create table if not exists public.consultant_certifications (
  consultant_id uuid not null references public.team_members(id) on delete cascade,
  cert_id text not null references public.certifications(id) on delete cascade,
  achieved boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (consultant_id, cert_id)
);

create index if not exists consultant_certifications_consultant_idx
  on public.consultant_certifications(consultant_id);
create index if not exists consultant_certifications_cert_idx
  on public.consultant_certifications(cert_id);

-- ─── 6. RLS-policies — authenticated-all, consistent met team_members ────
alter table public.specializations enable row level security;
alter table public.certifications enable row level security;
alter table public.certification_role_relevance enable row level security;
alter table public.consultant_certifications enable row level security;

-- Idempotente policy-creatie: drop-if-exists + create. Vermijdt errors bij
-- re-run en houdt de definitie centraal in deze SQL-file.
drop policy if exists "specializations_authed_all" on public.specializations;
create policy "specializations_authed_all"
  on public.specializations for all
  to authenticated
  using (true) with check (true);

drop policy if exists "certifications_authed_all" on public.certifications;
create policy "certifications_authed_all"
  on public.certifications for all
  to authenticated
  using (true) with check (true);

drop policy if exists "cert_role_relevance_authed_all" on public.certification_role_relevance;
create policy "cert_role_relevance_authed_all"
  on public.certification_role_relevance for all
  to authenticated
  using (true) with check (true);

drop policy if exists "consultant_certs_authed_all" on public.consultant_certifications;
create policy "consultant_certs_authed_all"
  on public.consultant_certifications for all
  to authenticated
  using (true) with check (true);

-- ─── 7. updated_at-trigger voor specializations + certifications + consultant_certifications ─
-- Zelfde patroon als andere tabellen in deze app — automatische timestamp
-- bij elke update zodat de Beheer-UI 'm kan tonen / sortering gebruiken.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists specializations_set_updated_at on public.specializations;
create trigger specializations_set_updated_at
  before update on public.specializations
  for each row execute function public.set_updated_at();

drop trigger if exists certifications_set_updated_at on public.certifications;
create trigger certifications_set_updated_at
  before update on public.certifications
  for each row execute function public.set_updated_at();

drop trigger if exists consultant_certifications_set_updated_at on public.consultant_certifications;
create trigger consultant_certifications_set_updated_at
  before update on public.consultant_certifications
  for each row execute function public.set_updated_at();

commit;

-- ─── Verificatie (run handmatig na migratie) ───────────────────────────────
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='team_members'
--   and column_name in ('role_code', 'other_certifications');
--
-- select table_name from information_schema.tables
-- where table_schema='public'
--   and table_name in ('certifications','certification_role_relevance','consultant_certifications');
