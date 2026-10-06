// src/lib/teamInvite.js
// The page side of netlify/functions/send-team-invite.js. The function lets
// only studio admins through, so the signed in session rides as a bearer
// token, the same shape as src/lib/trademarkWatch.js. Any invite modal calls
// this and never fetches the function itself, so a new modal cannot forget
// the header. Errors come back as plain words the page can show as they are.
//
// INVITABLE_ROLES must match VALID_ROLES in send-team-invite.js. Manager was
// added to both on 2026-10-05, Tyler's call.
//
// No oxford commas, no em dashes.

import { supabase } from './supabase';

export const INVITABLE_ROLES = ['admin', 'manager', 'team'];

export const sendTeamInvite = async ({ email, display_name, role }) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/send-team-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ email, display_name, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The invite answered ${res.status}.`);
  return data;
};
