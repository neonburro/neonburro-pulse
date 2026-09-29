-- supabase/migrations/20260929170000_client_report_submittals.sql
-- The other half of the client report. Prepared 2026-09-29 by Aster from
-- Tyler's ask, "a copy of the exact report needs to be saved and then a copy
-- of the submittal, timestamped right when he approves it, so we can protect
-- ourselves if we are doing work". NOT APPLIED. Tyler or Warbleur runs it
-- through the connector or the dashboard SQL editor, the ledger row at the
-- bottom records the run either way.
--
-- 20260927150000_client_reports.sql IS ALSO STILL UNAPPLIED. Run that one
-- first. This migration alters the table that one creates and will fail on
-- its own.
--
-- WHY THIS EXISTS
--
-- The report we send is already kept. client_reports.html holds the exact
-- bytes that went out, and the comment on that column explains why it is
-- stored rather than regenerated, a template that changes next month would
-- quietly make the studio notification a lie.
--
-- What is not kept is what comes BACK. The report is interactive now. An
-- owner marks each recommendation approved, passed or worth talking about,
-- writes notes, picks what to spend next month and records a closing thought
-- out loud. All of that currently lives nowhere.
--
-- That is the gap worth closing, and not for tidiness. If the studio starts
-- work in October on the strength of what Matt ticked in September, the
-- record of what he ticked has to be the thing he actually saw, frozen, with
-- the time on it. An answers blob alone does not do that, because the report
-- it answered can change underneath it. So this keeps both, the answers and
-- the document as signed, in the same row.
--
-- WHAT IT DOES
--
-- 1. SEVEN COLUMNS ON public.client_reports, additive, all nullable.
--    NULL everywhere means not submitted, which is the honest empty and the
--    state every existing row is already in.
--      responses        jsonb, what they marked. One key per recommendation
--                       with its verdict and note, plus the amount chosen and
--                       the closing thought.
--      submitted_at     timestamptz, the authoritative moment. Written by the
--                       function from the server clock and NEVER from a value
--                       the page sends, because a timestamp we are relying on
--                       must not be settable by the person it binds.
--      submitted_by     text, the name or address that came back with it.
--      submitted_html   text, the document exactly as it was when they
--                       pressed submit, answers rendered in. This is the
--                       artefact, html is what we sent and this is what they
--                       agreed to. Keeping both is the whole point, a diff
--                       between them is a real question worth being able to ask.
--      slug             text, the short public half of the link, six or so
--                       characters so pulse.neonburro.com/r/K3M9QP fits in a
--                       text message without looking like a phishing attempt.
--                       Safe to preview, safe to forward, useless on its own.
--      access_code      text, six digits, the half that is NOT in the link.
--                       Texted beside it and typed or pasted on arrival.
--                       Stored readable on purpose, because Tyler has to be
--                       able to see it in Pulse to send it. That is a real
--                       tradeoff and it is the right one here, the pair gates
--                       one month of one client and the door rate limits, so
--                       a readable six digits buys a workflow that actually
--                       gets used and costs very little.
--      code_attempts    int, so a door can stop answering after too many.
--      submit_token     text, the long single use half, issued by the door
--                       after the code is accepted and held in the page's
--                       memory only. It never appears in a link or a text.
--      token_expires_at timestamptz, so a link in an old mailbox stops working.
--      notified_at      timestamptz, when hello@neonburro.com was told. NULL
--                       means the studio has not been told yet, which makes
--                       the unsent queue a query rather than a guess.
--      og_card_url      text, this report's own share card, absolute https.
--                       Read by netlify/edge-functions/report-og.js so a
--                       texted link previews as the client and not as the
--                       portal. NULL falls back to the house card.
--
-- 2. TWO INDEXES. One on submit_token for the public lookup, one on
--    submitted_at for the studio's list of what has come back.
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
-- No client portal read policy. The 27th migration says a client does not
-- read this table from the portal yet and calls that deliberate. Tyler wants
-- the portal view, and it is the right next step, but it is a separate change
-- that needs its own thinking about which rows an owner may see and what
-- happens when one company has two owners. Shipping a read policy inside a
-- migration about submittals is how a client ends up seeing another client's
-- revenue. It gets its own migration, reviewed on its own.
--
-- No PDF column. The frozen copy here is html, which is what the browser
-- actually rendered and what a PDF would be generated FROM. Rendering the pdf
-- is a function's job, not a column, and storing both invites them to drift.
-- When the portal lands, it renders the pdf from submitted_html on demand.
--
-- WHO WRITES
-- The netlify functions on the service role, as with the rest of this table.
-- Staff read through the policy the 27th migration already created. Nobody
-- anonymous reads this table directly, the public submit path goes through a
-- function that looks up by submit_token and returns only that one row.
--
-- No oxford commas, no em dashes.

alter table public.client_reports add column if not exists responses jsonb;
alter table public.client_reports add column if not exists submitted_at timestamptz;
alter table public.client_reports add column if not exists submitted_by text;
alter table public.client_reports add column if not exists submitted_html text;
alter table public.client_reports add column if not exists slug text;
alter table public.client_reports add column if not exists access_code text;
alter table public.client_reports add column if not exists code_attempts int not null default 0;
alter table public.client_reports add column if not exists submit_token text;
alter table public.client_reports add column if not exists token_expires_at timestamptz;
alter table public.client_reports add column if not exists notified_at timestamptz;
alter table public.client_reports add column if not exists og_card_url text;

comment on column public.client_reports.responses is
  'What the owner marked. Verdict and note per recommendation, the amount chosen, the closing thought.';
comment on column public.client_reports.submitted_at is
  'Server clock at submit. Never read from the request body, this is the timestamp the studio relies on.';
comment on column public.client_reports.submitted_html is
  'The document as signed, answers rendered in. html is what we sent, this is what they agreed to.';
comment on column public.client_reports.slug is
  'Short public half of the link, safe to preview and forward. Useless without the code.';
comment on column public.client_reports.access_code is
  'Six digits, texted beside the link. Readable on purpose so Pulse can show Tyler what to send.';
comment on column public.client_reports.og_card_url is
  'Absolute https url of this report share card, read by the report-og edge function. NULL falls back to the house card.';
comment on column public.client_reports.submit_token is
  'Long single use half, issued by the door after the code is accepted. Never in a link or a text.';

-- One slug names one report, and one token names one report.
create unique index if not exists client_reports_slug_idx
  on public.client_reports (slug)
  where slug is not null;

create unique index if not exists client_reports_submit_token_idx
  on public.client_reports (submit_token)
  where submit_token is not null;

-- What has come back, newest first.
create index if not exists client_reports_submitted_idx
  on public.client_reports (submitted_at desc)
  where submitted_at is not null;

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260929170000',
  'client_report_submittals',
  array['see neonburro-pulse/supabase/migrations/20260929170000_client_report_submittals.sql'],
  'aster@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'client_report_submittals'
);
