-- supabase/migrations/20260925091707_token_wallets_burro.sql
-- The burro column on the registry. Prepared 2026-09-25 by Volt. NOT APPLIED.
-- Tyler or Warbleur runs it through the dashboard SQL editor or the
-- connector, the ledger row at the bottom records the run either way.
--
-- WHY
-- The studio keeps its wallet map in a private csv with the columns
-- label,address,app,burro,note and the Registry page in Pulse now takes a
-- paste of those lines. The table, from the studio's
-- supabase/migrations/2026082605_token_wallets.sql, has every column but
-- burro. Until this lands the page folds the burro name into the note as
-- "burro name" so nothing pasted is lost. Once it lands the page sees the
-- key on the rows it reads and writes the column straight, no code change,
-- either order works. See src/pages/Registry/index.jsx.
--
-- WHAT IT DOES
-- One nullable free text column with an empty default, which burro holds
-- or answers for the wallet. Existing rows read as empty. The staff RLS
-- policies on the table already cover the new column, nothing about who
-- reads or writes changes. Idempotent, safe to run twice.
--
-- No oxford commas, no em dashes.

alter table public.token_wallets
  add column if not exists burro text not null default '';

comment on column public.token_wallets.burro is
  'Which burro holds or answers for the wallet, the same column the studio''s private wallet csv carries. Empty when nobody has said.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260925091707',
  'token_wallets_burro',
  array['see neonburro-pulse/supabase/migrations/20260925091707_token_wallets_burro.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'token_wallets_burro'
);
