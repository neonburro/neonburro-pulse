// netlify/functions/item-answer.js
// SENTINEL: NB_PULSE_ITEM_ANSWER_V1
//
// The client's door for one open item. Tyler, 2026-10-05, by way of the
// coordinator. Every open item in a letter carries an approve and a deny
// link, or one link per choice, and they land on src/pages/Answer/index.jsx,
// which talks to this. No login. The token in the link is the only way in.
//
//   GET  ?k=<token>                       the item, its client's name and
//                                         whether it has been answered
//   POST { k, answer, choice, note, name } records the answer, once
//
// ── WHAT THIS DOOR WILL NOT DO ──────────────────────────────────────────────
// The same rules as report-public.js, the other public door in Pulse.
//   · It never takes an item id or a client id from the caller. The token
//     is the only key, so guessing numbers reads nothing.
//   · It never trusts a time from the body. answered_at is the server clock.
//   · First answer wins. A second answer is refused and the page shows the
//     first one, because the point of the record is that it does not move.
//     If a client changes their mind they reply to the letter and a person
//     records it in Pulse.
//   · It answers one shape for a bad token, an unknown token and a withdrawn
//     item, so a caller learns nothing from the wording.
//   · It never mails the client. Approve and deny write a row and an
//     activity_log line and that is all. The studio hears about it through
//     the admin queue on /mail/ and the one quiet digest a day,
//     netlify/functions/mail-digest.js. Tyler, "Just don't do a bunch of
//     them. Just add them to Pulse."
//
// ── A GET NEVER ANSWERS ─────────────────────────────────────────────────────
// Mail scanners follow every link in a message before a person sees it,
// Outlook safe links does exactly that. If opening the approve link recorded
// an approval, a scanner would approve every item in every letter. So a GET
// only reads, and the answer is a POST made by a press on the page.
//
// ── THE RATE LIMIT ──────────────────────────────────────────────────────────
// public.door_hits holds one row per request with a sha256 of the caller's
// address and the day, never the address. More than READS or WRITES in the
// window from one caller gets a calm 429. It is a fence against a script,
// not a vault, the token is the vault. If the table is missing, before
// supabase/migrations/20261005130000_mail_updates_and_open_items.sql, the
// limit is skipped and so is everything else, because client_items is
// missing too.
//
// ── THE COARSE DEVICE LINE ──────────────────────────────────────────────────
// answer_device is a few words read from the user agent, iPhone and Safari,
// Windows and Edge. Enough to tell the studio the answer came from a phone
// in the yard rather than the office, not enough to follow anybody.
//
// No oxford commas, no em dashes.

import { createHash } from 'node:crypto';
import { createDb, json } from './_social.js';

const TOKEN_OK = /^[A-Za-z0-9_-]{24,128}$/;
const NOPE = { ok: false, error: 'This link is not valid. Reply to the letter it came in and the studio will send a fresh one.' };
const WINDOW_MS = 10 * 60 * 1000;
const READS = 60;
const WRITES = 12;

const callerOf = (event) => {
  const h = event.headers || {};
  return String(h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();
};

const whoHash = (event, door) => {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${callerOf(event)}|${door}|${day}`).digest('hex');
};

// Counts this caller's hits in the window and writes one more. Returns true
// when the caller is over the line.
const overLimit = async (db, event, door, max) => {
  const who = whoHash(event, door);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await db
    .from('door_hits')
    .select('id', { count: 'exact', head: true })
    .eq('door', door)
    .eq('who_hash', who)
    .gte('at', since);
  if (error) return false;
  await db.from('door_hits').insert({ door, who_hash: who });
  return (count || 0) >= max;
};

export const deviceLine = (ua) => {
  const s = String(ua || '');
  const device = /iPhone/.test(s) ? 'iPhone'
    : /iPad/.test(s) ? 'iPad'
      : /Android/.test(s) ? 'Android'
        : /Macintosh|Mac OS X/.test(s) ? 'Mac'
          : /Windows/.test(s) ? 'Windows'
            : /Linux/.test(s) ? 'Linux' : 'unknown device';
  const browser = /Edg\//.test(s) ? 'Edge'
    : /OPR\//.test(s) ? 'Opera'
      : /Chrome\//.test(s) ? 'Chrome'
        : /Firefox\//.test(s) ? 'Firefox'
          : /Safari\//.test(s) ? 'Safari' : 'a browser';
  return `${device}, ${browser}`;
};

const publicShape = (row) => ({
  title: row.title,
  detail: row.detail || '',
  kind: row.kind,
  choices: Array.isArray(row.choices) ? row.choices : [],
  status: row.status,
  opened_at: row.opened_at,
  answered_at: row.answered_at,
  answer_choice: row.answer_choice || null,
  client: row.clients?.company || row.clients?.name || '',
});

const lookup = async (db, token) => {
  const { data, error } = await db
    .from('client_items')
    .select('id, client_id, title, detail, kind, choices, status, opened_at, answered_at, answer_choice, clients(name, company)')
    .eq('token', token)
    .maybeSingle();
  if (error || !data || data.status === 'withdrawn') return null;
  return data;
};

export const handler = async (event) => {
  const db = createDb();
  if (!db) return json(500, { ok: false, error: 'Not configured.' });

  if (event.httpMethod === 'GET') {
    if (await overLimit(db, event, 'item-read', READS)) return json(429, { ok: false, error: 'That is a lot of opening in a few minutes. Give it a little while and try again.' });
    const token = String((event.queryStringParameters || {}).k || '').trim();
    if (!TOKEN_OK.test(token)) return json(404, NOPE);
    const row = await lookup(db, token);
    if (!row) return json(404, NOPE);
    return json(200, { ok: true, item: publicShape(row) });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  if (await overLimit(db, event, 'item-write', WRITES)) return json(429, { ok: false, error: 'That is a lot of answers in a few minutes. Give it a little while and try again.' });

  let input = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, NOPE);
  }
  const token = String(input.k || '').trim();
  if (!TOKEN_OK.test(token)) return json(404, NOPE);

  const row = await lookup(db, token);
  if (!row) return json(404, NOPE);
  if (row.status !== 'open') {
    return json(200, { ok: true, already: true, item: publicShape(row) });
  }

  const choices = Array.isArray(row.choices) ? row.choices : [];
  let status = null;
  let choice = null;
  if (choices.length) {
    const n = Number(input.choice);
    if (!Number.isInteger(n) || n < 0 || n >= choices.length) return json(400, { ok: false, error: 'Pick one of the answers on the page.' });
    status = 'approved';
    choice = choices[n];
  } else if (input.answer === 'approve' || input.answer === 'deny') {
    status = input.answer === 'approve' ? 'approved' : 'denied';
  } else {
    return json(400, { ok: false, error: 'Pick approve or deny.' });
  }

  const at = new Date().toISOString();
  const { data: written, error } = await db
    .from('client_items')
    .update({
      status,
      answer_choice: choice,
      answered_at: at,
      answered_via: 'link',
      answered_by: String(input.name || '').trim().slice(0, 80) || null,
      answer_note: String(input.note || '').trim().slice(0, 1000) || null,
      answer_device: deviceLine((event.headers || {})['user-agent']),
    })
    .eq('token', token)
    .eq('status', 'open')
    .select('id, client_id, title, detail, kind, choices, status, opened_at, answered_at, answer_choice, clients(name, company)')
    .maybeSingle();

  if (error) return json(500, { ok: false, error: 'The answer did not save. Try again in a minute.' });
  if (!written) {
    // Somebody else answered between the read and the write. First wins.
    const now = await lookup(db, token);
    return json(200, { ok: true, already: true, item: now ? publicShape(now) : null });
  }

  await db.from('activity_log').insert({
    action: 'client_item_answered',
    entity_type: 'client_item',
    entity_id: written.id,
    metadata: { client_id: written.client_id, status, choice, via: 'link' },
    created_at: at,
  });

  return json(200, { ok: true, item: publicShape(written) });
};
