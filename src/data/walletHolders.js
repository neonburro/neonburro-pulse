// src/data/walletHolders.js
// SENTINEL: NB_WALLET_HOLDERS_V1
//
// Who can hold a wallet on the public map, in the order the room lists them.
//
// ── WHERE THESE NAMES COME FROM ─────────────────────────────────────────────
// The nine council are read from src/lib/personas.js and are NOT restated
// here. That file already carries the roster and the avatar urls and it is
// the same nine, so restating them is the drift that put the wrong roles in
// LiveField on the studio side. Add a council burro there, not here.
//
// The four extra holders are named here because Pulse has no copy of the
// studio's registries and cannot import across repos. Tender is a string
// member, Epoch is a steward, Kolache and Chime are voice agents, so they sit
// in four different files over there and in none of them here. The studio's
// src/data/everyone.js resolves all four by slug, which is what the public
// wallet band uses to print a name and a face, so the slugs below have to
// match that file exactly. They were checked against it on 2026-09-26.
//
// ── THE HOLDER KEY IS THE burro COLUMN ──────────────────────────────────────
// key is what lands in public.token_wallets.burro. For a burro or an agent it
// is the slug and the export writes it straight into wallets.js. For a
// treasury holder it is a name the public file never sees, because four
// treasury wallets are four separate holders and grouping them under one
// empty burro would lose which is which. The export reads kind and writes
// burro null for treasury. See supabase/migrations/20260926001122_token_
// wallets_public_map.sql for the same note on the table side.
//
// ── KINDS ───────────────────────────────────────────────────────────────────
//   burro      one of the yard, carries a face
//   agent      a voice agent, carries a face, is not on the council
//   treasury   a wallet the studio holds and nobody fronts, no face
//
// A BURRO IS NEVER NAMED WITHOUT A FACE, so every burro and every agent here
// carries an avatar url and the room draws it beside the name. A treasury
// holder is not a burro and deliberately has no face, it gets its initial on
// a plain disc instead.
//
// The avatars are served from neonburro.com, the same host personas.js reads,
// because Pulse does not carry copies of the portraits and should not.
//
// No oxford commas, no em dashes.

import { PERSONAS } from '../lib/personas';

const CDN = 'https://neonburro.com/burros';

const avatarFor = (slug) => `${CDN}/${slug}/${slug}-avatar.webp`;

// The nine, straight off the messaging roster. lane becomes the line under
// the name in the room.
const COUNCIL = PERSONAS.map((p) => ({
  key: p.id,
  name: p.name,
  kind: 'burro',
  avatar: p.avatar,
  line: p.lane,
}));

// The four Tyler named on 2026-09-26. Slugs verified against the studio's
// src/data/everyone.js, which is what prints the name on the public band.
const NAMED = [
  {
    key: 'tender',
    name: 'Tender',
    kind: 'burro',
    avatar: avatarFor('tender'),
    line: 'Settlement, the one that moves and the one that sits',
  },
  {
    key: 'epoch',
    name: 'Epoch',
    kind: 'burro',
    avatar: avatarFor('epoch'),
    line: 'The steward, the record and the long view',
  },
  {
    key: 'kolache',
    name: 'Kolache',
    kind: 'agent',
    avatar: avatarFor('kolache'),
    line: 'The Counter, a voice agent and not on the council',
  },
  {
    key: 'chime',
    name: 'Chime',
    kind: 'agent',
    avatar: avatarFor('chime'),
    line: 'The Front Desk, a voice agent and not on the council',
  },
];

// The vaults. No face, on purpose. thefurnace is written lowercase one word
// the way neonburro and theburroship are, and it is the only holder whose
// wallet may carry the burn flag.
//
// Origin is here and it was not in the ask, which listed the Reserve, the
// Open Hand, the LP and thefurnace. It has to be, because Origin is the first
// entry on the published map and a holder the room does not carry is a row
// the export cannot emit, which would make every export read as take the
// creator wallet off the page. It fits the definition anyway, a wallet the
// studio holds that nobody fronts. It is listed first for the same reason the
// public file lists it first, which is that a map that buries its origin is
// arranged to mislead.
const TREASURY = [
  {
    key: 'origin',
    name: 'Origin',
    kind: 'treasury',
    avatar: null,
    line: 'The wallet the mint was created from, named as creator on the mint itself',
  },
  {
    key: 'reserve',
    name: 'the Reserve',
    kind: 'treasury',
    avatar: null,
    line: 'theburroship, holds and moves by announcement',
  },
  {
    key: 'openhand',
    name: 'the Open Hand',
    kind: 'treasury',
    avatar: null,
    line: 'Pays the people who show up, only ever sends outward',
  },
  {
    key: 'lp',
    name: 'the LP',
    kind: 'treasury',
    avatar: null,
    line: 'Liquidity, paired with SOL in the pool',
  },
  {
    key: 'thefurnace',
    name: 'thefurnace',
    kind: 'treasury',
    avatar: null,
    line: 'The published burn intake, the one wallet that may carry burn',
  },
];

export const HOLDERS = [...COUNCIL, ...NAMED, ...TREASURY];

export const HOLDER_BY_KEY = Object.fromEntries(HOLDERS.map((h) => [h.key, h]));

// A row whose burro key is not in the list above still has to render, because
// the Registry writes that column too and somebody may have typed anything
// into it. It lands in one unclaimed block at the bottom rather than
// disappearing, and the room says so. Silently dropping a row is how a map
// gets a hole in it.
export const UNCLAIMED = {
  key: '',
  name: 'Nobody named',
  kind: 'treasury',
  avatar: null,
  line: 'Rows in the book with no holder written against them',
};

export default HOLDERS;
