// netlify/functions/netlify-deploy-webhook.js
// SENTINEL: NB_PULSE_DEPLOY_WEBHOOK_V2
//
// Receives webhook events from Netlify when deploys finish. Registered per
// site by connect-netlify-site.js, two hooks a site, deploy_succeeded and
// deploy_failed.
//
// Netlify POSTs the full deploy object to this URL. We:
//   1. Check the X-Webhook-Signature header against WEBHOOK_SECRET
//   2. Look up the client_site by netlify_site_id (skip if not connected)
//   3. Upsert the deploy into netlify_deploys
//   4. Insert an activity_log entry for the dashboard stream
//
// ── WHY IT CHECKS A SIGNATURE, 2026-10-05 ───────────────────────────────────
// Until this date anybody who knew a connected site id could post a made up
// deploy here. The row landed in netlify_deploys and a deploy_succeeded line
// with any commit message and any deploy_url landed in activity_log against
// that client, which get-client-activity.js serves to the client's own
// portal. A link of a stranger's choosing in a client's feed, on our page.
//
// Netlify signs an outgoing webhook when the hook carries a JWS secret. The
// header is X-Webhook-Signature, a JWT signed HS256 with that secret, whose
// claims are iss netlify and sha256, the hex SHA256 of the raw body. That
// is documented at docs.netlify.com, deploy notifications, payload signature.
// The check is written out here with node:crypto rather than a JWT package
// because it is twelve lines and the package would be the only new dependency
// in the functions.
//
// ── IT FAILS CLOSED, AND THAT HAS AN ORDER OF OPERATIONS ────────────────────
// No WEBHOOK_SECRET on the Pulse site answers 500 and logs why. No header or
// a wrong one answers 401. Nothing is written in either case. So when this
// ships, every hook registered before it, which carries no secret, stops
// landing until it is given one. Before deploying this:
//   1. Set WEBHOOK_SECRET on the Pulse site, functions scope. Mind the 4KB
//      functions env ceiling in the studio CLAUDE.md.
//   2. On every connected site give both deploy notifications the same value
//      as their JWS secret token, Project configuration, Notifications,
//      edit the outgoing webhook. connect-netlify-site.js sets it on new hooks.
//   3. Anything missed in between is recovered by backfill-deploys.js, which
//      upserts by id. It does not write activity_log, so the feed lines for
//      that window stay missing, which is the right way round.
//
// A replayed genuine payload passes the check. It upserts the same deploy by
// id and adds one duplicate feed line, nothing worse, so there is no nonce.
//
// No oxford commas, no em dashes.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createDb } from './_social.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const text = (statusCode, body) => ({ statusCode, body });

const fromB64url = (value) => Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sameBytes = (a, b) => a.length === b.length && timingSafeEqual(a, b);

// Returns null when the signature is good, otherwise the reason in words.
const signatureProblem = (token, rawBody, secret) => {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) return 'no signature';
  const [head, claimsPart, sig] = parts;
  let header = null;
  let claims = null;
  try {
    header = JSON.parse(fromB64url(head).toString('utf8'));
    claims = JSON.parse(fromB64url(claimsPart).toString('utf8'));
  } catch {
    return 'unreadable signature';
  }
  if (header?.alg !== 'HS256') return 'signature is not HS256';
  const expected = createHmac('sha256', secret).update(`${head}.${claimsPart}`).digest();
  if (!sameBytes(fromB64url(sig), expected)) return 'signature does not match';
  if (claims?.iss !== 'netlify') return 'signature is not from netlify';
  if (claims?.exp && Date.now() / 1000 > Number(claims.exp)) return 'signature expired';
  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  if (!sameBytes(Buffer.from(String(claims?.sha256 || '')), Buffer.from(bodyHash))) return 'body does not match signature';
  return null;
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return text(405, 'Method not allowed');

  if (!WEBHOOK_SECRET) {
    console.error('netlify-deploy-webhook refused, WEBHOOK_SECRET is not set on the Pulse site');
    return text(500, 'WEBHOOK_SECRET is not set');
  }

  const headers = event.headers || {};
  const signature = headers['x-webhook-signature'] || headers['X-Webhook-Signature'] || '';
  const rawBody = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
  const problem = signatureProblem(signature, rawBody, WEBHOOK_SECRET);
  if (problem) {
    console.warn('netlify-deploy-webhook refused,', problem);
    return text(401, 'Unauthorized');
  }

  const supabase = createDb();
  if (!supabase) return text(500, 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');

  try {
    const deploy = JSON.parse(rawBody.toString('utf8') || '{}');

    // Netlify sends the full deploy object - basic shape sanity check
    if (!deploy.id || !deploy.site_id) {
      console.warn('Webhook received without deploy.id or site_id');
      return text(400, 'Invalid payload');
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
      return text(200, 'OK (unconnected)');
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

    return text(200, 'OK');
  } catch (err) {
    console.error('netlify-deploy-webhook error:', err);
    // Return 200 anyway - failed processing shouldn't make Netlify retry forever
    return text(200, 'OK (error logged)');
  }
};
