// src/lib/studioTools.js
// SENTINEL: NB_PULSE_STUDIO_TOOLS_V1
//
// The services the studio runs on, one list, read by two hands. The Tools
// pane in Settings draws a row for each, and netlify/functions/
// studio-tools.js reads the same list to know which variable names to look
// for. One list so the page can never ask about a name the function does
// not check. Tyler, 2026-10-05: "Add some shit in there for tools that we
// could use for all kinds of stuff", after showing the Claude desktop
// connectors and skills panes.
//
// ── PURE DATA, ON PURPOSE ───────────────────────────────────────────────────
// The function imports this file, so it imports nothing. No supabase
// client, no icons, no import.meta. A browser only import here would break
// the function bundle the first time it loads. The icons live in the pane,
// keyed by tool key.
//
// ── STATUS IS REAL OR ABSENT ────────────────────────────────────────────────
// A row says only what Pulse can know from where it stands.
//   home pulse    Pulse holds the key. The function reports whether each
//                 name is set, a boolean and never a value, and Check runs
//                 one free read against the service with that key, the
//                 same reads the studio's keys-check.js makes. Until the
//                 function answers, the row says nothing.
//   home studio   the key lives on the studio site, neonburro.com. A
//                 function can only read its own site's variables, so
//                 Pulse cannot see it and the row names where it lives
//                 instead of a status. The names are listed so somebody
//                 knows what to look for on that site.
//   home desk     the studio Mac. Pulse runs in a browser and cannot see
//                 that machine at all.
//   home dashboard  no key anywhere in code, the work happens in the
//                 service's own dashboard.
// Never add a status Pulse cannot check. A green word that is a guess is
// worse than no word, because the day it is wrong nobody looks.
//
// ── ENV NAMES ───────────────────────────────────────────────────────────────
// Read off the code on 2026-10-05, process.env in netlify/functions for
// Pulse and in the studio's own functions folder for the rest. need is
//   required  the work stops without it
//   either    one of the either names is enough, Supabase takes the service
//             role key or the newer secret key
//   optional  the work falls back to something without it, the note says
//             what
// VITE_ names are not here. They are build scope, invisible to a function
// at run time, so a check would always say missing and always be wrong.
//
// ── DISCOVER ────────────────────────────────────────────────────────────────
// Tools the studio has picked or is weighing, none used by any code in
// either repo on 2026-10-05. Each says when and where it was decided. Move
// a tool into TOOLS the day code uses it, with its env names.
//
// No oxford commas, no em dashes.

export const HOME = {
  pulse: 'Pulse holds the key',
  studio: 'studio site',
  desk: 'studio Mac',
  dashboard: 'dashboard',
};

export const TOOLS = [
  {
    key: 'supabase',
    name: 'Supabase',
    line: 'The database and the sign in under Pulse, the studio and the shop',
    more: 'One project for all three. Every table Pulse reads lives here and every person who signs in, studio or client, is a row in profiles.',
    home: 'pulse',
    status: 'supabase',
    env: [
      { name: 'SUPABASE_URL', need: 'required' },
      { name: 'SUPABASE_SERVICE_ROLE_KEY', need: 'either' },
      { name: 'SUPABASE_SECRET_KEY', need: 'either', note: 'the newer key, the payment webhook and the social hand take either' },
    ],
    links: [{ href: 'https://supabase.com/dashboard/project/sspbripimqvfdkfbpubq', label: 'Supabase dashboard' }],
  },
  {
    key: 'netlify',
    name: 'Netlify',
    line: 'Builds and serves Pulse and runs its functions, the scheduled ones too',
    more: 'Every push to main is a production deploy and spends credits, so pushes are batched and only Warbleur pushes. The trademark list lives in Netlify Blobs on this site.',
    home: 'pulse',
    status: 'build',
    env: [
      { name: 'NETLIFY_PAT', need: 'optional', note: 'lists and connects client sites, those pages stop without it' },
      { name: 'BUILD_HOOK_URL', need: 'optional', note: 'wakes a studio build when a blog post publishes, which is a deploy' },
    ],
    links: [{ href: 'https://app.netlify.com/sites/neonburro-pulse/overview', label: 'Netlify project' }],
  },
  {
    key: 'stripe',
    name: 'Stripe',
    line: 'Cards, wallets and Link on invoices, and the webhook that marks them paid',
    more: 'Check reads the balance endpoint, which moves nothing, and keeps only whether Stripe answered and whether the key is live or test.',
    home: 'pulse',
    probe: true,
    env: [
      { name: 'STRIPE_SECRET_KEY', need: 'required' },
      { name: 'STRIPE_WEBHOOK_SECRET', need: 'required', note: 'without it a paid invoice never flips to paid' },
    ],
    links: [{ href: 'https://dashboard.stripe.com/', label: 'Stripe dashboard' }],
  },
  {
    key: 'resend',
    name: 'Resend',
    line: 'Every letter Pulse sends, invoices, invites, reports and the notices to the studio inbox',
    more: 'Sends as hello@neonburro.com. A key limited to sending answers Check as send only, which is all Pulse asks of it.',
    home: 'pulse',
    probe: true,
    env: [
      { name: 'RESEND_API_KEY', need: 'required' },
      { name: 'NOTIFICATION_EMAIL', need: 'optional', note: 'where asks, appointments and reports land, hello@neonburro.com when unset' },
    ],
    links: [{ href: 'https://resend.com/emails', label: 'Resend dashboard' }],
  },
  {
    key: 'anthropic',
    name: 'Claude',
    line: 'Volt\'s desk, and the drafts for invoices, releases and blog socials',
    more: 'The Anthropic API, called by volt-chat, draft-invoice, draft-release and publish-blog-post. Check lists the models, which costs nothing.',
    home: 'pulse',
    probe: true,
    env: [{ name: 'ANTHROPIC_API_KEY', need: 'required' }],
    links: [{ href: 'https://platform.claude.com/', label: 'Claude Console' }],
  },
  {
    key: 'deepgram',
    name: 'Deepgram',
    line: 'The mic on Volt\'s desk, speech into the input',
    more: 'Nova 3, called by transcribe. Check lists the projects, which costs nothing.',
    home: 'pulse',
    probe: true,
    env: [{ name: 'DEEPGRAM_API_KEY', need: 'required' }],
    links: [{ href: 'https://console.deepgram.com/', label: 'Deepgram console' }],
  },
  {
    key: 'meta',
    name: 'Meta',
    line: 'Facebook and Instagram posts from the Socials desk, every five minutes',
    more: 'release-meta runs on a schedule and stays dark until the token is set. Each account row names its own token variable, META_PAGE_ACCESS_TOKEN is the one the plan sets. The page and account ids can also come from the rows on Socials.',
    home: 'pulse',
    env: [
      { name: 'META_PAGE_ACCESS_TOKEN', need: 'required' },
      { name: 'META_PAGE_ID', need: 'optional', note: 'or the facebook row on Socials' },
      { name: 'META_IG_USER_ID', need: 'optional', note: 'or the instagram row on Socials' },
    ],
    links: [{ href: 'https://business.facebook.com/', label: 'Meta Business' }],
  },
  {
    key: 'solana',
    name: 'Solana RPC',
    line: 'Reads the studio\'s wallet balances for Registry, Wallets, Payouts and NEONBURRO',
    more: 'With SOLANA_RPC_URL set Pulse reads through that keyed endpoint. Without it, the public mainnet endpoint, which rate limits.',
    home: 'pulse',
    status: 'rpc',
    probe: true,
    env: [{ name: 'SOLANA_RPC_URL', need: 'optional', note: 'the public endpoint when unset' }],
    links: [],
  },
  {
    key: 'trademarks',
    name: 'Trademark watch',
    line: 'The USPTO register, read for every word the studio might file',
    more: 'Our own function, trademark-watch, with the list kept in Netlify Blobs and never in this public repo. Filings are by The Burroship LLC, directly with the USPTO.',
    home: 'pulse',
    status: 'watch',
    env: [],
    internal: { path: '/trademarks/', label: 'Open the watch' },
    links: [{ href: 'https://tmsearch.uspto.gov/', label: 'USPTO search' }],
  },
  {
    key: 'elevenlabs',
    name: 'ElevenLabs',
    line: 'The voices in the studio\'s voice room, the phone and the voice agents',
    more: 'Read by the voice functions on the studio site. The studio\'s nightly keys report checks this key.',
    home: 'studio',
    siteEnv: ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_IDS'],
    links: [{ href: 'https://elevenlabs.io/app/home', label: 'ElevenLabs' }],
  },
  {
    key: 'twilio',
    name: 'Twilio',
    line: 'The studio phone number, calls and voicemail into the voice room',
    more: 'One number points at the voice functions on the studio site.',
    home: 'studio',
    siteEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_NUMBER'],
    links: [{ href: 'https://console.twilio.com/', label: 'Twilio console' }],
  },
  {
    key: 'telegram',
    name: 'Telegram',
    line: 'The burros\' bots and the releases they post',
    more: 'One bot token per burro on the studio site, and the release hand that posts from the Socials desk lives there too. The nightly keys report checks every bot.',
    home: 'studio',
    siteEnv: ['TELEGRAM_BOT_TOKEN_<BURRO>'],
    links: [{ href: 'https://t.me/BotFather', label: 'BotFather' }],
  },
  {
    key: 'google',
    name: 'Google',
    line: 'Workspace mail for hello@ and the aliases, and the Places key behind the paid reads',
    more: 'Every studio notice Pulse sends lands in Workspace mail. The Places key is read by the reads on the studio site, the Review Read, the Town Read and the Weight Check.',
    home: 'studio',
    siteEnv: ['GOOGLE_PLACES_KEY'],
    links: [
      { href: 'https://admin.google.com/', label: 'Google Admin' },
      { href: 'https://console.cloud.google.com/', label: 'Cloud console' },
    ],
  },
  {
    key: 'cloudflare',
    name: 'Cloudflare',
    line: 'DNS for the studio domains already moved off GoDaddy',
    more: 'No key in any code. Records are changed in the dashboard by hand.',
    home: 'dashboard',
    links: [{ href: 'https://dash.cloudflare.com/', label: 'Cloudflare dashboard' }],
  },
  {
    key: 'github',
    name: 'GitHub',
    line: 'Every repo, under neonburro. Pulse is public, so nothing secret is ever committed',
    more: 'Netlify builds from main, so the commit behind this build is the one serving.',
    home: 'dashboard',
    links: [{ href: 'https://github.com/neonburro/neonburro-pulse', label: 'neonburro-pulse' }],
  },
  {
    key: 'local',
    name: 'The local model',
    line: 'Models meant for the studio Mac, for work that should never be billed per call',
    more: 'Java\'s crawler first, then transcription and embeddings over everything written. Pulse runs in a browser and cannot see that machine, so there is no status here.',
    home: 'desk',
    links: [],
  },
];

export const DISCOVER = [
  {
    key: 'cartesia',
    name: 'Cartesia',
    line: 'The house voice, the honest fallback when a burro is resting',
    state: 'picked, unused',
    more: 'Picked in the body plan on 2026-09-12 for all three languages. The studio\'s keys check probes CARTESIA_API_KEY and no function uses it yet.',
    links: [{ href: 'https://play.cartesia.ai/', label: 'Cartesia' }],
  },
  {
    key: 'fal',
    name: 'fal',
    line: 'Faces and short loops, FLUX.2 for a frame and LTX or Wan for motion',
    state: 'picked, unused',
    more: 'Picked in the body plan on 2026-09-12. The studio\'s keys check probes FAL_KEY and no function uses it yet.',
    links: [{ href: 'https://fal.ai/dashboard', label: 'fal dashboard' }],
  },
  {
    key: 'x',
    name: 'X',
    line: 'Posting from the Socials desk, links in a reply rather than the post',
    state: 'first in line',
    more: 'First in the social wiring order set in the hangar plan on 2026-09-15. There is no free tier, every post is paid.',
    links: [{ href: 'https://developer.x.com/', label: 'X developer' }],
  },
  {
    key: 'bluesky',
    name: 'Bluesky',
    line: 'A free feed of the thirteen, posted without a per post fee',
    state: 'an idea',
    more: 'Noted in the body plan on 2026-09-12 as free to post and free to run a feed. Nothing decided.',
    links: [{ href: 'https://bsky.app/', label: 'Bluesky' }],
  },
];

// The states a check can come back with. Tone names a paper colour, the
// pane maps it. say is the sentence under the row when it is open.
export const STATE = {
  answering: { label: 'answering', tone: 'green', say: 'Answered a read just now with the key the site holds' },
  'send-only': { label: 'send only', tone: 'green', say: 'The key is accepted and limited to sending, which is all Pulse asks of it' },
  limited: { label: 'limited key', tone: 'gold', say: 'The key is accepted, and this read is outside what it may do' },
  refused: { label: 'refused', tone: 'coral', say: 'The service did not accept the key' },
  'no-credit': { label: 'out of credit', tone: 'coral', say: 'The key is accepted and the account has no credit left' },
  busy: { label: 'busy', tone: 'gold', say: 'The service asked for a pause, check again in a minute' },
  'no-answer': { label: 'no answer', tone: 'gold', say: 'Nothing came back in time, or the service answered with an error of its own' },
  'no-key': { label: 'no key', tone: 'coral', say: 'A required variable is not set on the Pulse site' },
  set: { label: 'key set', tone: 'inkSec', say: 'Set on the Pulse site. Check reads the service to see whether it answers' },
};

// Every name the function looks for. Pulse held tools only.
export const envNames = () => [...new Set(
  TOOLS.filter((t) => t.home === 'pulse').flatMap((t) => (t.env || []).map((e) => e.name)),
)];

// What the variables alone can say about a tool, before any check. null
// until the function has answered, so the row stays quiet instead of
// guessing.
export const presenceOf = (tool, envMap) => {
  if (!envMap || tool.home !== 'pulse' || !tool.env?.length) return null;
  const required = tool.env.filter((e) => e.need === 'required');
  const either = tool.env.filter((e) => e.need === 'either');
  if (required.some((e) => !envMap[e.name])) return 'no-key';
  if (either.length && !either.some((e) => envMap[e.name])) return 'no-key';
  if (!required.length && !either.length) return null;
  return 'set';
};

// The answer to one free read, by status code. Shared with the function
// so the mapping is written once. body is the vendor's JSON when it sent
// some, read for one field only, Resend's error name.
//   Resend answers a send only key with 401 restricted_api_key, documented
//   on its errors page and read 2026-10-05, and 403 for a suspended key.
//   Anthropic answers 402 billing_error when the account is out of credit.
export const stateFor = (key, status, body = null) => {
  if (status >= 200 && status < 300) return 'answering';
  if (key === 'resend' && status === 401 && body?.name === 'restricted_api_key') return 'send-only';
  if (key === 'resend' && status === 403) return 'refused';
  if (status === 401) return 'refused';
  if (status === 402) return 'no-credit';
  if (status === 403) return 'limited';
  if (status === 429) return 'busy';
  return 'no-answer';
};

export default TOOLS;
