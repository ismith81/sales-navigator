-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — pgvector embeddings op team_members (Fase C)
-- ════════════════════════════════════════════════════════════════════════════
-- Voegt semantic-search-mogelijkheden toe naast de bestaande structurele
-- substring-match in find_team_members. Gebruikt Gemini's text-embedding-004
-- (768 dimensies, multilingual) via de bestaande GEMINI_API_KEY — geen nieuwe
-- env-vars nodig.
--
-- Gebruik: na deze migratie embedt /api/embed-team-backfill alle bestaande
-- profielen één keer. Daarna wordt elk profiel auto-ge-embed bij save (zie
-- /api/embed-team-member). Tolerant-bij-fail — een save zonder embedding
-- werkt nog (alleen niet zichtbaar voor semantic-zoek tot het opnieuw lukt).
--
-- Idempotent: alle statements gebruiken `if not exists` zodat 't veilig
-- herhaald kan draaien.

begin;

-- ─── 1. pgvector extension ─────────────────────────────────────────────────
-- Schema 'extensions' is Supabase's conventie voor extensions; sommige Supabase-
-- projecten verwachten 'm zo. Mocht 't faalen, val terug op het public schema.
create extension if not exists vector;

-- ─── 2. Embedding-kolom op team_members ────────────────────────────────────
-- 768 dimensies = match met text-embedding-004's output. Nullable: bestaande
-- profielen krijgen NULL tot de backfill-endpoint ze embedt; nieuwe profielen
-- krijgen NULL tot de auto-embed-flow ze invult. Bij retrieval-tijd filter
-- op `embedding is not null` zodat lege rows geen valse matches geven.
alter table public.team_members
  add column if not exists embedding vector(768);

-- ─── 3. Index voor similarity-search ───────────────────────────────────────
-- HNSW (Hierarchical Navigable Small World) — werkt goed voor kleine tot
-- middelgrote datasets, geen lists-tuning nodig zoals bij ivfflat. Cosine
-- distance is de standaard voor embeddings (vector_cosine_ops).
--
-- Bij groei naar 10k+ rows kan een rebuild met andere parameters nuttig zijn,
-- maar voor het huidige corpus (~12 profielen) is dit prima.
create index if not exists team_members_embedding_idx
  on public.team_members
  using hnsw (embedding vector_cosine_ops);

-- ─── 4. RPC-functie voor semantic-search vanuit Nova ──────────────────────
-- Aangeroepen vanuit api/chat.js's toolFindTeamMembers wanneer Nova een
-- semantic_query meegeeft. Returnt top-K matches gesorteerd op cosine-
-- similarity (1 - distance). Filtert profielen zonder embedding (NULL)
-- automatisch weg — alleen reeds-ge-embedde profielen zijn vindbaar.
--
-- security: invoker (default) — respecteert RLS van team_members zodat
-- alleen authenticated users de tabel kunnen bevragen, consistent met
-- direct-select-gedrag elders in de app.
create or replace function public.match_team_members(
  query_embedding vector(768),
  match_count int default 8
)
returns table (
  id uuid,
  similarity float
)
language sql
stable
as $$
  select
    tm.id,
    1 - (tm.embedding <=> query_embedding) as similarity
  from public.team_members tm
  where tm.embedding is not null
  order by tm.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_team_members(vector, int) to authenticated;

commit;

-- ─── Verificatie (run handmatig na migratie) ───────────────────────────────
-- select column_name, data_type, udt_name
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'team_members' and column_name = 'embedding';
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public' and tablename = 'team_members' and indexname = 'team_members_embedding_idx';
