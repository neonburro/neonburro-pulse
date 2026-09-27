-- supabase/migrations/20260927160000_clients_rls_scope.sql
-- The clients table stops answering to anybody holding a token. Prepared
-- 2026-09-27 by Volt from a read of the live policy set. NOT APPLIED. Tyler
-- or Warbleur runs it through the dashboard SQL editor or the connector, the
-- ledger row at the bottom records the run either way.
--
-- WHY THIS EXISTS
-- public.clients carried a policy named "Authenticated users can manage
-- clients", cmd ALL, role public, qual (auth.uid() IS NOT NULL) and no with
-- check. That is not a role gate. It is a gate that asks whether a token
-- exists, and every token passes it, so every signed in session held select,
-- insert, update and delete on all eleven client rows including email,
-- balance, stripe_customer_id, portal_pin and lookup_pin.
--
-- THE PART THAT MAKES IT URGENT
-- The gate is reachable from the open internet and not only from the portal.
-- neonburro.com route /send-a-burro/ calls signInWalkUp in
-- neonburro/src/lib/sendABurro.js, which calls supabase auth
-- signInAnonymously against this same project. An anonymous session carries a
-- real auth.uid() and the authenticated role in its jwt, so it satisfies
-- (auth.uid() IS NOT NULL) exactly the way a staff session does. Eight
-- anonymous users already exist, first 2026-08-27 and last 2026-08-28, which
-- is the week that page went up. A visitor to the open call page was one
-- request away from reading and deleting the client book. That is the reason
-- this file is not a tidy up.
--
-- WHAT REPLACES IT
-- Four per command policies in the vocabulary every other migration in this
-- folder already uses, and it is the desk_asks shape read column for column:
--   select   super_admin, admin, manager, team
--   insert   super_admin, admin, manager
--   update   super_admin, admin, manager, using and with check both
--   delete   super_admin, admin
-- Grants are revoked from public, anon and authenticated and handed back to
-- authenticated only, so anon holds no privilege on this table at all and the
-- policies are the second lock rather than the only one. service_role keeps
-- its own grant, so every netlify function keeps working untouched.
--
-- WHAT IS DELIBERATELY LEFT ALONE
-- Policy "Clients read own record" is not dropped. Its first branch, id in
-- (select client_id from profiles where profiles.id = auth.uid()), is the
-- portal read path and the portal must keep it. Permissive policies or
-- together, so clients_staff_read below is additive and takes nothing away
-- from a portal account.
--
-- Its second branch is dead and worth somebody's attention in a separate
-- sitting. It reads profiles.role in ('owner', 'admin', 'team'). No migration
-- in this folder has ever written 'owner' and no profiles row holds it, so
-- that branch grants nothing today and never has. The house vocabulary is
-- super_admin, admin, manager, team for staff and client for a portal
-- account. Two consequences. A manager was never covered by that branch, and
-- nothing enforces the vocabulary because profiles.role carries no check
-- constraint. Retiring that branch is a one line change and it is not in this
-- file because this file was asked to leave the portal read path as it stands.
--
-- THE PRECONDITION, READ THIS BEFORE RUNNING
-- These policies key off a profiles row. Today auth.users holds fifteen rows
-- and public.profiles holds one, a single super_admin. Eight of the other
-- fourteen are the anonymous walk ups above and lose access by design, but
-- three carry real email addresses and two of those sit at neonburro.com.
-- Thirteen of the fourteen have signed in. src/components/Layout/AppShell.jsx
-- does not gate on a profiles row, it only reads sidebar_collapsed, so rls
-- has been the only thing standing between a signed in session and this
-- table. Anyone without a profiles row who works in Pulse today loses the
-- clients pages the minute this runs. Run the preflight below, decide who is
-- staff, give them a profiles row with a role, then apply. Locking out a
-- colleague and locking out a stranger look identical from in here, so a
-- person has to say which is which.
--
-- THIRTEEN SIBLINGS
-- The same shape, cmd ALL with a qual of only auth.uid() is not null, sits on
-- account_transactions, appointments, client_contacts, form_submissions,
-- invoice_attachments, invoice_history, invoice_items, invoices, payments,
-- projects, runway_characters, sprint_counter and sprints_catalog. Every one
-- of them is reachable by the same anonymous session. This file fixes clients
-- only because clients is what was asked for. The other thirteen are open and
-- they carry payment and invoice rows.
--
-- WHAT WRITES FROM A BROWSER, ALL OF IT
-- Grepped src on 2026-09-27 so these policies do not break a working page.
--   src/pages/Clients/components/ClientModal.jsx:337  update by id
--   src/pages/Clients/components/ClientModal.jsx:341  insert then select
--   src/pages/Clients/components/ClientModal.jsx:363  delete by id
--   src/components/common/ClientAvatarUpload.jsx:72   update avatar_url
--   src/components/common/ClientAvatarUpload.jsx:108  update avatar_url null
-- The avatar component is rendered from one place, ClientDetail.jsx:474, a
-- staff page, so a manager role covers it. Everything else that touches this
-- table from a browser is a select and the read policy covers it,
-- Clients/index.jsx, Clients/ClientDetail.jsx, Messages, Calendar, Dashboard,
-- Invoicing and Reports. The insert at ClientModal.jsx:341 chains select on
-- the new row, which needs the read policy too, and it has it.
--
-- No oxford commas, no em dashes.

-- Preflight. Who loses the clients pages when this runs. Read it, do not skip
-- it. Expect one row per signed in user with no profiles row.
-- select u.email, u.is_anonymous, u.last_sign_in_at
--   from auth.users u
--   left join public.profiles p on p.id = u.id
--  where p.id is null
--  order by u.is_anonymous, u.last_sign_in_at desc nulls last;

-- ── the gate that asked only for a token ────────────────────────────────────

drop policy if exists "Authenticated users can manage clients" on public.clients;

-- ── grants, so anon holds nothing here ──────────────────────────────────────

alter table public.clients enable row level security;

revoke all on table public.clients from public, anon, authenticated;
grant select, insert, update, delete on table public.clients to authenticated;

-- ── the four per command policies ───────────────────────────────────────────

drop policy if exists clients_staff_read on public.clients;
create policy clients_staff_read
  on public.clients for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

drop policy if exists clients_manager_insert on public.clients;
create policy clients_manager_insert
  on public.clients for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

drop policy if exists clients_manager_update on public.clients;
create policy clients_manager_update
  on public.clients for update
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

drop policy if exists clients_admin_delete on public.clients;
create policy clients_admin_delete
  on public.clients for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

-- ── verify ──────────────────────────────────────────────────────────────────
-- Expect five rows, the four above plus "Clients read own record". No row
-- should carry a qual of only auth.uid() is not null.
-- select polname,
--        case polcmd when 'r' then 'select' when 'a' then 'insert'
--             when 'w' then 'update' when 'd' then 'delete'
--             when '*' then 'all' end as cmd,
--        pg_get_expr(polqual, polrelid) as qual
--   from pg_policy where polrelid = 'public.clients'::regclass
--  order by cmd, polname;

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260927160000',
  'clients_rls_scope',
  array['see neonburro-pulse/supabase/migrations/20260927160000_clients_rls_scope.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'clients_rls_scope'
);
