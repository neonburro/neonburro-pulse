// netlify/functions/send-team-invite.js
// SENTINEL: NB_PULSE_SEND_TEAM_INVITE_V2
//
// Invites a new studio member to Pulse. Supabase auth.admin.inviteUserByEmail
// sends the letterhead invite mail with a link to /accept-invite/, then a
// profiles row is written with the name and role the inviter chose.
//
// ── WHO CAN CALL IT ─────────────────────────────────────────────────────────
// Studio admins only, super_admin and admin, the same check as
// trademark-watch.js and impersonate-client.js. Until 2026-10-05 this function
// checked nothing. It runs with the service role, so anybody who could reach
// the url could invite any address as an admin of Pulse and the mail went out
// from the studio's own auth sender. Lyra found it reworking Settings, Volt
// closed it. The page sends the signed in session as a bearer token, see
// src/lib/teamInvite.js, and no token is a 401, any other role a 403.
// The repo is public, so the gate is the whole defence. Do not loosen it to
// "any signed in user", clients sign in to Pulse too.
//
// ── THE ROLES ───────────────────────────────────────────────────────────────
// An invite grants admin, manager or team. super_admin is never granted here,
// promotion stays SQL only. Manager was added 2026-10-05 on Tyler's word.
// Before that the modal offered Manager and this function quietly turned it
// into team, so the page and the function disagreed without saying so. An
// unknown role is now refused out loud instead of rewritten. A missing role
// still means team. INVITABLE_ROLES in src/lib/teamInvite.js must match
// VALID_ROLES here, change both together.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const ALLOWED_ROLES = ['super_admin', 'admin'];
// Must match INVITABLE_ROLES in src/lib/teamInvite.js.
const VALID_ROLES = ['admin', 'manager', 'team'];
const REDIRECT = 'https://pulse.neonburro.com/accept-invite/';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const whoIs = async (event) => {
  const headers = event.headers || {};
  const header = headers.authorization || headers.Authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!supa || !token) return null;
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await supa.from('profiles').select('id, role').eq('id', data.user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return { user: data.user, allowed: false };
  return { user: data.user, allowed: true };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const who = await whoIs(event);
  if (!who) return json(401, { error: 'Sign in first.' });
  if (!who.allowed) return json(403, { error: 'Only a studio admin can invite.' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Send JSON.' }); }

  const email = String(body.email || '').trim().toLowerCase();
  const displayName = String(body.display_name || '').trim() || null;
  const role = body.role ? String(body.role) : 'team';

  if (!email || !email.includes('@')) return json(400, { error: 'Email required' });
  if (!VALID_ROLES.includes(role)) {
    return json(400, { error: `An invite grants ${VALID_ROLES.slice(0, -1).join(', ')} or ${VALID_ROLES.at(-1)}.` });
  }

  try {
    const { data: existing } = await supa
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) return json(400, { error: 'Email already on the team' });

    const { data, error } = await supa.auth.admin.inviteUserByEmail(email, {
      redirectTo: REDIRECT,
      data: { display_name: displayName, role },
    });
    if (error) throw error;

    await supa.from('profiles').insert({
      id: data.user.id,
      email,
      display_name: displayName,
      role,
      created_at: new Date().toISOString(),
    });

    return json(200, { success: true, message: `Invite sent to ${email}`, userId: data.user.id });
  } catch (err) {
    return json(500, { error: err.message || 'Failed to send invite' });
  }
};
