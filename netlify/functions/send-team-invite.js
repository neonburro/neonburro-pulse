// netlify/functions/send-team-invite.js
// Invites a new team member to NeonBurro Pulse
// 1. Calls Supabase auth.admin.inviteUserByEmail with redirect to /accept-invite/
// 2. Creates profile row with display_name and role
// 3. Supabase sends the branded invite email automatically (Auth template handles it)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email, display_name, role } = JSON.parse(event.body || '{}');

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) };
    }

    const validRoles = ['admin', 'team'];
    const userRole = validRoles.includes(role) ? role : 'team';

    // Check if user already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email already on the team' }),
      };
    }

    // Send the invite
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        redirectTo: 'https://pulse.neonburro.com/accept-invite/',
        data: {
          display_name: display_name || null,
          role: userRole,
        },
      }
    );

    if (error) throw error;

    // Create profile row
    await supabase.from('profiles').insert({
      id: data.user.id,
      email: email.toLowerCase(),
      display_name: display_name || null,
      role: userRole,
      created_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Invite sent to ${email}`,
        userId: data.user.id,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to send invite' }),
    };
  }
};