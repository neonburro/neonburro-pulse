// netlify/functions/report-public.js
// SENTINEL: NB_PULSE_REPORT_PUBLIC_V1
//
// The owner's door. Prepared 2026-09-29 by Aster from Tyler's ask, "the link
// has got to be public, they have got to be able to open it".
//
// An owner opens their monthly report from an email or a text, with no
// account and no password, and sends it back with what they marked. That is
// the whole of this file. It is the only door in Pulse that answers somebody
// who is not signed in, so every line of it is written on the assumption that
// whoever is calling might not be Matt.
//
//   GET  ?k=<token>   answers one report, and nothing about any other
//   POST { k, responses, submitted_html, submitted_by }
//                     records the submittal, once, and stamps the time
//
// WHY A TOKEN AND NOT A LOGIN
//
// The same arrangement cimarron-pulse uses for a plan room card in
// PublicCard.jsx, and the same shape Pulse already trusts for accept invite.
// A client portal with passwords is a real thing to build and it is coming,
// but a monthly report that needs an account to read is a monthly report
// nobody reads. The token is the unguessable half of the link, one token
// names one report, and it expires.
//
// WHAT THIS DOOR WILL NOT DO
//
//   · It never takes a client_id, a report id or a period from the caller.
//     The token is the only way in. Ask for a row by id here and you have
//     built a way to read every client's revenue by guessing numbers.
//   · It never trusts a timestamp from the body. submitted_at is the server
//     clock, always. A time we rely on to say what work was authorised must
//     not be settable by the person it binds.
//   · It never lets a submittal be overwritten. First submit wins and the
//     second is refused, because the point of keeping the signed copy is
//     that it cannot change afterwards.
//   · It answers the same shape for a bad token, an expired token and a
//     token that never existed. A door that says "expired" has told an
//     unknown caller that they guessed a real one.
//
// WHAT COMES BACK ON A GET
//
//   html         the report as it was sent, out of client_reports.html
//   period       the month it covers, for the page title and the card
//   client       name and brand mark only, nothing financial beyond the
//                html the owner was already sent
//   submitted    true once it has been sent back, so the page opens locked
//                with the stamp rather than inviting a second answer
//
// No oxford commas, no em dashes.

import { createDb, json } from './_social.js';

const TOKEN_OK = /^[A-Za-z0-9_-]{16,128}$/;

// One shape for every failure, so a caller learns nothing from the wording.
const NOPE = { error: 'This link is not valid. Ask us for a fresh one.' };

const lookup = async (db, token) => {
  const { data, error } = await db
    .from('client_reports')
    .select('id, client_id, period_start, period_end, html, submitted_at, token_expires_at, clients(name, brand_mark_url)')
    .eq('submit_token', token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) return null;
  return data;
};

export const handler = async (event) => {
  const db = createDb();
  if (!db) return json(500, { error: 'Not configured.' });

  // ── the owner opens it ──────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const token = String((event.queryStringParameters || {}).k || '').trim();
    if (!TOKEN_OK.test(token)) return json(404, NOPE);

    const row = await lookup(db, token);
    if (!row) return json(404, NOPE);

    return json(200, {
      ok: true,
      html: row.html || '',
      period: { start: row.period_start, end: row.period_end },
      client: {
        name: row.clients?.name || '',
        mark_url: row.clients?.brand_mark_url || null,
      },
      submitted: !!row.submitted_at,
      submitted_at: row.submitted_at || null,
    });
  }

  // ── the owner sends it back ─────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let input = {};
    try {
      input = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Send json.' });
    }

    const token = String(input.k || '').trim();
    if (!TOKEN_OK.test(token)) return json(404, NOPE);

    const row = await lookup(db, token);
    if (!row) return json(404, NOPE);

    // First submit wins. The signed copy is the record and a record that can
    // be rewritten is not one.
    if (row.submitted_at) {
      return json(409, {
        error: 'This one has already been sent back.',
        submitted_at: row.submitted_at,
      });
    }

    const responses = (input.responses && typeof input.responses === 'object') ? input.responses : {};
    const submittedHtml = typeof input.submitted_html === 'string' ? input.submitted_html : null;
    const submittedBy = String(input.submitted_by || '').slice(0, 200) || null;

    // The server clock, never the body. See the header.
    const now = new Date().toISOString();

    const { error } = await db
      .from('client_reports')
      .update({
        responses,
        submitted_html: submittedHtml,
        submitted_by: submittedBy,
        submitted_at: now,
      })
      .eq('id', row.id)
      .is('submitted_at', null);

    if (error) return json(500, { error: 'Could not save that. Try again in a moment.' });

    return json(200, { ok: true, submitted_at: now });
  }

  return json(405, { error: 'Method not allowed' });
};
