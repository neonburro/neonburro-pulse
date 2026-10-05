// src/lib/mailPropose.js
// SENTINEL: NB_PULSE_MAIL_PROPOSE_V1
//
// THE INSERTION POINT. Everything that will one day draft an update for a
// client without a person writing it, a deploy digest, a security check, the
// weekly or monthly system report, comes in through proposeUpdate here and
// nowhere else. It writes a mail_documents row with status proposed and an
// origin that is not hand, and from that moment the row is in the admin
// queue on /mail/ and on the client's page, and netlify/functions/
// mail-send.js refuses to send it until a person approves it. That rule
// lives in rowProblems in src/lib/mailDocument.js and it is the reason this
// file can be wired to a schedule later without anything reaching a client
// on a machine's say so.
//
// ── WHAT IS NOT BUILT, ON PURPOSE ───────────────────────────────────────────
// Tyler, 2026-10-05, by way of the coordinator. Do not build the automatic
// generators yet, they need credentials and decisions from him. So there is
// no scheduled function reading Netlify deploys or a client's own Supabase.
// proposeDeployDigest below shows the whole shape with the reader injected,
// and it refuses loudly when no reader is handed in. When the decisions are
// made, a scheduled function does three things, picks the clients whose
// report_cadence is due, hands each one a reader and calls these. Nothing
// else changes.
//
// ── IDEMPOTENT BY source_ref ────────────────────────────────────────────────
// A generator that runs twice must not propose twice. source_ref names what
// a proposal was drafted from, deploys:2026-10-01:2026-10-07, and the unique
// index on (client_id, kind, source_ref) in
// supabase/migrations/20261005130000_mail_updates_and_open_items.sql turns a
// second proposal of the same thing into the first row's id.
//
// Pure apart from the db it is handed, a supabase client on the service
// role in a function or on a staff session in the browser. No Node, no
// React, so both can import it.
//
// No oxford commas, no em dashes.

import {
  KINDS, normalizeMail, templateFor, presetForClient, shortDate, todayInRidgway, CADENCES,
} from './mailDocument.js';

// Write one proposed update. Returns { ok, id, duplicate } or { ok: false, error }.
export const proposeUpdate = async (db, { client, kind, doc, origin, sourceRef = null }) => {
  if (!db) return { ok: false, error: 'no database handed in' };
  if (!client?.id) return { ok: false, error: 'a proposal belongs to a client, none was given' };
  if (!KINDS[kind] || kind === 'letter') return { ok: false, error: `${kind} is not a kind of update` };
  const from = String(origin || '').trim();
  if (!from || from === 'hand') return { ok: false, error: 'a proposal needs an origin that says what drafted it, never hand' };

  const clean = normalizeMail(doc);
  if (!clean.to.length && client.email) clean.to = [String(client.email).toLowerCase()];

  const { data, error } = await db
    .from('mail_documents')
    .insert({ client_id: client.id, kind, origin: from, source_ref: sourceRef, status: 'proposed', doc: clean })
    .select('id')
    .maybeSingle();

  if (error) {
    // 23505 is the unique index on client, kind and source_ref. The same
    // thing was proposed before, hand back the row that already holds it.
    if (error.code === '23505' && sourceRef) {
      const { data: existing } = await db
        .from('mail_documents')
        .select('id')
        .eq('client_id', client.id)
        .eq('kind', kind)
        .eq('source_ref', sourceRef)
        .maybeSingle();
      return { ok: true, id: existing?.id || null, duplicate: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id || null, duplicate: false };
};

// ── the deploy digest, the worked example ──────────────────────────────────

// Pure. deploys is [{ date: 'YYYY-MM-DD', site: 'example.com',
// summary: 'Share cards for four pages' }], newest last. Returns a document.
export const deployDigestDoc = ({ client, deploys, asOf = todayInRidgway(), since, until }) => {
  const preset = presetForClient(client);
  const doc = templateFor('deploy_digest', { presetKey: preset?.key, asOf, companyName: client?.company || client?.name });
  const rows = (deploys || []).map((d) => [shortDate(d.date), [d.site, d.summary].filter(Boolean).join(', ')]);
  doc.hero.lede = rows.length === 1
    ? `One change went live between ${shortDate(since)} and ${shortDate(until)}.`
    : `${rows.length} changes went live between ${shortDate(since)} and ${shortDate(until)}.`;
  doc.sections = [
    { type: 'table', title: 'What went live', columns: ['Date', 'What changed'], rows },
    { type: 'open_items', title: 'Waiting on you' },
  ];
  if (client?.email) doc.to = [String(client.email).toLowerCase()];
  return doc;
};

// The shape a generator will take. fetchDeploys({ client, since, until })
// returns the deploys for that client in that window, from wherever Tyler
// decides they come from, the Netlify API under a token he sets or the
// netlify-deploy-webhook rows Pulse already keeps. It is injected so this
// file never holds a credential and so it can be run with a stub.
export const proposeDeployDigest = async (db, { client, since, until, fetchDeploys }) => {
  if (typeof fetchDeploys !== 'function') {
    return { ok: false, error: 'no deploy reader is wired yet. That needs a decision and a credential from Tyler, see the header of src/lib/mailPropose.js.' };
  }
  const deploys = await fetchDeploys({ client, since, until });
  if (!deploys?.length) return { ok: true, skipped: 'nothing went live in that window, nothing proposed' };
  return proposeUpdate(db, {
    client,
    kind: 'deploy_digest',
    origin: 'system:deploy_digest',
    sourceRef: `deploys:${since}:${until}`,
    doc: deployDigestDoc({ client, deploys, asOf: until, since, until }),
  });
};

// ── the periodic report, the template a cadence will fill ──────────────────

// Which clients are due on a given day. Pure, for the scheduled function
// that does not exist yet. lastReportAt is the newest periodic_report sent
// to that client, or null.
export const isReportDue = ({ cadence, lastReportAt, today = todayInRidgway() }) => {
  const days = CADENCES[cadence]?.days;
  if (!days) return false;
  if (!lastReportAt) return true;
  const last = Date.parse(String(lastReportAt).slice(0, 10));
  const now = Date.parse(today);
  return Number.isFinite(last) && Number.isFinite(now) && (now - last) / 86400000 >= days;
};

// A periodic report always carries every open item and the work done since
// the last one. workDone is [{ date, text }]. The open items are not copied
// in, the renderer fills them from the client's rows at the moment of the
// test and the send, so the list is always the current one.
export const periodicReportDoc = ({ client, workDone = [], asOf = todayInRidgway() }) => {
  const preset = presetForClient(client);
  const doc = templateFor('periodic_report', { presetKey: preset?.key, asOf, companyName: client?.company || client?.name });
  doc.sections = [
    { type: 'open_items', title: 'Waiting on you' },
    { type: 'work_done', title: 'Work done since the last report', items: workDone },
  ];
  if (client?.email) doc.to = [String(client.email).toLowerCase()];
  return doc;
};
