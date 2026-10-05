// src/lib/trademarkWatch.js
// The page side of netlify/functions/trademark-watch.js. One call shape for
// every action, the signed in session rides as a bearer token because the
// function lets only studio roles through. Errors come back as plain words the
// page can show as they are.
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
  if (!res.ok) throw new Error(data.error || `The watch answered ${res.status}.`);
  return data;
};

// One lowercase word, letters and digits, the same rule the function keeps.
export const cleanWord = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const VERDICT = {
  clear: { label: 'clear', say: 'No mark with this word, live or dead' },
  dead: { label: 'dead marks only', say: 'Only lapsed filings with this word' },
  taken: { label: 'taken', say: 'A live filing already holds this word' },
};

export const when = (iso) => {
  if (!iso) return 'not checked';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
};

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
