-- supabase/migrations/20261005130000_mail_updates_and_open_items.sql
-- System updates, the approval lifecycle, the report cadence and open items.
-- Written 2026-10-05 by Cypher. NOT APPLIED. The Supabase connector in the
-- session that wrote it stopped answering right after
-- 20261005113806_mail_composer.sql went in, every call refused with "You do
-- not have permission", select 1 included, so this waits for a hand. Run it
-- through the connector or the dashboard SQL editor. The ledger row at the
-- bottom records a hand run and is skipped when the connector records its
-- own. 20261005113806_mail_composer.sql must be applied first, it is.
--
-- WHY THIS EXISTS
-- Tyler, 2026-10-05, the same afternoon the Mail room was built. Branded
-- system updates to clients, drafted inside Pulse and approved by him before
-- they go, appearing on the client they belong to. And open items, the
-- things waiting on a client, each a small check the client can approve or
-- deny, which stay open and carry into every later report with their age so
-- an unanswered list visibly stacks up. The studio stops doing work nobody
-- asked for and the record keeps going.
--
-- WHAT IT DOES
--   1. mail_documents gets kind, origin, source_ref and who approved or
--      dismissed it and when. kind and origin are what the queue reads.
--      source_ref with a unique index is how a future generator proposes the
--      same deploy digest twice and gets one row.
--   2. mail_documents.status widens from draft and sent to the lifecycle,
--      draft, proposed, approved, sent and dismissed. THIS IS THE ONE LINE
--      THAT IS NOT ADDITIVE. A check constraint cannot be widened in place,
--      so it is dropped by name and added again wider. Nothing can be lost
--      by it, it only allows more, and the table it sits on was created the
--      same day and held no rows when this was written. If you are running
--      this later, check that the old constraint is the narrow one first,
--      select pg_get_constraintdef(oid) from pg_constraint where conname =
--      'mail_documents_status_check'.
--   3. clients.report_cadence, off, weekly, biweekly or monthly, default off.
--      A constant default is a metadata change in Postgres 11 and later, no
--      rewrite of the clients table.
--   4. public.client_items, the open items. One row per thing waiting on a
--      client. token is the unguessable half of the answer link, made by the
--      database so no insert can forget it. Two uuids of randomness, 244
--      bits, hex, no pgcrypto needed.
--   5. public.door_hits, the rate limit for the public answer door. A row
--      per request with a hashed address, never the address itself.
--
-- WHO READS AND WHO WRITES
--   client_items  staff read and write through public.is_staff(), the same
--                 one policy shape invoices and mail_documents carry. The
--                 public never reads it. netlify/functions/item-answer.js
--                 answers a person holding a token on the service role and
--                 never takes an id from them.
--   door_hits     row level security on and no policy at all. Only the
--                 service role touches it.
--
-- THE VOCABULARIES ARE MIRRORED
-- KINDS, STATUSES, CADENCES and ITEM_KINDS in src/lib/mailDocument.js hold
-- the same lists as the check constraints here. Change one and change the
-- other in the same commit.
--
-- No oxford commas, no em dashes.

-- ── 1. kind, origin and the approval record ─────────────────────────────────

alter table public.mail_documents add column if not exists kind         text not null default 'letter';
alter table public.mail_documents add column if not exists origin       text not null default 'hand';
alter table public.mail_documents add column if not exists source_ref   text;
alter table public.mail_documents add column if not exists approved_by  uuid references auth.users (id) on delete set null;
alter table public.mail_documents add column if not exists approved_at  timestamptz;
alter table public.mail_documents add column if not exists dismissed_by uuid references auth.users (id) on delete set null;
alter table public.mail_documents add column if not exists dismissed_at timestamptz;

comment on column public.mail_documents.kind is
  'letter, system_update, security_check, progress, deploy_digest or periodic_report. KINDS in src/lib/mailDocument.js mirrors this list.';
comment on column public.mail_documents.origin is
  'hand when a person wrote it in Pulse, otherwise what drafted it, system:deploy_digest and the like. Anything not hand is refused by mail-send.js until status is approved.';
comment on column public.mail_documents.source_ref is
  'What a generator drafted this from, deploys:2026-10-01:2026-10-07 for example. Unique per client and kind, so proposing the same thing twice writes one row.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mail_documents_kind_check' and conrelid = 'public.mail_documents'::regclass
  ) then
    alter table public.mail_documents add constraint mail_documents_kind_check
      check (kind in ('letter', 'system_update', 'security_check', 'progress', 'deploy_digest', 'periodic_report'));
  end if;
end $$;

create unique index if not exists mail_documents_source_ref_uidx
  on public.mail_documents (client_id, kind, source_ref)
  where source_ref is not null;

create index if not exists mail_documents_status_idx on public.mail_documents (status, updated_at desc);

-- ── 2. the lifecycle, the one non additive statement, see the header ────────

alter table public.mail_documents drop constraint if exists mail_documents_status_check;
alter table public.mail_documents add constraint mail_documents_status_check
  check (status in ('draft', 'proposed', 'approved', 'sent', 'dismissed'));

-- ── 3. the cadence the client picked for the system report ──────────────────

alter table public.clients add column if not exists report_cadence text not null default 'off';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_report_cadence_check' and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients add constraint clients_report_cadence_check
      check (report_cadence in ('off', 'weekly', 'biweekly', 'monthly'));
  end if;
end $$;

comment on column public.clients.report_cadence is
  'How often this client gets the system report, off, weekly, biweekly or monthly. CADENCES in src/lib/mailDocument.js mirrors the list. Nothing reads it on a schedule yet, the generator is not built.';

-- ── 4. open items ───────────────────────────────────────────────────────────

create table if not exists public.client_items (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 300),
  detail             text,
  kind               text not null default 'decision'
                     check (kind in ('decision', 'access', 'payment', 'security', 'other')),
  choices            text[],
  status             text not null default 'open'
                     check (status in ('open', 'approved', 'denied', 'withdrawn')),
  opened_at          timestamptz not null default now(),
  answered_at        timestamptz,
  answered_by        text,
  answered_via       text check (answered_via in ('link', 'pulse')),
  answer_choice      text,
  answer_note        text,
  answer_device      text,
  seen_at            timestamptz,
  token              text not null unique
                     default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  first_document_id  uuid references public.mail_documents (id) on delete set null,
  first_send_id      uuid references public.mail_sends (id) on delete set null,
  source_note        text,
  source_url         text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.client_items is
  'Things waiting on a client. Each stays open until answered and carries into every report with its age. Answered from the public page through netlify/functions/item-answer.js by token, or by a person in Pulse. Answering never mails the client.';
comment on column public.client_items.token is
  'The unguessable half of the answer link, pulse.neonburro.com/answer/<token>/. Staff can read it to build the link, the public never reads this table.';
comment on column public.client_items.choices is
  'When set the item is answered by picking one of these rather than approve or deny, how often to receive the report for example. answer_choice holds the pick and status becomes approved.';
comment on column public.client_items.seen_at is
  'When somebody in Pulse saw the answer. An answered item with no seen_at is in the admin queue and in the next daily digest.';

create index if not exists client_items_client_idx on public.client_items (client_id, status, opened_at);
create index if not exists client_items_unseen_idx on public.client_items (answered_at) where answered_at is not null and seen_at is null;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'client_items_touch' and tgrelid = 'public.client_items'::regclass
  ) then
    create trigger client_items_touch
      before update on public.client_items
      for each row execute function public.update_updated_at();
  end if;
end $$;

alter table public.client_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_items' and policyname = 'client_items_staff_manage'
  ) then
    create policy client_items_staff_manage
      on public.client_items for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end $$;

-- ── 5. the rate limit for the public door ───────────────────────────────────

create table if not exists public.door_hits (
  id        bigint generated always as identity primary key,
  door      text not null,
  who_hash  text not null,
  at        timestamptz not null default now()
);

comment on table public.door_hits is
  'One row per request to a public door, item-answer for now. who_hash is a sha256 of the caller address and the day, never the address. RLS on with no policy, service role only.';

create index if not exists door_hits_lookup_idx on public.door_hits (door, who_hash, at desc);

alter table public.door_hits enable row level security;

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20261005130000',
  'mail_updates_and_open_items',
  array['see neonburro-pulse/supabase/migrations/20261005130000_mail_updates_and_open_items.sql'],
  'cypher@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'mail_updates_and_open_items'
);
