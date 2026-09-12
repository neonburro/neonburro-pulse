// netlify/functions/release-social.js
// SENTINEL: NB_PULSE_RELEASE_SOCIAL_V1
//
// The hand that posts. Every five minutes, read the releases that are staged,
// approved, due and pointed at a channel this function knows how to reach,
// and put them out through the burro's own account. Scheduled in
// netlify.toml. Nothing here decides what to say, that is the Releases page
// and a hue•man's thumb on approved. This file only carries it.
//
// ── WHY ONE FUNCTION FOR EVERY CHANNEL ──────────────────────────────────────
// A release row already says its channel and its voice. One function reads
// the row, finds the account for (voice, channel) in social_accounts, reads
// the token from the env var that row NAMES, and hands the body and the
// picture to the channel's adapter. Adding a channel is adding an adapter
// below and a row per burro in social_accounts. The tokens never leave
// Netlify env. The database holds only the env var's name.
//
// ── WHAT IS WIRED, 2026-09-12 ────────────────────────────────────────────────
//   telegram   live. Bot API sendPhoto when the release has an asset,
//              sendMessage when it does not. The bot must be an admin of the
//              chat whose id is on the account row. external_id is the
//              message id.
//   x          not connected. The row fails with a clear error until the
//              adapter exists. X needs an OAuth user context per burro
//              account and a paid tier for writes, decide before wiring.
//   instagram  not connected. Needs a Facebook page and an Instagram
//              business account per burro, publishes from a public image
//              url, which the social buckets already provide.
//   reddit     not connected. Script app OAuth per account.
//   site, blog, newsletter, phosphor, shop, pulse
//              never posted by this function, those are shipped by hand or
//              by their own pipelines, the row is left alone.
//
// ── THE CONTRACT WITH THE PAGE ──────────────────────────────────────────────
// A row goes out when ALL of these are true: status staged, approved true,
// release_at at or before now, channel has an adapter, the account row for
// (voice, channel) exists and is enabled, the env var it names is set. On
// success: status released, released_at now, external_id set, error null.
// On failure: status failed, error set, nothing else touched, so the page
// can show why and the pip can send it back to the ramp. A row is claimed
// before posting by flipping approved_at forward, so two overlapping runs
// cannot post it twice.
//
// ── NEVER ───────────────────────────────────────────────────────────────────
// Never post a row that is not approved. Never log a token. Never post about
// the coin's price, the page refuses those words before they get here and
// this function trusts the page, but the adapter also refuses a body that
// carries a dollar sign next to the word NEONBURRO as a last rail.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

// The rail applies only to a body that names the token in capitals, the same
// rule the Releases page runs before approve. "moon over the reservoir" in a
// warbleur post is fine. "$" or a hype word beside NEONBURRO is not.
const NAMES_TOKEN = /NEONBURRO/;
const PRICE_TALK = /NEONBURRO[^.\n]{0,40}\$|\$[^.\n]{0,40}NEONBURRO|\b(pump|moon|100x|10x|gains|price target|buy now|last chance|undervalued|early)\b/i;
const readsAsPriceTalk = (body) => NAMES_TOKEN.test(body || '') && PRICE_TALK.test(body || '');

const publicUrl = (bucket, path) => `${url}/storage/v1/object/public/${bucket}/${path}`;

const telegram = async ({ account, release, token }) => {
  if (!account.chat_id) throw new Error('telegram account has no chat_id');
  const base = `https://api.telegram.org/bot${token}`;
  const body = release.body || release.title;
  let res;
  if (release.asset_bucket && release.asset_path) {
    res = await fetch(`${base}/sendPhoto`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: account.chat_id, photo: publicUrl(release.asset_bucket, release.asset_path), caption: body, parse_mode: undefined }),
    });
  } else {
    res = await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: account.chat_id, text: body, disable_web_page_preview: false }),
    });
  }
  const json = await res.json();
  if (!json.ok) throw new Error(`telegram ${json.error_code || res.status} ${json.description || ''}`.trim());
  return String(json.result?.message_id ?? '');
};

const notConnected = (name) => async () => { throw new Error(`${name} is not connected yet`); };

const ADAPTERS = {
  telegram,
  x: notConnected('x'),
  instagram: notConnected('instagram'),
  reddit: notConnected('reddit'),
};

export default async () => {
  if (!url || !key) return new Response('no database', { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from('releases')
    .select('id, title, channel, voice, body, asset_bucket, asset_path, release_at, approved_at')
    .eq('status', 'staged')
    .eq('approved', true)
    .lte('release_at', now)
    .in('channel', Object.keys(ADAPTERS))
    .order('release_at', { ascending: true })
    .limit(10);
  if (error) return new Response(`read failed ${error.message}`, { status: 500 });

  const out = [];
  for (const release of due || []) {
    const claim = await db.from('releases').update({ approved_at: now }).eq('id', release.id).eq('approved_at', release.approved_at).select('id');
    if (!claim.data || !claim.data.length) continue;

    try {
      if (readsAsPriceTalk(release.body)) throw new Error('body reads as price talk, refused');
      const { data: account } = await db
        .from('social_accounts')
        .select('*')
        .eq('burro', release.voice)
        .eq('channel', release.channel)
        .maybeSingle();
      if (!account) throw new Error(`no ${release.channel} account for ${release.voice}`);
      if (!account.enabled) throw new Error(`${release.voice} on ${release.channel} is switched off`);
      const token = account.token_env ? process.env[account.token_env] : null;
      if (!token) throw new Error(`env ${account.token_env || '(none)'} is not set`);
      const externalId = await ADAPTERS[release.channel]({ account, release, token });
      await db.from('releases').update({ status: 'released', released_at: new Date().toISOString(), external_id: externalId, error: null }).eq('id', release.id);
      out.push({ id: release.id, ok: true });
    } catch (e) {
      await db.from('releases').update({ status: 'failed', error: String(e.message || e).slice(0, 500) }).eq('id', release.id);
      out.push({ id: release.id, ok: false, error: String(e.message || e) });
    }
  }
  return new Response(JSON.stringify({ at: now, posted: out.filter((o) => o.ok).length, failed: out.filter((o) => !o.ok).length, out }), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '*/5 * * * *' };
