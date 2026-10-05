// netlify/functions/connect-netlify-site.js
// SENTINEL: NB_PULSE_CONNECT_SITE_V2
//
// Connects a Netlify site to a client in Pulse. The one caller is the
// Connect button in src/pages/Clients/components/SitesTab.jsx.
//
// POST { siteName: 'mwgridsolutions', clientId: 'uuid', isInternal: false, displayName: 'MW Grid Solutions Public Site' }
// Staff only.
//
// Steps:
//   1. Checks the caller is signed in and holds a staff role
//   2. Fetch site metadata from Netlify API
//   3. Insert client_sites row
//   4. Register deploy_succeeded + deploy_failed webhooks, signed
//   5. Backfill last 20 deploys into netlify_deploys
//   6. Log activity_log entry
//
// ── WHY THIS DOOR IS LOCKED, 2026-10-05 ─────────────────────────────────────
// Until this date it had no authentication. It holds NETLIFY_PAT, so anybody
// could attach any site on the account to any client id, register hooks on it
// and pull its deploy history into that client's record. gate() in _social.js
// is the lock now, super_admin, admin or manager. list-netlify-sites.js was
// open the same way and was locked in the same commit, same caller.
//
// ── THE HOOKS ARE SIGNED ────────────────────────────────────────────────────
// netlify-deploy-webhook.js refuses anything without a good
// X-Webhook-Signature from 2026-10-05, so a hook registered here carries
// WEBHOOK_SECRET as its JWS secret, in data.signature_secret beside the url.
// That field name is remembered, not read. The published open api spec types
// hook data as a free object and names no field for the JWS secret token, so
// it was not proven on the day it was written. The proof is to connect one
// site after deploy and see
// the JWS secret filled on its two outgoing webhooks in the Netlify UI. If it
// is empty there, fill it by hand and correct the field name here.
//
// No WEBHOOK_SECRET on the Pulse site means no hooks are registered at all,
// because an unsigned hook would only be refused. The site still connects
// and backfills, webhook_registered_at stays empty and the reply says why.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';

const NETLIFY_PAT = process.env.NETLIFY_PAT;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const WEBHOOK_URL = 'https://pulse.neonburro.com/.netlify/functions/netlify-deploy-webhook';

const netlifyFetch = async (path, opts = {}) => {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${NETLIFY_PAT}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netlify API ${res.status}: ${text}`);
  }
  return res.json();
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabase = createDb();
  const gated = await gate(supabase, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  if (!NETLIFY_PAT) return json(500, { error: 'NETLIFY_PAT environment variable not set' });

  try {
    const { siteName, clientId, isInternal = false, displayName } = JSON.parse(event.body || '{}');

    if (!siteName || !clientId) return json(400, { error: 'siteName and clientId required' });

    // 1. Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) return json(404, { error: 'Client not found' });

    // 2. Look up the Netlify site by name (slug)
    let netlifySite;
    try {
      // Netlify's "get site" by slug uses the slug as the site_id in the URL
      netlifySite = await netlifyFetch(`/sites/${siteName}.netlify.app`);
    } catch (err) {
      // Fall back to listing and matching by name
      const allSites = await netlifyFetch('/sites?per_page=100');
      netlifySite = allSites.find(
        (s) => s.name === siteName || s.site_id === siteName || s.id === siteName
      );
      if (!netlifySite) {
        return json(404, { error: `Netlify site '${siteName}' not found on your account` });
      }
    }

    const netlifySiteId = netlifySite.id;
    const netlifySiteName = netlifySite.name;
    const primaryUrl = netlifySite.ssl_url || netlifySite.url;
    const framework = netlifySite.published_deploy?.framework || null;

    // 3. Insert client_sites row (upsert in case re-connecting)
    const { data: siteRow, error: siteError } = await supabase
      .from('client_sites')
      .upsert(
        {
          client_id: clientId,
          netlify_site_id: netlifySiteId,
          netlify_site_name: netlifySiteName,
          display_name: displayName || netlifySiteName,
          primary_url: primaryUrl,
          framework,
          is_internal: isInternal,
        },
        { onConflict: 'netlify_site_id' }
      )
      .select()
      .single();

    if (siteError) throw new Error(`client_sites upsert failed: ${siteError.message}`);

    // 4. Register webhooks for deploy_succeeded and deploy_failed, signed.
    // Netlify API: POST /hooks?site_id=
    let hooksNote = '';
    if (WEBHOOK_SECRET) {
      const webhookEvents = ['deploy_succeeded', 'deploy_failed'];
      for (const eventType of webhookEvents) {
        try {
          await netlifyFetch(`/hooks?site_id=${netlifySiteId}`, {
            method: 'POST',
            body: JSON.stringify({
              site_id: netlifySiteId,
              type: 'url',
              event: eventType,
              data: {
                url: WEBHOOK_URL,
                signature_secret: WEBHOOK_SECRET,
              },
            }),
          });
        } catch (hookErr) {
          // If hook already exists Netlify returns an error - that's fine, continue
          console.warn(`Webhook ${eventType} for ${netlifySiteName}:`, hookErr.message);
        }
      }

      // Mark webhook registered
      await supabase
        .from('client_sites')
        .update({ webhook_registered_at: new Date().toISOString() })
        .eq('id', siteRow.id);
    } else {
      console.warn(`No hooks registered for ${netlifySiteName}, WEBHOOK_SECRET is not set on the Pulse site`);
      hooksNote = ' New deploys will not stream in until WEBHOOK_SECRET is set on the Pulse site and the site is connected again.';
    }

    // 5. Backfill last 20 deploys
    const deploys = await netlifyFetch(`/sites/${netlifySiteId}/deploys?per_page=20`);

    if (deploys.length > 0) {
      const deployRows = deploys.map((d) => ({
        id: d.id,
        netlify_site_id: netlifySiteId,
        site_id: siteRow.id,
        client_id: clientId,
        state: d.state,
        branch: d.branch,
        context: d.context,
        commit_ref: d.commit_ref,
        commit_url: d.commit_url,
        commit_message: d.title,
        committer: d.committer,
        deploy_url: d.deploy_url,
        permalink: d.links?.permalink,
        deploy_time: d.deploy_time,
        error_message: d.error_message,
        framework: d.framework,
        created_at: d.created_at,
        published_at: d.published_at,
      }));

      const { error: deployError } = await supabase
        .from('netlify_deploys')
        .upsert(deployRows, { onConflict: 'id' });

      if (deployError) {
        console.error('Deploy backfill error:', deployError.message);
      }
    }

    await supabase
      .from('client_sites')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', siteRow.id);

    // 6. Log activity
    await supabase.from('activity_log').insert({
      action: 'site_connected',
      entity_type: 'client_site',
      entity_id: siteRow.id,
      client_id: clientId,
      user_id: gated.user.id,
      category: 'transactional',
      metadata: {
        client_name: client.name,
        site_name: netlifySiteName,
        netlify_site_id: netlifySiteId,
        backfilled_deploys: deploys.length,
        hooks_registered: Boolean(WEBHOOK_SECRET),
      },
      created_at: new Date().toISOString(),
    });

    return json(200, {
      success: true,
      site: siteRow,
      backfilledDeploys: deploys.length,
      hooksRegistered: Boolean(WEBHOOK_SECRET),
      message: `Connected ${netlifySiteName} to ${client.name} (${deploys.length} deploys synced).${hooksNote}`,
    });
  } catch (err) {
    console.error('connect-netlify-site error:', err);
    return json(500, { error: err.message || 'Failed to connect site' });
  }
};
