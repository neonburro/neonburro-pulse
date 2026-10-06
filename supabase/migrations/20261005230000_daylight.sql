-- supabase/migrations/20261005230000_daylight.sql
--
-- DAYLIGHT. The shape of the next three weeks, before anything is booked.
-- See src/lib/daylight.js for the whole argument. Short version: the calendar
-- holds appointments, daylight holds the offer of time, and an offer becomes an
-- appointment in the EXISTING appointments table when Tyler takes it. Nothing
-- in here duplicates that table.
--
-- RLS. Every table is studio only. The client facing page is public and has no
-- session, so it never reaches Supabase at all: netlify/functions/daylight-public.js
-- holds the service key and answers only what a token is entitled to. This is
-- deliberate. There is a documented case in this org of public tables answering
-- to any anon token and the fix is to not hand an anon key to an unauthed page.
--
-- No oxford commas, no em dashes.

-- ── THE STUDIO'S OWN DAYS ───────────────────────────────────────────────────
-- One row per marked day. A day with no row is not a fourth state, it is a day
-- nobody has spoken for, and the client page renders it as quiet rather than as
-- free. Saying nothing is not a promise.
create table if not exists public.daylight_days (
  day         date primary key,
  state       text not null check (state in ('open', 'tight', 'gone')),
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- ── THE SHARED LINKS ────────────────────────────────────────────────────────
-- One per client. The token is the whole credential, so it is generated server
-- side and is long. Revoking sets revoked_at rather than deleting, because the
-- offers below point at it and a client's history should survive the link.
create table if not exists public.daylight_links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  label       text not null,
  client_id   uuid references public.clients (id) on delete set null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index if not exists daylight_links_token_idx on public.daylight_links (token) where revoked_at is null;

-- ── WHAT A CLIENT SENDS BACK ────────────────────────────────────────────────
-- An offer is availability and never a booking. start_min is minutes from local
-- midnight, an integer, because "2 PM on the 14th" is a wall clock and not an
-- instant. The instant is resolved once, when the offer is taken and the
-- calendar's own combineLocal makes the appointment.
--
-- meeting_type is checked against the same three ids as appointments, which are
-- defined in src/pages/Calendar/calendarConstants.js. IF A FOURTH TYPE IS EVER
-- ADDED THERE, THIS CHECK AND THE ONE ON appointments BOTH HAVE TO MOVE.
create table if not exists public.daylight_offers (
  id            uuid primary key default gen_random_uuid(),
  link_id       uuid not null references public.daylight_links (id) on delete cascade,
  day           date not null,
  start_min     int  not null check (start_min >= 0 and start_min < 1440),
  minutes       int  not null default 30 check (minutes > 0 and minutes <= 480),
  meeting_type  text not null check (meeting_type in ('call', 'video', 'in_person')),
  note          text,
  status        text not null default 'new' check (status in ('new', 'taken', 'passed')),
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists daylight_offers_link_idx on public.daylight_offers (link_id, created_at desc);
create index if not exists daylight_offers_open_idx on public.daylight_offers (status, day) where status = 'new';

-- ── RLS, studio only on all three ───────────────────────────────────────────
alter table public.daylight_days   enable row level security;
alter table public.daylight_links  enable row level security;
alter table public.daylight_offers enable row level security;

-- Signed in staff read and write. The public page does not come through here,
-- it comes through the function with the service key, which bypasses RLS.
drop policy if exists daylight_days_staff on public.daylight_days;
create policy daylight_days_staff on public.daylight_days
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'staff'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'staff'))
  );

drop policy if exists daylight_links_staff on public.daylight_links;
create policy daylight_links_staff on public.daylight_links
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'staff'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'staff'))
  );

drop policy if exists daylight_offers_staff on public.daylight_offers;
create policy daylight_offers_staff on public.daylight_offers
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'staff'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin', 'staff'))
  );
