// netlify/functions/registry-balances.js
// SENTINEL: NB_PULSE_REGISTRY_BALANCES_V2
//
// The chain side of the Registry page and the token room. Takes a list of
// Solana addresses and answers with each one's SOL and NEONBURRO balance,
// the time that figure was true and whether it came off the chain just now
// or out of the cache. The wallet list itself lives in token_wallets and
// travels through the Supabase client, this function only ever talks to
// the chain and to its own cache. Session gated like every Pulse function,
// chain data is public but this door is ours.
//
// ── WHY SERVER SIDE ─────────────────────────────────────────────────────────
// The public RPC rate limits browsers hard and CORS behavior shifts under
// load. A server request is friendlier to the endpoint and gives one place
// to slot a private RPC url, set SOLANA_RPC_URL on the Pulse site and
// nothing else changes.
//
// ── THE LADDER, 2026-09-25 ──────────────────────────────────────────────────
// V1 sent one batch of forty calls to the public node and the public node
// answered 429, so every wallet in the room said not read. V2 climbs a
// ladder and keeps whatever each rung gives it.
//   1. one batch, two calls per address, ids map back by index
//   2. on 429 or any non ok answer, wait about 1500 ms and send the batch
//      once more, only the addresses still missing
//   3. read the cache for what is still missing, then walk, one address
//      per request with a short pause between them, under a time budget
//      so the function answers before Netlify cuts it off. Addresses with
//      nothing in the cache walk first, so a short budget is spent on the
//      wallets that would otherwise say not read. Partial answers kept.
//   4. every address the chain refused answers from the cache, the last
//      good figure and the time it was read, marked cached
// A wallet with no live figure and no cached figure answers null on both
// numbers and the page says not read. The note says what happened in
// words and numbers so the page can repeat it plainly.
//
// An address counts as read only when both of its calls answered. A live
// SOL figure next to a cached NEONBURRO figure would have two times and
// one row, so a half answer goes down the ladder whole.
//
// ── THE CACHE ───────────────────────────────────────────────────────────────
// Netlify Blobs, store registry-balances, one key per address, value
// { sol, nb, at }. Written after every live read, read only for addresses
// the chain refused. connectLambda(event) comes first, handlers with the
// (event, context) signature get the blob context on the event as base64
// and getStore throws MissingBlobsEnvironmentError without it. Same
// pattern as read-weight-background.js on the studio site. When the
// context is missing altogether, an old netlify dev or a bare invocation,
// connectLambda itself throws, so it is guarded and the read goes on
// without a cache. Under netlify dev the store is a local sandbox that
// empties on restart, fine for a cache. The store never blocks a read. If
// it fails the live figures still go out and the note says so.
//
// ── THE ENDPOINT ────────────────────────────────────────────────────────────
// SOLANA_RPC_URL on the Pulse site, functions scope, wins when set. The
// public mainnet endpoint is the fallback and the reason the ladder
// exists. The url may carry a key, so it is never logged or returned,
// the answer says keyed or public and nothing more.
//
// ── THE BUDGET ──────────────────────────────────────────────────────────────
// A synchronous Netlify function has ten seconds. The clock starts before
// the session check and the ladder spends about 8.5 seconds at most, then
// stops walking. The pages send addresses in small chunks, see
// src/lib/registryBalances.js, so one refused chunk costs one budget and
// not the whole book. Proven offline on 2026-09-25 with a stubbed node,
// forty refused addresses answer in 8.5 seconds with the cache filled in.
//
// ── THE ANSWER ──────────────────────────────────────────────────────────────
//   balances[address]  { sol, nb, at, source }  source is live, cache or none
//   counts             { total, live, cached, none }
//   rpc                keyed or public
//   at                 when this answer was made
//   note               one plain line, empty when every figure is live
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';
import { connectLambda, getStore } from '@netlify/blobs';

const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const RPC = process.env.SOLANA_RPC_URL || PUBLIC_RPC;
const RPC_KIND = process.env.SOLANA_RPC_URL ? 'keyed' : 'public';
const MINT = 'EdBEwPyso39z2ow59frpuLUVz5axm61dnqAeAuxYpump';
const STORE = 'registry-balances';

const MAX_ADDRESSES = 40;
const RETRY_WAIT_MS = 1500;
const WALK_PAUSE_MS = 250;
const BUDGET_MS = 8500;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const isAddress = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ''));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The two calls for one address. Ids are base and base plus one so a batch
// answer maps back by index whatever order the node returns it in.
const calls = (address, base) => [
  { jsonrpc: '2.0', id: base, method: 'getBalance', params: [address] },
  {
    jsonrpc: '2.0',
    id: base + 1,
    method: 'getTokenAccountsByOwner',
    params: [address, { mint: MINT }, { encoding: 'jsonParsed' }],
  },
];

// One round trip. Never throws, the ladder reads ok and status.
const post = async (body) => {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, status: res.status, answers: [] };
    const json = await res.json();
    return { ok: true, status: res.status, answers: Array.isArray(json) ? json : [json] };
  } catch {
    return { ok: false, status: 0, answers: [] };
  }
};

// Reads a batch answer into figures by address. Both calls must answer
// without a jsonrpc error for the address to count as read.
const collect = (list, answers, out) => {
  const byId = new Map(answers.map((r) => [r.id, r]));
  let read = 0;
  list.forEach((address, i) => {
    const solAns = byId.get(i * 2);
    const nbAns = byId.get(i * 2 + 1);
    if (!solAns || !nbAns || solAns.error || nbAns.error) return;
    const sol = (typeof solAns.result?.value === 'number') ? solAns.result.value / 1e9 : null;
    const accounts = nbAns.result?.value;
    const nb = Array.isArray(accounts)
      ? accounts.reduce((sum, acc) => sum + (acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0)
      : null;
    if (sol === null || nb === null) return;
    out[address] = { sol, nb };
    read += 1;
  });
  return read;
};

const says = (status) => (status ? `answered ${status}` : 'did not answer');

// A cached value is only trusted when it has the shape this function wrote.
const isFigure = (value) => value && typeof value === 'object'
  && typeof value.sol === 'number' && typeof value.nb === 'number';

export const handler = async (event) => {
  let blobsReady = false;
  try { connectLambda(event); blobsReady = true; } catch { blobsReady = false; }
  const started = Date.now();

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!supa || !token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sign in first.' }) };
  }
  const { data: userData, error: authErr } = await supa.auth.getUser(token);
  if (authErr || !userData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sign in first.' }) };
  }

  try {
    const { addresses } = JSON.parse(event.body || '{}');
    const list = [...new Set((Array.isArray(addresses) ? addresses : []).filter(isAddress))].slice(0, MAX_ADDRESSES);
    if (!list.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Send addresses.' }) };
    }

    let store = null;
    try { store = blobsReady ? getStore(STORE) : null; } catch { store = null; }
    let cacheFailed = !store;

    const live = {};
    const parts = [];

    // rung 1, the batch
    let res = await post(list.flatMap((a, i) => calls(a, i * 2)));
    if (res.ok) collect(list, res.answers, live);
    let pending = list.filter((a) => !live[a]);
    if (pending.length) {
      parts.push(res.ok
        ? `the ${RPC_KIND} node left ${pending.length} of ${list.length} unanswered in the batch`
        : `the ${RPC_KIND} node ${says(res.status)} on the batch`);
    }

    // rung 2, the same batch once more after a breath
    if (pending.length) {
      await sleep(RETRY_WAIT_MS);
      res = await post(pending.flatMap((a, i) => calls(a, i * 2)));
      const before = pending.length;
      if (res.ok) collect(pending, res.answers, live);
      pending = list.filter((a) => !live[a]);
      if (pending.length) {
        parts.push(res.ok
          ? `the retry read ${before - pending.length} of ${before}`
          : `the retry ${says(res.status)}`);
      }
    }

    // rung 3, the cache for what is missing, then the walk, uncached first
    const cached = {};
    if (store && pending.length) {
      const reads = await Promise.allSettled(pending.map((address) => store.get(address, { type: 'json' })));
      reads.forEach((r, i) => {
        if (r.status === 'rejected') { cacheFailed = true; return; }
        if (isFigure(r.value)) cached[pending[i]] = r.value;
      });
    }

    if (pending.length) {
      const order = [...pending.filter((a) => !cached[a]), ...pending.filter((a) => cached[a])];
      let walked = 0;
      let read = 0;
      let stopped = false;
      for (const address of order) {
        if (Date.now() - started > BUDGET_MS) { stopped = true; break; }
        const one = await post(calls(address, 0));
        walked += 1;
        if (one.ok) read += collect([address], one.answers, live);
        await sleep(WALK_PAUSE_MS);
      }
      pending = list.filter((a) => !live[a]);
      parts.push(`one at a time read ${read} of ${walked}${stopped ? ' before the time budget ran out' : ''}`);
    }

    // rung 4, write what is live, answer the rest from the cache
    const now = new Date().toISOString();
    const balances = {};
    const writes = [];
    for (const address of list) {
      if (!live[address]) continue;
      balances[address] = { ...live[address], at: now, source: 'live' };
      if (store) writes.push(store.setJSON(address, { ...live[address], at: now }));
    }
    if (writes.length) {
      const settled = await Promise.allSettled(writes);
      if (settled.some((s) => s.status === 'rejected')) cacheFailed = true;
    }

    let cachedCount = 0;
    for (const address of pending) {
      const hit = cached[address];
      if (hit) cachedCount += 1;
      balances[address] = hit
        ? { sol: hit.sol, nb: hit.nb, at: hit.at || null, source: 'cache' }
        : { sol: null, nb: null, at: null, source: 'none' };
    }

    const counts = {
      total: list.length,
      live: list.length - pending.length,
      cached: cachedCount,
      none: pending.length - cachedCount,
    };

    if (counts.cached) parts.push(`${counts.cached} answered from the cache with the time they were read`);
    if (counts.none) parts.push(`${counts.none} never read and not in the cache`);
    if (cacheFailed && pending.length) parts.push('the cache was unreachable');
    const note = parts.length ? parts.join(', ') : '';

    return {
      statusCode: 200,
      body: JSON.stringify({ balances, counts, rpc: RPC_KIND, at: now, note }),
    };
  } catch (err) {
    console.error('registry-balances error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'The chain read failed.' }) };
  }
};
