// netlify/functions/mail-digest.js
// SENTINEL: NB_PULSE_MAIL_DIGEST_V1
//
// The one quiet email a day about what is waiting on Tyler in the Mail room.
// Tyler, 2026-10-05, "I don't mind sending notifications. Admin
// notifications could just be email. Just don't do a bunch of them. Just
// add them to Pulse."
//
// So the queue lives in Pulse, at the top of /mail/ with a count, and this
// is the only email about it. It runs once a day at 14:00 UTC, eight in the
// morning in Ridgway in summer and seven in winter, and it sends only when
// something NEW has arrived since the last digest. Something already in the
// last digest and still waiting does not trigger another one, it is still in
// the queue and in the count, which is where Tyler said it belongs. When
// nothing is new the run logs one line and sends nothing.
//
// What counts as waiting, the same two things loadQueue in
// src/pages/Mail/client/mailData.js reads for the room.
//   proposed updates, mail_documents with status proposed
//   answers back, client_items answered and not yet seen in Pulse
//
// ── THE SAME RENDERER AND THE SAME PATH ─────────────────────────────────────
// The digest is a Mail document drawn by renderMail in src/lib/mailRender.js
// on the house colours, and it goes through resendSend in mail-send.js,
// RESEND_API_KEY, from notifications@neonburro.com the way every studio
// notice in Pulse goes, to NOTIFICATION_EMAIL or hello@neonburro.com. It
// never goes to a client and it names no client address.
//
// ── THE MEMORY ──────────────────────────────────────────────────────────────
// The last digest is an activity_log row, action mail_digest_sent, written
// after a send that worked. No new table. If the send fails no row is
// written, so tomorrow's run sees the same things as new and tries again.
//
// ── THE SCHEDULE IS IN TWO PLACES ───────────────────────────────────────────
// export const config below and [functions."mail-digest"] in netlify.toml.
// The house rule from netlify.toml's own header, the two must agree.
//
// No oxford commas, no em dashes.

import { createDb } from './_social.js';
import { resendSend } from './mail-send.js';
import { renderMail } from '../../src/lib/mailRender.js';
import { blankMail, kindLabel } from '../../src/lib/mailDocument.js';

export const config = { schedule: '0 14 * * *' };

const STUDIO_TO = process.env.NOTIFICATION_EMAIL || 'hello@neonburro.com';
const FROM = 'NeonBurro Pulse <notifications@neonburro.com>';
const PULSE_MAIL = 'https://pulse.neonburro.com/mail/';

const who = (row) => row?.clients?.company || row?.clients?.name || 'no client';

// Pure, so it can be rendered and looked at without a database.
export const digestDoc = ({ proposed, answers, fresh, asOf }) => {
  const total = proposed.length + answers.length;
  const doc = blankMail('neonburro', asOf);
  doc.to = [STUDIO_TO];
  doc.subject = `Pulse • ${total} waiting on you`;
  doc.preheader = `${fresh} new since yesterday. Nothing has been sent to anybody.`;
  doc.hero = {
    kicker: 'Pulse  ·  the mail room',
    headline: total === 1 ? 'One thing is waiting on you.' : `${total} things are waiting on you.`,
    lede: `${fresh} arrived since the last digest. Nothing below has been sent to anybody and nothing will be until you open it.`,
    buttonLabel: 'Open the queue ›',
    buttonUrl: PULSE_MAIL,
    codeLine: '',
    code: '',
  };
  doc.sections = [];
  if (proposed.length) {
    doc.sections.push({
      type: 'list',
      title: 'Proposed, waiting for approval',
      items: proposed.map((r) => `${who(r)}, ${kindLabel(r.kind).toLowerCase()}, ${r.doc?.subject || 'untitled'}`),
    });
  }
  if (answers.length) {
    doc.sections.push({
      type: 'list',
      title: 'Answers back from clients',
      items: answers.map((i) => `${who(i)}, ${i.title}, ${i.answer_choice || i.status}`),
    });
  }
  doc.cardsLabel = '';
  doc.cards = [];
  doc.signature = {
    tagline: '', subline: '', name: '', title: '', phone: '', email: '',
    siteLabel: 'neonburro.com', siteUrl: 'https://neonburro.com/',
    loginLabel: 'Open Pulse', loginUrl: PULSE_MAIL,
    signoff: 'one digest a day, only when something is new',
  };
  return doc;
};

export const runDigest = async ({ db, mailer, now = () => new Date() }) => {
  const { data: last } = await db
    .from('activity_log')
    .select('created_at')
    .eq('action', 'mail_digest_sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = last?.created_at || '1970-01-01T00:00:00Z';

  const [docs, answers] = await Promise.all([
    db.from('mail_documents').select('id, kind, doc, created_at, clients(name, company)').eq('status', 'proposed').order('created_at', { ascending: true }),
    db.from('client_items').select('id, title, status, answer_choice, answered_at, clients(name, company)').not('answered_at', 'is', null).is('seen_at', null).neq('status', 'withdrawn').order('answered_at', { ascending: true }),
  ]);
  const proposed = docs.data || [];
  const answered = answers.data || [];
  const fresh = proposed.filter((r) => r.created_at > since).length + answered.filter((i) => i.answered_at > since).length;

  if (!fresh) return { ok: true, sent: false, reason: `nothing new since ${since}`, waiting: proposed.length + answered.length };

  const asOf = now().toISOString().slice(0, 10);
  const rendered = renderMail(digestDoc({ proposed, answers: answered, fresh, asOf }));
  const id = await mailer({ from: FROM, to: [STUDIO_TO], subject: rendered.subject, html: rendered.html, text: rendered.text }, null);

  await db.from('activity_log').insert({
    action: 'mail_digest_sent',
    entity_type: 'mail_digest',
    metadata: { proposed: proposed.length, answers: answered.length, fresh, resend_id: id },
    created_at: now().toISOString(),
  });
  return { ok: true, sent: true, id, fresh, waiting: proposed.length + answered.length };
};

export const handler = async () => {
  const db = createDb();
  if (!db) { console.log('[mail-digest] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set, nothing ran'); return { statusCode: 200 }; }
  if (!process.env.RESEND_API_KEY) { console.log('[mail-digest] RESEND_API_KEY is not set, nothing ran'); return { statusCode: 200 }; }
  try {
    const result = await runDigest({ db, mailer: resendSend });
    console.log('[mail-digest]', JSON.stringify(result));
  } catch (err) {
    console.error('[mail-digest] failed', err?.message);
  }
  return { statusCode: 200 };
};
