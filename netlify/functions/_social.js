// netlify/functions/_social.js
// SENTINEL: NB_PULSE_SOCIAL_HAND_V1
//
// The shared half of the Meta posting hand. publish-facebook.js and
// publish-instagram.js each hold one channel's Graph API calls, this file
// holds what they share, the database, the claim and write pattern copied
// from the Telegram hand on the studio site (neonburro/netlify/functions/
// release-social.js), the session gate for the manual door and the Meta env
// reader. The underscore keeps Netlify from deploying it as a function, the
// same convention as _letterhead.js beside it.
//
// ── WHY THE META HAND LIVES ON PULSE ────────────────────────────────────────
// A token lives in exactly one place. The Telegram bot tokens were set on the
// studio site so that runner lives there. The plan of 2026-09-25 puts the
// Meta values on the Pulse site, META_PAGE_ACCESS_TOKEN, META_PAGE_ID and
// META_IG_USER_ID, functions scope, so the Meta runner lives here. Pulse
// keeps the desk either way.
//
// ── THE CLAIM ───────────────────────────────────────────────────────────────
// A row is claimed by stamping claimed_at with this run's instant, guarded
// by the previous claimed_at so two ticks cannot both take it. The row is
// reread under the claim, checked, posted, then written released with the
// external id, every write guarded by the same instant. A claim older than
// ten minutes is stale and may be taken again. On any failure the row goes
// to failed with the reason and claimed_at null, and a person puts it back
// on the ramp with one tap. The manual door never steals a fresh claim, it
// says the runner holds the row and stops.
//
// ── THE READS USE STAR ──────────────────────────────────────────────────────
// asset_alt arrives with the 2026-09-25 migration. A named field list would
// make every five minute tick error until the migration is applied, star
// reads whatever columns exist and the code tolerates a missing alt.
//
// ── WHAT IS NEVER LOGGED ────────────────────────────────────────────────────
// The token. It rides in the form body, never the url, Graph error bodies
// are read for message and code and never echoed whole.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';

export const GRAPH = 'https://graph.facebook.com/v21.0';
export const META_ENV = /^META_[A-Z0-9_]+$/;
export const STAFF = ['super_admin', 'admin', 'manager'];
export const RELEASE_FIELDS = '*';
const STALE_MS = 10 * 60 * 1000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export const createDb = () => (
  (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    : null
);

const NAMES_TOKEN = /NEONBURRO/;
const PRICE_TALK = /NEONBURRO[^.\n]{0,40}\$|\$[^.\n]{0,40}NEONBURRO|\b(pump|moon|100x|10x|gains|price target|buy now|last chance|undervalued|early)\b/i;

export const readsAsPriceTalk = (body) => (
  NAMES_TOKEN.test(body || '') && PRICE_TALK.test(body || '')
);

export const staleBefore = () => new Date(Date.now() - STALE_MS).toISOString();

// A picked plate is a public url stored whole in asset_path, or an object in
// a Pulse bucket. shared.jsx on the page tells them apart the same way.
export const assetUrl = (release) => {
  const path = String(release.asset_path || '').trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!release.asset_bucket) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${release.asset_bucket}/${path}`;
};

export const formatOf = (url) => {
  const clean = String(url || '').split('?')[0].split('#')[0];
  const ext = (clean.split('.').pop() || '').toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
};

export const releaseCopy = (release) => {
  const copy = String(release.body || release.title || '').trim();
  const link = String(release.link || '').trim();
  if (!link || copy.includes(link)) return copy;
  return `${copy}\n\n${link}`;
};

// The three Meta values by name. token_env on the account row names the
// token variable. The page id and the ig user id come from their own names
// and fall back to the account row's chat_id, which Meta channels do not
// use otherwise and which holds the public object id. Values never leave
// this function, only the names that are missing.
export const readMetaEnv = (account) => {
  const tokenName = account.token_env || '';
  const missing = [];
  const named = META_ENV.test(tokenName);
  if (!named) missing.push('a META_ token_env on the account row');
  const token = named ? process.env[tokenName] : null;
  if (named && !token) missing.push(tokenName);
  const pageId = process.env.META_PAGE_ID || (account.channel === 'facebook' ? account.chat_id : null) || null;
  const igUserId = process.env.META_IG_USER_ID || (account.channel === 'instagram' ? account.chat_id : null) || null;
  if (account.channel === 'facebook' && !pageId) missing.push('META_PAGE_ID');
  if (account.channel === 'instagram' && !igUserId) missing.push('META_IG_USER_ID');
  return { token, pageId, igUserId, missing };
};

// Names only, for the readiness probe the page reads. True or false per name.
export const metaReadiness = (channel) => {
  const names = ['META_PAGE_ACCESS_TOKEN', channel === 'facebook' ? 'META_PAGE_ID' : 'META_IG_USER_ID'];
  const missing = names.filter((name) => !process.env[name]);
  return { channel, ready: missing.length === 0, missing, names };
};

// One Graph call. Form encoded, the token rides in the body on a POST and
// in the query on a GET, and neither is ever printed. Errors come back as
// meta <code> <message>.
export const graph = async (path, params, token, method = 'POST') => {
  const body = new URLSearchParams({ ...params, access_token: token });
  const response = method === 'GET'
    ? await fetch(`${GRAPH}/${path}?${body.toString()}`)
    : await fetch(`${GRAPH}/${path}`, {
      method,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload || payload.error) {
    const err = payload?.error || {};
    const code = err.code ? `${err.code}${err.error_subcode ? `.${err.error_subcode}` : ''}` : response.status;
    throw new Error(`meta ${code} ${err.message || 'no message'}`.trim());
  }
  return payload;
};

export const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export const resolveAccount = async (db, release) => {
  if (!release.social_account_id) throw new Error('no publishing account is selected');
  const { data, error } = await db
    .from('social_accounts')
    .select('*')
    .eq('id', release.social_account_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('selected publishing account does not exist');
  if (data.channel !== release.channel) throw new Error('selected publishing account belongs to another channel');
  return data;
};

// Carry one release through one adapter under a claim. Returns
// { id, ok, externalId } or { id, ok: false, error }. The adapter receives
// the account, the reread release and the env and returns the external id.
export const carry = async (db, release, adapter, now) => {
  let claimQuery = db
    .from('releases')
    .update({ claimed_at: now })
    .eq('id', release.id)
    .eq('status', 'staged')
    .eq('approved', true);
  claimQuery = release.claimed_at
    ? claimQuery.eq('claimed_at', release.claimed_at)
    : claimQuery.is('claimed_at', null);
  const claim = await claimQuery.select('id').maybeSingle();
  if (claim.error || !claim.data) {
    return { id: release.id, ok: false, error: 'another hand holds this release' };
  }

  const { data: current, error: rereadError } = await db
    .from('releases')
    .select(RELEASE_FIELDS)
    .eq('id', release.id)
    .eq('status', 'staged')
    .eq('approved', true)
    .eq('claimed_at', now)
    .maybeSingle();
  if (rereadError || !current) {
    await db.from('releases').update({ claimed_at: null }).eq('id', release.id).eq('claimed_at', now);
    return { id: release.id, ok: false, error: 'release changed before posting' };
  }

  try {
    if (readsAsPriceTalk(current.body)) throw new Error('body reads as price talk, refused');
    if (['needs_lyra', 'generating'].includes(current.asset_status)) throw new Error('creative work is not ready');

    const account = await resolveAccount(db, current);
    if (!account.enabled) throw new Error(`${account.burro} on ${current.channel} is switched off`);
    const env = readMetaEnv(account);
    if (env.missing.length) throw new Error(`not connected, missing ${env.missing.join(' and ')} on the Pulse site`);

    const externalId = await adapter({ account, release: current, env });

    const released = await db
      .from('releases')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
        external_id: externalId,
        error: null,
        claimed_at: null,
      })
      .eq('id', current.id)
      .eq('status', 'staged')
      .eq('approved', true)
      .eq('claimed_at', now)
      .select('id')
      .maybeSingle();
    if (released.error || !released.data) {
      throw new Error(`release changed while ${current.channel} was posting. verify the external post ${externalId}`);
    }
    return { id: current.id, ok: true, externalId };
  } catch (failure) {
    const message = String(failure.message || failure).slice(0, 500);
    await db
      .from('releases')
      .update({ status: 'failed', claimed_at: null, error: message })
      .eq('id', current.id)
      .eq('status', 'staged')
      .eq('approved', true)
      .eq('claimed_at', now);
    return { id: current.id, ok: false, error: message };
  }
};

// The session gate for the manual doors, the same one publish-blog-post.js
// uses. Returns { user, profile } or { status, error }.
export const gate = async (db, event) => {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!db) return { status: 500, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set on the Pulse site.' };
  if (!token) return { status: 401, error: 'Sign in first.' };
  const { data: userData, error: authErr } = await db.auth.getUser(token);
  if (authErr || !userData?.user) return { status: 401, error: 'Sign in first.' };
  const { data: profile } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
  if (!STAFF.includes(profile?.role)) return { status: 403, error: 'This door needs a staff role.' };
  return { user: userData.user, profile };
};

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// The manual door shared by both Meta functions. GET answers readiness by
// name, POST carries one staged approved row now, on a person's click.
export const metaDoor = (channel, adapter) => async (event) => {
  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  if (event.httpMethod === 'GET') return json(200, metaReadiness(channel));
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let releaseId = null;
  try {
    releaseId = JSON.parse(event.body || '{}').release_id || null;
  } catch {
    releaseId = null;
  }
  if (!releaseId) return json(400, { error: 'Send a release_id.' });

  const { data: release, error } = await db
    .from('releases')
    .select(RELEASE_FIELDS)
    .eq('id', releaseId)
    .maybeSingle();
  if (error || !release) return json(404, { error: 'That release does not exist.' });
  if (release.channel !== channel) return json(400, { error: `That release is for ${release.channel}, not ${channel}.` });
  if (release.status !== 'staged' || !release.approved) {
    return json(409, { error: 'Only a staged and approved release can leave. Stage it and switch approval on.' });
  }
  if (release.claimed_at && release.claimed_at > staleBefore()) {
    return json(409, { error: 'The scheduled hand holds this release right now. Give it a minute.' });
  }

  const now = new Date().toISOString();
  const result = await carry(db, release, adapter, now);
  return json(result.ok ? 200 : 502, result);
};
