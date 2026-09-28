// netlify/functions/backfill-deploys.js
// Historical sync of Netlify deploys into the netlify_deploys table.
// Now with pagination - fetches ALL deploys via per_page + pagination loop.
//
// Usage:
//   GET /.netlify/functions/backfill-deploys
//   GET /.netlify/functions/backfill-deploys?days=90
//   GET /.netlify/functions/backfill-deploys?site=cimarronengineering
//   GET /.netlify/functions/backfill-deploys?days=365&site=cimarronengineering
//
// Defaults: 90 days, all connected sites, paginates until cutoff or 1000 deploys.
//
// Idempotent: re-running upserts existing rows by id, no duplicates.
// Does NOT log to activity_log - we don't want hundreds of fake notifications
// for old deploys. Webhook handles activity_log for live deploys going forward.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NETLIFY_PAT = process.env.NETLIFY_PAT;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const PER_PAGE = 100;
const MAX_PAGES_PER_SITE = 10;  // hard cap: 1000 deploys per site per run

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

// Match the shape used by netlify-deploy-webhook.js exactly so backfilled
// rows are indistinguishable from live webhook rows.
const mapDeployToRow = (d, clientSite) => ({
  id: d.id,
  netlify_site_id: clientSite.netlify_site_id,
  site_id: clientSite.id,
  client_id: clientSite.client_id,
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
});

// Fetch all deploys for a site, paginating until we hit the cutoff date
// or reach the safety cap of 1000 deploys.
const fetchAllDeploysForSite = async (siteId, cutoffMs) => {
  const all = [];
  let page = 1;

  while (page <= MAX_PAGES_PER_SITE) {
    const batch = await netlifyFetch(
      `/sites/${siteId}/deploys?per_page=${PER_PAGE}&page=${page}`
    );

    if (!batch || batch.length === 0) {
      break;
    }

    all.push(...batch);

    // Stop early if last deploy in batch is older than cutoff
    const lastDeploy = batch[batch.length - 1];
    if (lastDeploy.created_at && new Date(lastDeploy.created_at).getTime() < cutoffMs) {
      break;
    }

    // Stop if we got fewer than per_page (last page)
    if (batch.length < PER_PAGE) {
      break;
    }

    page += 1;
  }

  return all;
};

export const handler = async (event) => {
  const startedAt = Date.now();
  const params = event.queryStringParameters || {};
  const daysBack = parseInt(params.days || '90', 10);
  const siteFilter = params.site || null;

  if (!NETLIFY_PAT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'NETLIFY_PAT env var not set' }),
    };
  }

  try {
    let sitesQuery = supabase
      .from('client_sites')
      .select('id, client_id, netlify_site_id, netlify_site_name, display_name');

    if (siteFilter) {
      sitesQuery = sitesQuery.eq('netlify_site_name', siteFilter);
    }

    const { data: sites, error: sitesError } = await sitesQuery;
    if (sitesError) throw new Error(`client_sites query failed: ${sitesError.message}`);

    if (!sites || sites.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: siteFilter
            ? `No client_site found with netlify_site_name '${siteFilter}'`
            : 'No client_sites registered yet',
          total_synced: 0,
          by_site: [],
        }),
      };
    }

    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const cutoffMs = cutoffDate.getTime();

    const bySite = [];
    let totalSynced = 0;
    let totalSkipped = 0;
    const errors = [];

    for (const site of sites) {
      try {
        // Paginate to fetch ALL recent deploys
        const allDeploys = await fetchAllDeploysForSite(site.netlify_site_id, cutoffMs);

        // Filter to deploys within the cutoff window
        const recentDeploys = (allDeploys || []).filter((d) => {
          if (!d.created_at) return false;
          return new Date(d.created_at).getTime() >= cutoffMs;
        });

        const skipped = (allDeploys?.length || 0) - recentDeploys.length;

        if (recentDeploys.length === 0) {
          bySite.push({
            site: site.netlify_site_name,
            display_name: site.display_name,
            synced: 0,
            skipped,
            fetched: allDeploys?.length || 0,
            note: `No deploys in last ${daysBack} days`,
          });
          totalSkipped += skipped;
          continue;
        }

        const rows = recentDeploys.map((d) => mapDeployToRow(d, site));

        const { error: upsertError } = await supabase
          .from('netlify_deploys')
          .upsert(rows, { onConflict: 'id' });

        if (upsertError) {
          errors.push({ site: site.netlify_site_name, error: upsertError.message });
          bySite.push({
            site: site.netlify_site_name,
            display_name: site.display_name,
            synced: 0,
            error: upsertError.message,
          });
          continue;
        }

        bySite.push({
          site: site.netlify_site_name,
          display_name: site.display_name,
          synced: recentDeploys.length,
          skipped,
          fetched: allDeploys?.length || 0,
        });

        totalSynced += recentDeploys.length;
        totalSkipped += skipped;

        await supabase
          .from('client_sites')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', site.id);
      } catch (siteErr) {
        console.error(`Backfill failed for ${site.netlify_site_name}:`, siteErr);
        errors.push({ site: site.netlify_site_name, error: siteErr.message });
        bySite.push({
          site: site.netlify_site_name,
          display_name: site.display_name,
          synced: 0,
          error: siteErr.message,
        });
      }
    }

    const durationMs = Date.now() - startedAt;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: errors.length === 0,
        days_back: daysBack,
        site_filter: siteFilter,
        total_synced: totalSynced,
        total_skipped: totalSkipped,
        sites_processed: sites.length,
        errors: errors.length > 0 ? errors : undefined,
        by_site: bySite,
        duration_ms: durationMs,
      }, null, 2),
    };
  } catch (err) {
    console.error('backfill-deploys error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
