// netlify/functions/mail-send.js
// SENTINEL: NB_PULSE_MAIL_SEND_V2
//
// The door behind the Mail room. POST { document_id, mode, again? } with the
// signed in session as a bearer token. mode is test or send. Staff only, the
// same gate the report and social doors use (_social.js, super_admin admin
// and manager).
//
// ── ONE RENDERER ────────────────────────────────────────────────────────────
// This door never takes html from the browser. It reads the saved row and
// the client's open items, normalizes the document and calls renderMail from
// src/lib/mailRender.js, the same function the editor's preview calls with
// the same items from src/lib/mailItems.js. What Tyler looked at is what
// leaves, because there is only one thing that can make it.
//
// ── TEST FIRST, AND A TEST OF THESE EXACT BYTES ─────────────────────────────
// A test goes to TEST_TO in src/lib/mailDocument.js and nowhere else, with
// no cc, whatever the document says. A real send is refused unless the
// latest successful test of this document carried the same sha256 of
// subject and html as the send would. Change one comma after the test, or
// let a client answer an open item the letter lists, and the send says so
// and asks for another test. That is Tyler's line of 2026-10-05, a test to
// me first, written as a rule the server keeps rather than a habit somebody
// remembers.
//
// ── WHAT ELSE A SEND REFUSES ────────────────────────────────────────────────
// rowProblems in mailDocument.js. A letter with no client, because every
// letter sits on a client's page. A dismissed one. And anything the system
// drafted, origin not hand, until a person has approved it, which is the
// rule that keeps proposals from ever leaving on a machine's say so.
// A document already sent is refused unless again is true, and Resend gets
// an Idempotency-Key on a first send, the document and the hash, so two
// requests that race past the status check still deliver once.
//
// ── EVERY SEND IS WRITTEN DOWN, AND NOTHING MAILS THE STUDIO PER SEND ───────
// mail_sends gets one row per attempt, test or send, sent or failed, with
// who pressed it, when, the from line, every address, the subject, the
// exact html and text, the hash and the Resend id. The browser can read
// those rows and cannot write them, there is no insert policy. A real send
// also writes one activity_log row and stamps first_send_id on every open
// item it carried for the first time, so an item knows which letter first
// asked it. It does not mail the studio. Tyler, 2026-10-05, "Just don't do
// a bunch of them. Just add them to Pulse." The one digest a day is
// netlify/functions/mail-digest.js.
//
// ── THE RESEND SETUP, BY NAME ───────────────────────────────────────────────
// RESEND_API_KEY, the same variable send-invoice.js and resend-invoice.js
// read on the Pulse site. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY through
// createDb in _social.js. The from line comes from SENDERS in
// mailDocument.js, on neonburro.com, the domain the invoice path has
// delivered from since June. Links are sent exactly as rendered. If click
// tracking is ever switched on for that domain in Resend it will rewrite
// every href, invoices and answer links included, so leave it off.
//
// ── WHY runSend IS SEPARATE FROM handler ────────────────────────────────────
// runSend takes its database and its mailer as arguments, so the whole path
// can be exercised locally with a stub mailer and a stub table and nothing
// leaves. handler is the thin part that wires the real ones in.
//
// No oxford commas, no em dashes.

import { createHash } from 'node:crypto';
import { createDb, gate, json } from './_social.js';
import { renderMail } from '../../src/lib/mailRender.js';
import { loadOpenItems } from '../../src/lib/mailItems.js';
import {
  normalizeMail, checkMail, rowProblems, blockingFor, fromLine, senderOf, hasOpenItemsBlock, TEST_TO, EMAIL_RE,
} from '../../src/lib/mailDocument.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const hashOf = (rendered) => createHash('sha256').update(rendered.hashInput, 'utf8').digest('hex');

// The real mailer. Returns the Resend id or throws with Resend's sentence.
export const resendSend = async (payload, idempotencyKey) => {
  const headers = { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  let result = null;
  try {
    result = await res.json();
  } catch {
    result = null;
  }
  if (!res.ok || !result?.id) throw new Error(result?.message || `resend answered ${res.status}`);
  return result.id;
};

const longDate = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'long', day: 'numeric' });

// db is a supabase client, user is the signed in user, input is the body,
// mailer(payload, idempotencyKey) returns an id or throws. now is injectable
// so a local run is repeatable.
export const runSend = async ({ db, user, input, mailer, now = () => new Date().toISOString() }) => {
  const documentId = String(input?.document_id || '').trim();
  const mode = input?.mode === 'send' ? 'send' : input?.mode === 'test' ? 'test' : null;
  const again = input?.again === true;
  if (!documentId) return { ok: false, error: 'Send a document_id.' };
  if (!mode) return { ok: false, error: 'mode is test or send.' };

  const { data: row, error: readErr } = await db
    .from('mail_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();
  if (readErr) {
    if (/mail_documents/i.test(readErr.message || '')) {
      return { ok: false, error: 'The mail tables are not in the database yet, the mail_composer migration has not been applied.' };
    }
    return { ok: false, error: readErr.message };
  }
  if (!row) return { ok: false, error: 'That letter does not exist.' };

  const doc = normalizeMail(row.doc);
  const { items } = await loadOpenItems(db, row.client_id);
  const rendered = renderMail(doc, { items });
  const hash = hashOf(rendered);
  const problems = [...rowProblems(row), ...checkMail(doc)];
  const blocking = blockingFor(problems, mode);
  if (blocking.length) {
    return { ok: false, error: blocking.map((p) => p.text).join(' '), problems: blocking };
  }

  if (mode === 'send') {
    const { data: lastTest } = await db
      .from('mail_sends')
      .select('content_hash, created_at')
      .eq('document_id', documentId)
      .eq('kind', 'test')
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastTest) {
      return { ok: false, error: `Send a test first. It goes to ${TEST_TO} and the send opens once it lands.` };
    }
    if (lastTest.content_hash !== hash) {
      return { ok: false, error: `The letter changed after the last test, or an open item it lists was answered. Send a test of this version to ${TEST_TO} first.` };
    }
    if (row.status === 'sent' && !again) {
      return { ok: false, already: true, error: `This one already went on ${row.sent_at ? longDate(row.sent_at) : 'an earlier day'}. Press send again to send it a second time.` };
    }
  }

  const sender = senderOf(doc.from);
  const to = mode === 'test' ? [TEST_TO] : doc.to;
  const cc = mode === 'test' ? [] : doc.cc.filter((e) => !doc.to.includes(e));
  // The server is the gate on where a letter goes, not the browser's regex.
  const bad = [...to, ...cc].filter((e) => !EMAIL_RE.test(e));
  if (bad.length) return { ok: false, error: `${bad.join(' and ')} is not an email address.` };

  const subject = mode === 'test' ? `Test • ${rendered.subject}` : rendered.subject;
  const payload = {
    from: fromLine(doc.from),
    to,
    subject,
    html: rendered.html,
    text: rendered.text,
    reply_to: sender.replyTo,
  };
  if (cc.length) payload.cc = cc;

  const idempotencyKey = mode === 'send' && !again ? `mail-${documentId}-${hash.slice(0, 32)}` : null;

  let resendId = null;
  let failure = null;
  try {
    resendId = await mailer(payload, idempotencyKey);
  } catch (err) {
    failure = String(err?.message || err).slice(0, 500);
  }

  const at = now();
  const record = {
    document_id: documentId,
    kind: mode,
    status: failure ? 'failed' : 'sent',
    sent_by: user?.id || null,
    sent_by_email: user?.email || null,
    from_address: payload.from,
    to_emails: to,
    cc_emails: cc,
    subject,
    html: rendered.html,
    text_body: rendered.text,
    content_hash: hash,
    resend_id: resendId,
    error: failure,
    doc,
    created_at: at,
  };
  const { data: sendRow, error: recordErr } = await db.from('mail_sends').insert(record).select('id').maybeSingle();
  const notes = [];
  if (recordErr) {
    console.error('[mail-send] the record did not write', recordErr.message);
    notes.push(`The record did not write, ${recordErr.message}.`);
  }

  if (failure) return { ok: false, error: `Resend refused it, ${failure}`, notes };

  if (mode === 'send') {
    const { error: markErr } = await db
      .from('mail_documents')
      .update({ status: 'sent', sent_at: at, updated_by: user?.id || null })
      .eq('id', documentId);
    if (markErr) notes.push(`The letter went but was not marked sent, ${markErr.message}.`);

    // Every open item this letter carried for the first time remembers it.
    if (hasOpenItemsBlock(doc) && items.length) {
      const fresh = items.filter((it) => !it.first_send_id).map((it) => it.id);
      if (fresh.length) {
        const { error: itemErr } = await db
          .from('client_items')
          .update({ first_document_id: documentId, first_send_id: sendRow?.id || null })
          .in('id', fresh);
        if (itemErr) notes.push(`The open items were not linked to this letter, ${itemErr.message}.`);
      }
    }

    await db.from('activity_log').insert({
      user_id: user?.id || null,
      action: 'mail_sent',
      entity_type: 'mail_document',
      entity_id: documentId,
      metadata: { subject: rendered.subject, kind: row.kind || 'letter', to, cc, resend_id: resendId, open_items: hasOpenItemsBlock(doc) ? items.length : 0 },
      created_at: at,
    });
  }

  console.log('[mail-send]', mode, documentId, 'to', to.length + cc.length, 'by', user?.id, 'resend', resendId);
  return { ok: true, kind: mode, id: resendId, to, cc, subject, hash, at, notes };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { ok: false, error: gated.error });

  let input = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Send json.' });
  }

  if (!RESEND_API_KEY) {
    return json(200, { ok: false, error: 'RESEND_API_KEY is not set on the Pulse site, so nothing went.' });
  }

  try {
    const result = await runSend({ db, user: gated.user, input, mailer: resendSend });
    return json(200, result);
  } catch (err) {
    console.error('[mail-send] failed', err?.message);
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};
