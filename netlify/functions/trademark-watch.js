// netlify/functions/trademark-watch.js
// SENTINEL: NB_PULSE_TRADEMARK_WATCH_V2
//
// The door a person uses into the trademark watch. Pulse /trademarks/ calls
// it for the studio, and neonburro.com /account/trademarks/ calls it across
// origins for a client. Everything it knows about the register, TSDR, the
// dates and the store is in netlify/lib/trademarks.js, read that header
// first. This file is who may do what, and nothing else.
//
// Tyler, 2026-10-05: "I'd like that tool to just be accessible in Pulse ...
// you can keep adding names to it ... daily, weekly, biweekly or monthly ...
// set dates to check this one again when the trademark expires." And the
// studio offers it to clients, so a client keeps a watch list of their own.
//
// ── WHO CAN OPEN WHAT ───────────────────────────────────────────────────────
// Every Pulse client signs in to the same Supabase project as the studio, so
// a session proves nothing. The role decides, read from profiles with the
// service key on every call:
//   studio   profiles.role super_admin or admin, the same two roles as
//            impersonate-client.js and v1. Opens any list. Only the studio
//            opens or closes a client's list.
//   client   profiles.role client with a client_id, the same test the
//            portal's useClientAuth makes. Reaches ONE list, client/<their
//            client_id>, and the key is worked out here from the profile.
//            Whatever owner a client sends is ignored, so there is no
//            request a client can shape that reads another list.
//   anyone else gets 403, team and manager included, because v1 kept this
//   to the two top roles and nobody has asked to widen it.
// A client's list exists only once the studio opens it. Until then the
// portal asks, hears open false and shows nothing, so the offer is the
// studio's to make.
//
// ── WHY CLIENTS ARE NOT SENT INTO PULSE ─────────────────────────────────────
// Pulse's ProtectedRoute admits any session and its pages read tables that
// still answer to any signed in token, checked live on 2026-10-05: twelve
// policies qualified only on auth.uid() is not null, form_submissions and
// client_contacts among them, see supabase/migrations/
// 20260927170000_staff_scope_the_twelve.sql, prepared and not applied. A
// client sent to pulse.neonburro.com would find every other client's
// contacts one click away. So a client's watch lives in the portal they
// already use, and this function is the only thing the two surfaces share.
//
// ── CROSS ORIGIN ────────────────────────────────────────────────────────────
// The portal is neonburro.com and this is pulse.neonburro.com, so the
// browser sends a preflight. Only the studio's own origins and localhost get
// an allow header. The bearer token is what authorises, CORS only decides
// which pages may read the answer.
//
// ── ACTIONS, POST { action, owner, word, ... } ──────────────────────────────
//   list      one list, every entry with its dates worked out for today
//   lists     studio only. Every list with counts, and clients with none
//   open      studio only. Start a client's list
//   close     studio only. Delete a client's list
//   add       a word, read straight away. cadence defaults to monthly
//   check     read the register again for one word
//   watch     set cadence and the look again date
//   note      a line of context on a word
//   remove    take a word off
//   facts     read TSDR for one mark, the next unread live one or a serial
//   suggest   one word variants, no reads
//   probe     the exact read alone for one suggestion, cached a week
// Every read of the office is charged to the list first, see the ceilings in
// the lib header. A ceiling answers 429 with a sentence a person can read.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';
import {
  STORE, STUDIO_KEY, CLIENT_PREFIX, clientKey, keyFor, ownerOf, UUID, CADENCES, LIMITS,
  cleanWord, isoDay, addYears, readRegister, probeRegister, readTsdr, factsStale,
  decorate, applyRead, recordFailure, charge, mutate, readList, emptyList, suggest,
  keepProbe, PROBE_FRESH_MS, Ceiling, NotOpen,
} from '../lib/trademarks.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const STUDIO_ROLES = ['super_admin', 'admin'];
const ORIGINS = ['https://neonburro.com', 'https://www.neonburro.com'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const corsFor = (origin) => (origin && (ORIGINS.includes(origin) || LOCAL.test(origin))
  ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  : { Vary: 'Origin' });

const whoIs = async (req) => {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!supa || !token) return null;
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await supa
    .from('profiles')
    .select('id, role, client_id, display_name')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profile && STUDIO_ROLES.includes(profile.role)) {
    return { kind: 'studio', by: profile.display_name || data.user.email || 'the studio' };
  }
  if (profile && profile.role === 'client' && profile.client_id && UUID.test(profile.client_id)) {
    return { kind: 'client', clientId: profile.client_id, by: 'the client' };
  }
  return { kind: 'none' };
};

const clientName = async (id) => {
  const { data } = await supa.from('clients').select('name, company').eq('id', id).maybeSingle();
  return data ? (data.name || data.company || 'A client') : null;
};

export default async (req) => {
  const cors = corsFor(req.headers.get('origin'));
  const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const who = await whoIs(req);
  if (!who) return json(401, { error: 'Sign in first.' });
  if (who.kind === 'none') return json(403, { error: 'This watch is for the studio and the clients it opens one for.' });

  let body = {};
  try { body = await req.json(); } catch { return json(400, { error: 'Send JSON.' }); }
  const action = String(body.action || 'list');
  const studio = who.kind === 'studio';

  let store;
  try {
    store = getStore({ name: STORE, consistency: 'strong' });
  } catch {
    return json(500, { error: 'The store is not reachable from here. Run it on the site or under netlify dev.' });
  }

  // The owner. A client's is fixed by their profile, never by the request.
  const owner = studio ? (body.owner && body.owner !== 'studio' ? String(body.owner) : 'studio') : who.clientId;
  if (owner !== 'studio' && !UUID.test(owner)) return json(400, { error: 'That is not a list.' });
  const key = keyFor(owner);
  const limits = { ...(studio ? LIMITS.studio : LIMITS.client), words: owner === 'studio' ? LIMITS.studio.words : LIMITS.client.words };
  const today = isoDay();
  const reply = (doc, extra = {}) => ({ reads: doc.reads, limits, ...extra });

  try {
    // ── studio only ───────────────────────────────────────────────────────
    if (action === 'lists') {
      if (!studio) return json(403, { error: 'Only the studio sees every list.' });
      const { blobs } = await store.list({ prefix: CLIENT_PREFIX });
      const ids = blobs.map((b) => ownerOf(b.key)).filter((id) => UUID.test(id));
      const [studioDoc, docs, clients] = await Promise.all([
        readList(store, STUDIO_KEY),
        Promise.all(ids.map((id) => readList(store, clientKey(id)))),
        supa.from('clients').select('id, name, company').order('name'),
      ]);
      const names = new Map((clients.data || []).map((c) => [c.id, c.name || c.company || 'A client']));
      const sum = (doc) => {
        const entries = (doc?.entries || []).map((e) => decorate(e, today));
        return {
          words: entries.length,
          watching: entries.filter((e) => e.cadence !== 'off').length,
          free: entries.filter((e) => e.chance === 'free').length,
          clear: entries.filter((e) => e.verdict === 'clear').length,
          taken: entries.filter((e) => e.verdict === 'taken').length,
        };
      };
      const lists = [
        { owner: 'studio', name: 'The studio', ...sum(studioDoc) },
        ...ids.map((id, i) => ({ owner: id, name: names.get(id) || 'A client no longer in Pulse', ...sum(docs[i]) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ];
      const open = new Set(ids);
      return json(200, {
        lists,
        clients: (clients.data || []).filter((c) => !open.has(c.id)).map((c) => ({ id: c.id, name: c.name || c.company || 'A client' })),
      });
    }

    if (action === 'open' || action === 'close') {
      if (!studio) return json(403, { error: 'Only the studio opens or closes a list.' });
      if (owner === 'studio') return json(400, { error: 'The studio list is always open.' });
      const name = await clientName(owner);
      if (action === 'open') {
        if (!name) return json(404, { error: 'No such client.' });
        await store.setJSON(key, emptyList(owner, who.by), { onlyIfNew: true });
        const doc = await readList(store, key);
        return json(200, reply(doc, { owner, name, open: true, entries: [] }));
      }
      await store.delete(key);
      return json(200, { owner, closed: true });
    }

    // ── one list ──────────────────────────────────────────────────────────
    if (action === 'list') {
      const doc = await readList(store, key);
      if (!doc && owner !== 'studio') {
        if (!studio) return json(200, { open: false });
        return json(404, { error: 'The studio has not opened a watch for this client.' });
      }
      const list = doc || emptyList('studio', '');
      const name = owner === 'studio' ? 'The studio' : await clientName(owner);
      return json(200, reply(list, {
        viewer: who.kind, owner, name, open: true, today,
        entries: list.entries.map((e) => decorate(e, today)),
      }));
    }

    if (action === 'suggest') {
      const doc = await readList(store, key);
      if (!doc && owner !== 'studio') throw new NotOpen('The studio has not opened a watch for this client.');
      const skip = (doc?.entries || []).map((e) => e.word);
      const candidates = suggest(body.word, { owner: owner === 'studio' ? 'studio' : 'client', round: Number(body.round) || 0, skip })
        .map((c) => {
          const hit = doc?.probes?.[c.word];
          return hit && Date.now() - Date.parse(hit.at) < PROBE_FRESH_MS ? { ...c, probe: hit } : c;
        });
      return json(200, { candidates });
    }

    const word = cleanWord(body.word);
    if (!word || word.length < 2 || word.length > 40) {
      return json(400, { error: 'One word, lowercase, letters and digits, 2 to 40 long.' });
    }
    const entryOf = (doc) => doc.entries.find((e) => e.word === word);

    if (action === 'probe') {
      const { doc: before } = await mutate(store, key, (doc) => {
        const hit = doc.probes[word];
        if (hit && Date.now() - Date.parse(hit.at) < PROBE_FRESH_MS) return false;
        charge(doc, 1, limits);
        return true;
      });
      const cached = before.probes[word];
      if (cached && Date.now() - Date.parse(cached.at) < PROBE_FRESH_MS) return json(200, reply(before, { word, ...cached, cached: true }));
      const result = await probeRegister(word);
      const { doc } = await mutate(store, key, (d) => { keepProbe(d, word, result); });
      return json(200, reply(doc, { word, ...result, cached: false }));
    }

    if (action === 'add' || action === 'check') {
      const cadence = CADENCES[body.cadence] !== undefined ? body.cadence : 'monthly';
      const { result: known } = await mutate(store, key, (doc) => {
        const entry = entryOf(doc);
        if (action === 'add' && entry) return false;
        if (action === 'check' && !entry) throw new NotOpen('That word is not on the list.');
        if (action === 'add' && doc.entries.length >= limits.words) {
          throw new Ceiling(`A list holds ${limits.words} words. Take one off to add another.`);
        }
        charge(doc, 2, limits);
        if (!entry) {
          doc.entries.unshift({
            word, note: String(body.note || '').slice(0, 400), addedAt: new Date().toISOString(), addedBy: who.by,
            cadence, lookAgain: null, checkedAt: null, checkedBy: '', verdict: null, exact: [], close: [],
            closeTotal: 0, error: null, failedAt: null, changes: [], seen: [],
          });
        }
        return 'charged';
      });
      if (known === false) {
        const doc = await readList(store, key);
        return json(200, reply(doc, { entry: decorate(entryOf(doc), today), existed: true }));
      }
      let read = null;
      let failure = null;
      try { read = await readRegister(word); } catch (err) { failure = err.message; }
      const { doc } = await mutate(store, key, (d) => {
        const entry = entryOf(d);
        if (!entry) return false;
        if (read) applyRead(entry, read, 'person');
        else recordFailure(entry, failure);
        return true;
      });
      const entry = entryOf(doc);
      if (!entry) return json(404, { error: 'That word was taken off while it was being read.' });
      return json(200, reply(doc, { entry: decorate(entry, today) }));
    }

    if (action === 'watch' || action === 'note' || action === 'remove') {
      if (action === 'watch') {
        if (body.cadence !== undefined && CADENCES[body.cadence] === undefined) return json(400, { error: 'Off, daily, weekly, biweekly or monthly.' });
        if (body.lookAgain !== undefined && body.lookAgain !== null) {
          const d = String(body.lookAgain);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return json(400, { error: 'A look again date is a day, like 2027-03-01.' });
          if (d < today) return json(400, { error: 'Pick today or a day after it.' });
          if (d > addYears(today, 12)) return json(400, { error: 'Twelve years out is as far as this looks.' });
        }
      }
      const { doc } = await mutate(store, key, (d) => {
        const entry = entryOf(d);
        if (!entry) throw new NotOpen('That word is not on the list.');
        if (action === 'remove') { d.entries = d.entries.filter((e) => e.word !== word); return true; }
        if (action === 'note') { entry.note = String(body.note || '').slice(0, 400); return true; }
        if (body.cadence !== undefined) entry.cadence = body.cadence;
        if (body.lookAgain !== undefined) entry.lookAgain = body.lookAgain || null;
        return true;
      });
      if (action === 'remove') return json(200, reply(doc, { removed: word }));
      return json(200, reply(doc, { entry: decorate(entryOf(doc), today) }));
    }

    if (action === 'facts') {
      // ONE mark a call. TSDR answered 403 to the second of four reads sent
      // 350ms apart on 2026-10-05 and 200 to a single read a minute later, so
      // it refuses a burst and not a read. The page asks for the next mark
      // itself, a few seconds on, stops at the first refusal and stops after
      // four marks a word. more tells it whether a live mark is still unread.
      const doc = await readList(store, key);
      if (!doc) throw new NotOpen('The studio has not opened a watch for this client.');
      const entry = entryOf(doc);
      if (!entry) throw new NotOpen('That word is not on the list.');
      let mark;
      if (body.serial) {
        mark = [...entry.exact, ...entry.close].find((m) => m.serial === String(body.serial));
        if (!mark) return json(404, { error: 'That mark is not on this word.' });
        if (!factsStale(mark)) mark = null;
      } else {
        mark = entry.exact.find((m) => m.alive && factsStale(m)) || null;
      }
      if (!mark) return json(200, reply(doc, { entry: decorate(entry, today), read: 0, more: false }));
      await mutate(store, key, (d) => { charge(d, 1, limits); });
      let facts;
      try {
        facts = await readTsdr(mark.serial);
      } catch (err) {
        const slow = /403|429/.test(err.message);
        return json(slow ? 429 : 502, { error: slow ? 'TSDR asked for a slower pace. Give it a minute.' : err.message });
      }
      const { doc: after } = await mutate(store, key, (d) => {
        const e = entryOf(d);
        if (!e) return false;
        for (const list of [e.exact, e.close]) {
          for (const m of list) if (m.serial === mark.serial) m.facts = facts;
        }
        return true;
      });
      const fresh = entryOf(after);
      if (!fresh) return json(404, { error: 'That word was taken off while TSDR was being read.' });
      const more = !body.serial && fresh.exact.some((m) => m.alive && factsStale(m));
      return json(200, reply(after, { entry: decorate(fresh, today), read: 1, serial: mark.serial, more }));
    }

    return json(400, { error: 'Unknown action.' });
  } catch (err) {
    if (err instanceof Ceiling) return json(429, { error: err.message });
    if (err instanceof NotOpen) return json(404, { error: err.message });
    console.log(JSON.stringify({ fn: 'trademark-watch', action, viewer: who.kind, error: err.message }));
    return json(502, { error: err.message || 'The watch could not finish that.' });
  }
};
