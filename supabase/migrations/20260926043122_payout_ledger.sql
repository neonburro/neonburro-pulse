-- supabase/migrations/20260926043122_payout_ledger.sql
-- The payout ledger. Prepared 2026-09-26 by Volt. NOT APPLIED. Tyler or
-- Warbleur runs it through the dashboard SQL editor or the connector, the
-- ledger row at the bottom records the run either way.
--
-- Three other migrations in this folder are also prepared and waiting on the
-- same hand, 20260925152100_desk_asks, 20260925160000_social_facebook_bucket
-- and 20260926001122_token_wallets_public_map. This one depends on none of
-- them and they may be run in any order. It touches public.invoices only as
-- a foreign key target and that table has been live since the first billing
-- migration.
--
-- ════════════════════════════════════════════════════════════════════════════
-- WHY THIS EXISTS
-- ════════════════════════════════════════════════════════════════════════════
--
-- Tyler, 2026-09-26. When I get paid from clients in Pulse, I can pay out to
-- the Burrow accounts. How do we leave a trail of payments. And we could be
-- fully transparent that we are going to go 50/50 with everything, like
-- crypto and USD, and everything is kind of merged together.
--
-- ── THE TRAIL IS A JOIN, AND THAT IS THE WHOLE POINT ────────────────────────
-- A payout row on its own is the studio claiming it paid somebody. A
-- transaction on a chain on its own is unreadable, an address moving a number
-- to another address for no stated reason. The two together, with the row
-- carrying the signature that settles it, is the only version a stranger has
-- a reason to believe. So payouts.tx_signature is not a convenience field. It
-- is the join, and a row without one is a claim rather than a payment. Every
-- surface that reads this table has to say which it is looking at.
--
-- ── THE SHARE IS TAKEN ON THE REVENUE, NOT ON THE CURRENCY ──────────────────
-- A published percentage of each settled invoice is set aside for a holder
-- whatever currency the money arrived in, dollars through Stripe or SOL and
-- USDC on chain. There is deliberately no rule anywhere in this schema that
-- converts dollars into NEONBURRO, because the studio buying its own coin is
-- the one mechanism the direction forbids. See
-- neonburro/docs/06-plans/2026-09-26-the-burro-is-the-product.md, which
-- measured why, the studio already holds nearly all supply so buying more of
-- it moves a price we are the only participant in. A burro is paid out of
-- coin the studio ALREADY holds, or in dollars. Distribution, never purchase.
--
-- That is why usd_value is the obligation and currency and amount are how it
-- was discharged. The dollar figure is stamped once from the invoice at the
-- moment the row is recorded and is never recomputed, the same discipline as
-- settlements.usd_value in 2026081001_billing_rails.sql and for the same
-- reason. A ledger that recomputes from today's price is telling a story
-- rather than keeping a record.
--
-- ── WRITTEN ADDITIVE ON PURPOSE ─────────────────────────────────────────────
-- No drop, no revoke, no alter of anything that already exists. Every
-- statement either creates something absent or does nothing, so the file is
-- idempotent and safe to run twice, and the session running it is a hand in a
-- browser that should not be asked to paste a destructive statement. The
-- policies are created inside do blocks that check pg_policies first, because
-- create policy has no if not exists and the usual drop policy first shape is
-- a destructive statement in a file a person is pasting.
--
-- ── ON THE ABSENT REVOKE ────────────────────────────────────────────────────
-- The older tables in this folder revoke from public and anon before
-- granting. This file does not, because a revoke is exactly the statement the
-- additive rule excludes. RLS is the real gate either way. Row level security
-- is enabled on both tables and no policy below names anon or public, so an
-- anonymous reader selects zero rows regardless of any table grant. If the
-- belt as well as the braces is wanted, that revoke goes in its own migration
-- that a hand runs knowingly, not smuggled into this one.
--
-- No oxford commas, no em dashes.


-- ════════════════════════════════════════════════════════════════════════════
-- 1. payout_rules, the published percentages
-- ════════════════════════════════════════════════════════════════════════════
--
-- One row per holder per period. A change is a NEW ROW with a later
-- effective_from and the old row stays exactly as it was written, because a
-- percentage that can be edited after the fact is a percentage nobody outside
-- the building has a reason to trust. There is no update policy on this table
-- and that absence is the enforcement, not an oversight. An admin delete
-- exists for a row typed wrong within the minute, and using it on a rule that
-- has already produced payouts breaks the link between a payout and the rule
-- it came from, which is why payouts.rule_id is on delete set null and
-- payouts.share carries its own stamped copy of the number.
--
-- holder is the holder key from src/data/walletHolders.js in this repo, the
-- nine council read out of src/lib/personas.js plus tender, epoch, kolache,
-- chime and the five treasury keys. It is deliberately NOT a foreign key.
-- That roster lives in a JavaScript file because the studio's own registries
-- live in the studio repo and Pulse cannot import across repos, so a
-- constraint here would be a second roster that drifts from the first. The
-- room refuses a holder it does not recognise and the table stores what it is
-- given.

create table if not exists public.payout_rules (
  id uuid primary key default gen_random_uuid(),
  holder text not null,
  share numeric(6, 4) not null check (share > 0 and share <= 1),
  effective_from date not null,
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.payout_rules is
  'The published payout percentages, one row per holder per period. Never edited. A change is a new row with a later effective_from and the old row stays readable, which is why there is no update policy on this table.';

comment on column public.payout_rules.holder is
  'The holder key from src/data/walletHolders.js in neonburro-pulse. Not a foreign key on purpose, that roster is a JavaScript file because it is assembled from studio registries Pulse cannot import. The room validates it, the table stores it.';

comment on column public.payout_rules.share is
  'The fraction of a settled invoice set aside for this holder, 0 to 1. Four decimals, so 0.0250 is two and a half percent. Taken on the revenue whatever currency arrived, never a rule about converting one currency into another.';

comment on column public.payout_rules.effective_from is
  'The day this rule starts applying. The rule in force for an invoice is the latest row for that holder whose effective_from is on or before the day the invoice settled, so backdating a rule silently changes what past invoices should have paid. Do not backdate.';

-- One rule per holder per day. A second edit on the same day is the same
-- period and has to replace the first deliberately rather than stack.
create unique index if not exists payout_rules_holder_from_uniq
  on public.payout_rules (holder, effective_from);

create index if not exists payout_rules_holder_idx
  on public.payout_rules (holder, effective_from desc);

alter table public.payout_rules enable row level security;

grant select, insert, delete on table public.payout_rules to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_rules'
      and policyname = 'payout_rules_staff_read'
  ) then
    create policy payout_rules_staff_read
      on public.payout_rules for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('super_admin', 'admin', 'manager', 'team')
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_rules'
      and policyname = 'payout_rules_manager_insert'
  ) then
    create policy payout_rules_manager_insert
      on public.payout_rules for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('super_admin', 'admin', 'manager')
        )
      );
  end if;
end
$$;

-- No update policy. See the note above, it is the enforcement.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_rules'
      and policyname = 'payout_rules_admin_delete'
  ) then
    create policy payout_rules_admin_delete
      on public.payout_rules for delete
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('super_admin', 'admin')
        )
      );
  end if;
end
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. payouts, one row per amount owed to one holder out of one settled invoice
-- ════════════════════════════════════════════════════════════════════════════
--
-- ── THE THREE NUMBERS AND WHY THERE ARE THREE ───────────────────────────────
--   usd_value   what was set aside. Stamped from the invoice at the moment
--               the row was recorded, in dollars, never recomputed. This is
--               the obligation and it does not move if a coin price does.
--   currency    what the studio pays it in. USD, USDC, SOL or NEONBURRO. Null
--               is not allowed and there is no preference between them, which
--               is the merged rail Tyler asked for.
--   amount      how much of that currency actually moved. NULL until it does,
--               because a coin amount before a send is a guess and a guess in
--               a ledger column reads as a record. On a USD row it equals
--               usd_value.
--
-- usd_rate is derived at settlement from usd_value over amount rather than
-- typed, so the three numbers cannot disagree. It is stored because the rate
-- at a moment is itself a fact worth keeping, the same call settlements made.
--
-- ── THE PROOF, AND THE HONEST GAP IN IT ─────────────────────────────────────
-- tx_signature is the join for anything that moved on Solana. A dollar payout
-- has no chain signature and never will, so reference carries the off chain
-- proof instead, a Stripe transfer id or a bank confirmation number. The
-- constraint below requires the right one of the two for the currency before
-- a row may read sent.
--
-- Those two proofs are not equally good and the room must not pretend they
-- are. A signature can be checked by a stranger on solscan. A bank
-- confirmation number can only be checked by somebody with access to the
-- account, which means a dollar payout is verifiable inside the building and
-- attestable outside it. That is a real difference and the public shape has
-- to carry it as a word rather than flatten both into paid.
--
-- ── ONE ROW PER HOLDER PER INVOICE ──────────────────────────────────────────
-- The unique index below is the double count guard. Splitting the same
-- invoice twice fails loudly on the second attempt instead of quietly owing
-- somebody twice, which is the single most likely way this table gets wrong.
-- A holder genuinely owed twice out of one invoice is owed it under two
-- different rules and that is a conversation, not an insert.
--
-- ── A SIGNATURE BELONGS TO ONE PAYMENT ──────────────────────────────────────
-- The partial unique index on tx_signature stops one transaction being pasted
-- onto two rows and counted as two payments. Same for reference. Both are
-- partial so any number of rows may be waiting with nothing.
--
-- ── NEVER IN THIS TABLE ─────────────────────────────────────────────────────
-- Public addresses only in destination. No private key, no seed phrase and no
-- keypair, here or in a log or a commit. There is no column for one.

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),

  invoice_id uuid not null references public.invoices (id) on delete restrict,
  holder text not null,

  rule_id uuid references public.payout_rules (id) on delete set null,
  share numeric(6, 4) not null check (share > 0 and share <= 1),

  currency text not null default 'USD'
    check (currency in ('USD', 'USDC', 'SOL', 'NEONBURRO')),
  amount numeric(38, 10) check (amount is null or amount > 0),
  usd_value numeric(12, 2) not null check (usd_value >= 0),
  usd_rate numeric(18, 8),

  status text not null default 'owed'
    check (status in ('owed', 'sent', 'void')),

  destination text,
  tx_signature text,
  reference text,
  settled_at timestamptz,

  note text not null default '',
  recorded_by uuid references auth.users (id) on delete set null,
  settled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payouts is
  'One row per amount owed to one holder out of one settled invoice. The row plus the transaction it names is the trail. A row with no signature and no reference is a claim, not a payment, and every surface reading this table has to say so.';

comment on column public.payouts.invoice_id is
  'The settled invoice the share was taken on. On delete restrict, because deleting an invoice that has already paid somebody would leave a payment with nothing to reconcile against. Void the payouts first if an invoice really has to go.';

comment on column public.payouts.share is
  'The fraction applied, stamped at record time from the rule in force. Carried here as well as on the rule so the arithmetic on this row can be redone from this row alone, and so an admin deleting a rule cannot erase what was actually applied.';

comment on column public.payouts.usd_value is
  'The dollar value set aside, stamped from the invoice at the moment this row was recorded. Never recomputed. The obligation, not the settlement.';

comment on column public.payouts.amount is
  'How much of currency actually moved. Null until it does. A coin amount written before a send is a guess and a guess in a ledger column reads as a record.';

comment on column public.payouts.usd_rate is
  'usd_value over amount, derived at settlement rather than typed, so the three numbers on the row cannot disagree.';

comment on column public.payouts.tx_signature is
  'The Solana transaction signature. This is the join and the reason the trail is worth anything. Base58, 64 bytes, 86 to 88 characters. A stranger can check it on solscan, which is the difference between a record and a claim.';

comment on column public.payouts.reference is
  'The off chain proof for a USD payout, a Stripe transfer id or a bank confirmation. It is attestable rather than verifiable, checkable only by somebody with account access, and the surfaces must not print it as equal to a signature.';

comment on column public.payouts.destination is
  'The public address the coin was sent to, or the account a dollar payout landed in described in words. Public addresses only. No private key, no seed phrase and no keypair goes in this table.';

comment on column public.payouts.status is
  'owed is recorded and unpaid, sent is discharged and proved, void is a row withdrawn without payment. A row is never deleted to undo it, it is voided, because a ledger that loses rows cannot be reconciled.';

comment on column public.payouts.settled_by is
  'The hand that took this row out of owed, whether by settling it or by voiding it. recorded_by is the hand that created it. Two names on every row that stopped being owed, which is the trail on the row itself.';

-- The double count guard. See the note above.
create unique index if not exists payouts_invoice_holder_uniq
  on public.payouts (invoice_id, holder);

-- One transaction is one payment.
create unique index if not exists payouts_signature_uniq
  on public.payouts (tx_signature)
  where tx_signature is not null;

create unique index if not exists payouts_reference_uniq
  on public.payouts (reference)
  where reference is not null;

create index if not exists payouts_holder_status_idx
  on public.payouts (holder, status, created_at desc);

create index if not exists payouts_invoice_idx
  on public.payouts (invoice_id);

-- The room opens on what is owed, so that read earns its own index.
create index if not exists payouts_owed_idx
  on public.payouts (created_at desc)
  where status = 'owed';

-- ── sent means proved ───────────────────────────────────────────────────────
-- A do block rather than a bare add constraint, because add constraint has no
-- if not exists and a second run would error out in front of whoever is
-- pasting this. The table is new so there is nothing to validate against.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payouts'::regclass
      and conname = 'payouts_sent_is_proved'
  ) then
    alter table public.payouts
      add constraint payouts_sent_is_proved
      check (
        status <> 'sent'
        or (
          settled_at is not null
          and amount is not null
          and (
            case
              when currency = 'USD' then reference is not null and reference <> ''
              else tx_signature is not null and tx_signature <> ''
            end
          )
        )
      );
  end if;
end
$$;

-- ── updated_at keeps itself ─────────────────────────────────────────────────
-- create or replace on a function the database has never seen is a create,
-- and on one it has seen it replaces a body identical to this one. Neither is
-- destructive. The trigger is guarded because create trigger has no if not
-- exists and the usual drop trigger first shape is the statement this file is
-- not allowed to carry.

create or replace function public.payouts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.payouts'::regclass
      and tgname = 'payouts_touch'
  ) then
    create trigger payouts_touch
      before update on public.payouts
      for each row execute function public.payouts_touch_updated_at();
  end if;
end
$$;

alter table public.payouts enable row level security;

grant select, insert, update, delete on table public.payouts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts_staff_read'
  ) then
    create policy payouts_staff_read
      on public.payouts for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('super_admin', 'admin', 'manager', 'team')
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts_manager_insert'
  ) then
    create policy payouts_manager_insert
      on public.payouts for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('super_admin', 'admin', 'manager')
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts_manager_update'
  ) then
    create policy payouts_manager_update
      on public.payouts for update
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
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts_admin_delete'
  ) then
    create policy payouts_admin_delete
      on public.payouts for delete
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('super_admin', 'admin')
        )
      );
  end if;
end
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- NOT IN THIS FILE, ON PURPOSE
-- ════════════════════════════════════════════════════════════════════════════
--
-- There is no public view and no anon policy. A public payout feed is
-- designed and is not exposed, and the reason is that both tables carry
-- invoice_id and a feed that leaks which invoice a payout came from leaks the
-- client who paid it. The standing rule is the no client names note in
-- neonburro/docs/council/comms/inbox-cypher/ dated 2026-09-25 and it applies
-- double here, because a payout feed is a money surface and a money surface
-- with a client name on it is worse than no feed. When a feed is built it is
-- a security definer view that selects holder, currency, amount, usd_value,
-- settled_at and tx_signature and NOTHING that identifies the payer, not the
-- invoice id, not the invoice number, not the client, not the invoice total
-- and not a timestamp precise enough to line a payout up against an invoice
-- by time. The design is written out in the note to Warbleur in
-- neonburro/docs/council/comms/inbox-warbleur/ dated 2026-09-26. Do not add
-- the view without reading it.

-- Ledger row, so a hand applied run is visible to the connector's migration list.
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select
  '20260926043122',
  'payout_ledger',
  array['see neonburro-pulse/supabase/migrations/20260926043122_payout_ledger.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'payout_ledger'
);
