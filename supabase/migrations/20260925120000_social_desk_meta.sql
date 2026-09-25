-- supabase/migrations/20260925120000_social_desk_meta.sql
-- The social desk, the Meta half. Prepared 2026-09-25 by Volt from the plan
-- at neonburro/docs/06-plans/2026-09-25-the-social-desk.md. NOT APPLIED.
-- Tyler or Warbleur runs it through the dashboard SQL editor or the
-- connector, the ledger row at the bottom records the run either way.
--
-- WHAT IT DOES
-- 1. releases.asset_alt, the alt line of the picked plate. The picker copies
--    it from the studio library index or the shelf snapshot, publish-facebook
--    sends it to the Page as alt_text_custom and draft-release reads it for
--    the draft. The drawer only writes the column once it sees it on a row,
--    so the page can ship before or after this file, either order works.
-- 2. Two social_accounts rows, the studio Facebook Page and the studio
--    Instagram, both owned by warbleur as the publishing identity, both
--    pointing at the one token name META_PAGE_ACCESS_TOKEN, both switched
--    off. chat_id on the Page row carries the public page id read off the
--    Page url, META_PAGE_ID on the Pulse site wins when it is set. The
--    Instagram row's chat_id waits for the ig user id. A row that already
--    exists keeps its handle, its chat_id and its enabled switch, only the
--    env name and the note are refreshed.
-- 3. A check that a facebook or instagram row names a META_ variable, the
--    same shape as the telegram check beside it. Rows the account panel may
--    have added earlier with a guessed name are normalised first so the
--    check lands on every row.
-- 4. release_drafts, the trail and the count behind draft-release.js. One
--    row per time an operator asks Volt for a draft, written before the
--    model is called so a refused ask still holds what was typed, then
--    filled with the tokens and the dollars the call spent. The three
--    ceilings in docs/02-engineering/interaction-ceilings.md are counted
--    off these rows, the session and the day by user_id, the life of a
--    release by release_id, refused rows skipped. The service role writes,
--    staff read. Until this table exists the drafter closes on every call,
--    which is the honest state and the reason this file has to run before
--    the draft button is worth pressing.
--
-- WHAT IT DOES NOT DO
-- Nothing is enabled. No token is stored, the value lives on the Pulse
-- Netlify site in the functions scope and nowhere else. The Page posts
-- nothing until an admin flips the row on in Pulse and the three META_ names
-- exist on the site.
--
-- No oxford commas, no em dashes.

alter table public.releases
  add column if not exists asset_alt text;

comment on column public.releases.asset_alt is
  'The alt line of the picked plate. Carried to Facebook as alt_text_custom and read by draft-release. Set by the Socials picker.';

insert into public.social_accounts (burro, channel, handle, token_env, chat_id, enabled, note)
values
  (
    'warbleur',
    'facebook',
    'Neonburro',
    'META_PAGE_ACCESS_TOKEN',
    '61594682854824',
    false,
    'the studio page, https://www.facebook.com/profile.php?id=61594682854824. chat_id holds the page id, META_PAGE_ID on the Pulse site wins when set'
  ),
  (
    'warbleur',
    'instagram',
    '@neonburro',
    'META_PAGE_ACCESS_TOKEN',
    null,
    false,
    'the studio instagram, a business account connected to the page. chat_id may hold the ig user id, META_IG_USER_ID on the Pulse site wins when set'
  )
on conflict (burro, channel) do update set
  handle = coalesce(social_accounts.handle, excluded.handle),
  token_env = excluded.token_env,
  chat_id = coalesce(social_accounts.chat_id, excluded.chat_id),
  note = excluded.note;

update public.social_accounts
set token_env = 'META_PAGE_ACCESS_TOKEN'
where channel in ('facebook', 'instagram')
  and (token_env is null or token_env !~ '^META_[A-Z0-9_]+$');

alter table public.social_accounts
  drop constraint if exists social_accounts_meta_env_check;

alter table public.social_accounts
  add constraint social_accounts_meta_env_check
  check (
    channel not in ('facebook', 'instagram')
    or token_env is null
    or token_env ~ '^META_[A-Z0-9_]+$'
  );

-- ── the trail and the count behind volt's draft door ────────────────────────

create table if not exists public.release_drafts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  channel text,
  voice text,
  intent text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6),
  rounds integer not null default 0,
  request_id text,
  refused boolean,
  refusal text,
  created_at timestamptz not null default now()
);

comment on table public.release_drafts is
  'One row per ask of draft-release.js, written before the model is called. The three interaction ceilings count these rows, refused is null on a row that spent. cost_usd is the live price at the call, the daily report is the exact number.';

comment on column public.release_drafts.refused is
  'True when the ceiling or the count closed the door after the trail was written. Such a row spent nothing and the counts skip it. Null on a row that reached the model.';

create index if not exists release_drafts_user_created_idx
  on public.release_drafts (user_id, created_at desc)
  where refused is null;

create index if not exists release_drafts_release_idx
  on public.release_drafts (release_id)
  where refused is null;

alter table public.release_drafts enable row level security;

revoke all on table public.release_drafts from public, anon, authenticated;
grant select on table public.release_drafts to authenticated;

-- The service role writes and needs no policy, it bypasses RLS. A write on a
-- lesser key is refused, which is the point. Staff read.
drop policy if exists release_drafts_staff_read on public.release_drafts;
create policy release_drafts_staff_read on public.release_drafts
  for select to authenticated
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
  '20260925120000',
  'social_desk_meta',
  array['see neonburro-pulse/supabase/migrations/20260925120000_social_desk_meta.sql'],
  'volt@neonburro.com'
where not exists (
  select 1 from supabase_migrations.schema_migrations where name = 'social_desk_meta'
);
