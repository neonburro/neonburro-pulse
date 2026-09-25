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
