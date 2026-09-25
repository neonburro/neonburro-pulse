// netlify/functions/transcribe.js
// SENTINEL: NB_PULSE_TRANSCRIBE_V2
//
// The ear on Volt's desk. The mic beside the input in
// src/components/Layout/VoltDesk.jsx records through MediaRecorder, posts
// the audio here, and the words come back and drop into the input. That is
// all this door does. It never writes an ask and never talks to a model,
// the chat is netlify/functions/volt-chat.js. One action, POST, session
// gated and staff only the way publish-blog-post.js gates, through gate()
// in _social.js.
//
// The transcriber is Deepgram nova-3 with smart_format and the keyterms
// neonburro, Ridgway, Ouray, Pulse and Volt, the same call the studio makes
// in neonburro/netlify/functions/voice-voicemail.js transcribe(). The key is
// DEEPGRAM_API_KEY on the Pulse site, functions scope, and it never leaves
// this file. Until it is set every tap answers with one plain line.
//
// ── THE CEILINGS, BINDING ───────────────────────────────────────────────────
// neonburro/docs/02-engineering/interaction-ceilings.md. A tap here makes
// the studio spend, so this door carries all three, counted off rows in
// public.desk_turns with kind hear, written before the call, never a count
// header, failing closed, staff or not. The desk_turns row is the meter for
// this surface, it carries the seconds and the dollars. There is no
// agent_usage row because nothing here is a model call.
//
//   the session    9 hearings in 3 minutes per operator. Tyler's numbers.
//                  Measured as a rolling three minute window because a
//                  function has no session object to measure from, a tenth
//                  inside the window waits.
//   the day        DAY_USD per operator per rolling day, the count derived.
//   the life       LIFE_USD for the life of the desk, every hear row, the
//                  count derived.
//
// ── THE ARITHMETIC, READ 2026-09-25 ─────────────────────────────────────────
// Deepgram nova-3 prerecorded, pay as you go, $0.0043 a minute. A recording
// is capped at MAX_SECONDS, three minutes, in the browser and again here,
// so the worst case hearing is
//
//   3 minutes x $0.0043 = $0.0129, held as COST_PER_HEARING_USD $0.013,
//   rounded up the way draft-release.js rounds its constant.
//
//   the day     $1.00 / $0.013 = 76.9    DAY_CAP 76 hearings per person
//   the life    $10.00 / $0.013 = 769.2  LIFE_CAP 769 hearings for the desk
//
// The dollars are judgement, said plainly. There is no order behind this
// surface and so no price to take two percent of, it is a studio cost the
// way the draft door is. If the price, the cap or the model moves, redo the
// two lines and move the constant. The counts are outputs, never copied
// forward. The real spend on a row is the seconds Deepgram reported times
// the price, which is what cost_usd holds and what the daily report reads.
//
// ── THE ORDER OF THINGS ─────────────────────────────────────────────────────
// The trail row is written before anything else so a refused hearing still
// holds who asked and where, then the count, then Deepgram. A refusal after
// the trail marks its own row refused and the counts skip it, so a refused
// hearing spends nothing. A Deepgram error marks the row refused too,
// Deepgram bills on success. A timeout does not, we cannot know, so it
// counts. If the trail cannot write or the count cannot be taken the door
// closes, it never hears when it cannot count.
//
// ── THE CLOCK ───────────────────────────────────────────────────────────────
// A synchronous Netlify function has ten seconds. nova-3 runs around forty
// times realtime so three minutes of audio is under five seconds, and the
// Deepgram call aborts at DEEPGRAM_TIMEOUT_MS to leave room to write the row
// and answer. A timed out call answers with the plain failure line.
//
// ── THE BODY ────────────────────────────────────────────────────────────────
// JSON with the audio as base64, never a raw binary body, because Netlify
// base64 encodes binary bodies on its own and the two paths disagree. The
// browser records opus in webm at 32 kbps, Safari records aac in mp4, so
// three minutes is about 0.7 MB and about 3 MB base64 at the worst. The
// decoded size is capped at MAX_BYTES under the 6 MB payload limit.
//
// MAX_SECONDS here matches MAX_SECONDS in src/components/Layout/VoltDesk.jsx.
// The mic stops itself at that number, this file refuses past it with a
// little slack for the browser's clock. Change them together. The closed
// door lines below render verbatim on the desk, it keeps no copy keyed on
// reason.
//
// Needs DEEPGRAM_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the
// Pulse site, plus the 2026-09-25 desk migration applied for desk_turns.
// Until the table exists every tap closes with the trail message, which is
// the honest state.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&keyterm=neonburro&keyterm=Ridgway&keyterm=Ouray&keyterm=Pulse&keyterm=Volt';
const DEEPGRAM_TIMEOUT_MS = 8500;
const USD_PER_MINUTE = 0.0043;
const MODEL = 'deepgram-nova-3';
const KIND = 'hear';
const MAX_SECONDS = 180;
const SECONDS_SLACK = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const PAGE_CHARS = 200;
const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'];

// The ceilings. See the arithmetic in the header before touching any of these.
const COST_PER_HEARING_USD = 0.013;
const SESSION_MS = 3 * 60 * 1000;
const SESSION_CAP = 9;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_USD = 1.00;
const LIFE_USD = 10.00;
const DAY_CAP = Math.max(0, Math.floor(DAY_USD / COST_PER_HEARING_USD));
const LIFE_CAP = Math.max(0, Math.floor(LIFE_USD / COST_PER_HEARING_USD));

// What a closed door says. Words, never a number the person did not know
// about, except the counts, which staff may know.
const CLOSED = {
  session: 'that is nine hearings in three minutes. give it a minute and the mic listens again, or type it.',
  day: `that is ${DAY_CAP} hearings today, the day's budget. tomorrow it opens again, or type it.`,
  life: `the desk has had its ${LIFE_CAP} hearings, the budget for its life. type it, and a person decides what happens next.`,
  count: 'volt cannot count right now, so the mic is closed. type it, or try again in a minute.',
  trail: 'volt could not write the trail, so the mic is closed. nothing was spent. type it.',
  key: 'DEEPGRAM_API_KEY is not set on the Pulse site, so volt cannot hear yet. type it.',
  heard: 'volt could not hear that. try again, or type it.',
  nothing: 'volt heard nothing. tap, speak, tap again.',
  long: 'that is over three minutes. say it in two takes.',
  big: 'that recording is too large to carry. say it in two takes.',
};

const n = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const round6 = (value) => Math.round(value * 1e6) / 1e6;
const baseMime = (mime) => String(mime || '').split(';')[0].trim().toLowerCase();

// ── the count ───────────────────────────────────────────────────────────────
// Rows and a limit, never a count header. Refused rows are skipped. Throws
// when it cannot tell, and the caller closes the door on a throw. Cheapest
// window first so an operator already stopped by the session never runs the
// all time read. Refused on greater than, the trail row just written is
// inside the count, so the ninth hearing in a session is heard and the
// tenth is not.
const overLimit = async (db, userId) => {
  const rows = async (query, cap) => {
    const { data, error } = await query.eq('kind', KIND).is('refused', null).limit(cap + 2);
    if (error) throw new Error(error.message);
    return (data || []).length;
  };
  const since = (ms) => new Date(Date.now() - ms).toISOString();

  const inSession = await rows(
    db.from('desk_turns').select('id').eq('user_id', userId).gte('created_at', since(SESSION_MS)),
    SESSION_CAP,
  );
  if (inSession > SESSION_CAP) return { reason: 'session', detail: `${inSession} in three minutes` };

  const inDay = await rows(
    db.from('desk_turns').select('id').eq('user_id', userId).gte('created_at', since(DAY_MS)),
    DAY_CAP,
  );
  if (inDay > DAY_CAP) return { reason: 'day', detail: `${inDay} in a day` };

  const inLife = await rows(
    db.from('desk_turns').select('id'),
    LIFE_CAP,
  );
  if (inLife > LIFE_CAP) return { reason: 'life', detail: `${inLife} of ${LIFE_CAP} on the desk` };

  return null;
};

// A refusal after the trail marks its own row so the counts skip it. If the
// mark fails the row counts, which fails closed.
const markRefused = async (db, trailId, reason) => {
  if (!trailId) return;
  const { error } = await db.from('desk_turns').update({ refused: true, refusal: reason }).eq('id', trailId);
  if (error) console.warn('[transcribe] could not mark the trail refused, it will count,', error.message);
};

// ── the ear ─────────────────────────────────────────────────────────────────
// Returns { transcript, duration, requestId } or { failed, status, threw }.
// The key rides in the header and is never logged. A non ok status is a
// failure that spent nothing, a throw is a timeout that may have.
const hear = async (buffer, mime) => {
  try {
    const res = await fetch(DEEPGRAM_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': mime },
      body: buffer,
      signal: AbortSignal.timeout(DEEPGRAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[transcribe] deepgram answered', res.status);
      return { failed: true, status: res.status };
    }
    const data = await res.json();
    const transcript = String(data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
    return {
      transcript,
      duration: n(data?.metadata?.duration),
      requestId: data?.metadata?.request_id || null,
    };
  } catch (err) {
    console.warn('[transcribe] deepgram threw', err.message);
    return { failed: true, status: 0, threw: true };
  }
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { error: gated.error });
  if (!DEEPGRAM_API_KEY) return json(503, { error: CLOSED.key, message: CLOSED.key, reason: 'key' });

  let input = {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}');
    input = JSON.parse(raw || '{}');
  } catch {
    return json(400, { error: 'Send json.' });
  }

  const mime = baseMime(input.mime) || 'audio/webm';
  if (!MIMES.includes(mime)) return json(400, { error: 'That audio type is not one volt can hear.' });
  const claimed = Math.round(n(input.seconds));
  if (claimed > MAX_SECONDS + SECONDS_SLACK) return json(400, { error: CLOSED.long, message: CLOSED.long, reason: 'long' });
  const audio = String(input.audio || '');
  if (!audio) return json(400, { error: 'Send the audio.' });
  const buffer = Buffer.from(audio, 'base64');
  if (!buffer.length) return json(400, { error: 'Send the audio.' });
  if (buffer.length > MAX_BYTES) return json(413, { error: CLOSED.big, message: CLOSED.big, reason: 'big' });
  const page = String(input.page || '').trim().slice(0, PAGE_CHARS) || null;
  const chatId = String(input.chat_id || '').trim().slice(0, 64) || null;

  try {
    // The trail, before anything can be spent.
    const { data: trail, error: trailErr } = await db
      .from('desk_turns')
      .insert({ kind: KIND, chat_id: chatId, user_id: gated.user.id, page, model: MODEL, seconds: claimed })
      .select('id')
      .maybeSingle();
    if (trailErr || !trail) {
      console.error('[transcribe] trail did not write, refusing,', trailErr?.message);
      return json(503, { error: CLOSED.trail, message: CLOSED.trail, reason: 'trail' });
    }

    // The ceiling, after the trail and before the ear.
    let over = null;
    try {
      over = await overLimit(db, gated.user.id);
    } catch (err) {
      console.error('[transcribe] could not count, refusing,', err.message);
      await markRefused(db, trail.id, 'count');
      return json(503, { error: CLOSED.count, message: CLOSED.count, reason: 'count' });
    }
    if (over) {
      console.warn(`[transcribe] ${gated.user.id} over the ${over.reason} ceiling, ${over.detail}, refused`);
      await markRefused(db, trail.id, over.reason);
      return json(429, { error: CLOSED[over.reason], message: CLOSED[over.reason], reason: over.reason });
    }

    const heard = await hear(buffer, mime);
    if (heard.failed) {
      if (!heard.threw) await markRefused(db, trail.id, `deepgram ${heard.status}`);
      return json(502, { error: CLOSED.heard, message: CLOSED.heard, reason: 'heard' });
    }

    const seconds = Math.round(heard.duration) || claimed;
    const cost = round6((heard.duration / 60) * USD_PER_MINUTE);
    const { error: fillErr } = await db
      .from('desk_turns')
      .update({ seconds, cost_usd: cost, request_id: heard.requestId })
      .eq('id', trail.id);
    if (fillErr) console.warn('[transcribe] the row did not take the spend,', fillErr.message);

    if (!heard.transcript) return json(422, { error: CLOSED.nothing, message: CLOSED.nothing, reason: 'nothing' });

    return json(200, { ok: true, transcript: heard.transcript, seconds, cost_usd: cost });
  } catch (err) {
    console.error('[transcribe] error', err);
    return json(500, { error: err.message || 'The ear hit an error.' });
  }
};
