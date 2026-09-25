// src/lib/registryBalances.js
//
// The one way a page asks registry-balances for the book's balances. The
// Registry and the token room both call this, so the chunk size, the merge,
// the counting and the time format live here once and the two pages cannot
// disagree about what was read.
//
// ── WHY CHUNKS ──────────────────────────────────────────────────────────────
// The function batches two calls per address into one body and the public
// node answered 429 to forty calls at once on 2026-09-25, which blanked the
// whole room. Ten addresses is twenty calls, under the public node's per
// method window, and one refused chunk costs one function budget and not
// the book. Chunks go out one after another, never in parallel, because a
// second request on the same node while the first is being refused only
// deepens the refusal.
//
// onChunk fires after every chunk with the balances so far, so a page can
// draw the rows it has while the rest is still on the wire.
//
// The answer shape per address is the function's, { sol, nb, at, source },
// source is live, cache or none, at is an ISO time. A chunk the function
// itself could not answer, a 500 or the network, is filled with none so
// every address the page asked about has a row in the answer.
// See netlify/functions/registry-balances.js for the ladder.
//
// No oxford commas, no em dashes.

import { supabase } from './supabase';

export const CHUNK = 10;

export const EMPTY_COUNTS = { total: 0, live: 0, cached: 0, none: 0 };

const NONE = { sol: null, nb: null, at: null, source: 'none' };

export const readRegistryBalances = async (addresses, onChunk) => {
  const list = [...new Set((addresses || []).filter(Boolean))];
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  };

  const balances = {};
  const counts = { ...EMPTY_COUNTS };
  const notes = new Set();
  let rpc = '';
  let failed = 0;

  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    try {
      const res = await fetch('/.netlify/functions/registry-balances', {
        method: 'POST',
        headers,
        body: JSON.stringify({ addresses: chunk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'the chain read failed');
      chunk.forEach((address) => { balances[address] = data.balances?.[address] || { ...NONE }; });
      counts.total += chunk.length;
      counts.live += data.counts?.live || 0;
      counts.cached += data.counts?.cached || 0;
      counts.none += chunk.length - (data.counts?.live || 0) - (data.counts?.cached || 0);
      if (data.rpc) rpc = data.rpc;
      if (data.note) notes.add(data.note);
    } catch (err) {
      failed += 1;
      chunk.forEach((address) => { balances[address] = { ...NONE }; });
      counts.total += chunk.length;
      counts.none += chunk.length;
      notes.add(err.message || 'the chain read failed');
    }
    if (onChunk) {
      onChunk({
        balances: { ...balances },
        counts: { ...counts },
        done: Math.min(i + CHUNK, list.length),
        of: list.length,
      });
    }
  }

  return { balances, counts, notes: [...notes], rpc, failed };
};

// The time a figure was true, as a person reads it. Today is the time
// alone, any other day carries the date, because a cached figure can be
// days old and the room has to say so.
export const readTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};

// One word and a time for a figure, the same on both pages.
export const sourceLine = (balance) => {
  if (!balance || balance.source === 'none' || !balance.source) return 'not read';
  if (balance.source === 'cache') return `cached ${readTime(balance.at)}`;
  return `live ${readTime(balance.at)}`;
};
