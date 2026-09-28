// netlify/functions/get-client-activity.js
// Server-side endpoint to fetch deploy activity for a client.
// Used by AccountActivity.jsx in BOTH normal auth and impersonation modes.
//
// Why this exists: impersonation doesn't create a Supabase Auth session,
// so anon-role queries fail RLS. This function uses service role to safely
// fetch data after verifying the requester's identity.
//
// Auth modes accepted:
//   1. Authorization: Bearer <supabase_jwt> -- normal client login
//   2. X-Impersonation-Token: <token>       -- admin impersonation
//
// Either way, we resolve to a client_id and return only THAT client's data.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Impersonation-Token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Resolve auth → client_id
const resolveClientId = async (event) => {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const impersonationToken =
    event.headers['x-impersonation-token'] || event.headers['X-Impersonation-Token'];

  // Mode 1: Impersonation token
  if (impersonationToken) {
    const tokenHash = crypto.createHash('sha256').update(impersonationToken).digest('hex');
    const { data, error } = await supabase.rpc('validate_impersonation_session', {
      p_token_hash: tokenHash,
    });
    if (error || !data || data.length === 0) {
      return { error: 'Invalid impersonation session', status: 401 };
    }
    return { clientId: data[0].r_client_id };
  }

  // Mode 2: Real client auth via JWT
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (error || !user) {
      return { error: 'Invalid auth token', status: 401 };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('client_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.client_id) {
      return { error: 'Profile has no client_id', status: 403 };
    }

    return { clientId: profile.client_id };
  }

  return { error: 'No authentication provided', status: 401 };
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { clientId, error, status } = await resolveClientId(event);
    if (error) {
      return {
        statusCode: status || 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error }),
      };
    }

    // Fetch sites for this client (filter to public + activity-enabled)
    const { data: sites, error: sitesError } = await supabase
      .from('client_sites')
      .select('id, netlify_site_id, netlify_site_name, display_name, primary_url')
      .eq('client_id', clientId)
      .eq('is_internal', false)
      .eq('show_activity_to_client', true);

    if (sitesError) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: sitesError.message }),
      };
    }

    if (!sites || sites.length === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          sites: [],
          deploys: [],
        }),
      };
    }

    // Fetch deploys for those sites
    const siteIds = sites.map((s) => s.netlify_site_id);
    const { data: deploys, error: deploysError } = await supabase
      .from('netlify_deploys')
      .select('id, netlify_site_id, state, branch, commit_ref, commit_url, commit_message, committer, deploy_url, permalink, deploy_time, framework, created_at, published_at')
      .in('netlify_site_id', siteIds)
      .eq('state', 'ready')
      .order('created_at', { ascending: false })
      .limit(100);

    if (deploysError) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: deploysError.message }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        sites,
        deploys: deploys || [],
      }),
    };
  } catch (err) {
    console.error('get-client-activity error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
