-- supabase/migrations/20261005170000_client_companies.sql
--
-- NOT APPLIED. Written by Volt 2026-10-05, waiting on Tyler's go. Run the
-- READ ONLY CHECK at the bottom first and keep its output, run this, then run
-- the check again and compare. Nothing here drops, renames or narrows
-- anything. Every new column is nullable and every existing row keeps
-- working untouched.
--
-- ── THE ASK ─────────────────────────────────────────────────────────────────
-- Tyler, 2026-10-05: one client can hold several companies and several
-- websites. Matt Beyer is the example, one person, Colorado Boy, Colorado Boy
-- Depot and Colorado Girl Coffee, four websites, all of it under his one
-- client.
--
-- ── WHAT ALREADY EXISTS, READ FROM THE CODE THE SAME DAY ────────────────────
--   clients          one person or business. ONE company text field, one
--                    website, one billing address. The invoice Bill To reads
--                    these (src/lib/invoiceEmailTemplate.js).
--   client_contacts  many people per client, primary and billing CC flags.
--   client_sites     MANY Netlify sites per client already, keyed unique on
--                    netlify_site_id (connect-netlify-site.js upserts on it).
--                    So several websites under one client works today. What
--                    is missing is which company each site belongs to.
--   projects         many per client. invoices carry client_id and project_id.
--
-- So the gap is one thing, the company. This adds it as its own table under
-- the client and lets a site, a project and an invoice point at one.
--
-- ── WHY A TABLE AND NOT MORE COLUMNS ON clients ─────────────────────────────
-- A second company needs its own name, its own billing address and often its
-- own EIN, and an invoice to Colorado Girl Coffee should print Colorado Girl
-- Coffee in Billed to, not Colorado Boy. That is a row, not a column.
-- clients.company stays exactly as it is. Until a client has rows here, the
-- client record IS the one company, so no backfill is needed for anything to
-- keep working.
--
-- ── WHY invoices.bill_to IS A SNAPSHOT ──────────────────────────────────────
-- The pay page is public and reads the invoice by pay_token. If the document
-- looked a company up live it would need an anon read on client_companies,
-- which is exactly the shape of the hole closed on 2026-09-27 (see the memory
-- note on the anon session RLS hole). Instead send-invoice.js, on the service
-- role, freezes the Billed to block into invoices.bill_to at send time. The
-- pay page and resend read that, the company table never faces anon, and an
-- invoice keeps the address it was sent with even if the company moves.
-- WRITE THE WHOLE OBJECT, a PATCH on a jsonb column replaces rather than
-- merges, the studio learned that on 2026-09-21.
--
-- ── RLS ─────────────────────────────────────────────────────────────────────
-- client_companies is staff only from the first minute, through
-- public.is_staff(), the house helper. No anon policy, no portal policy. A
-- portal read for a client's own companies can be added later, scoped
-- role = 'client' and client_id matching, the canon in the anon note.
-- The three new columns live on tables whose policies already exist and
-- are not changed here. client_sites has no migration file anywhere, it was
-- made by hand, and its RLS was NOT readable from the 2026-10-05 session
-- (the connector reaches Greenville only and the Chrome dashboard was signed
-- in to another org). The check below reads it. If client_sites comes back
-- with RLS off or an auth.uid() is not null policy, that is a finding to fix
-- on its own, before this, not inside this file.
--
-- ── WHAT CODE FOLLOWS, NOT IN THIS FILE ─────────────────────────────────────
-- 1. ClientModal gains a Companies section, ClientDetail lists companies
--    with their sites grouped under each.
-- 2. SitesTab gets a company picker on connect and on each site row.
-- 3. InvoiceEditor gets a Bill to company picker under the client.
-- 4. send-invoice.js writes bill_to, the template and the pay page prefer it.
-- Step 4 changes what a client receives, so it ships last and gets a render
-- looked at before any real send.
--
-- No oxford commas, no dashes.

-- ── 1. the companies ────────────────────────────────────────────────────────
create table if not exists public.client_companies (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  name          text not null,
  website       text,
  billing_email text,
  tax_id        text,
  address_line1 text,
  address_line2 text,
  city          text,
  region        text,
  postal_code   text,
  country       text default 'US',
  is_primary    boolean not null default false,
  sort_order    integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists client_companies_client_id_idx
  on public.client_companies (client_id);

alter table public.client_companies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_companies'
      and policyname = 'Staff manage client_companies'
  ) then
    create policy "Staff manage client_companies"
      on public.client_companies for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end $$;

-- ── 2. who each site, project and invoice belongs to ───────────────────────
alter table public.client_sites add column if not exists company_id uuid
  references public.client_companies(id) on delete set null;
alter table public.projects add column if not exists company_id uuid
  references public.client_companies(id) on delete set null;
alter table public.invoices add column if not exists company_id uuid
  references public.client_companies(id) on delete set null;

create index if not exists client_sites_company_id_idx on public.client_sites (company_id);
create index if not exists projects_company_id_idx on public.projects (company_id);
create index if not exists invoices_company_id_idx on public.invoices (company_id);

-- ── 3. the frozen Billed to block, written at send ─────────────────────────
alter table public.invoices add column if not exists bill_to jsonb;

-- ── 4. the ledger row, so a hand run shows up in the migration list ────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
values ('20261005170000', 'client_companies', array['see supabase/migrations/20261005170000_client_companies.sql'], 'tyler@neonburro.com')
on conflict (version) do nothing;

-- ── READ ONLY CHECK, run before and after, keep both outputs ───────────────
-- select c.relname as table_name,
--        case when c.relrowsecurity then 'rls on' else 'RLS OFF' end as rls
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public'
--    and c.relname in ('client_companies','client_sites','projects','invoices','clients')
--  order by 1;
--
-- select tablename, policyname, cmd, roles, qual
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('client_companies','client_sites','projects','invoices')
--  order by 1, 2;
--
-- After the run, client_companies must show rls on and exactly one policy,
-- Staff manage client_companies, ALL, authenticated, is_staff(). Every other
-- row must match the before output exactly.
