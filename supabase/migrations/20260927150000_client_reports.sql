-- supabase/migrations/20260927150000_client_reports.sql
-- The client report. Prepared 2026-09-27 by Volt from Tyler's ask, "all we
-- have to do is approve it once and then it's automated, neonburro gets an
-- admin notification for anything going out, and we need a preview of what
-- their report looks like for every client". NOT APPLIED. Tyler or Warbleur
-- runs it through the connector or the dashboard SQL editor, the ledger row
-- at the bottom records the run either way.
--
-- WHY THIS EXISTS
-- Seven invoices paid all time and eleven clients on the books, three of
-- whom have never been invoiced once. A report that arrives every month
-- whether or not anybody remembered to ask is the reason a client keeps
-- paying. This migration is the table it lands in and the two things that
-- gate it, a brand palette and an approval.
--
-- WHAT IT DOES
--
-- 1. SIX BRAND COLUMNS ON public.clients, additive, all nullable.
--    The shape is the one the house already uses, CLIENT_WORK in
--    neonburro/src/pages/Services/Signatures.jsx, which stores ink, soft,
--    accent and edge per business and is what a finished signature kit
--    produces. Two are added here, paper because an email needs a ground
--    and a signature block does not, and mark_url because a report that
--    carries the client's logo is the whole point of branding it.
--    A finished brand kit already produces every one of these values, so a
--    client whose kit is done can be filled in by hand today.
--      brand_ink       primary text, their darkest
--      brand_soft      supporting text, their mid tone
--      brand_accent    the one accent, the rule and the button
--      brand_edge      hairlines and borders
--      brand_paper     the sheet the report is printed on, never pure white
--      brand_mark_url  their logo, absolute https, rendered at 140px wide
--    NULL is the honest empty. A client with no palette gets the house
--    letterhead and the preview says so in words. There is no default
--    colour written here, because a wrong colour that looks deliberate is
--    worse than no colour at all.
--
-- 2. FIVE GATE COLUMNS ON public.clients.
--    report_approved is false by default and the schedule reads only rows
--    where it is true. That is the fail closed rule, Tyler approves a
--    client once and the schedule picks them up the following month, and
--    nothing reaches anybody because a default was permissive. The Reports
--    page lists every unapproved client as waiting.
--      report_approved     the gate, false until a hand flips it
--      report_approved_at  when, and
--      report_approved_by  who, so the record says whose approval it was
--      report_to           recipient override, text[]. NULL means the
--                          derived list, clients.email plus every primary
--                          client_contacts row, deduped.
--      report_sender       the burro who signs it, slug. NULL means the
--                          rule in netlify/functions/_client-report.js
--                          derives it from what the report carries.
--
-- 3. public.client_reports, one row per client per period.
--    data holds every derived figure, narrative is the prose written from
--    those figures by rule and never by a model, and html holds the exact
--    bytes that were sent. html is here and not regenerated on demand
--    because the studio notification promises a link to exactly what the
--    client got, and a template that changes next month would quietly make
--    that a lie. Twelve rows a year per client, the storage is nothing and
--    the honesty is the point.
--    A preview writes NO row. Nothing is saved until something is sent.
--
-- WHO WRITES
-- The netlify functions write on the service role and bypass RLS. Staff
-- read, the same roles _social.js gates on. Nobody anonymous, and a client
-- does not read this table from the portal yet, which is deliberate, the
-- report is a mail today and a portal page is a later ask.
--
-- No oxford commas, no em dashes.

-- ── the brand palette, per client ───────────────────────────────────────────

alter table public.clients add column if not exists brand_ink      text;
alter table public.clients add column if not exists brand_soft     text;
alter table public.clients add column if not exists brand_accent   text;
alter table public.clients add column if not exists brand_edge     text;
alter table public.clients add column if not exists brand_paper    text;
alter table public.clients add column if not exists brand_mark_url text;

comment on column public.clients.brand_ink is
  'Primary text colour, hex with the hash. The ink key in CLIENT_WORK, neonburro/src/pages/Services/Signatures.jsx. Null means this client has no brand kit yet and the report falls back to the house letterhead.';
comment on column public.clients.brand_soft is
  'Supporting text colour, hex. The soft key in CLIENT_WORK.';
comment on column public.clients.brand_accent is
  'The one accent, hex. The rule at the top of the report and the button. The accent key in CLIENT_WORK. The text that sits on an accent fill is not stored, it is derived from the accent''s luminance so a pale brand never ships white on white.';
comment on column public.clients.brand_edge is
  'Hairlines and borders, hex. The edge key in CLIENT_WORK.';
comment on column public.clients.brand_paper is
  'The ground the report prints on, hex. Never pure white, the same rule the house paper follows. Not in CLIENT_WORK because a signature sits on whatever the mail client paints and a report carries its own sheet.';
comment on column public.clients.brand_mark_url is
  'Absolute https url to the client''s logo, rendered at 140px wide in the report header. Null renders the neonburro wordmark instead.';

-- A colour column holds a six digit hex with the hash, or nothing. This is
-- here because a pasted value with a stray space or a trailing semicolon
-- lands in an email as a broken style attribute and renders as a default
-- nobody chose. Fail at the write, not in somebody's inbox.
alter table public.clients drop constraint if exists clients_brand_hex_ck;
alter table public.clients add constraint clients_brand_hex_ck check (
      (brand_ink    is null or brand_ink    ~ '^#[0-9A-Fa-f]{6}$')
  and (brand_soft   is null or brand_soft   ~ '^#[0-9A-Fa-f]{6}$')
  and (brand_accent is null or brand_accent ~ '^#[0-9A-Fa-f]{6}$')
  and (brand_edge   is null or brand_edge   ~ '^#[0-9A-Fa-f]{6}$')
  and (brand_paper  is null or brand_paper  ~ '^#[0-9A-Fa-f]{6}$')
);

alter table public.clients drop constraint if exists clients_brand_mark_https_ck;
alter table public.clients add constraint clients_brand_mark_https_ck check (
  brand_mark_url is null or brand_mark_url ~ '^https://'
);

-- ── the gate ────────────────────────────────────────────────────────────────

alter table public.clients add column if not exists report_approved    boolean not null default false;
alter table public.clients add column if not exists report_approved_at timestamptz;
alter table public.clients add column if not exists report_approved_by uuid references auth.users (id) on delete set null;
alter table public.clients add column if not exists report_to          text[];
alter table public.clients add column if not exists report_sender      text;

comment on column public.clients.report_approved is
  'False until a hand approves this client for the monthly report. The schedule in netlify/functions/client-report-monthly.js reads only true. Approve once and it is automatic from the next month. This default is the fail closed rule and must never be changed to true.';
comment on column public.clients.report_to is
  'Recipient override. Null means the derived list, clients.email plus every client_contacts row with is_primary, deduped and lowercased. A report goes to that client only, never to a list.';
comment on column public.clients.report_sender is
  'The burro who signs the report, slug, one of the nine in src/lib/personas.js. Null means the rule in netlify/functions/_client-report.js derives it, Tyler when the report carries a decision, Aster when it carries shipped work, Volt otherwise.';

create index if not exists clients_report_approved_idx
  on public.clients (report_approved)
  where report_approved;

-- ── the reports ─────────────────────────────────────────────────────────────

create table if not exists public.client_reports (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  kind         text not null default 'monthly'
    check (kind in ('monthly')),
  period_start date not null,
  period_end   date not null,
  data         jsonb not null,
  narrative    text,
  sender       text,
  brand_house  boolean not null default false,
  html         text,
  emailed_to   text[],
  emailed_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (client_id, kind, period_start)
);

comment on table public.client_reports is
  'One row per client per period. Written only when something is sent, a preview saves nothing. Every figure in data came from a query, never from a typed value, and the template leaves a figure out rather than guessing it.';
comment on column public.client_reports.html is
  'The exact bytes the client received. Kept rather than re-rendered because the studio notification links to what they got and a changed template would make that a lie.';
comment on column public.client_reports.brand_house is
  'True when this client had no palette and the report went out on the house letterhead. So the record says which reports were branded and which were not.';
comment on column public.client_reports.sender is
  'The burro slug who signed it. A burro is never named without a face, so the report carries the avatar beside the name.';

create index if not exists client_reports_client_period_idx
  on public.client_reports (client_id, period_start desc);

create index if not exists client_reports_emailed_idx
  on public.client_reports (emailed_at desc)
  where emailed_at is not null;

alter table public.client_reports enable row level security;

revoke all on table public.client_reports from public, anon, authenticated;
grant select on table public.client_reports to authenticated;

drop policy if exists client_reports_staff_read on public.client_reports;
create policy client_reports_staff_read
  on public.client_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260927150000',
  'client_reports',
  array['see neonburro-pulse/supabase/migrations/20260927150000_client_reports.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'client_reports'
);
