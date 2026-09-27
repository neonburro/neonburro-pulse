// netlify/functions/client-report-monthly.js
// SENTINEL: NB_PULSE_REPORT_MONTHLY_V1
//
// The automatic half. Tyler's ask, "all we have to do is approve it once,
// and then it's automated".
//
// Scheduled for the 1st at 14:00 UTC, which is 8am in Ridgway in summer and
// 7am in winter, the same hour cimarron-pulse settled on for the weekly. The
// schedule lives in netlify.toml AND in the export const config below, and
// the two must agree. Netlify honours only the per function table in
// netlify.toml; an inline schedule alone was ignored without complaint until
// 2026-09-12 and flip-overdue-invoices never fired for weeks because of it.
// Change both or neither.
//
// It reports the month that just closed, because it runs on the 1st.
//
// ── IT FAILS CLOSED, FOUR WAYS ──────────────────────────────────────────────
//
// 1. It selects only clients where report_approved is true. The column
//    defaults to false, so a new client is skipped until a hand approves
//    them. A permissive default here would be the one way this feature
//    mails somebody it should not have.
// 2. Until the migration runs, the select on report_approved errors and
//    this function sends nothing and says so in the log. That is the honest
//    state of an unapplied migration and it is deliberately not worked
//    around.
// 3. A client with nowhere to send to is skipped, not guessed at.
// 4. An empty month is skipped. A client who hears from us monthly should
//    hear something, and a page that says nothing happened is worse than
//    silence.
//
// Every send tells the studio, through sendReport in _client-report.js. One
// mail per client sent, so the studio inbox on the 1st is a list of exactly
// who heard from us.
//
// The log prints client ids and counts and never a name or an address.
//
// No oxford commas, no em dashes.

import { createDb } from './_social.js';
import { buildReport, sendReport } from './_client-report.js';

export const config = { schedule: '0 14 1 * *' };

export const handler = async () => {
  const db = createDb();
  if (!db) {
    console.error('[client-report] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set on the Pulse site, nothing ran');
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'the database is not configured' }) };
  }

  const { data: approved, error } = await db
    .from('clients')
    .select('id')
    .eq('report_approved', true)
    .order('created_at', { ascending: true });

  if (error) {
    // The unapplied migration lands here. Say so plainly and send nothing.
    console.error('[client-report] the approved list could not be read, nothing was sent.', error.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false, sent: 0, error: error.message }) };
  }
  if (!approved?.length) {
    console.log('[client-report] no client is approved for the monthly report, nothing was sent');
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, approved: 0 }) };
  }

  const results = { sent: 0, skipped_empty: 0, skipped_no_address: 0, failed: 0 };

  for (const row of approved) {
    try {
      const report = await buildReport(db, { clientId: row.id });

      if (!report.recipients.length) {
        results.skipped_no_address += 1;
        console.log('[client-report] skipped', row.id, 'no address');
        continue;
      }
      if (report.empty) {
        results.skipped_empty += 1;
        console.log('[client-report] skipped', row.id, 'nothing to report for', report.period_start);
        continue;
      }

      const sent = await sendReport(db, report);
      if (sent.ok) {
        results.sent += 1;
        console.log('[client-report] sent', row.id, report.period_start, 'to', sent.to.length, sent.notes.length ? `notes ${sent.notes.join('; ')}` : '');
      } else {
        results.failed += 1;
        console.error('[client-report] failed', row.id, sent.error);
      }
    } catch (err) {
      // One client's bad row does not stop the other ten.
      results.failed += 1;
      console.error('[client-report] threw on', row.id, String(err.message || err));
    }
  }

  console.log('[client-report] monthly run done,', JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ ok: true, approved: approved.length, ...results }) };
};
