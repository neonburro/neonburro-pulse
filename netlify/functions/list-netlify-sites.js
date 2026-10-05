// netlify/functions/list-netlify-sites.js
// SENTINEL: NB_PULSE_LIST_SITES_V2
//
// Lists all Netlify sites on the account via the PAT. The one caller is the
// site picker in src/pages/Clients/components/SitesTab.jsx. Staff only.
//
// GET /.netlify/functions/list-netlify-sites
//
// Returns: { sites: [{ id, name, url, framework, updated_at, published_at, connected }], count }
// `connected` = true if this site is already linked in client_sites table
//
// ── WHY THIS DOOR IS LOCKED, 2026-10-05 ─────────────────────────────────────
// Until this date it had no authentication and it answered anybody with every
// site on the account, its url, its last commit title and the name of the
// client it is connected to. That is the client list, confidential clients
// included, to a stranger with a browser. gate() in _social.js is the lock
// now, super_admin, admin or manager, and SitesTab sends the session token.
// connect-netlify-site.js was locked in the same commit.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';

const NETLIFY_PAT = process.env.NETLIFY_PAT;

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
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const supabase = createDb();
  const gated = await gate(supabase, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  if (!NETLIFY_PAT) return json(500, { error: 'NETLIFY_PAT environment variable not set' });

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

    return json(200, {
      sites,
      count: sites.length,
    });
  } catch (err) {
    console.error('list-netlify-sites error:', err);
    return json(500, { error: err.message || 'Failed to list sites' });
  }
};
