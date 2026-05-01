-- ════════════════════════════════════════════════════════════════════════════
-- Sales Navigator — Cleanup: legacy talking_points / follow_ups op cases-tabel
-- ════════════════════════════════════════════════════════════════════════════
-- Talking points en vervolgvragen horen conceptueel bij Onderwerpen (topics
-- in app_config), niet bij cases. CaseEditor heeft hiervoor ook geen invoer-
-- velden meer; CaseDetailModal en CaseCard renderen ze niet meer; store.js
-- leest/schrijft ze niet meer; ImportCase + parseTemplate genereren geen
-- defaults meer.
--
-- Deze migratie ruimt de legacy DB-kolommen op zodat het schema overeenstemt
-- met de feitelijke datamodel.
--
-- Idempotent: `if exists` zodat 't veilig herhaald kan draaien.

begin;

alter table public.cases drop column if exists talking_points;
alter table public.cases drop column if exists follow_ups;

commit;
