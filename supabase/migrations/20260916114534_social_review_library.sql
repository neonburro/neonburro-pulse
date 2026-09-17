-- supabase/migrations/20260916114534_social_review_library.sql
--
-- Pulse owns the staff review surface for social identity, voice lanes,
-- service concepts and tool candidates. This library does not replace the
-- public account registry in neonburro/src/data/socials.js and it never stores
-- credentials. A social service row is presentation material until it points
-- to a canonical service record.
--
-- Profile copy and content lanes are approved by the creative owner. Services
-- and tools enter review because neither availability nor vendor adoption is
-- implied by appearing here. Publishing approval remains on releases and is
-- never inferred from this table.
--
-- Staff can read. Managers can add or edit. Admins can retire or remove. No
-- anonymous policy exists.
-- No Oxford commas, no em dashes.

create table public.social_review_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('profile_copy', 'content_lane', 'service', 'tool')),
  slug text not null,
  title text not null,
  body text not null,
  summary text,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  voice text,
  channel text,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'retired')),
  source_ref text,
  details jsonb not null default '{}'::jsonb,
  preferred boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);

comment on table public.social_review_items is
  'Staff review library for exact profile copy, recurring voices, social service concepts and internal tool candidates.';

comment on column public.social_review_items.details is
  'Structured review context only. Never store a password, token, API key or private customer detail.';

create index social_review_items_kind_status_idx
  on public.social_review_items (kind, status, updated_at desc);

create index social_review_items_voice_idx
  on public.social_review_items (voice, kind)
  where voice is not null;

create index social_review_items_account_idx
  on public.social_review_items (social_account_id)
  where social_account_id is not null;

alter table public.social_review_items enable row level security;

revoke all on table public.social_review_items from public, anon, authenticated;
grant select, insert, update, delete on table public.social_review_items to authenticated;

create policy social_review_items_staff_read
  on public.social_review_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager', 'team')
    )
  );

create policy social_review_items_manager_insert
  on public.social_review_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin', 'manager')
    )
  );

create policy social_review_items_manager_update
  on public.social_review_items for update
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

create policy social_review_items_admin_delete
  on public.social_review_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('super_admin', 'admin')
    )
  );

insert into public.social_review_items (
  kind,
  slug,
  title,
  body,
  summary,
  voice,
  channel,
  status,
  source_ref,
  details,
  preferred,
  approved_at
) values
  (
    'profile_copy',
    'studio-primary-x-github',
    'Studio primary',
    'Custom websites, software and AI systems built around your business. Designed to connect, measured to learn and continuously improved.',
    'The rhythmic house bio for X and GitHub.',
    'lyra',
    'x_github',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'live profile', 'location_in_bio', false, 'token_in_bio', false, 'speed_claim', false),
    true,
    now()
  ),
  (
    'profile_copy',
    'studio-primary-instagram',
    'Studio primary for Instagram',
    E'Custom websites, software and AI systems\nbuilt around your business.\nDesigned to connect, measured to learn and continuously improved.',
    'The house bio with natural line breaks.',
    'lyra',
    'instagram',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'live profile', 'line_breaks', true, 'location_in_bio', false, 'token_in_bio', false),
    true,
    now()
  ),
  (
    'profile_copy',
    'studio-primary-telegram',
    'Studio primary for Telegram',
    'Custom websites, software and AI systems built around your business. Designed to connect, measured to learn and continuously improved. Studio releases, field notes and council signals. neonburro.com',
    'The house bio plus the broadcast purpose.',
    'lyra',
    'telegram',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'public broadcast description', 'public_address', 'https://t.me/burroship', 'token_in_bio', false),
    true,
    now()
  ),
  (
    'profile_copy',
    'studio-alt-whole-business',
    'Whole business',
    'Custom websites, software and AI systems for the whole business. Built to connect, measured to learn and continuously improved.',
    'Approved alternate for broader business context.',
    'lyra',
    'cross_platform',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'approved alternate'),
    false,
    now()
  ),
  (
    'profile_copy',
    'studio-alt-minimal-rhythm',
    'Minimal rhythm',
    'Custom websites, software and AI systems built around your business. Connected, measured and continuously improved.',
    'Approved short alternate.',
    'lyra',
    'cross_platform',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'approved alternate'),
    false,
    now()
  ),
  (
    'profile_copy',
    'studio-alt-real-world',
    'Real world',
    'Custom websites, software and AI systems. Built around the whole business, measured in the real world and continuously improved.',
    'Approved alternate with a real-world proof note.',
    'lyra',
    'cross_platform',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'approved alternate'),
    false,
    now()
  ),
  (
    'profile_copy',
    'studio-alt-connected-system',
    'Connected system',
    'Custom websites, software and AI systems that work together. Built around the business, measured in the real world and continuously improved.',
    'Approved alternate that foregrounds connection.',
    'lyra',
    'cross_platform',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'approved alternate'),
    false,
    now()
  ),
  (
    'profile_copy',
    'studio-alt-better-websites',
    'Better websites',
    'Better websites are only the beginning. We custom-build the systems behind the business, measure what happens and keep improving them.',
    'Approved alternate for a website-led context.',
    'lyra',
    'cross_platform',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'approved alternate'),
    false,
    now()
  ),
  (
    'profile_copy',
    'studio-alt-embrace-new',
    'Embrace what is new',
    'We help businesses embrace what is new. Custom websites, software and AI systems designed to connect, measured to learn and continuously improved.',
    'Approved alternate closest to the original studio purpose.',
    'lyra',
    'cross_platform',
    'approved',
    'neonburro/docs/05-brand/social-profiles.md',
    jsonb_build_object('use', 'approved alternate'),
    false,
    now()
  ),
  (
    'content_lane',
    'warbleur-studio-field',
    'Warbleur studio field',
    'Studio decisions, field notes and what just shipped.',
    'The studio voice facing the town.',
    'warbleur',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'ion-research-signal',
    'Ion research signal',
    'Research signals, useful discoveries and what changed his mind.',
    'Verified research and listening notes.',
    'ion',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'cypher-proof-of-repair',
    'Cypher proof of repair',
    'Builds, boundaries, Solana systems and proof of repair.',
    'Technical evidence and verified on-chain work.',
    'cypher',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'lyra-visual-direction',
    'Lyra visual direction',
    'Visual direction, brand systems and the asset shelf.',
    'The creative system and its choices.',
    'lyra',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'volt-quiet-operations',
    'Volt quiet operations',
    'Uptime, operations, automation and quiet fixes.',
    'The system staying alive.',
    'volt',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'aster-measured-growth',
    'Aster measured growth',
    'Campaigns, leads, experiments and measured growth.',
    'What a release changed for the business.',
    'aster',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'skye-motion-field',
    'Skye motion field',
    'Films, locations, camera notes and motion studies.',
    'The source material and how it was seen.',
    'skye',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'pixel-interface-detail',
    'Pixel interface detail',
    'Interface details, interaction patterns and visual QA.',
    'The destination after the social promise.',
    'pixel',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'echo-clean-record',
    'Echo clean record',
    'Payments, asset movement and clean records.',
    'The record without private customer detail.',
    'echo',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'epoch-token-record',
    'Epoch token record',
    'Token record, verified milestones and permanent receipts.',
    'The coin lane with no price promises.',
    'epoch',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'content_lane',
    'tender-open-hand',
    'Tender open hand',
    'Estimates, invoices, settlement and the open hand.',
    'Plain records around money and scope.',
    'tender',
    null,
    'approved',
    'neonburro/docs/06-plans/2026-09-16-social-field-plan.md',
    '{}'::jsonb,
    false,
    now()
  ),
  (
    'service',
    'signal-check',
    'Signal Check',
    'A profile and channel scan with three concrete friction points, one measurable next move and a fit recommendation.',
    'A real public evaluation with no account access required.',
    'aster',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'public evaluation', 'access', 'none', 'support', jsonb_build_array('ion', 'lyra')),
    false,
    null
  ),
  (
    'service',
    'signal-reset',
    'Signal Reset',
    'A fixed sprint for account ownership, profile copy, links, identity, disclosure, campaign naming, baseline metrics and a 30-day release map.',
    'The clean foundation before monthly operation.',
    'lyra',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'fixed sprint', 'access', 'page role and read-only analytics', 'support', jsonb_build_array('aster', 'cypher', 'pixel')),
    false,
    null
  ),
  (
    'service',
    'signal-loop',
    'Signal Loop',
    'A monthly content and community system planned in Pulse with reporting, a growing Field Book and a person approving every release.',
    'The core social subscription.',
    'aster',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'monthly system', 'access', 'content role and read-only analytics', 'support', jsonb_build_array('lyra', 'ion', 'skye', 'pixel', 'volt')),
    false,
    null
  ),
  (
    'service',
    'signal-engine',
    'Signal Engine',
    'A monthly growth operation that connects social listening, experiments, destinations, lead routing, paid support and attribution.',
    'The social system tied to a business result.',
    'aster',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'monthly growth operation', 'access', 'content role, read-only analytics and client-owned ad access', 'support', jsonb_build_array('lyra', 'ion', 'pixel', 'volt', 'cypher')),
    false,
    null
  ),
  (
    'service',
    'founder-voice',
    'Founder Voice',
    'Turns interviews, calls and field notes into credible first-person content.',
    'A focused source-to-voice lane.',
    'lyra',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('ion', 'skye')),
    false,
    null
  ),
  (
    'service',
    'repurposing-room',
    'Repurposing Room',
    'Turns one useful source into clips, carousels, posts, email and site content.',
    'One strong source carried across useful forms.',
    'lyra',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('skye', 'pixel')),
    false,
    null
  ),
  (
    'service',
    'community-desk',
    'Community Desk',
    'Handles comments, inbox triage, escalation and recurring audience questions inside a defined response window.',
    'A bounded human community hand.',
    'warbleur',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('lyra', 'ion')),
    false,
    null
  ),
  (
    'service',
    'launch-room',
    'Launch Room',
    'Carries one product, event or announcement across every relevant channel.',
    'A coordinated release with one approval path.',
    'warbleur',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('lyra', 'aster', 'skye', 'pixel')),
    false,
    null
  ),
  (
    'service',
    'listening-radar',
    'Listening Radar',
    'Tracks brand mentions, customer language, competitors and buying signals.',
    'Research input that stays separate from verified fact.',
    'ion',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('aster')),
    false,
    null
  ),
  (
    'service',
    'paid-campaign-lab',
    'Paid Campaign Lab',
    'Develops creative variants, landing-page continuity and measured tests with client-owned billing.',
    'Small paid experiments after conversion tracking is proven.',
    'aster',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('lyra', 'pixel', 'cypher')),
    false,
    null
  ),
  (
    'service',
    'social-governance',
    'Social Governance',
    'Creates permissions, approval rules, disclosure standards and an offboarding plan.',
    'The client keeps the accounts, history and working system.',
    'cypher',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('lyra', 'warbleur')),
    false,
    null
  ),
  (
    'service',
    'solana-signal-desk',
    'Solana Signal Desk',
    'Supports X and Telegram communication with verified facts, clear token boundaries, public service results and no price promises.',
    'A verified Solana communication lane.',
    'cypher',
    null,
    'review',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('shape', 'focused lane', 'support', jsonb_build_array('epoch', 'aster', 'lyra')),
    false,
    null
  ),
  (
    'tool',
    'pulse',
    'Pulse',
    'The source of truth for releases, approvals, results and the Field Book.',
    'Use now.',
    'aster',
    null,
    'approved',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('adoption', 'now', 'boundary', 'no public release without approval'),
    true,
    now()
  ),
  (
    'tool',
    'supabase',
    'Supabase',
    'Staff-only records, storage and event history beneath Pulse.',
    'Use now.',
    'volt',
    null,
    'approved',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('adoption', 'now', 'boundary', 'no secret or service key in a browser or document'),
    true,
    now()
  ),
  (
    'tool',
    'native-platform-tools',
    'Native platform tools',
    'Account roles, publishing and first-party channel insight.',
    'Use now.',
    'lyra',
    null,
    'approved',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('adoption', 'now', 'boundary', 'client owns every account and billing method'),
    true,
    now()
  ),
  (
    'tool',
    'google-analytics',
    'Google Analytics',
    'Campaign and site attribution with one enforced UTM vocabulary.',
    'Use now where the client has it.',
    'aster',
    null,
    'approved',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('adoption', 'now', 'boundary', 'read-only access where possible'),
    true,
    now()
  ),
  (
    'tool',
    'search-console',
    'Search Console',
    'Queries, clicks and search visibility around the social destination.',
    'Use now where the client has it.',
    'aster',
    null,
    'approved',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('adoption', 'now', 'boundary', 'read-only access where possible'),
    true,
    now()
  ),
  (
    'tool',
    'runway-image-generation',
    'Runway and image generation',
    'Original campaign imagery and motion studies.',
    'Use now with human visual review.',
    'lyra',
    null,
    'approved',
    'neonburro/docs/05-brand/social-services.md',
    jsonb_build_object('adoption', 'now', 'boundary', 'human visual review before release'),
    true,
    now()
  ),
  (
    'tool',
    'buffer-team',
    'Buffer Team',
    'A possible approval and publishing layer when several client channels need one queue.',
    'Candidate after native publishing becomes the bottleneck.',
    'volt',
    null,
    'review',
    'https://buffer.com/pricing',
    jsonb_build_object('adoption', 'later', 'gate', 'several paying client channels', 'pulse_remains_source', true),
    false,
    null
  ),
  (
    'tool',
    'metricool-advanced',
    'Metricool Advanced',
    'A possible multi-client reporting and comparison layer.',
    'Candidate when reporting volume becomes the bottleneck.',
    'aster',
    null,
    'review',
    'https://help.metricool.com/plans-add-ons-and-api-access-explained-xux1u',
    jsonb_build_object('adoption', 'later', 'gate', 'multi-client reporting load', 'pulse_remains_source', true),
    false,
    null
  ),
  (
    'tool',
    'posthog',
    'PostHog',
    'Funnels, session replay and product behavior when a client needs product analytics.',
    'Candidate by client need.',
    'aster',
    null,
    'review',
    'https://posthog.com/pricing',
    jsonb_build_object('adoption', 'later', 'gate', 'named product behavior question'),
    false,
    null
  ),
  (
    'tool',
    'plausible',
    'Plausible',
    'A simpler privacy-first traffic view when that is the client need.',
    'Candidate by client need.',
    'aster',
    null,
    'review',
    'https://plausible.io/',
    jsonb_build_object('adoption', 'later', 'gate', 'simple privacy-first reporting request'),
    false,
    null
  ),
  (
    'tool',
    'descript',
    'Descript',
    'Transcript-led editing and caption work when source-media volume grows.',
    'Candidate by production volume.',
    'skye',
    null,
    'review',
    'https://www.descript.com/pricing',
    jsonb_build_object('adoption', 'later', 'gate', 'frequent transcript-led production'),
    false,
    null
  ),
  (
    'tool',
    'brand24',
    'Brand24',
    'Broader mention monitoring for a paying client with a defined listening need.',
    'Candidate only with a supporting contract.',
    'ion',
    null,
    'review',
    'https://brand24.com/prices/',
    jsonb_build_object('adoption', 'later', 'gate', 'paying broad-listening client'),
    false,
    null
  ),
  (
    'tool',
    'make',
    'Make',
    'An unusual client connector before custom engineering is justified.',
    'Candidate for bounded integrations.',
    'volt',
    null,
    'review',
    'https://www.make.com/en/pricing',
    jsonb_build_object('adoption', 'later', 'gate', 'bounded connector with clear owner', 'first_party_preferred', true),
    false,
    null
  )
on conflict (kind, slug) do update set
  title = excluded.title,
  body = excluded.body,
  summary = excluded.summary,
  voice = excluded.voice,
  channel = excluded.channel,
  status = excluded.status,
  source_ref = excluded.source_ref,
  details = excluded.details,
  preferred = excluded.preferred,
  approved_at = excluded.approved_at,
  updated_at = now();
