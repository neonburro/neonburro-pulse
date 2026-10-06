// netlify/functions/studio-tools.js
// SENTINEL: NB_PULSE_STUDIO_TOOLS_FN_V1
//
// The honest half of the Tools pane in Settings. The page cannot see a
// Netlify variable and must never hold a key, so it asks this function two
// questions and gets back booleans and plain words, never a value and never
// a fragment of one.
//
//   list    which of the names in src/lib/studioTools.js are set on this
//           site, true or false each. Supabase answers by the fact that the
//           role check below just read profiles with the service key.
//   check   one tool, one free read against the vendor with the key this
//           site holds, the same reads the studio's keys-check.js makes:
//           Stripe balance, Resend domains, Anthropic models, Deepgram
//           projects, Solana getHealth. The answer is a state word from
//           stateFor in the same lib, the status code and, for Stripe,
//           live or test. Nothing a vendor says in an error body comes
//           back, Stripe's echoes part of the key.
//
// ── WHO CAN ASK ─────────────────────────────────────────────────────────────
// Studio only. Clients sign in to Pulse too, so a session is not enough, the
// caller's profiles.role must be super_admin or admin, the same check and
// the same two roles as trademark-watch.js and impersonate-client.js. The
// Settings page hides the pane from everyone else, this is the gate that
// counts.
//
// ── WHY THERE IS NO SCHEDULE ────────────────────────────────────────────────
// A check runs only when a person presses Check on the pane, one tool a
// call, and the pane walks the list with a pause between. Every read is free
// at the vendor, but nobody needs Pulse polling five services all day to
// learn what one press tells them. The studio already has a nightly report,
// keys-report.js, for the keys it holds.
//
// ── THE FUNCTIONS ENVIRONMENT ───────────────────────────────────────────────
// This adds no variable. It reads the ones that are already there, which
// matters because the functions scope is capped at 4KB.
//
// ── NEVER ───────────────────────────────────────────────────────────────────
// Never log a key, return a key or return a vendor's error text. Every call
// here is a read that changes nothing at the vendor.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';
import { TOOLS, envNames, stateFor } from '../../src/lib/studioTools.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const supa = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const ALLOWED_ROLES = ['super_admin', 'admin'];
// The same public endpoint registry-balances.js falls back to. Change both
// or neither.
const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const PROBE_MS = 7000;
// The one name each read goes out with. A check needs only that one, so a
// missing webhook secret never stops the Stripe key itself being tested.
// The pane still shows every missing required name in the row.
const PROBE_KEY = {
  stripe: 'STRIPE_SECRET_KEY',
  resend: 'RESEND_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
  solana: null,
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const isSet = (env, name) => !!String(env[name] || '').trim();

export const readEnv = (env = process.env) => Object.fromEntries(envNames().map((name) => [name, isSet(env, name)]));

// One read each. Each returns { code, body, mode } and body carries only the
// one field stateFor reads. The key goes out in a header and nowhere else.
const PROBES = {
  stripe: async (env, signal, go) => {
    const r = await go('https://api.stripe.com/v1/balance', {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal,
    });
    const j = r.ok ? await r.json().catch(() => null) : null;
    return { code: r.status, mode: typeof j?.livemode === 'boolean' ? (j.livemode ? 'live' : 'test') : null };
  },
  resend: async (env, signal, go) => {
    const r = await go('https://api.resend.com/domains', {
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}` }, signal,
    });
    const j = r.ok ? null : await r.json().catch(() => null);
    return { code: r.status, body: { name: j?.name || null } };
  },
  anthropic: async (env, signal, go) => {
    const r = await go('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, signal,
    });
    return { code: r.status };
  },
  deepgram: async (env, signal, go) => {
    const r = await go('https://api.deepgram.com/v1/projects', {
      headers: { authorization: `Token ${env.DEEPGRAM_API_KEY}` }, signal,
    });
    return { code: r.status };
  },
  solana: async (env, signal, go) => {
    const url = String(env.SOLANA_RPC_URL || '').trim() || PUBLIC_RPC;
    const r = await go(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
      signal,
    });
    const j = await r.json().catch(() => null);
    return { code: r.status, health: j?.result === 'ok' };
  },
};

export const probeTool = async (key, env = process.env, go = fetch) => {
  const tool = TOOLS.find((t) => t.key === key && t.probe);
  const at = new Date().toISOString();
  if (!tool || !PROBES[key]) return { key, state: null, code: null, at, error: 'There is nothing to check for this one.' };
  if (PROBE_KEY[key] && !isSet(env, PROBE_KEY[key])) return { key, state: 'no-key', code: null, at };
  try {
    const out = await PROBES[key](env, AbortSignal.timeout(PROBE_MS), go);
    const state = key === 'solana'
      ? (out.code === 200 && out.health ? 'answering' : 'no-answer')
      : stateFor(key, out.code, out.body);
    return { key, state, code: out.code, mode: out.mode || null, at };
  } catch {
    return { key, state: 'no-answer', code: null, at };
  }
};

const whoIs = async (event) => {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!supa || !token) return null;
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await supa.from('profiles').select('id, role').eq('id', data.user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return { allowed: false };
  return { allowed: true };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const who = await whoIs(event);
  if (!who) return json(401, { error: 'Sign in first.' });
  if (!who.allowed) return json(403, { error: 'This pane is for the studio.' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Send JSON.' }); }
  const action = String(body.action || 'list');

  // Reaching this line means the service key just read profiles, so Supabase
  // answered with the key this site holds.
  if (action === 'list') return json(200, { env: readEnv(), supabase: 'answering', at: new Date().toISOString() });

  if (action === 'check') return json(200, await probeTool(String(body.key || '')));

  return json(400, { error: 'Unknown action.' });
};
