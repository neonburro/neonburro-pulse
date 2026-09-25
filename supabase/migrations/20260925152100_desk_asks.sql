-- supabase/migrations/20260925152100_desk_asks.sql
-- Volt's desk, the two tables behind it. Prepared 2026-09-25 by Cypher from
-- Tyler's ask, whoever the AI is in Pulse sits in the bottom right corner
-- all the time, press it and it opens, the mic transcribes what I say, and
-- Volt drafts anything within Pulse and hands the rest to a person. NOT
-- APPLIED. Tyler or Warbleur runs it through the dashboard SQL editor or
-- the connector, the ledger row at the bottom records the run either way.
--
-- WHAT IT DOES
-- 1. desk_turns, the trail and the meter behind both doors of the desk.
--    One row per time the desk spends, written BEFORE the spend so a
--    refused turn still holds what was typed and who typed it, then filled
--    with what it cost. kind says which door.
--      hear   netlify/functions/transcribe.js, Deepgram nova-3, seconds
--             and cost_usd
--      turn   netlify/functions/volt-chat.js, Sonnet 5, the prompt, the
--             tokens, cost_usd and the tool the model called
--    The three ceilings in neonburro/docs/02-engineering/interaction-
--    ceilings.md are counted off these rows per kind, the session and the
--    day by user_id, the life by chat_id for turns and over every row for
--    hearings, refused rows skipped. The arithmetic is in each function's
--    header. Until this table exists both doors close on every call, which
--    is the honest state and the reason this file has to run before the
--    disc is worth pressing.
-- 2. desk_asks, the asks for a person. One row per time Volt's write_ask
--    tool runs, the ask in the operator's words, the page it concerned and
--    whether the mail to the studio inbox went. Today lists the last five
--    and a hand marks them done. transcript keeps its name from the first
--    design where every ask was a recording, the meaning is the same, what
--    was said. The columns that belonged to the recording, seconds,
--    cost_usd, refused and refusal, live on desk_turns now and are not
--    carried here as columns that would be null forever.
--
-- WHO WRITES
-- The functions write on the service role and bypass RLS. Staff read both
-- tables the way social_review_items does it. desk_asks takes a manager
-- update because the done button on Today writes status, done_by and
-- done_at from the browser, and an admin delete. desk_turns is read only
-- from the browser. Nobody anonymous.
--
-- No oxford commas, no em dashes.

-- ── the trail and the meter ─────────────────────────────────────────────────

create table if not exists public.desk_turns (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('hear', 'turn')),
  chat_id text,
  user_id uuid references auth.users (id) on delete set null,
  page text,
  prompt text,
  model text,
  seconds integer,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6),
  rounds integer not null default 0,
  request_id text,
  tool text,
  refused boolean,
  refusal text,
  created_at timestamptz not null default now()
);

comment on table public.desk_turns is
  'One row per spend on Volt''s desk, written before the spend. kind hear is a Deepgram transcription, kind turn is a Sonnet chat turn. The three interaction ceilings count these rows per kind, refused is null on a row that spent.';

comment on column public.desk_turns.refused is
  'True when a ceiling, the count or the vendor closed the door after the trail was written. Such a row spent nothing and the counts skip it. Null on a row that reached the vendor.';

comment on column public.desk_turns.cost_usd is
  'The live price at the call. Deepgram at $0.0043 a minute on the seconds it reported, Sonnet on the tokens it reported. The daily report is the exact number.';

create index if not exists desk_turns_kind_user_created_idx
  on public.desk_turns (kind, user_id, created_at desc)
  where refused is null;

create index if not exists desk_turns_kind_chat_idx
  on public.desk_turns (kind, chat_id)
  where refused is null;

create index if not exists desk_turns_kind_created_idx
  on public.desk_turns (kind, created_at desc)
  where refused is null;

alter table public.desk_turns enable row level security;

revoke all on table public.desk_turns from public, anon, authenticated;
grant select on table public.desk_turns to authenticated;

drop policy if exists desk_turns_staff_read on public.desk_turns;
create policy desk_turns_staff_read
  on public.desk_turns for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

-- ── the asks for a person ───────────────────────────────────────────────────

create table if not exists public.desk_asks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  chat_id text,
  page text,
  transcript text not null,
  status text not null default 'new'
    check (status in ('new', 'done')),
  mailed boolean,
  done_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.desk_asks is
  'One row per ask Volt wrote for a person through his write_ask tool. The ask in the operator''s words, the page it concerned, whether the studio inbox got the mail. Today lists the last five and a hand marks them done.';

comment on column public.desk_asks.transcript is
  'The ask in the operator''s words as Volt wrote it. The name is from the first design where every ask was a recording, the meaning is the same, what was said.';

create index if not exists desk_asks_created_idx
  on public.desk_asks (created_at desc);

create index if not exists desk_asks_status_idx
  on public.desk_asks (status, created_at desc);

alter table public.desk_asks enable row level security;

revoke all on table public.desk_asks from public, anon, authenticated;
grant select, insert, update, delete on table public.desk_asks to authenticated;

drop policy if exists desk_asks_staff_read on public.desk_asks;
create policy desk_asks_staff_read
  on public.desk_asks for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

drop policy if exists desk_asks_manager_insert on public.desk_asks;
create policy desk_asks_manager_insert
  on public.desk_asks for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

drop policy if exists desk_asks_manager_update on public.desk_asks;
create policy desk_asks_manager_update
  on public.desk_asks for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

drop policy if exists desk_asks_admin_delete on public.desk_asks;
create policy desk_asks_admin_delete
  on public.desk_asks for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260925152100',
  'desk_asks',
  array['see neonburro-pulse/supabase/migrations/20260925152100_desk_asks.sql'],
  'cypher@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'desk_asks'
);
