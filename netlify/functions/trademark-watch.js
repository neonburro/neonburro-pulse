// netlify/functions/trademark-watch.js
// SENTINEL: NB_PULSE_TRADEMARK_WATCH_V1
//
// The studio's trademark watch, behind /trademarks/ in Pulse. A list of words
// the studio might file for The Burroship LLC, each one checked against the
// USPTO register and the answer kept, so the page is an evolving record and
// not a search box. Tyler, 2026-10-05: "We could make a list of words that we're
// trying. We'll keep adding to the report. It's an evolving link ... they're
// all one word." Every word is lowercase and one word, never two words.
//
// NO WORD EVER APPEARS IN THIS REPO. It is public, and a list of names the
// studio means to file is exactly what somebody would race to file first.
// The list was seeded straight into the store from the CLI, netlify
// blobs:set studio-trademarks words, never from code.
//
// ── WHO CAN OPEN IT ─────────────────────────────────────────────────────────
// Studio only. Clients sign in to Pulse too, so a session is not enough, the
// caller's profiles.role must be super_admin or admin, the same check as
// impersonate-client.js. The neonburro-pulse repo is PUBLIC on GitHub, so the
// words live in Netlify Blobs and never in this file or anywhere in the repo.
//
// ── THE SEARCH ──────────────────────────────────────────────────────────────
// tmsearch.uspto.gov posts an Elasticsearch body to prod-stage-v1-0-0/tmsearch.
// Read off the page's own request on 2026-10-05 by Ion and by Aster, and it
// answers a plain server request with no browser session. Two reads a word:
//   exact   the page's own wordmark query, WM phrase and match plus the PM
//           pseudo mark, every status. A hit counts only when its wordmark,
//           stripped to letters and digits and lowercased, equals the word.
//   close   a fuzzy match on WM, live marks only (LD true), the spellings an
//           examiner would weigh. The office pairs a word with its sound
//           alike pseudo mark, so a made up spelling of a common word meets
//           the common word at examination. That is where a filing would be
//           refused, so this is not a nicety.
// The status word is worked out because no field holds one. alive with a
// registration number is registered, alive without one is pending, dead with
// a cancel date is cancelled, dead with an abandon date is abandoned.
// The page sends one word a call and pauses between them, so a long list
// never hammers the office and never runs past the ten second clock. If the
// office starts refusing plain requests, the answer says so and the entry
// keeps its last good read.
//
// ── THE VERDICT ─────────────────────────────────────────────────────────────
//   clear      no mark with this exact word, live or dead
//   dead       only dead marks with this exact word
//   taken      at least one live mark, registered or pending
// Clear means the federal register only. It says nothing about state marks or
// a name in use without a filing, and a lawyer reads before anything is filed.
// Owner for every filing is The Burroship LLC, Tyler 2026-10-05.
//
// ── THE STORE ───────────────────────────────────────────────────────────────
// Netlify Blobs, store studio-trademarks, one key, words, a JSON list. Read,
// change, write, which is fine for one studio adding a word at a time.
// connectLambda(event) first, the same pattern and guard as
// registry-balances.js. An empty store is an empty list. Words written from
// the CLI arrive unchecked and the page checks them on first open.
//
// ── ACTIONS, POST { action, word, note } ────────────────────────────────────
//   list     every entry, newest first
//   add      a new word, checked straight away
//   check    read the register again for one word
//   note     keep a line of context on a word
//   remove   take a word off the list
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';
import { connectLambda, getStore } from '@netlify/blobs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const ALLOWED_ROLES = ['super_admin', 'admin'];
const STORE = 'studio-trademarks';
const KEY = 'words';
const SEARCH = 'https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch';
const TSDR = (serial) => `https://tsdr.uspto.gov/#caseNumber=${serial}&caseType=SERIAL_NO&searchType=statusSearch`;
const FIELDS = [
  'alive', 'abandonDate', 'cancelDate', 'filedDate', 'internationalClass',
  'ownerName', 'registrationDate', 'registrationId', 'wordmark', 'currentBasis',
];

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

// One lowercase word, letters and digits only, the rule Tyler set.
const cleanWord = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const statusOf = (s) => {
  if (s.alive) return s.registrationId ? 'registered' : 'pending';
  if (s.cancelDate) return 'cancelled';
  if (s.abandonDate) return 'abandoned';
  return 'dead';
};

const shape = (hit) => {
  const s = hit.source || {};
  return {
    serial: hit.id,
    mark: s.wordmark || '',
    alive: !!s.alive,
    status: statusOf(s),
    owner: (s.ownerName || [])[0] || '',
    classes: (s.internationalClass || []).filter((c) => !/CANCELLED|DELETED/i.test(c)).map((c) => c.replace(/^IC\s*/i, '')),
    filed: s.filedDate ? String(s.filedDate).slice(0, 10) : null,
    registered: s.registrationDate ? String(s.registrationDate).slice(0, 10) : null,
    link: TSDR(hit.id),
  };
};

const ask = async (body) => {
  const res = await fetch(SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`the register answered ${res.status}`);
  const data = await res.json();
  if (!data?.hits) throw new Error('the register sent something unexpected');
  return data.hits;
};

const readRegister = async (word) => {
  const [exactHits, closeHits] = await Promise.all([
    ask({
      query: { bool: { must: [{ bool: { should: [
        { match_phrase: { WM: { query: word, boost: 5 } } },
        { match: { WM: { query: word, boost: 2 } } },
        { match_phrase: { PM: { query: word, boost: 2 } } },
      ] } }] } },
      size: 100, from: 0, track_total_hits: true, _source: FIELDS,
    }),
    ask({
      query: { bool: {
        must: [{ fuzzy: { WM: { value: word, fuzziness: 'AUTO', max_expansions: 30 } } }],
        filter: [{ term: { LD: 'true' } }],
      } },
      size: 12, track_total_hits: true, _source: FIELDS,
    }),
  ]);
  const exact = (exactHits.hits || []).map(shape).filter((m) => flat(m.mark) === word);
  const close = (closeHits.hits || []).map(shape).filter((m) => flat(m.mark) !== word).slice(0, 8);
  const verdict = exact.some((m) => m.alive) ? 'taken' : exact.length ? 'dead' : 'clear';
  return {
    verdict,
    exact,
    close,
    closeTotal: Math.max(0, (closeHits.totalValue || 0) - exact.filter((m) => m.alive).length),
    checkedAt: new Date().toISOString(),
    error: null,
  };
};

const whoIs = async (event) => {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!supa || !token) return null;
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await supa.from('profiles').select('id, role, display_name').eq('id', data.user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return { user: data.user, allowed: false };
  return { user: data.user, email: profile.display_name || data.user.email || '', allowed: true };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const who = await whoIs(event);
  if (!who) return json(401, { error: 'Sign in first.' });
  if (!who.allowed) return json(403, { error: 'This page is for the studio.' });

  let store;
  try {
    connectLambda(event);
    store = getStore(STORE);
  } catch {
    return json(500, { error: 'The store is not reachable from here. Run it on the site or under netlify dev.' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Send JSON.' }); }
  const action = String(body.action || 'list');

  let words = await store.get(KEY, { type: 'json' }).catch(() => null);
  if (!Array.isArray(words)) words = [];
  // An entry written from the CLI may carry only word and note.
  words = words.map((e) => ({
    note: '', addedAt: null, addedBy: '', checkedAt: null, verdict: null,
    exact: [], close: [], closeTotal: 0, error: null, ...e,
  }));
  const save = () => store.setJSON(KEY, words);
  const find = (w) => words.find((e) => e.word === w);

  if (action === 'list') return json(200, { words });

  const word = cleanWord(body.word);
  if (!word || word.length < 2 || word.length > 40) {
    return json(400, { error: 'One word, lowercase, letters and digits, 2 to 40 long.' });
  }

  if (action === 'remove') {
    words = words.filter((e) => e.word !== word);
    await save();
    return json(200, { words });
  }

  if (action === 'note') {
    const entry = find(word);
    if (!entry) return json(404, { error: 'Not on the list.' });
    entry.note = String(body.note || '').slice(0, 400);
    await save();
    return json(200, { entry });
  }

  if (action === 'add' || action === 'check') {
    let entry = find(word);
    if (!entry) {
      if (action === 'check') return json(404, { error: 'Not on the list.' });
      entry = {
        word, note: String(body.note || '').slice(0, 400), addedAt: new Date().toISOString(),
        addedBy: who.email, checkedAt: null, verdict: null, exact: [], close: [], closeTotal: 0, error: null,
      };
      words.unshift(entry);
    }
    try {
      Object.assign(entry, await readRegister(word));
    } catch (err) {
      entry.error = `${err.message}. The last good read is kept.`;
    }
    await save();
    return json(200, { entry });
  }

  return json(400, { error: 'Unknown action.' });
};
