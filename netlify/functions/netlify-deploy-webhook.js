// netlify/functions/netlify-deploy-webhook.js
// Receives webhook events from Netlify when deploys finish
// Configured per-site by connect-netlify-site.js
//
// Netlify POSTs the full deploy object to this URL
// We:
//   1. Look up the client_site by netlify_site_id (skip if not connected)
//   2. Upsert the deploy into netlify_deploys
//   3. Insert an activity_log entry for the dashboard stream

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const deploy = JSON.parse(event.body || '{}');

    // Netlify sends the full deploy object - basic shape sanity check
    if (!deploy.id || !deploy.site_id) {
      console.warn('Webhook received without deploy.id or site_id', deploy);
      return { statusCode: 400, body: 'Invalid payload' };
    }

    // 1. Find the client_site for this Netlify site
    const { data: clientSite } = await supabase
      .from('client_sites')
      .select('id, client_id, display_name, netlify_site_name')
      .eq('netlify_site_id', deploy.site_id)
      .maybeSingle();

    // If site isn't connected to a client, silently accept and exit
    // (avoids errors when webhooks fire for sites we don't track)
    if (!clientSite) {
      console.log(`Webhook for unconnected site ${deploy.site_id} - ignoring`);
      return { statusCode: 200, body: 'OK (unconnected)' };
    }

    // 2. Upsert deploy
    const { error: deployError } = await supabase
      .from('netlify_deploys')
      .upsert(
        {
          id: deploy.id,
          netlify_site_id: deploy.site_id,
          site_id: clientSite.id,
          client_id: clientSite.client_id,
          state: deploy.state,
          branch: deploy.branch,
          context: deploy.context,
          commit_ref: deploy.commit_ref,
          commit_url: deploy.commit_url,
          commit_message: deploy.title,
          committer: deploy.committer,
          deploy_url: deploy.deploy_url,
          permalink: deploy.links?.permalink,
          deploy_time: deploy.deploy_time,
          error_message: deploy.error_message,
          framework: deploy.framework,
          created_at: deploy.created_at,
          published_at: deploy.published_at,
        },
        { onConflict: 'id' }
      );

    if (deployError) {
      console.error('Deploy upsert failed:', deployError.message);
      // Continue anyway so webhook returns 200 - Netlify retries on non-2xx
    }

    // 3. Log activity (only for terminal states - skip 'building' / 'enqueued')
    const isSuccess = deploy.state === 'ready';
    const isFailed = deploy.state === 'error';

    if (isSuccess || isFailed) {
      const action = isSuccess ? 'deploy_succeeded' : 'deploy_failed';

      // Truncate commit message for the activity feed
      const commitPreview = (deploy.title || '').slice(0, 80);

      await supabase.from('activity_log').insert({
        action,
        entity_type: 'netlify_deploy',
        entity_id: deploy.id,
        client_id: clientSite.client_id,
        category: 'transactional',
        metadata: {
          site_name: clientSite.display_name || clientSite.netlify_site_name,
          netlify_site_id: deploy.site_id,
          branch: deploy.branch,
          context: deploy.context,
          commit_ref: deploy.commit_ref?.slice(0, 7),
          commit_url: deploy.commit_url,
          commit_message: commitPreview,
          committer: deploy.committer,
          deploy_url: deploy.deploy_url,
          permalink: deploy.links?.permalink,
          deploy_time: deploy.deploy_time,
          error_message: deploy.error_message,
          framework: deploy.framework,
        },
        created_at: deploy.published_at || deploy.created_at || new Date().toISOString(),
      });
    }

    // Update last_synced_at on the client_site
    await supabase
      .from('client_sites')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', clientSite.id);

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('netlify-deploy-webhook error:', err);
    // Return 200 anyway - failed processing shouldn't make Netlify retry forever
    return { statusCode: 200, body: 'OK (error logged)' };
  }
};
