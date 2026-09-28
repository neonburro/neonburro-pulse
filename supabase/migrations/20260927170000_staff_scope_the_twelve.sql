-- supabase/migrations/20260927170000_staff_scope_the_twelve.sql
-- The twelve tables still answering to anybody holding a token. Prepared
-- 2026-09-27 by Volt. NOT APPLIED. Tyler or Warbleur runs it through the
-- dashboard SQL editor or the connector, the ledger row at the bottom records
-- the run either way.
--
-- WHY THIS EXISTS
-- Fourteen tables in public carried a policy with cmd ALL and a qual of only
-- (auth.uid() IS NOT NULL). That is not a role gate. It asks whether a token
-- exists, and every token passes it. clients and invoices were closed earlier
-- today by ledger row 20260927144150, found from the client report side. These
-- are the other twelve, same shape, same reach, still open.
--
-- WHAT MAKES IT REACHABLE, AND IT IS NOT THE PORTAL
-- neonburro.com route /send-a-burro/ calls signInWalkUp in
-- neonburro/src/lib/sendABurro.js, which calls supabase auth signInAnonymously
-- against this same project. An anonymous session carries a real auth.uid()
-- and the authenticated role in its jwt, so it satisfies that qual exactly the
-- way a staff session does. Eight anonymous users exist, first 2026-08-27 and
-- last 2026-08-28, the week that page went up. So the door is the open
-- internet and not a signed in client, and behind it today sit 29 invoice
-- items, 22 invoice history rows, 9 form submissions with names and messages,
-- 9 projects, 6 payments and 1 invoice attachment.
--
-- THE SHAPE OF THE FIX
-- One policy per table, for all to authenticated, using and with check both on
-- public.is_staff(). That helper already exists, it is STABLE SECURITY DEFINER
-- with search_path pinned, it reads role in ('super_admin', 'admin',
-- 'manager', 'team'), and 20260927144150 used it for clients and invoices.
-- Using it here rather than repeating a role list is the whole point, a list
-- copied thirteen times is a list that drifts.
--
-- Grants are deliberately not touched. anon holds table grants on most of
-- these, but with no policy left for anon, row level security denies it, and
-- 20260927144150 chose the same policy only approach. Pulling the grants as
-- well is defence in depth and it is worth a separate sitting, not a silent
-- rider on this one.
--
-- WHAT KEEPS WORKING, CHECKED POLICY BY POLICY
-- Every client facing and public read path below is left in place untouched.
--   invoice_items   "Clients read own invoice items", and "Anon read invoice
--                   items via invoice pay_token" for the public pay page
--   payments        "Clients read own payments", read by the studio site at
--                   neonburro/src/pages/Account/AccountPayments.jsx
--   projects        "Clients read own projects", read by AccountProjects.jsx
--                   and AccountOverview.jsx on the studio site
--   form_submissions  "Anyone can submit forms" and "Anon can insert form
--                   submissions", the public marketing forms. Both are insert
--                   only and both stay, so a contact form keeps posting.
--   sprints_catalog "Anon can read active sprints catalog"
-- Every netlify function runs on the service role and bypasses rls entirely,
-- so send-invoice, resend-invoice, the report functions and volt-chat are not
-- affected by anything in this file.
--
-- TWO POLICIES DROPPED BEYOND THE TWELVE, BOTH DEAD OR REDUNDANT
-- 1. form_submissions "Admins can do everything on form_submissions", cmd ALL,
--    checks role in ('owner', 'admin', 'team'). 'owner' has never been written
--    by any migration in this folder and no profiles row holds it, and the
--    branch misses super_admin and manager entirely. is_staff() covers all
--    four house roles, so this one is superseded rather than narrowed.
-- 2. sprint_counter "Authenticated users can read sprint counter", cmd SELECT,
--    qual (auth.uid() IS NOT NULL). Same hole in read form. The staff policy
--    replaces it.
--
-- FOUR OF THE TWELVE ARE ORPHANS
-- account_transactions, runway_characters, sprint_counter and sprints_catalog
-- are referenced by no file in any of the six properties, checked across src,
-- netlify/functions and scripts on 2026-09-27. Three hold no rows at all,
-- sprint_counter holds 1 and sprints_catalog holds 5. Locking them to staff
-- cannot break a page because no page reads them. They are candidates for
-- dropping and that is Tyler's call, not this file's.
--
-- WHAT THIS FILE DOES NOT FIX, AND SOMEBODY SHOULD
-- invoices still carries "Anon can read invoices by pay_token" and "Anon read
-- invoices via pay_token", two duplicates of one policy, both qualified only
-- on pay_token is not null. The policy never compares the token to anything
-- and rls cannot see a request filter, so any anonymous caller can read EVERY
-- invoice holding a token, not just the one they were sent. 20260927144150
-- found this, left it in place so nobody's payment broke that night, and wrote
-- it up for Warbleur. The fix is a code change, serve the pay page from a
-- function on the service role keyed by the token, then take anon off the
-- table. It is still open as of this file and it is the last money hole.
--
-- ON THE TIGHTER SPLIT THAT IS NOT HERE
-- A per command split is available, team reading but not writing and delete
-- reserved to admin. This file does not do it, because clients and invoices
-- were closed hours ago with a single is_staff() policy and a matching shape
-- across all fourteen is worth more than a tighter gate on twelve of them.
-- If Tyler wants the split it should land on all fourteen at once.
--
-- No oxford commas, no em dashes.

-- ── the money tables ────────────────────────────────────────────────────────

drop policy if exists "Authenticated users can manage payments" on public.payments;
drop policy if exists payments_staff_manage on public.payments;
create policy payments_staff_manage
  on public.payments for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can manage invoice items" on public.invoice_items;
drop policy if exists invoice_items_staff_manage on public.invoice_items;
create policy invoice_items_staff_manage
  on public.invoice_items for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can manage invoice history" on public.invoice_history;
drop policy if exists invoice_history_staff_manage on public.invoice_history;
create policy invoice_history_staff_manage
  on public.invoice_history for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can manage invoice attachments" on public.invoice_attachments;
drop policy if exists invoice_attachments_staff_manage on public.invoice_attachments;
create policy invoice_attachments_staff_manage
  on public.invoice_attachments for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can manage transactions" on public.account_transactions;
drop policy if exists account_transactions_staff_manage on public.account_transactions;
create policy account_transactions_staff_manage
  on public.account_transactions for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── the client facing tables, their read own policies left alone ────────────

drop policy if exists "Authenticated users can manage projects" on public.projects;
drop policy if exists projects_staff_manage on public.projects;
create policy projects_staff_manage
  on public.projects for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can manage client_contacts" on public.client_contacts;
drop policy if exists client_contacts_staff_manage on public.client_contacts;
create policy client_contacts_staff_manage
  on public.client_contacts for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists appointments_rw on public.appointments;
drop policy if exists appointments_staff_manage on public.appointments;
create policy appointments_staff_manage
  on public.appointments for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── the inbox, public insert kept so the marketing forms keep posting ───────

drop policy if exists "Authenticated users can manage form submissions" on public.form_submissions;
drop policy if exists "Admins can do everything on form_submissions" on public.form_submissions;
drop policy if exists form_submissions_staff_manage on public.form_submissions;
create policy form_submissions_staff_manage
  on public.form_submissions for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── the four orphans, no file in any property reads them ────────────────────

drop policy if exists runway_characters_rw on public.runway_characters;
drop policy if exists runway_characters_staff_manage on public.runway_characters;
create policy runway_characters_staff_manage
  on public.runway_characters for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can update sprint counter" on public.sprint_counter;
drop policy if exists "Authenticated users can read sprint counter" on public.sprint_counter;
drop policy if exists sprint_counter_staff_manage on public.sprint_counter;
create policy sprint_counter_staff_manage
  on public.sprint_counter for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Authenticated users can manage sprint catalog" on public.sprints_catalog;
drop policy if exists sprints_catalog_staff_manage on public.sprints_catalog;
create policy sprints_catalog_staff_manage
  on public.sprints_catalog for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── verify ─────────────────────────────────────────────────────────────────
-- Expect zero rows. Anything returned still answers to any token.
-- select c.relname, p.polname
--   from pg_policy p
--   join pg_class c on c.oid = p.polrelid
--   join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public'
--    and p.polcmd = '*'
--    and regexp_replace(coalesce(pg_get_expr(p.polqual, p.polrelid), ''), '\s+', ' ', 'g')
--        ~* '^\(?\s*auth\.uid\(\)\s+IS\s+NOT\s+NULL\s*\)?$'
--  order by c.relname;

-- And the paths that must survive. Expect the five kept policies listed in the
-- header, one per row, still present.
-- select c.relname, p.polname
--   from pg_policy p
--   join pg_class c on c.oid = p.polrelid
--  where c.relname in ('invoice_items', 'payments', 'projects', 'form_submissions', 'sprints_catalog')
--    and p.polname not like '%staff_manage'
--  order by c.relname, p.polname;

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260927170000',
  'staff_scope_the_twelve',
  array['see neonburro-pulse/supabase/migrations/20260927170000_staff_scope_the_twelve.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'staff_scope_the_twelve'
);
