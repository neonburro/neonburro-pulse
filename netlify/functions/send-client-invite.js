// netlify/functions/send-client-invite.js
// SENTINEL: NB_PULSE_CLIENT_INVITE_V2
//
// Activates a client's portal account and sends them their credentials.
// Two callers, both staff screens, src/components/common/ActivateClientButton.jsx
// and the Portal tab in src/pages/Clients/components/ClientModal.jsx.
//
// POST { clientId }. Staff only.
//
// Flow:
//   1. Checks the caller is signed in and holds a staff role
//   2. Ensures the client has a fresh 8-char PIN (regenerates 6-char legacy PINs)
//   3. Creates the Supabase auth user with email + PIN as password (email pre-confirmed)
//   4. Creates the profile row with role='client' linked to client_id
//   5. Sends the letterhead mail through Resend with username + PIN + the sign in link
//   6. Marks client.portal_account_created_at
//
// Safe to run more than once. If the auth user exists the PIN is re-applied
// as the password and the mail goes again.
//
// ── WHY THIS DOOR IS LOCKED, 2026-10-05 ─────────────────────────────────────
// Until this date it had no authentication. Anybody holding a client id could
// make the studio rewrite that client's portal password, regenerate a short
// PIN and mail it out, and could do it as often as they liked. The PIN only
// ever went to the address on file, so it was not a takeover, but it reset a
// real person's password on a stranger's request and spent Resend on it.
// gate() in _social.js is the lock, the same one client-report-send.js uses,
// super_admin, admin or manager. Both callers send the session token as
// Authorization: Bearer, read from supabase.auth.getSession().
//
// ── THE MAIL IS THE LETTERHEAD, 2026-09-17 ───────────────────────────────────
// This used to be the dark card with the neon ridge and cyan. It now wears the
// same warm paper as the invoice and the six Supabase auth mails, built by
// _letterhead.js. The credentials print as two mono rows on a ruled table, the
// way the invoice prints its meta, and nothing loads an image. Tyler's ruling,
// the client side is light, white and black with the marks.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';
import { letterhead, button, rows, fallback, escapeHtml } from './_letterhead.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'neonburro <hello@neonburro.com>';
const PORTAL_URL = 'https://neonburro.com/account/';

const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// ============================================================
// THE PORTAL INVITE, ON THE LETTERHEAD
// ============================================================
const buildInviteEmailHTML = ({ clientName, clientEmail, username, pin, portalUrl }) => {
  const first = escapeHtml(firstNameOf(clientName));
  return letterhead({
    preheader: 'Your username and PIN for the neonburro portal.',
    kicker: 'pulse · your portal',
    title: `Your portal is open, ${first}.`,
    body: `Your account with neonburro is live. Sign in with the two lines below to follow the work, see every invoice and talk to the team in one place.`,
    action:
      rows([
        ['username', escapeHtml(username)],
        ['pin', escapeHtml(pin)],
      ]) +
      button(portalUrl, 'Sign in') +
      fallback(portalUrl),
    closing: 'Keep this note. The PIN is the key and the username is the name. If either goes missing, reply here and a person will sort it.',
    to: clientEmail,
  });
};

// ============================================================
// HANDLER
// ============================================================
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabase = createDb();
  const gated = await gate(supabase, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  try {
    const { clientId } = JSON.parse(event.body || '{}');
    if (!clientId) return json(400, { error: 'Client ID required' });

    // Fetch client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) return json(404, { error: 'Client not found' });
    if (!client.email) return json(400, { error: 'Client has no email on file' });
    if (!client.username) {
      return json(400, { error: 'Client has no username - run backfill migration first' });
    }

    const email = client.email.toLowerCase();
    let pin = client.portal_pin;

    // Regenerate PIN if missing or legacy (< 8 chars)
    if (!pin || pin.length < 8) {
      const { data: newPin } = await supabase.rpc('generate_portal_pin');
      if (newPin) {
        pin = newPin;
        await supabase.from('clients').update({ portal_pin: pin }).eq('id', clientId);
      }
    }

    // Check if auth user already exists for this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    let userId;

    if (existingUser) {
      // User exists - update their password to the current PIN
      userId = existingUser.id;
      await supabase.auth.admin.updateUserById(userId, { password: pin });
    } else {
      // Create new auth user with PIN as password, email pre-confirmed
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: {
          display_name: client.name,
          role: 'client',
          client_id: client.id,
        },
      });
      if (createError) throw createError;
      userId = newUser.user.id;
    }

    // Upsert profile row
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: userId,
        email,
        display_name: client.name,
        role: 'client',
        client_id: clientId,
        created_at: new Date().toISOString(),
      });
    } else {
      await supabase.from('profiles').update({
        role: 'client',
        client_id: clientId,
        display_name: client.name,
      }).eq('id', userId);
    }

    // Send the letterhead mail via Resend
    const emailHtml = buildInviteEmailHTML({
      clientName: client.name,
      clientEmail: email,
      username: client.username,
      pin,
      portalUrl: PORTAL_URL,
    });

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: `Your portal is open, ${firstNameOf(client.name)} • neonburro`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend failed: ${errText}`);
    }

    const resendData = await resendRes.json();

    // Mark client as activated
    await supabase
      .from('clients')
      .update({
        portal_invite_sent_at: new Date().toISOString(),
        portal_account_created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    // Log to activity
    await supabase.from('activity_log').insert({
      action: 'portal_activated',
      entity_type: 'client',
      entity_id: clientId,
      client_id: clientId,
      user_id: gated.user.id,
      category: 'transactional',
      metadata: {
        client_name: client.name,
        username: client.username,
        resend_id: resendData.id,
      },
      created_at: new Date().toISOString(),
    });

    return json(200, {
      success: true,
      message: `Portal access sent to ${email}`,
      username: client.username,
      userId,
    });
  } catch (err) {
    console.error('send-client-invite error:', err);
    return json(500, { error: err.message || 'Failed to activate portal' });
  }
};
