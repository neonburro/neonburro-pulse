-- supabase/migrations/20260916090353_socials_account_routing_and_staff_rls.sql
-- Pulse Socials separates the council member speaking from the account that
-- publishes the post. It also adds Lyra's shared creative queue and replaces
-- broad authenticated access with staff role policies. The studio posting
-- hand requires the selected account after the existing row is backfilled.
--
-- This migration is prepared locally. Apply it to the shared Neon Burro
-- Supabase project before shipping the matching Pulse interface.
--
-- No oxford commas, no em dashes.

alter table public.releases
  add column if not exists social_account_id uuid references public.social_accounts(id) on delete restrict,
  add column if not exists content_pillar text,
  add column if not exists creative_brief text,
  add column if not exists asset_status text not null default 'not_needed',
  add column if not exists claimed_at timestamptz;

alter table public.releases
  drop constraint if exists releases_asset_status_check;

alter table public.releases
  add constraint releases_asset_status_check
  check (asset_status in ('not_needed', 'needs_lyra', 'generating', 'ready'));

alter table public.releases
  drop constraint if exists releases_approval_asset_ready_check;

alter table public.releases
  add constraint releases_approval_asset_ready_check
  check (not approved or asset_status not in ('needs_lyra', 'generating'));

create index if not exists releases_social_account_id_idx
  on public.releases (social_account_id);

update public.releases r
set social_account_id = a.id
from public.social_accounts a
where r.social_account_id is null
  and r.voice = a.burro
  and r.channel = a.channel;

alter table public.social_accounts
  drop constraint if exists social_accounts_telegram_env_check;

alter table public.social_accounts
  add constraint social_accounts_telegram_env_check
  check (
    channel <> 'telegram'
    or token_env is null
    or token_env ~ '^TELEGRAM_BOT_TOKEN_[A-Z0-9_]+$'
  );

create schema if not exists private;

create or replace function private.guard_profile_authority_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;

  if new.role is distinct from old.role
    or new.client_id is distinct from old.client_id then
    if (select auth.jwt() ->> 'role') = 'service_role' then
      return new;
    end if;

    select p.role
      into caller_role
      from public.profiles p
      where p.id = (select auth.uid());

    if caller_role is null
      or caller_role not in ('super_admin', 'admin') then
      raise exception 'profile authorization fields require an admin';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_authority_fields() from public, anon, authenticated;

drop trigger if exists profiles_guard_authority_fields on public.profiles;

create trigger profiles_guard_authority_fields
  before update on public.profiles
  for each row
  execute function private.guard_profile_authority_fields();

revoke all on public.releases from public, anon, authenticated;
revoke all on public.social_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.releases to authenticated;
grant select, insert, update, delete on public.social_accounts to authenticated;

drop policy if exists releases_rw on public.releases;
drop policy if exists releases_staff_read on public.releases;
drop policy if exists releases_staff_insert on public.releases;
drop policy if exists releases_staff_update on public.releases;
drop policy if exists releases_staff_delete on public.releases;

create policy releases_staff_read on public.releases
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

create policy releases_staff_insert on public.releases
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

create policy releases_staff_update on public.releases
  for update to authenticated
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

create policy releases_staff_delete on public.releases
  for delete to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

drop policy if exists social_accounts_rw on public.social_accounts;
drop policy if exists social_accounts_staff_read on public.social_accounts;
drop policy if exists social_accounts_admin_insert on public.social_accounts;
drop policy if exists social_accounts_admin_update on public.social_accounts;
drop policy if exists social_accounts_admin_delete on public.social_accounts;

create policy social_accounts_staff_read on public.social_accounts
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

create policy social_accounts_admin_insert on public.social_accounts
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

create policy social_accounts_admin_update on public.social_accounts
  for update to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

create policy social_accounts_admin_delete on public.social_accounts
  for delete to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

drop policy if exists social_buckets_write on storage.objects;
drop policy if exists social_buckets_insert on storage.objects;
drop policy if exists social_buckets_update on storage.objects;
drop policy if exists social_buckets_delete on storage.objects;

create policy social_buckets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id like 'social-%'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

create policy social_buckets_update on storage.objects
  for update to authenticated
  using (
    bucket_id like 'social-%'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  )
  with check (
    bucket_id like 'social-%'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

create policy social_buckets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id like 'social-%'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

comment on column public.releases.social_account_id is
  'The publishing account. Voice remains the council member speaking.';

comment on column public.releases.creative_brief is
  'The shared image or motion brief for Lyra and the illustrator.';

comment on column public.releases.asset_status is
  'The creative queue state, separate from editorial approval.';

comment on column public.releases.claimed_at is
  'The posting hand claim time. Human approval stays in approved_at.';
