// src/lib/trademarkWatch.js
// SENTINEL: NB_PULSE_TRADEMARK_WATCH_CLIENT_V2
//
// The page side of netlify/functions/trademark-watch.js. One call shape for
// every action. The signed in session rides as a bearer token because the
// function decides who may open which list from the profile behind it, never
// from anything the page sends. Errors come back as plain words the page can
// show as they are.
//
// The words that describe a verdict, a cadence and a tone live here once so
// the list, the word and the mark views cannot drift apart. The client portal
// on neonburro.com keeps its own copy of the same words in
// neonburro/src/pages/Account/trademarks.js, because the two sites share no
// code. If a word changes here, change it there in the same sitting.
//
// THE SESSION CEILING. The function keeps the day and lifetime ceilings on
// each list. A session only exists in the page, so the page counts the
// requests to the office it caused, in sessionStorage per list, against the
// session number the function sends back in limits. Storage can throw in a
// private window, so every read and write is wrapped and a failure counts as
// zero rather than locking anybody out.
//
// No oxford commas, no em dashes.

import { supabase } from './supabase';

export const callWatch = async (action, payload = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/trademark-watch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `The watch answered ${res.status}.`);
    err.status = res.status;
    throw err;
  }
  return data;
};

// One lowercase word, letters and digits, the same rule the function keeps.
export const cleanWord = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const VERDICT = {
  clear: { label: 'clear', say: 'No mark with this word on the federal register, live or dead' },
  dead: { label: 'dead marks only', say: 'Only lapsed filings hold this word' },
  taken: { label: 'taken', say: 'A live filing holds this word' },
};

export const CADENCE = [
  { key: 'off', label: 'Off', short: 'off' },
  { key: 'daily', label: 'Daily', short: 'daily' },
  { key: 'weekly', label: 'Weekly', short: 'weekly' },
  { key: 'biweekly', label: 'Every two weeks', short: 'two weeks' },
  { key: 'monthly', label: 'Monthly', short: 'monthly' },
];
export const cadenceShort = (key) => (CADENCE.find((c) => c.key === key) || CADENCE[0]).short;

// What each tone of a date means, in a word.
export const TONE_WORD = {
  free: 'could come free',
  look: 'look again',
  watch: 'clock running',
  soon: 'coming',
  kept: 'kept up',
  gone: 'gone',
};

export const when = (iso) => {
  if (!iso) return 'not read';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
};

export const day = (iso) => (iso
  ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  : '');

export const shortDay = (iso) => (iso
  ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  : '');

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const plusMonths = (n, from = todayIso()) => {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── the session ceiling ─────────────────────────────────────────────────────
const sessionKey = (owner) => `nb-tm-session-${owner}`;
export const sessionUsed = (owner) => {
  try { return Number(sessionStorage.getItem(sessionKey(owner))) || 0; } catch { return 0; }
};
export const spendSession = (owner, n) => {
  try { sessionStorage.setItem(sessionKey(owner), String(sessionUsed(owner) + n)); } catch { /* counts as zero */ }
};

// What each action costs in requests to the office. Mirrors the charge()
// calls in netlify/functions/trademark-watch.js.
export const COST = { add: 2, check: 2, probe: 1, facts: 1 };
