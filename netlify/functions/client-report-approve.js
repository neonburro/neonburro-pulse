// netlify/functions/client-report-approve.js
// SENTINEL: NB_PULSE_REPORT_APPROVE_V1
//
// The gate. Tyler's ask, in his words, "all we have to do is approve it
// once, and then it's automated".
//
// POST { client_id, approved } flips clients.report_approved and records
// when and who. The monthly schedule reads only rows where it is true, so
// until a hand comes through this door a client is skipped and the Reports
// page lists them as waiting. The column defaults to false in the migration
// and that default is the fail closed rule, nothing reaches a client
// because a default was permissive.
//
// ── WHY THIS IS A FUNCTION AND NOT A BROWSER UPDATE ─────────────────────────
//
// Every other small flag in Pulse is written straight from the page with the
// session key, and this one is not, because public.clients carries a policy
// named "Authenticated users can manage clients" with cmd ALL and a qual of
// only auth.uid() is not null. That grants every authenticated account,
// including a client portal account, full write on every client row. Under
// that policy a browser side approval flip would be a gate anybody signed in
// could open, which is not a gate.
//
// So the flip goes through the service role behind the staff gate instead,
// and the real fix, scoping that policy to staff, is raised separately and
// is not this file's job. When the policy is tightened this door is still
// the right shape and can stay.
//
// Staff only. The approving user id is written to report_approved_by from
// the session and never from the body, so the record says whose approval it
// actually was.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';

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
  if (typeof input.approved !== 'boolean') return json(400, { error: 'Send approved, true or false.' });

  const patch = input.approved
    ? { report_approved: true, report_approved_at: new Date().toISOString(), report_approved_by: gated.user.id }
    : { report_approved: false, report_approved_at: null, report_approved_by: null };

  const { data, error } = await db
    .from('clients')
    .update(patch)
    .eq('id', clientId)
    .select('id, report_approved, report_approved_at')
    .maybeSingle();

  if (error) {
    const message = String(error.message || error);
    if (/column .* does not exist/i.test(message)) {
      return json(200, {
        ok: false,
        error: 'the gate columns are not in the database yet, supabase/migrations/20260927150000_client_reports.sql has not been applied',
      });
    }
    console.error('[client-report] approve failed for', clientId, message);
    return json(500, { error: message });
  }
  if (!data) return json(404, { error: 'no such client' });

  // The client id only, never a name or an address, the same rule every log
  // line in this build follows.
  console.log('[client-report] gate', data.report_approved ? 'opened' : 'closed', 'for', clientId, 'by', gated.user.id);

  return json(200, { ok: true, approved: data.report_approved, approved_at: data.report_approved_at });
};
