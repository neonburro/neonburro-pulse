// netlify/functions/trademark-watch-scheduled.js
// SENTINEL: NB_PULSE_TRADEMARK_NIGHT_V1
//
// The night hand of the trademark watch. Every list, the studio's and each
// client's, carries a cadence per word, off, daily, weekly, biweekly or
// monthly, and a look again date a person can set. This reads the words that
// are due, writes down what changed and goes back to sleep. Everything it
// does to a list goes through netlify/lib/trademarks.js, read that header for
// the store, the register and the terms.
//
// ── THE PACE, AND WHY IT IS SLOW ON PURPOSE ─────────────────────────────────
// The office's terms deny service to anybody "generating unusually high
// numbers of database accesses", automated or not. So:
//   when      every twenty minutes from 03:00 to 08:40 UTC, eighteen runs,
//             all of them between ten at night and five in the morning on
//             the east coast in either season, when the office is quiet
//   how many  at most nine words a run, a second and a half apart, and
//             nothing new starts after twenty seconds, so a run never meets
//             the thirty second clock a scheduled function has
//   how much  two requests a word to the search index and none to TSDR.
//             TSDR is read only when a person opens a mark.
// That is at most 162 words a night and 324 requests spread over six hours.
// When more are due than that, the longest unread go first and the rest wait
// a night. A look again date outranks a cadence, because a person chose it.
// Two failed reads in a row and the run stops, the office is down or saying
// no, and a word whose read failed is left alone for six hours.
//
// ── WHAT IT WRITES ──────────────────────────────────────────────────────────
// applyRead() in the lib, so a night read and a person's read leave the same
// record: the verdict, the marks, and a line in changes for a new filing, a
// status change, a mark going dead or coming back and a new close spelling.
// A look again date that fires is cleared and the read says so in changes.
// It logs counts, never a word, because the words are the secret.
//
// ── THE SCHEDULE LIVES IN TWO PLACES ────────────────────────────────────────
// Here in export const config AND in netlify.toml, and the two must agree.
// netlify.toml says why, an inline schedule alone was ignored without
// complaint on this site until 2026-09-12. A scheduled function cannot be
// called by URL in production, so nobody can make it run hot.
//
// No oxford commas, no em dashes.

import { getStore } from '@netlify/blobs';
import {
  STORE, STUDIO_KEY, CLIENT_PREFIX, UUID, ownerOf, readList, mutate, readRegister,
  applyRead, recordFailure, dueReason, pause,
} from '../lib/trademarks.js';

const MAX_WORDS = 9;
const GAP_MS = 1500;
const BUDGET_MS = 20000;

export const config = { schedule: '*/20 3-8 * * *' };

export default async () => {
  const started = Date.now();
  const store = getStore({ name: STORE, consistency: 'strong' });
  const { blobs } = await store.list({ prefix: CLIENT_PREFIX });
  const keys = [STUDIO_KEY, ...blobs.map((b) => b.key).filter((k) => UUID.test(ownerOf(k)))];

  const due = [];
  for (const key of keys) {
    const doc = await readList(store, key);
    for (const entry of doc?.entries || []) {
      const why = dueReason(entry, started);
      if (why) due.push({ key, word: entry.word, why, last: entry.checkedAt || '' });
    }
  }
  due.sort((a, b) => (Number(b.why === 'look') - Number(a.why === 'look')) || a.last.localeCompare(b.last));

  let read = 0;
  let changed = 0;
  let failed = 0;
  let streak = 0;
  for (const item of due) {
    if (read + failed >= MAX_WORDS || Date.now() - started > BUDGET_MS || streak >= 2) break;
    if (read + failed > 0) await pause(GAP_MS);
    let result = null;
    let failure = null;
    let made = 0;
    try { result = await readRegister(item.word); } catch (err) { failure = err.message; }
    // made is set, never added to, inside mutate, because mutate runs the
    // change again when another hand wrote the list first.
    await mutate(store, item.key, (doc) => {
      const entry = doc.entries.find((e) => e.word === item.word);
      if (!entry) return false;
      if (!result) { recordFailure(entry, failure); return true; }
      const changes = applyRead(entry, result, 'schedule');
      if (item.why === 'look' && entry.lookAgain) {
        entry.changes.unshift({ kind: 'look', say: 'Read again on the date you set.', at: result.readAt, by: 'schedule' });
        entry.lookAgain = null;
      }
      made = changes.filter((c) => c.kind !== 'first').length;
      return true;
    }).catch(() => {});
    changed += made;
    if (result) { read += 1; streak = 0; } else { failed += 1; streak += 1; }
  }

  const summary = { fn: 'trademark-watch-scheduled', lists: keys.length, due: due.length, read, failed, changed, ms: Date.now() - started };
  console.log(JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
