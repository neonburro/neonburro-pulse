// netlify/functions/client-report-preview.js
// SENTINEL: NB_PULSE_REPORT_PREVIEW_V1
//
// The preview. Tyler's ask, in his words, "we need to have a preview of what
// their report looks like for every client".
//
// POST { client_id, period_end? } and it answers the rendered report for
// that client. It SENDS NOTHING and it SAVES NOTHING, and those two
// sentences are the whole contract of this door. It calls buildReport and
// renderReport from _client-report.js, the same two functions the schedule
// calls, so what Tyler reads here is the bytes a client would receive and
// not an approximation of them. If this door ever grew a template of its
// own the preview would stop being worth looking at.
//
// period_end names any day inside the month to preview and defaults to the
// month that just closed, so a preview on the 27th shows August and not a
// half finished September. The Reports page offers the last twelve months.
//
// The answer carries more than the html, because the page has to be able to
// say what it is showing:
//
//   html          the rendered report, put in an iframe srcDoc by the page
//   data          every derived figure, so the page can show the counts
//   brand.house   true when this client has NO palette and the report fell
//                 back to the house letterhead. The page says so in words
//                 above the preview, because a house report that looks
//                 finished is the one way this feature misleads Tyler.
//   brand.partial true when some keys were given and some were not, with
//                 missing naming which
//   approved      the gate, so the page can say waiting on approval
//   recipients    who it would go to, derived, so a client with no address
//                 is visible before somebody presses send
//   empty         nothing to say in any section this month
//
// Staff only, the same gate the social doors use.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';
import { buildReport, renderReport } from './_client-report.js';

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

  try {
    const report = await buildReport(db, { clientId, periodEnd });
    return json(200, {
      ok: true,
      html: renderReport(report),
      data: report.data,
      narrative: report.narrative,
      sender: report.sender,
      recipients: report.recipients,
      approved: !!report.client.report_approved,
      approved_at: report.client.report_approved_at || null,
      empty: report.empty,
      brand: {
        house: report.brand.house,
        partial: report.brand.partial,
        missing: report.brand.missing,
        accent: report.brand.accent,
        paper: report.brand.paper,
        ink: report.brand.ink,
      },
      period: { start: report.period_start, end: report.period_end, label: report.data.period.label },
    });
  } catch (err) {
    // The brand and gate columns do not exist until the migration runs, and
    // until then every select above fails. Say which rather than 500ing at a
    // person who has no way to know.
    const message = String(err.message || err);
    if (/column .* does not exist|client_reports/i.test(message)) {
      return json(200, {
        ok: false,
        error: 'the report columns are not in the database yet, supabase/migrations/20260927150000_client_reports.sql has not been applied',
      });
    }
    console.error('[client-report] preview failed for', clientId, message);
    return json(500, { error: message });
  }
};
