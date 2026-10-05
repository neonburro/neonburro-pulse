// netlify/functions/send-team-invite.js
// SENTINEL: NB_PULSE_TEAM_INVITE_V2
//
// Invites a new team member to Pulse. The one caller is the Invite button in
// src/pages/Settings/components/SettingsTeam.jsx.
//
// POST { email, display_name, role }. role is admin, manager or team.
//
//   1. Checks the caller is signed in and holds super_admin or admin
//   2. Calls auth.admin.inviteUserByEmail with redirect to /accept-invite/
//   3. Upserts the profiles row with display_name and role
//   4. Supabase sends the branded invite mail itself, the auth template does it
//
// ── WHY THIS DOOR IS LOCKED, 2026-10-05 ─────────────────────────────────────
// Until this date the function had no authentication at all. It took the role
// from the POST body and wrote it with the service role key, so anybody on the
// internet could post their own address with role admin and receive a working
// admin invite to pulse.neonburro.com. admin is in the staff list every staff
// door checks, so that was the client book, the invoices and the payments in
// one request. Nothing in the logs says whether it was ever used.
//
// ── WHO MAY INVITE ──────────────────────────────────────────────────────────
// gate() in _social.js answers 401 without a session and 403 for anybody who
// is not super_admin, admin or manager. This door then narrows it to
// super_admin and admin, because that is who the Settings page shows the team
// section to (canManageTeam in src/pages/Settings/index.jsx) and who the
// profiles_guard_authority_fields trigger lets change a role
// (supabase/migrations/20260916090353_socials_account_routing_and_staff_rls.sql).
// A manager can no more mint an admin here than in the table. If one of the
// three lists moves, move the other two in the same commit.
//
// super_admin is never invitable. Promotion to it stays SQL only.
//
// ── MANAGER WAS SILENTLY TEAM ───────────────────────────────────────────────
// SettingsTeam has offered admin, manager and team since the Paper pass, but
// this door accepted admin and team and turned anything else into team. A
// manager invite arrived as team and nobody was told. The list here matches
// INVITABLE_ROLES in SettingsTeam.jsx now and an unknown role is refused out
// loud rather than downgraded.
//
// ── THE PROFILE ROW IS AN UPSERT ────────────────────────────────────────────
// It was a bare insert whose error was never read, so a failed write left an
// invited person with no role and the button said it worked. An upsert on id
// is right whether or not something else made the row first, and the error is
// read. The service role passes the authority trigger, which lets
// service_role through by design.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';

const INVITERS = ['super_admin', 'admin'];
const INVITABLE = ['admin', 'manager', 'team'];
const REDIRECT = 'https://pulse.neonburro.com/accept-invite/';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { error: gated.error });
  if (!INVITERS.includes(gated.profile?.role)) {
    return json(403, { error: 'Inviting to the team needs an admin.' });
  }

  let input = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Send json.' });
  }

  const email = String(input.email || '').trim().toLowerCase();
  const displayName = String(input.display_name || '').trim() || null;
  const role = input.role ? String(input.role) : 'team';

  if (!email || !email.includes('@')) return json(400, { error: 'Email required' });
  if (!INVITABLE.includes(role)) return json(400, { error: 'role must be admin, manager or team' });

  try {
    const { data: existing } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) return json(400, { error: 'Email already on the team' });

    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: REDIRECT,
      data: { display_name: displayName, role },
    });
    if (error) throw error;

    const { error: profileError } = await db.from('profiles').upsert(
      {
        id: data.user.id,
        email,
        display_name: displayName,
        role,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (profileError) {
      console.error('[team-invite] invite sent but the profile row failed for', data.user.id, profileError.message);
      return json(500, {
        error: `The invite went to ${email} but the profile row did not land, ${profileError.message}. They will sign in with no role until it is fixed.`,
      });
    }

    console.log('[team-invite]', role, 'invite sent to user', data.user.id, 'by', gated.user.id);
    return json(200, {
      success: true,
      message: `Invite sent to ${email}`,
      userId: data.user.id,
    });
  } catch (err) {
    return json(500, { error: err.message || 'Failed to send invite' });
  }
};
