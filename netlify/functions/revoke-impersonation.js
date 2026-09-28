// netlify/functions/revoke-impersonation.js
// Admin-only: revoke an active impersonation session.
// The underlying session rows are kept (for the audit log) but marked revoked_at.
// Once revoked, any further calls to validate_impersonation_session will return empty.
//
// Auth model:
//   - Admins can revoke sessions they started
//   - Owners can revoke any session (enforced inside the RPC)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verify admin JWT
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing authorization' }),
      };
    }

    const jwt = authHeader.slice(7);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !userData?.user) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid session' }),
      };
    }

    const adminUserId = userData.user.id;

    // Parse body
    const { session_id } = JSON.parse(event.body || '{}');

    if (!session_id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'session_id is required' }),
      };
    }

    // Call revoke RPC (authorization enforced inside the function)
    const { data: revoked, error: revokeError } = await supabase.rpc(
      'revoke_impersonation_session',
      {
        p_session_id: session_id,
        p_admin_user_id: adminUserId,
      }
    );

    if (revokeError) {
      console.error('revoke_impersonation_session error:', revokeError);
      const publicMessage = revokeError.message.includes('Not authorized')
        ? 'Not authorized to revoke this session'
        : 'Could not revoke session';

      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: publicMessage }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        revoked: revoked === true,
      }),
    };
  } catch (err) {
    console.error('revoke-impersonation error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Something went wrong' }),
    };
  }
};