-- supabase/migrations/20261005113806_mail_composer.sql
-- The Mail room. Written and APPLIED 2026-10-05 by Cypher through the
-- Supabase connector, which wrote ledger row 20261005113806 mail_composer
-- itself, so this file is named by that version and carries no ledger
-- insert of its own. The body below is byte for byte what ran.
--
-- WHY THIS EXISTS
-- Tyler, 2026-10-05, after the Greenville September letter went out of a
-- Gmail draft. "I wonder if we could send this from Pulse and really style
-- it nicely ... If we want to edit the text in it, we can. It's like a
-- proposal or invoice, but it's more for these reports and emails." Two
-- tables, the letters and the record of every send.
--
-- NAMED MAIL AND NOT LETTERS
-- letter_opens and letter_answers already exist on this project and belong
-- to the studio's client letter pages, the /n/ links with a code. A table
-- called letters beside them would read as the same system and it is not.
--
-- PURELY ADDITIVE
-- Two new tables, their indexes, one trigger on the new table and two
-- policies. Nothing existing is altered, dropped or revoked. The trigger and
-- the policies are created inside do blocks that check first, so a second
-- run is a no op rather than an error, the additive form the house uses
-- when a file may be run by hand in the dashboard as well.
--
-- WHO READS AND WHO WRITES
--   mail_documents  staff read and write, public.is_staff(), one policy for
--                   all commands, the same shape invoices carries since
--                   20260927144150. The editor saves drafts on the signed
--                   in session.
--   mail_sends      staff read only. There is no insert, update or delete
--                   policy on purpose. netlify/functions/mail-send.js
--                   writes it on the service role, which bypasses RLS, so
--                   the record of what went and to whom cannot be written
--                   or edited from a browser.
-- anon reaches neither. Grants are left as the project default, the policy
-- only approach 20260927144150 chose, and with no anon policy RLS denies it.
--
-- PROVED AFTER IT RAN, NOT ASSUMED
-- In one rolled back transaction on 2026-10-05, with a probe row inserted
-- first. anon read 0 rows and its insert was refused 42501. A signed in
-- session with a uid that is not staff, which is what the public send a
-- burro page mints, read 0 rows of either table. Tyler's own uid read the
-- probe row. The same staff session was refused 42501 writing mail_sends.
-- Both tables were empty again after the rollback.
--
-- THE DOC COLUMN IS REPLACED WHOLE
-- The editor writes the whole normalized document on every save, never a
-- patch. See the header of src/lib/mailDocument.js for why that is said out
-- loud.
--
-- No oxford commas, no em dashes.

-- ── the letters ─────────────────────────────────────────────────────────────

create table if not exists public.mail_documents (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients (id) on delete set null,
  status      text not null default 'draft' check (status in ('draft', 'sent')),
  doc         jsonb not null default '{}'::jsonb check (jsonb_typeof(doc) = 'object'),
  created_by  uuid references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  sent_at     timestamptz
);

comment on table public.mail_documents is
  'Letters composed in the Pulse Mail room. doc holds the whole structured document, the shape is src/lib/mailDocument.js in neonburro-pulse and the html is always drawn from it by src/lib/mailRender.js. The editor writes the whole doc on every save, replacing on purpose.';
comment on column public.mail_documents.doc is
  'The whole letter, to, cc, subject, preheader, opening, hero, cards, signature and theme. Replaced whole on save, never patched.';
comment on column public.mail_documents.status is
  'draft until netlify/functions/mail-send.js sends it for real, then sent. A test never changes it.';

create index if not exists mail_documents_updated_idx on public.mail_documents (updated_at desc);
create index if not exists mail_documents_client_idx on public.mail_documents (client_id) where client_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'mail_documents_touch' and tgrelid = 'public.mail_documents'::regclass
  ) then
    create trigger mail_documents_touch
      before update on public.mail_documents
      for each row execute function public.update_updated_at();
  end if;
end $$;

alter table public.mail_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_documents' and policyname = 'mail_documents_staff_manage'
  ) then
    create policy mail_documents_staff_manage
      on public.mail_documents for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end $$;

-- ── the record of every send ────────────────────────────────────────────────

create table if not exists public.mail_sends (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid references public.mail_documents (id) on delete set null,
  kind           text not null check (kind in ('test', 'send')),
  status         text not null check (status in ('sent', 'failed')),
  sent_by        uuid references auth.users (id) on delete set null,
  sent_by_email  text,
  from_address   text not null,
  to_emails      text[] not null,
  cc_emails      text[] not null default '{}',
  subject        text not null,
  html           text,
  text_body      text,
  content_hash   text not null,
  resend_id      text,
  error          text,
  doc            jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.mail_sends is
  'One row per attempt from the Pulse Mail room, test or send, sent or failed. Written only by netlify/functions/mail-send.js on the service role. html is the exact bytes that went. content_hash is the sha256 of subject and html, and a real send is refused unless the latest sent test of the same document carries the same hash.';

create index if not exists mail_sends_document_idx on public.mail_sends (document_id, created_at desc);

alter table public.mail_sends enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_sends' and policyname = 'mail_sends_staff_read'
  ) then
    create policy mail_sends_staff_read
      on public.mail_sends for select
      to authenticated
      using (public.is_staff());
  end if;
end $$;
