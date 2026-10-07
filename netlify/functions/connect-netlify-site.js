// netlify/functions/connect-netlify-site.js
// Connects a Netlify site to a client in Pulse
//
// POST { siteName: 'mwgridsolutions', clientId: 'uuid', isInternal: false, displayName: 'MW Grid Solutions Public Site' }
//
// Steps:
//   1. Fetch site metadata from Netlify API
//   2. Insert client_sites row
//   3. Register deploy_succeeded + deploy_failed webhooks
//   4. Backfill last 20 deploys into netlify_deploys
//   5. Log activity_log entry

//
// ── STAFF ONLY, 2026-10-05, Volt ────────────────────────────────────────────
// This door had no sign in check at all. Anybody holding the url could call
// it, and with the service role behind it that meant any stranger could attach
// any site to any client and register deploy webhooks on it. It was hidden
// only because NETLIFY_PAT on the Pulse site answers 401 from Netlify today,
// so every call died before reaching the database. The gate is the one in
// _social.js that publish-blog-post.js uses, a Supabase session in the
// Authorization header and a staff role in profiles. Keep it ahead of the PAT
// being renewed, never after.

import { createClient } from '@supabase/supabase-js';
import { gate } from './_social.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NETLIFY_PAT = process.env.NETLIFY_PAT;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const door = await gate(supabase, event);
  if (door.error) {
    return { statusCode: door.status, body: JSON.stringify({ error: door.error }) };
  }

  try {
    const { siteName, clientId, isInternal = false, displayName } = JSON.parse(event.body || '{}');

    if (!siteName || !clientId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'siteName and clientId required' }),
      };
    }

    // 1. Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
    }

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
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `Netlify site '${siteName}' not found on your account` }),
        };
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
    //
    // ── THE HOOKS ARE SIGNED, 2026-10-07, Cypher ──────────────────────────
    // netlify-deploy-webhook.js refuses anything without a good
    // X-Webhook-Signature, HS256 with WEBHOOK_SECRET. This file read that
    // variable and never used it, so every hook it registered was unsigned
    // and would only be refused. A hook now carries WEBHOOK_SECRET as its JWS
    // secret, in data.signature_secret beside the url. The two files must
    // agree on the variable name.
    //
    // The field name was first remembered rather than read, because Netlify's
    // open api spec types hook data as a free object. On 2026-10-08 Warbleur
    // read it live from Netlify's listHookTypes: the url hook type takes
    // signature_secret. The last proof is still the artifact, connect one
    // site after deploy and see the JWS secret filled on its two outgoing
    // webhooks in the Netlify UI.
    //
    // No WEBHOOK_SECRET on the Pulse site means no hooks are registered at
    // all, because an unsigned hook would only be refused. The site still
    // connects and backfills, webhook_registered_at stays empty and the reply
    // says why. This note sits here and not in the header on purpose, so it
    // does not collide with Volt's STAFF ONLY block when his branch merges.
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
      category: 'transactional',
      metadata: {
        client_name: client.name,
        site_name: netlifySiteName,
        netlify_site_id: netlifySiteId,
        backfilled_deploys: deploys.length,
      },
      created_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        site: siteRow,
        backfilledDeploys: deploys.length,
        message: `Connected ${netlifySiteName} to ${client.name} (${deploys.length} deploys synced).${hooksNote}`,
      }),
    };
  } catch (err) {
    console.error('connect-netlify-site error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to connect site' }),
    };
  }
};
