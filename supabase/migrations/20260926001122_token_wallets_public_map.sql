-- supabase/migrations/20260926001122_token_wallets_public_map.sql
-- The public map columns on the registry. Prepared 2026-09-26 by Volt.
-- NOT APPLIED. Tyler or Warbleur runs it through the dashboard SQL editor
-- or the connector, the ledger row at the bottom records the run either way.
--
-- WHY
-- Tyler asked for a room in Pulse where he can paste the live wallets onto
-- each character, the nine council plus Tender, Epoch, Kolache and Chime,
-- and have the room produce the published map instead of anybody hand
-- editing an array. The published record does not move. It stays the
-- committed file neonburro/src/data/wallets.js, because that file's own
-- header says an address not on the page is not ours, and a page that reads
-- its completeness promise out of a database at render can blank the promise
-- the first time a node refuses. So Pulse is where a person types and Pulse
-- produces the file. Pulse is not the live source for the public page.
--
-- public.token_wallets already carries id, label, address, app, note, sort,
-- created_at and burro. It was built for the operational book at /registry/,
-- which is complete and private. The public map needs six more facts about a
-- row and nothing else, and every one of them is nullable or defaulted so
-- every existing row keeps working untouched.
--
-- WHAT IT ADDS
--   purpose      one honest sentence about what the wallet is for. Empty
--                until somebody writes it. A published row with an empty
--                purpose is named as incomplete in the room, because that
--                sentence becomes public copy.
--   since        the day it started being used. Null is allowed and means
--                nobody wrote it down, which is the truth and reads better
--                than a guessed date.
--   burn         true on exactly one wallet, thefurnace. The partial unique
--                index below allows one true row and any number of false
--                ones, so a second furnace has to retire the first.
--   retired      the day a wallet stopped being used. A retired wallet is
--                never deleted, the row stays and the date says what
--                happened. The first furnace is the reason this column
--                exists, see the thefurnace note in wallets.js.
--   published    whether this row belongs on the public page. Default false,
--                so nothing lands on the map by existing. The room's export
--                never emits a row with published false.
--   holder_kind  burro, agent or treasury. Chime is a voice agent and not a
--                burro, and the Reserve, the Open Hand, the LP and thefurnace
--                are not fronted by anybody, so all three sit in one table
--                without pretending to be the same thing.
--
-- THE BURRO COLUMN HOLDS THE HOLDER KEY, INCLUDING FOR A TREASURY ROW
-- burro carries the grouping key the wallets room reads, so a treasury row
-- carries reserve, openhand, lp or thefurnace there rather than a burro slug.
-- Four treasury wallets are four separate holders and folding them into one
-- empty bucket would lose that. The export reads holder_kind and writes
-- burro null into wallets.js for anything that is not a burro or an agent, so
-- the public file never sees these keys. See src/data/walletHolders.js.
--
-- NEVER IN THIS TABLE
-- Public addresses only. A private key, a seed phrase or a keypair must never
-- reach this table, the room, a log or a commit. There is no column for one
-- and there will not be.
--
-- WRITTEN ADDITIVE ON PURPOSE
-- No drop, no revoke, no alter of an existing column. The dashboard SQL
-- editor flags destructive statements and the session running this is a hand
-- in a browser, so every statement here either creates something absent or
-- does nothing. The staff RLS policies from 2026082605_token_wallets.sql
-- already govern these columns, nothing about who reads or writes changes.
-- Idempotent, safe to run twice.
--
-- No oxford commas, no em dashes.

-- ── the six columns ─────────────────────────────────────────────────────────

alter table public.token_wallets
  add column if not exists purpose text not null default '';

alter table public.token_wallets
  add column if not exists since date;

alter table public.token_wallets
  add column if not exists burn boolean not null default false;

alter table public.token_wallets
  add column if not exists retired date;

alter table public.token_wallets
  add column if not exists published boolean not null default false;

alter table public.token_wallets
  add column if not exists holder_kind text not null default 'burro';

comment on column public.token_wallets.purpose is
  'One honest sentence about what the wallet is for. This becomes public copy on the token page when the row is published, so the room names a published row with an empty purpose as incomplete.';

comment on column public.token_wallets.since is
  'The day the wallet started being used. Null means nobody wrote it down, which is allowed and is better than a guess.';

comment on column public.token_wallets.burn is
  'True on exactly one wallet, thefurnace, enforced by token_wallets_one_burn_idx. A planned share is not a burn until the Burn instruction verifies on chain, see NeonburroBurn.jsx and burns.js in the studio repo.';

comment on column public.token_wallets.retired is
  'The day the wallet stopped being used. A retired wallet is never deleted, the row stays and this date says what happened.';

comment on column public.token_wallets.published is
  'Whether this row belongs on the public token page. The wallets room export never emits a row with this false. The published record is still the committed file neonburro/src/data/wallets.js, this flag only says which rows the export writes.';

comment on column public.token_wallets.holder_kind is
  'burro, agent or treasury. Chime is a voice agent, the Reserve and the Open Hand and the LP and thefurnace are treasury and are fronted by nobody. The export writes burro null into wallets.js for a treasury row.';

-- ── one burn wallet, and only one ───────────────────────────────────────────
-- A partial unique index on a single true value. Postgres treats every false
-- row as outside the index, so any number of wallets may be false and exactly
-- one may be true. A second furnace has to set the first one false, which is
-- the conversation we want somebody to have.

create unique index if not exists token_wallets_one_burn_idx
  on public.token_wallets (burn)
  where burn;

-- The room reads the published set often enough to earn its own index.

create index if not exists token_wallets_published_idx
  on public.token_wallets (published, sort);

-- ── holder_kind stays one of three ──────────────────────────────────────────
-- A do block rather than a bare add constraint, because add constraint has no
-- if not exists and a second run would error out in front of whoever is
-- pasting this. Existing rows default to burro so the check validates clean.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.token_wallets'::regclass
      and conname = 'token_wallets_holder_kind_check'
  ) then
    alter table public.token_wallets
      add constraint token_wallets_holder_kind_check
      check (holder_kind in ('burro', 'agent', 'treasury'));
  end if;
end
$$;

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260926001122',
  'token_wallets_public_map',
  array['see neonburro-pulse/supabase/migrations/20260926001122_token_wallets_public_map.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'token_wallets_public_map'
);
