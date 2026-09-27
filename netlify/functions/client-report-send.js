// netlify/functions/client-report-send.js
// SENTINEL: NB_PULSE_REPORT_SEND_V1
//
// Send one client's report now, on a person's own click. This is the door
// behind the Send button on the Reports page and it is the only way a report
// leaves the building outside the monthly schedule.
//
// POST { client_id, period_end? }. Staff only.
//
// ── WHAT THIS DOOR REFUSES ──────────────────────────────────────────────────
//
// A report reaches a client only when all four hold, and every one of them
// is checked here and not in the browser, because a check in the browser is
// a soft copy and the policy is the real one.
//
//   1. The caller is staff.
//   2. clients.report_approved is true. A send on an unapproved client is
//      refused with the reason in words, not silently skipped, because a
//      person pressed a button and deserves to be told why nothing went.
//   3. The client has somewhere to send to, clients.email or a primary
//      client_contacts row, or clients.report_to when it is set.
//   4. The report has something to say. An empty month is refused rather
//      than mailed, unless the caller passes allow_empty, which exists so a
//      person who has read the preview and wants it sent anyway can say so.
//
// A refusal is a 200 with ok:false and a sentence, not an error status. The
// page shows the sentence. Nothing about a refusal is exceptional.
//
// ── THE STUDIO ALWAYS HEARS ─────────────────────────────────────────────────
//
// sendReport in _client-report.js mails the studio on every successful send,
// with who it went to, when, and a link to the stored bytes. That is not
// optional and there is no flag here to turn it off.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';
import { buildReport, sendReport } from './_client-report.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  let input = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Send json.' });
  }

  const clientId = String(input.client_id || '').trim();
  if (!clientId) return json(400, { error: 'Send a client_id.' });
  const periodEnd = input.period_end ? String(input.period_end).slice(0, 10) : null;
  const allowEmpty = input.allow_empty === true;

  try {
    const report = await buildReport(db, { clientId, periodEnd });

    if (!report.client.report_approved) {
      return json(200, {
        ok: false,
        error: 'this client is not approved for the report yet. Approve them on the Reports page and the send opens.',
      });
    }
    if (!report.recipients.length) {
      return json(200, {
        ok: false,
        error: 'this client has no email address and no primary contact, so there is nowhere to send it.',
      });
    }
    if (report.empty && !allowEmpty) {
      return json(200, {
        ok: false,
        empty: true,
        error: `there is nothing to report for ${report.data.period.label}. Nothing shipped, nothing was billed and nothing is open.`,
      });
    }

    const sent = await sendReport(db, report);
    if (!sent.ok) return json(200, { ok: false, error: sent.error });

    console.log('[client-report] sent for', clientId, report.period_start, 'to', sent.to.length, 'recipients by', gated.user.id);
    return json(200, { ok: true, id: sent.id, count: sent.to.length, notes: sent.notes, period: report.data.period.label });
  } catch (err) {
    const message = String(err.message || err);
    if (/column .* does not exist|client_reports/i.test(message)) {
      return json(200, {
        ok: false,
        error: 'the report tables are not in the database yet, supabase/migrations/20260927150000_client_reports.sql has not been applied',
      });
    }
    console.error('[client-report] send failed for', clientId, message);
    return json(500, { error: message });
  }
};
