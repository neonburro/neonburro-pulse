// src/lib/mailDocument.js
// SENTINEL: NB_PULSE_MAIL_DOCUMENT_V2
//
// The shape of a letter in the Mail room, and every rule about it that the
// browser and the server must agree on. Pure javascript, no imports, no
// React, no Node. It is read by these files and they must never carry their
// own copy of anything in here.
//
//   src/lib/mailRender.js              the one renderer, html and text
//   src/lib/mailPropose.js             the insertion point for proposals
//   netlify/functions/mail-send.js     the door that sends, checks again
//   netlify/functions/mail-digest.js   the one quiet digest a day
//   netlify/functions/item-answer.js   the public approve or deny door
//   src/pages/Mail/                    the room, the editor, the client parts
//   scripts/mail-render.mjs            renders a document to a file by hand
//
// ── WHY A STRUCTURED DOCUMENT AND NOT AN HTML BOX ───────────────────────────
// Tyler, 2026-10-05, after the Greenville September letter went out of a
// Gmail draft. He wanted the same letter sent from Pulse, styled like that,
// with the words editable. A letter is therefore fields, to, cc, subject,
// preheader, an opening, one hero card, sections, up to four link cards, a
// signature and a theme, and the html is always drawn from them. Nobody
// edits html. That is what lets a client's colours swap in one click and
// what keeps a pasted Gmail redirect out of a sent link.
//
// ── KINDS, STATUS AND WHO APPROVES ──────────────────────────────────────────
// The same afternoon the room grew into system updates. kind is a column on
// mail_documents, not part of the doc, because the queue and the client
// page filter on it. A letter Tyler writes himself has origin hand and his
// send is the approval. Anything the system drafts has another origin, is
// written as proposed, and the door refuses to send it until a person has
// approved it, rowProblems below. A dismissed one never goes. Nothing in
// this room goes out on a machine's signature, and nothing here sends on
// its own yet. Later automatic sends would read approved rows.
//
// ── SECTIONS ────────────────────────────────────────────────────────────────
// Blocks between the hero and the link cards, each on its own light card.
// text, list, table, checklist and work_done are content held in the doc.
// open_items holds nothing, the renderer fills it from the client's open
// items handed in as context, so a periodic report always carries every
// item still waiting with its age, so the list visibly stacks up.
//
// ── AGES ARE COUNTED TO asOf, NEVER TO NOW ──────────────────────────────────
// doc.asOf is the date the letter speaks for. Ages ("open since 3 Oct, 2
// weeks") count to it and not to the clock, because the renderer must give
// the same bytes in the browser and in the door, and a test of yesterday
// must still match a send of today. Change asOf and it is a new version.
//
// ── THE WHOLE DOCUMENT IS WRITTEN EVERY TIME ────────────────────────────────
// mail_documents.doc is jsonb and the editor writes the whole normalized
// document on every save, never a partial. Replacing is the intended
// meaning here. The house was bitten in September by a PATCH on a jsonb
// column that replaced when somebody expected a merge, so this is said out
// loud. If you ever add a partial writer, merge in javascript first.
//
// ── THE THEME IS FOUR COLOURS, THE PALETTE IS FIFTEEN ───────────────────────
// A person picks ground, card, accent and ink. resolvePalette turns those
// into every tone the renderer paints. A preset carries its tones exactly,
// measured off the letter it came from, so Greenville renders to the hex
// the Gmail draft used. Change any one of the four and the tones are derived
// by mixing instead, which is close and never identical.
//
// ── THE TEST ADDRESS IS A CONSTANT ──────────────────────────────────────────
// TEST_TO is fixed here and read by the door. The browser never says where a
// test goes, so a test can never reach a client no matter what is typed.
//
// No oxford commas, no em dashes.

export const MAIL_VERSION = 2;
export const MAX_CARDS = 4;
export const MAX_SECTIONS = 8;
export const MAX_ROWS = 24;

// Where every test goes and nowhere else. Tyler, 2026-10-05, "send a test to
// me goes to tyler@neonburro.com first". mail-send.js reads this.
export const TEST_TO = 'tyler@neonburro.com';

// The public answer page for an open item lives on Pulse. item-answer.js
// and src/pages/Answer/index.jsx are the two halves of it.
// An item answers approve or deny, or, when it carries choices, one of its
// choices by number. The how often question is the reason choices exist,
// weekly, every two weeks or monthly is not a yes or a no.
export const PULSE_ORIGIN = 'https://pulse.neonburro.com';
export const answerLink = (token, answer) => {
  const base = `${PULSE_ORIGIN}/answer/${token}/`;
  if (answer === 'approve' || answer === 'deny') return `${base}?a=${answer}`;
  if (Number.isInteger(answer)) return `${base}?c=${answer}`;
  return base;
};

// Who a letter can be from. The door maps the key to the from line and
// refuses any other key, so a from address cannot be typed into a request.
// Both live on neonburro.com, the domain the invoice path has sent from
// since June, see docs/mail/README.md.
export const SENDERS = {
  tyler: { key: 'tyler', name: 'Tyler Reagan', address: 'tyler@neonburro.com', replyTo: 'tyler@neonburro.com' },
  hello: { key: 'hello', name: 'neonburro', address: 'hello@neonburro.com', replyTo: 'hello@neonburro.com' },
};

export const senderOf = (key) => SENDERS[key] || SENDERS.tyler;
export const fromLine = (key) => {
  const s = senderOf(key);
  return `${s.name} <${s.address}>`;
};

// ── the vocabularies, each mirrored by a check constraint ───────────────────
// supabase/migrations/20261005130000_mail_updates_and_open_items.sql holds
// the same lists as check constraints. Change one and change the other.

export const KINDS = {
  letter: { key: 'letter', label: 'Letter' },
  system_update: { key: 'system_update', label: 'System update' },
  security_check: { key: 'security_check', label: 'Security check' },
  progress: { key: 'progress', label: 'Progress update' },
  deploy_digest: { key: 'deploy_digest', label: 'Deploy digest' },
  periodic_report: { key: 'periodic_report', label: 'System report' },
};
export const kindLabel = (k) => (KINDS[k] || KINDS.letter).label;

export const STATUSES = ['draft', 'proposed', 'approved', 'sent', 'dismissed'];

export const CADENCES = {
  off: { key: 'off', label: 'Off', days: null },
  weekly: { key: 'weekly', label: 'Weekly', days: 7 },
  biweekly: { key: 'biweekly', label: 'Every two weeks', days: 14 },
  monthly: { key: 'monthly', label: 'Monthly', days: 30 },
};

export const ITEM_KINDS = {
  decision: { key: 'decision', label: 'decision' },
  access: { key: 'access', label: 'access' },
  payment: { key: 'payment', label: 'payment' },
  security: { key: 'security', label: 'security' },
  other: { key: 'other', label: 'other' },
};

export const SECTION_TYPES = {
  text: { key: 'text', label: 'A paragraph' },
  list: { key: 'list', label: 'A list of changes' },
  table: { key: 'table', label: 'A small table' },
  checklist: { key: 'checklist', label: 'A checklist' },
  open_items: { key: 'open_items', label: 'Open items, filled in for you' },
  work_done: { key: 'work_done', label: 'Work done, with dates' },
};

export const CHECK_STATES = {
  pass: { key: 'pass', label: 'pass' },
  attention: { key: 'attention', label: 'attention' },
  info: { key: 'info', label: 'note' },
};

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── dates without a clock or a locale ───────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Today in Ridgway as YYYY-MM-DD. Only used to fill asOf on a new document,
// never by the renderer.
export const todayInRidgway = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts;
};

const dayNumber = (iso) => {
  const d = String(iso || '').slice(0, 10);
  if (!DATE_RE.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86400000);
};

// "3 Oct", the short date the open items and the work done print.
export const shortDate = (iso) => {
  const d = String(iso || '').slice(0, 10);
  if (!DATE_RE.test(d)) return '';
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]}`;
};

// "today", "4 days", "2 weeks", "6 months". Counted to asOf.
export const ageLabel = (openedIso, asOfIso) => {
  const a = dayNumber(openedIso);
  const b = dayNumber(asOfIso);
  if (a === null || b === null) return '';
  const days = Math.max(0, b - a);
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
};

export const ageDays = (openedIso, asOfIso) => {
  const a = dayNumber(openedIso);
  const b = dayNumber(asOfIso);
  return a === null || b === null ? 0 : Math.max(0, b - a);
};

// ── colour arithmetic ───────────────────────────────────────────────────────

const toRgb = (hex) => {
  const h = String(hex || '').replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
};

const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

// t of 0 is a, t of 1 is b.
export const mix = (a, b, t) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex) => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// ── the presets ─────────────────────────────────────────────────────────────
//
// neonburro is the Pulse paper, read off src/theme/colors.js, paper and
// chrome. The ground is paper.sheet, the card is the one dark (paper.ink and
// chrome.ground), the accent is Topo Lime with limeInk on it, the card text
// is chrome.text and never white. If those values move in colors.js, move
// them here in the same commit.
//
// greenville is measured off the Gmail draft "Greenville Transformer,
// September" of 2026-10-05, the letter this room was built to send. Navy
// #000249 and red #DD1717 are the client's own, from their brand guide.
//
// matches is tested against a client's company or name when one is picked
// in the editor, so choosing that client puts the letter in their colours.
// warn is the colour an attention mark and an aging item print in, a quiet
// amber in both, never the accent, because Greenville's accent is red and a
// red mark reads as an alarm.

export const PRESETS = {
  neonburro: {
    key: 'neonburro',
    label: 'neonburro',
    base: { ground: '#F4EEE2', card: '#241A16', accent: '#C5D957', ink: '#241A16' },
    tones: {
      ground: '#F4EEE2',
      ink: '#241A16',
      card: '#241A16',
      accent: '#C5D957',
      onAccent: '#3A4319',
      cardKicker: '#A2937F',
      cardHead: '#EFE7DA',
      cardLede: '#D3C8B7',
      cardLine: '#BCAF9C',
      muted: '#6B5245',
      sheet: '#FBF9F4',
      sheetEdge: '#E4DBCB',
      link: '#241A16',
      faint: '#9A8574',
      period: '#6E7A30',
      good: '#5E7A1E',
      warn: '#9A6A00',
    },
  },
  greenville: {
    key: 'greenville',
    label: 'Greenville Transformer',
    matches: /greenville transformer/i,
    base: { ground: '#F6F7FB', card: '#000249', accent: '#DD1717', ink: '#14161F' },
    tones: {
      ground: '#F6F7FB',
      ink: '#14161F',
      card: '#000249',
      accent: '#DD1717',
      onAccent: '#FFFFFF',
      cardKicker: '#8D92B7',
      cardHead: '#FFFFFF',
      cardLede: '#C6C9DE',
      cardLine: '#A9ADCB',
      muted: '#5C6179',
      sheet: '#FFFFFF',
      sheetEdge: '#E2E5EF',
      link: '#000249',
      faint: '#9AA0B5',
      period: '#7C8C1C',
      good: '#2F6B3A',
      warn: '#9A6A00',
    },
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export const presetForClient = (client) => {
  const name = `${client?.company || ''} ${client?.name || ''}`;
  return PRESET_LIST.find((p) => p.matches && p.matches.test(name)) || null;
};

export const THEME_KEYS = ['ground', 'card', 'accent', 'ink'];

// A theme with every colour a real six digit hex. Anything that is not falls
// back to the preset it claims, or to neonburro, so a half typed hex in the
// editor never paints a broken style attribute into somebody's inbox.
export const cleanTheme = (theme = {}) => {
  const preset = PRESETS[theme.preset] || PRESETS.neonburro;
  const out = { preset: preset.key };
  THEME_KEYS.forEach((k) => {
    const v = String(theme[k] || '').trim();
    out[k] = HEX_RE.test(v) ? v.toUpperCase() : preset.base[k];
  });
  return out;
};

export const themeMatchesPreset = (theme) => {
  const t = cleanTheme(theme);
  const preset = PRESETS[t.preset];
  return !!preset && THEME_KEYS.every((k) => preset.base[k].toUpperCase() === t[k]);
};

export const themeLabel = (theme) => (themeMatchesPreset(theme) ? PRESETS[cleanTheme(theme).preset].label : 'custom colours');

const derive = ({ ground, card, accent, ink }) => {
  const darkCard = luminance(card) < 0.3;
  const cardHead = darkCard ? '#FFFFFF' : ink;
  return {
    ground,
    ink,
    card,
    accent,
    onAccent: contrast('#FFFFFF', accent) >= contrast(ink, accent) ? '#FFFFFF' : ink,
    cardKicker: mix(card, cardHead, 0.56),
    cardHead,
    cardLede: mix(card, cardHead, 0.78),
    cardLine: mix(card, cardHead, 0.66),
    muted: mix(ink, ground, 0.4),
    sheet: mix(ground, '#FFFFFF', 0.7),
    sheetEdge: mix(ground, ink, 0.08),
    link: darkCard ? card : ink,
    faint: mix(ink, ground, 0.6),
    period: '#7C8C1C',
    good: '#2F6B3A',
    warn: '#9A6A00',
  };
};

export const resolvePalette = (theme) => {
  const t = cleanTheme(theme);
  if (themeMatchesPreset(t)) return { ...PRESETS[t.preset].tones };
  return derive(t);
};

// ── links and phones ────────────────────────────────────────────────────────

// The path printed under a link card, the address without its scheme or its
// trailing slash. Derived and never typed, so it cannot disagree with the
// href it sits under.
export const pathOf = (url) => String(url || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

// tel: wants E.164. Ten digits are a US number, eleven starting 1 already
// carry the country. Anything else is not a number this studio can dial and
// the check below says so instead of shipping a dead link.
export const telOf = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return null;
};

// A link copied out of a received mail is often a redirect, Gmail's
// google.com/url, Outlook safe links, a filter's urldefense. The Greenville
// draft of 2026-10-04 carried six of them. They are refused at send and the
// check hands back the address they point to.
const WRAPPERS = [
  { re: /^https?:\/\/(www\.)?google\.[a-z.]+\/url\?/i, by: 'Gmail', param: ['q', 'url'] },
  { re: /safelinks\.protection\.outlook\.com/i, by: 'Outlook', param: ['url'] },
  { re: /urldefense\.(proofpoint\.)?com/i, by: 'a mail filter', param: ['u'] },
];

export const wrapperOf = (url) => WRAPPERS.find((w) => w.re.test(String(url || ''))) || null;

export const unwrapLink = (url) => {
  const w = wrapperOf(url);
  if (!w) return url;
  try {
    const parsed = new URL(url);
    for (const p of w.param) {
      const v = parsed.searchParams.get(p);
      if (v && /^https?:\/\//i.test(v)) return v;
    }
  } catch {
    return url;
  }
  return url;
};

// Returns a sentence fragment or null. Empty is allowed here, the caller
// decides whether a link is required.
export const linkProblem = (url) => {
  const u = String(url || '').trim();
  if (!u) return null;
  if (/^javascript:/i.test(u)) return 'is not a web address';
  if (!/^https?:\/\/[^\s"<>]+$/i.test(u)) return 'needs to be a full address starting with https';
  const w = wrapperOf(u);
  if (w) {
    const real = unwrapLink(u);
    return real !== u
      ? `is wrapped by ${w.by}. Use the address it points to, ${real}`
      : `is wrapped by ${w.by}. Paste the real address instead`;
  }
  return null;
};

// ── the document ────────────────────────────────────────────────────────────

export const DEFAULT_SIGNATURE = {
  tagline: '',
  subline: '',
  name: 'Tyler Reagan',
  title: 'Product and Systems',
  phone: '970 973 8550',
  email: 'tyler@neonburro.com',
  siteLabel: 'neonburro.com',
  siteUrl: 'https://neonburro.com/',
  loginLabel: 'Client login',
  loginUrl: 'https://neonburro.com/account/',
  signoff: 'embrace what’s new',
};

const EMPTY_HERO = { kicker: '', headline: '', lede: '', buttonLabel: '', buttonUrl: '', codeLine: '', code: '' };
const EMPTY_CARD = { kicker: '', title: '', line: '', url: '' };

export const blankCard = () => ({ ...EMPTY_CARD });

export const blankSection = (type = 'list') => {
  const t = SECTION_TYPES[type] ? type : 'list';
  if (t === 'text') return { type: t, title: '', body: '' };
  if (t === 'list') return { type: t, title: 'What changed', items: [] };
  if (t === 'table') return { type: t, title: '', columns: ['', ''], rows: [] };
  if (t === 'checklist') return { type: t, title: 'Security check', items: [] };
  if (t === 'work_done') return { type: t, title: 'Work done since the last report', items: [] };
  return { type: 'open_items', title: 'Waiting on you' };
};

export const blankMail = (presetKey = 'neonburro', asOf = null) => {
  const preset = PRESETS[presetKey] || PRESETS.neonburro;
  return {
    version: MAIL_VERSION,
    from: 'tyler',
    to: [],
    cc: [],
    subject: '',
    preheader: '',
    asOf: asOf && DATE_RE.test(asOf) ? asOf : todayInRidgway(),
    opening: '',
    hero: { ...EMPTY_HERO },
    sections: [],
    cardsLabel: 'Also yours, no charge',
    cards: [],
    signature: { ...DEFAULT_SIGNATURE },
    theme: { preset: preset.key, ...preset.base },
  };
};

// A starting document per kind. A periodic report always opens with the
// open items and the work done, which is the whole point of one.
export const templateFor = (kind, { presetKey = 'neonburro', asOf = null, companyName = '' } = {}) => {
  const doc = blankMail(presetKey, asOf);
  const name = String(companyName || '').trim();
  const label = kindLabel(kind);
  if (kind === 'letter' || !KINDS[kind]) return doc;
  doc.subject = name ? `${name}, ${label.toLowerCase()}` : label;
  doc.hero.kicker = `${label}  ·  ${shortDate(doc.asOf)}`;
  if (kind === 'periodic_report') {
    doc.hero.headline = 'Where things stand.';
    doc.sections = [blankSection('open_items'), blankSection('work_done')];
  } else if (kind === 'security_check') {
    doc.hero.headline = 'A security check.';
    doc.sections = [blankSection('checklist')];
  } else if (kind === 'deploy_digest') {
    doc.hero.headline = 'What went live.';
    doc.sections = [{ type: 'table', title: 'Deploys', columns: ['Date', 'What changed'], rows: [] }];
  } else {
    doc.hero.headline = kind === 'progress' ? 'Progress.' : 'A system update.';
    doc.sections = [blankSection('list')];
  }
  doc.cardsLabel = '';
  return doc;
};

// A letter with no client in it, for the development fixture and for
// scripts/mail-render.mjs when it is run with no file. This repository is
// public, so a real letter, its addresses and its codes never live in it.
export const sampleMail = () => ({
  ...blankMail('neonburro', '2026-10-05'),
  to: ['tyler@neonburro.com'],
  subject: 'A sample letter from the studio',
  preheader: 'Everything from the month in one place, a tap each.',
  opening: 'Hi there, a short note before the report.\n\nEverything from the month sits in one place below. Open it, tap through and anything that needs a person comes back to the studio the same day.',
  hero: {
    kicker: 'Month end report  ·  sample',
    headline: 'A few questions,\none tap each.',
    lede: 'Everything from the month sits in one place, with a handful of questions that take a tap each. Nothing needs writing unless you feel like writing something.',
    buttonLabel: 'Open the report ›',
    buttonUrl: 'https://neonburro.com/',
    codeLine: 'It asks for a code once. It is SAMPLE01 and it works for everybody.',
    code: 'SAMPLE01',
  },
  sections: [
    { type: 'open_items', title: 'Waiting on you' },
    { type: 'work_done', title: 'Work done since the last report', items: [{ date: '2026-10-02', text: 'The site moved to faster image formats.' }, { date: '2026-10-05', text: 'The share cards were redrawn.' }] },
    { type: 'checklist', title: 'Security check', items: [{ label: 'Every sign in uses a unique password', state: 'pass', note: '' }, { label: 'One old account still has access', state: 'attention', note: 'Waiting on you above.' }] },
  ],
  cards: [
    { kicker: 'Services', title: 'What the studio does', line: 'Every service with what it costs and how it is delivered.', url: 'https://neonburro.com/services/' },
    { kicker: 'Account', title: 'Your client login', line: 'Invoices, reports and messages in one place.', url: 'https://neonburro.com/account/' },
  ],
  signature: { ...DEFAULT_SIGNATURE, tagline: 'Systems built around how the work already happens.', subline: 'Less done by hand, every day.' },
});

// Open items for the sample, so the fixture and the hand render show the
// block filled. Tokens are visibly fake.
export const sampleItems = () => ([
  { id: 'sample-1', title: 'Approve a support login for the studio', detail: 'One account so the studio can look without asking for a password.', kind: 'access', opened_at: '2026-09-21', token: 'sample-token-one' },
  { id: 'sample-2', title: 'How often should this report arrive', detail: '', kind: 'decision', opened_at: '2026-10-05', token: 'sample-token-two', choices: ['Weekly', 'Every two weeks', 'Monthly'] },
]);

const str = (v, max = 6000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);

const addresses = (v) => {
  const seen = new Set();
  const out = [];
  (Array.isArray(v) ? v : []).forEach((raw) => {
    const e = String(raw || '').trim().toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push(e);
  });
  return out.slice(0, 50);
};

const cleanSection = (s) => {
  const type = SECTION_TYPES[s?.type] ? s.type : 'list';
  const title = str(s?.title, 200);
  if (type === 'text') return { type, title, body: str(s?.body, 4000) };
  if (type === 'list') return { type, title, items: (Array.isArray(s?.items) ? s.items : []).slice(0, MAX_ROWS).map((i) => str(i, 500)) };
  if (type === 'table') {
    const columns = (Array.isArray(s?.columns) ? s.columns : []).slice(0, 4).map((c) => str(c, 60));
    const width = Math.max(1, columns.length);
    const rows = (Array.isArray(s?.rows) ? s.rows : []).slice(0, MAX_ROWS)
      .map((r) => Array.from({ length: width }, (_, i) => str(Array.isArray(r) ? r[i] : '', 300)));
    return { type, title, columns: columns.length ? columns : [''], rows };
  }
  if (type === 'checklist') {
    return {
      type,
      title,
      items: (Array.isArray(s?.items) ? s.items : []).slice(0, MAX_ROWS).map((i) => ({
        label: str(i?.label, 300),
        state: CHECK_STATES[i?.state] ? i.state : 'pass',
        note: str(i?.note, 300),
      })),
    };
  }
  if (type === 'work_done') {
    return {
      type,
      title,
      items: (Array.isArray(s?.items) ? s.items : []).slice(0, MAX_ROWS).map((i) => ({
        date: DATE_RE.test(String(i?.date || '')) ? i.date : '',
        text: str(i?.text, 500),
      })),
    };
  }
  return { type: 'open_items', title };
};

// Every key present, every value the right type. Strings are kept as typed,
// spaces and all, because the editor is mid sentence when this runs. The
// renderer trims where trimming is right.
export const normalizeMail = (raw = {}) => {
  const src = raw || {};
  const base = blankMail(src.theme?.preset, src.asOf);
  const hero = src.hero || {};
  const sig = src.signature || {};
  return {
    version: MAIL_VERSION,
    from: SENDERS[src.from] ? src.from : base.from,
    to: addresses(src.to),
    cc: addresses(src.cc),
    subject: str(src.subject, 300),
    preheader: str(src.preheader, 300),
    asOf: DATE_RE.test(String(src.asOf || '')) ? src.asOf : base.asOf,
    opening: str(src.opening, 12000),
    hero: Object.fromEntries(Object.keys(EMPTY_HERO).map((k) => [k, str(hero[k], 2000)])),
    sections: (Array.isArray(src.sections) ? src.sections : []).slice(0, MAX_SECTIONS).map(cleanSection),
    cardsLabel: src.cardsLabel === undefined ? base.cardsLabel : str(src.cardsLabel, 200),
    cards: (Array.isArray(src.cards) ? src.cards : [])
      .slice(0, MAX_CARDS)
      .map((c) => Object.fromEntries(Object.keys(EMPTY_CARD).map((k) => [k, str(c?.[k], 1000)]))),
    signature: Object.fromEntries(Object.keys(DEFAULT_SIGNATURE).map((k) => [k, sig[k] === undefined ? base.signature[k] : str(sig[k], 400)])),
    theme: {
      preset: PRESETS[src.theme?.preset] ? src.theme.preset : base.theme.preset,
      ...Object.fromEntries(THEME_KEYS.map((k) => [k, str(src.theme?.[k] ?? base.theme[k], 7)])),
    },
  };
};

export const hasOpenItemsBlock = (doc) => (doc?.sections || []).some((s) => s.type === 'open_items');

// ── the check ───────────────────────────────────────────────────────────────
//
// One list of problems for the editor, the send gate and the door. block
// true means the door refuses a send. block false is advice. recipients
// true marks a problem about who it goes to, which a test ignores because a
// test only ever goes to TEST_TO.

export const checkMail = (input) => {
  const doc = normalizeMail(input);
  const out = [];
  const add = (block, text, recipients = false) => out.push({ block, text, recipients });

  if (!doc.to.length) add(true, 'Add at least one address to send to.', true);
  doc.to.forEach((e) => { if (!EMAIL_RE.test(e)) add(true, `${e} in to is not an email address.`, true); });
  doc.cc.forEach((e) => { if (!EMAIL_RE.test(e)) add(true, `${e} in cc is not an email address.`, true); });
  doc.cc.forEach((e) => { if (doc.to.includes(e)) add(false, `${e} is in to and in cc.`, true); });

  if (!doc.subject.trim()) add(true, 'The subject is empty.');
  if (!doc.preheader.trim()) add(false, 'No preheader, so the inbox shows the first words of the opening instead.');

  const h = doc.hero;
  const label = h.buttonLabel.trim();
  const url = h.buttonUrl.trim();
  if (label && !url) add(true, 'The button has a label and no address.');
  if (url && !label) add(true, 'The button has an address and no label.');
  const buttonProblem = linkProblem(url);
  if (buttonProblem) add(true, `The button address ${buttonProblem}.`);
  if (h.code.trim() && !h.codeLine.includes(h.code.trim())) {
    add(false, `The code ${h.code.trim()} is not in the code line, so it will not be set bright.`);
  }

  doc.sections.forEach((s, i) => {
    const n = i + 1;
    if (s.type === 'table' && s.rows.length && !s.columns.some((c) => c.trim())) add(false, `Section ${n} is a table with no column names.`);
    if (s.type === 'work_done') s.items.forEach((it) => { if (it.text.trim() && !it.date) add(true, `Section ${n} has work with no date. Every line of work done carries its date.`); });
  });

  doc.cards.forEach((c, i) => {
    const n = i + 1;
    if (c.url.trim() && !c.title.trim()) add(true, `Link card ${n} has an address and no title.`);
    if (c.title.trim() && !c.url.trim()) add(true, `Link card ${n} has a title and no address.`);
    const p = linkProblem(c.url);
    if (p) add(true, `Link card ${n} ${p}.`);
  });

  const s = doc.signature;
  if (s.phone.trim() && !telOf(s.phone)) add(true, 'The signature phone is not ten digits, so it cannot be a tap to call link.');
  if (s.email.trim() && !EMAIL_RE.test(s.email.trim())) add(true, 'The signature email is not an email address.');
  const siteProblem = linkProblem(s.siteUrl);
  if (siteProblem) add(true, `The signature site address ${siteProblem}.`);
  const loginProblem = linkProblem(s.loginUrl);
  if (loginProblem) add(true, `The client login address ${loginProblem}.`);

  THEME_KEYS.forEach((k) => {
    if (!HEX_RE.test(String(doc.theme[k] || '').trim())) add(true, `The ${k} colour is not a six digit hex like #000249.`);
  });

  if (/google\.[a-z.]+\/url\?|safelinks\.protection\.outlook\.com/i.test(`${doc.opening} ${h.lede}`)) {
    add(true, 'The opening or the lede carries a wrapped Gmail or Outlook link. Paste the real address.');
  }

  return out;
};

// The rules that need the row and not only the document. Read by the gate
// in the editor and again by the door, which is the one that counts.
export const needsApproval = (row) => String(row?.origin || 'hand') !== 'hand';

export const rowProblems = (row) => {
  const out = [];
  if (!row?.client_id) out.push({ block: true, text: 'Pick the client this letter belongs to. Every letter sits on a client.', recipients: true });
  if (row?.status === 'dismissed') out.push({ block: true, text: 'This one was dismissed. Duplicate it to send something like it.' });
  if (needsApproval(row) && !['approved', 'sent'].includes(row?.status)) {
    out.push({ block: true, text: `This ${kindLabel(row?.kind).toLowerCase()} was drafted by the system and waits for Tyler. Approve it first.`, recipients: true });
  }
  return out;
};

// What stops a given mode. A test ignores recipient problems because it
// only ever goes to TEST_TO. A send honours every blocking problem.
export const blockingFor = (problems, mode) => problems.filter((p) => p.block && (mode === 'send' || !p.recipients));
