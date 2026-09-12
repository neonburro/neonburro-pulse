-- supabase/migrations/2026091202_social_timeline.sql
-- The social timeline, built on the releases table that already exists.
-- APPLIED 2026-09-12 through the connector as migration social_timeline and
-- verified: seven new columns on releases, twelve social_accounts rows, five
-- social buckets.
--
-- WHY THIS SHAPE
-- A release was already one thing the studio intends to put into the world,
-- with a channel, a voice and a date. It was missing the thing itself: the
-- words, the picture, and the proof it went out. This migration adds those
-- four fields and nothing else to the row, so the Releases page keeps working
-- and the release-social function has what it needs to post.
--
-- ASSETS LIVE IN BUCKETS, ONE PER CHANNEL
-- social-telegram, social-instagram, social-x, social-reddit, social-site.
-- Each channel has its own sizes and rules, so each has its own shelf. Public
-- read because every channel needs a public url to fetch the picture from,
-- authenticated write because only the team drops files in. A release points
-- at one object by bucket and path.
--
-- ACCOUNTS ARE ROWS, TOKENS ARE NOT
-- social_accounts names the handle a burro owns on a channel and the NAME of
-- the Netlify env var that holds its token. The token itself never enters the
-- database. Telegram also needs the chat id of the group the bot posts into.
-- enabled false is the kill switch per account.
--
-- APPROVAL IS A FIELD, NOT A STATUS
-- The status pip stays the workflow, idea to drafted to staged to released.
-- approved is the human thumb. The function posts a row only when it is
-- staged, approved, due, and its account is enabled. Nothing goes out on
-- schedule alone. failed is a new status for a post the channel refused, the
-- error column says why, and advancing the pip puts it back on the ramp.
--
-- No oxford commas, no em dashes.

alter table public.releases
  add column if not exists body text,
  add column if not exists asset_bucket text,
  add column if not exists asset_path text,
  add column if not exists approved boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists external_id text,
  add column if not exists error text;

alter table public.releases drop constraint if exists releases_status_check;
alter table public.releases
  add constraint releases_status_check
  check (status in ('idea','drafted','staged','released','failed'));

create index if not exists releases_due_idx
  on public.releases (release_at)
  where status = 'staged' and approved;

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  burro text not null,
  channel text not null,
  handle text,
  token_env text,
  chat_id text,
  enabled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (burro, channel)
);

alter table public.social_accounts enable row level security;

drop policy if exists social_accounts_rw on public.social_accounts;
create policy social_accounts_rw on public.social_accounts
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

insert into storage.buckets (id, name, public)
values
  ('social-telegram', 'social-telegram', true),
  ('social-instagram', 'social-instagram', true),
  ('social-x', 'social-x', true),
  ('social-reddit', 'social-reddit', true),
  ('social-site', 'social-site', true)
on conflict (id) do nothing;

drop policy if exists social_buckets_read on storage.objects;
create policy social_buckets_read on storage.objects
  for select to public
  using (bucket_id like 'social-%');

drop policy if exists social_buckets_write on storage.objects;
create policy social_buckets_write on storage.objects
  for all to authenticated
  using (bucket_id like 'social-%')
  with check (bucket_id like 'social-%');

insert into public.social_accounts (burro, channel, handle, token_env, enabled, note)
values
  ('warbleur', 'telegram', null, 'TELEGRAM_BOT_TOKEN_WARBLEUR', false, 'the studio facing the town'),
  ('ion', 'telegram', null, 'TELEGRAM_BOT_TOKEN_ION', false, 'the ship facing the sky'),
  ('cypher', 'telegram', null, 'TELEGRAM_BOT_TOKEN_CYPHER', false, 'money and the furnace'),
  ('lyra', 'telegram', null, 'TELEGRAM_BOT_TOKEN_LYRA', false, 'the art'),
  ('volt', 'telegram', null, 'TELEGRAM_BOT_TOKEN_VOLT', false, 'the weekly reading and gauge'),
  ('aster', 'telegram', null, 'TELEGRAM_BOT_TOKEN_ASTER', false, 'the calendar'),
  ('skye', 'telegram', null, 'TELEGRAM_BOT_TOKEN_SKYE', false, 'film'),
  ('pixel', 'telegram', null, 'TELEGRAM_BOT_TOKEN_PIXEL', false, 'motion'),
  ('echo', 'telegram', null, 'TELEGRAM_BOT_TOKEN_ECHO', false, 'the ledger'),
  ('epoch', 'telegram', null, 'TELEGRAM_BOT_TOKEN_EPOCH', false, 'the coin, only the coin'),
  ('tender', 'telegram', null, 'TELEGRAM_BOT_TOKEN_TENDER', false, 'the payroll office'),
  ('kolache', 'telegram', null, 'TELEGRAM_BOT_TOKEN_KOLACHE', false, 'the welcome')
on conflict (burro, channel) do nothing;
