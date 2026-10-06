// netlify/functions/daylight-public.js
//
// THE ONLY DOOR THE SHARED LINK EVER KNOCKS ON.
//
// Daylight's client page is public. Anybody holding the link opens it with no
// session, no login and no Supabase key, and that is the point. Everything it
// can see or do comes through here, where the service key lives and where a
// token buys exactly two things: the next three weeks as the studio marked
// them, and the right to offer a time back.
//
// WHY NOT JUST LET THE PAGE READ SUPABASE. Because a key in a public page
// reaches any table the policies happen to allow, and this org has already had
// fourteen tables answering to any anon token once. Two things stop that here
// and BOTH are needed, neither is enough alone:
//
//   1. the three daylight tables grant the anon role nothing. RLS is on and no
//      policy names anon or public, checked against the live database.
//   2. everything the public page needs comes through this function, which
//      answers a token and nothing else.
//
// Point 1 is the real wall. The page is served by the same bundle as the rest
// of Pulse, so the anon key is present in it whatever this file does, and any
// design that depends on the key being absent is a design that is already
// wrong.
//
// WHAT A TOKEN DOES NOT BUY. It never returns a note Tyler wrote on a day, only
// the state. His note is for the studio board. "Gone" is all a client needs and
// "Gone, Telluride with the kids" is not theirs. It never returns another
// client's offers, or any offer at all, because availability goes one way: they
// tell us, they do not read the room. It never returns a client id, a name
// beyond the label on the link, or anything from appointments.
//
// RATE AND SIZE. One offer is a row, so the write is capped per token per day
// and every string is clamped before it reaches the database. A public endpoint
// with no cap is somebody else's free database.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supa = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const json = (code, body) => ({
  statusCode: code,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

// Must match HORIZON_DAYS in src/lib/daylight.js. Said in both files on purpose,
// there is no shared module across the browser and the function bundle.
const HORIZON_DAYS = 21;
const MAX_OFFERS_PER_DAY = 12;
const TYPES = ['call', 'video', 'in_person'];

const clamp = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// Local YYYY-MM-DD in Ridgway, which is where the studio's day starts and ends.
// Not the server's UTC day: at 6pm Mountain the UTC date is already tomorrow and
// the board would drop today off the front.
const ridgwayToday = () => {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return f.format(new Date());
};

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const linkFor = async (token) => {
  if (!token || token.length < 16 || token.length > 128) return null;
  const { data } = await supa
    .from('daylight_links')
    .select('id, label, revoked_at')
    .eq('token', token)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return data;
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!supa) return json(500, { error: 'Not configured.' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Send JSON.' }); }

  const token = clamp(body.token, 128);
  const link = await linkFor(token);
  // One answer for a bad token, a revoked token and a token that never existed.
  // Telling them apart tells somebody probing which guesses were close.
  if (!link) return json(404, { error: 'This link is not open.' });

  const from = ridgwayToday();
  const to = addDays(from, HORIZON_DAYS - 1);
  const action = clamp(body.action, 16) || 'board';

  // ── THE BOARD ─────────────────────────────────────────────────────────────
  // The hours that are taken, and NOT what is happening in them. `note` is the
  // studio's own line, "Telluride with the kids", and is never selected here.
  // A client needs to know an hour is spoken for, not why.
  if (action === 'board') {
    const { data, error } = await supa
      .from('daylight_blocks')
      .select('day, start_min, end_min')
      .gte('day', from)
      .lte('day', to)
      .order('start_min', { ascending: true });
    if (error) return json(500, { error: 'Could not read the weeks.' });

    const days = {};
    for (const row of data || []) {
      (days[row.day] ||= []).push({ start_min: row.start_min, end_min: row.end_min });
    }
    return json(200, { label: link.label, from, days, horizon: HORIZON_DAYS });
  }

  // ── AN OFFER ──────────────────────────────────────────────────────────────
  if (action === 'offer') {
    const day = clamp(body.day, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < from || day > to) {
      return json(400, { error: 'Pick a day inside the three weeks.' });
    }

    const startMin = Number(body.startMin);
    if (!Number.isInteger(startMin) || startMin < 0 || startMin > 1439) {
      return json(400, { error: 'That time did not come through.' });
    }

    const minutes = Number(body.minutes) || 30;
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 480) {
      return json(400, { error: 'That length did not come through.' });
    }

    const meetingType = clamp(body.meetingType, 16);
    if (!TYPES.includes(meetingType)) return json(400, { error: 'Pick how you would like to meet.' });

    // The hour has to still be free. Checked HERE and not only in the page,
    // because the page is public and a check in the browser is a suggestion.
    //
    // THE ERROR IS NOT IGNORED, AND THAT IS THE POINT. An earlier version read
    // only `data` and let a failed lookup through, because a query that errors
    // returns no rows and no rows looks exactly like a free day. That is a gate
    // that opens when the lock breaks. A read that did not succeed is not
    // evidence the hour is free, so it is refused.
    const { data: blocks, error: blockErr } = await supa
      .from('daylight_blocks').select('start_min, end_min').eq('day', day);
    if (blockErr) return json(503, { error: 'Could not check that day just now. Try again in a moment.' });

    // Overlap, the plain version: two ranges clash unless one ends before the
    // other starts. Same arithmetic as isFree in src/lib/daylight.js, said twice
    // because the browser and the function bundle share no module. IF THE RULE
    // CHANGES IT CHANGES IN BOTH.
    const clash = (blocks || []).some((b) => startMin < b.end_min && startMin + minutes > b.start_min);
    if (clash) {
      return json(409, { error: 'That hour was taken since the page loaded. Pick another.' });
    }

    const { count } = await supa
      .from('daylight_offers')
      .select('id', { count: 'exact', head: true })
      .eq('link_id', link.id)
      .eq('day', day);
    if ((count || 0) >= MAX_OFFERS_PER_DAY) {
      return json(429, { error: 'That is plenty of times for one day. We will come back to you.' });
    }

    const { error } = await supa.from('daylight_offers').insert({
      link_id: link.id,
      day,
      start_min: startMin,
      minutes,
      meeting_type: meetingType,
      note: clamp(body.note, 400) || null,
    });
    if (error) return json(500, { error: 'It did not save. Try once more.' });

    return json(200, { ok: true });
  }

  return json(400, { error: 'Unknown action.' });
};
