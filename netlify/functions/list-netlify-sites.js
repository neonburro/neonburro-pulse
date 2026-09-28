// netlify/functions/list-netlify-sites.js
// Lists all Netlify sites on your account via the PAT
// Used by SitesTab to populate the site picker dropdown
//
// GET /.netlify/functions/list-netlify-sites
//
// Returns: { sites: [{ id, name, url, framework, updated_at, published_at, connected }], count }
// `connected` = true if this site is already linked in client_sites table

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NETLIFY_PAT = process.env.NETLIFY_PAT;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NETLIFY_API = 'https://api.netlify.com/api/v1';

const netlifyFetch = async (path) => {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    headers: {
      Authorization: `Bearer ${NETLIFY_PAT}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netlify API ${res.status}: ${text}`);
  }
  return res.json();
};

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!NETLIFY_PAT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'NETLIFY_PAT environment variable not set' }),
    };
  }

  try {
    // Fetch sites (Netlify paginates at 100 by default; enough for most accounts)
    // sort_by=updated_at puts most-recently-active sites first
    const netlifySites = await netlifyFetch('/sites?per_page=100&sort_by=updated_at');

    // Fetch already-connected sites so we can mark them in the UI
    const { data: connectedSites } = await supabase
      .from('client_sites')
      .select('netlify_site_id, client_id, clients(name)');

    const connectedMap = {};
    (connectedSites || []).forEach((cs) => {
      connectedMap[cs.netlify_site_id] = {
        clientId: cs.client_id,
        clientName: cs.clients?.name,
      };
    });

    // Shape for the frontend - minimal data, sorted, with connection status
    const sites = (netlifySites || [])
      .map((s) => {
        const connection = connectedMap[s.id];
        return {
          id: s.id,
          name: s.name,
          url: s.ssl_url || s.url,
          framework: s.published_deploy?.framework || null,
          updated_at: s.updated_at,
          published_at: s.published_deploy?.published_at || null,
          latest_commit: s.published_deploy?.title || null,
          connected: !!connection,
          connected_to_client: connection?.clientName || null,
          connected_to_client_id: connection?.clientId || null,
        };
      })
      // Already sorted by Netlify via sort_by=updated_at, but ensure newest first
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return {
      statusCode: 200,
      body: JSON.stringify({
        sites,
        count: sites.length,
      }),
    };
  } catch (err) {
    console.error('list-netlify-sites error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to list sites' }),
    };
  }
};
