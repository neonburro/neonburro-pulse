// src/pages/Trademarks/useWatch.js
// SENTINEL: NB_PULSE_TRADEMARKS_HOOK_V2
//
// One list in memory for the whole watch. The list, the word and the mark are
// three routes under /trademarks/ but one mounted component, index.jsx, so
// moving between them never reloads the list and the back crumb lands on the
// same rows. This hook is that memory and every action on it.
//
// Every action returns the fresh entry from the function and puts it back in
// place, so the page never guesses what the function wrote. reads and limits
// ride on every answer and are kept, so the ceiling line is always current.
//
// call is the function. index.jsx passes the real one, a local review fixture
// passes its own, nothing else changes.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useRef } from 'react';
import { COST, sessionUsed, spendSession } from '../../lib/trademarkWatch';

export const useWatch = (owner, call) => {
  const [list, setList] = useState(null);
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState({});
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  const absorb = useCallback((res) => {
    if (!res) return;
    setList((l) => (l ? { ...l, reads: res.reads || l.reads, limits: res.limits || l.limits } : l));
  }, []);

  const put = useCallback((entry) => {
    if (!entry) return;
    setList((l) => {
      if (!l) return l;
      const at = l.entries.findIndex((e) => e.word === entry.word);
      const entries = at === -1 ? [entry, ...l.entries] : l.entries.map((e, i) => (i === at ? entry : e));
      return { ...l, entries };
    });
  }, []);

  const mark = (word, what) => setBusy((b) => ({ ...b, [word]: what }));
  const clear = (word) => setBusy((b) => { const n = { ...b }; delete n[word]; return n; });

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await call('list', { owner });
      if (ownerRef.current === owner) setList(res);
      return res;
    } catch (err) {
      if (ownerRef.current === owner) { setError(err.message); setList({ open: false, failed: true, entries: [] }); }
      return null;
    }
  }, [owner, call]);

  const loadLists = useCallback(async () => {
    try {
      const res = await call('lists');
      setLists(res);
    } catch { setLists({ lists: [], clients: [] }); }
  }, [call]);

  useEffect(() => { setList(null); load(); }, [load]);
  useEffect(() => { if (list?.viewer === 'studio' && !lists) loadLists(); }, [list?.viewer, lists, loadLists]);

  // The session ceiling. Thrown as an error so every caller shows it the same way.
  const spend = (cost) => {
    const cap = list?.limits?.session || 60;
    if (sessionUsed(owner) + cost > cap) {
      throw new Error('That is as much reading as one sitting gets. The night reads carry on, come back later.');
    }
    spendSession(owner, cost);
  };

  const run = async (word, what, cost, fn) => {
    setError('');
    mark(word, what);
    try {
      if (cost) spend(cost);
      const res = await fn();
      absorb(res);
      if (res?.entry) put(res.entry);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      clear(word);
    }
  };

  const actions = {
    add: (word, cadence) => run(word, 'reading', COST.add, () => call('add', { owner, word, cadence })),
    check: (word) => run(word, 'reading', COST.check, () => call('check', { owner, word })),
    watch: (word, patch) => run(word, 'saving', 0, () => call('watch', { owner, word, ...patch })),
    note: (word, note) => run(word, 'saving', 0, () => call('note', { owner, word, note })),
    facts: (word, serial) => run(word, 'tsdr', COST.facts, () => call('facts', { owner, word, ...(serial ? { serial } : {}) })),
    remove: async (word) => {
      const res = await run(word, 'removing', 0, () => call('remove', { owner, word }));
      setList((l) => (l ? { ...l, entries: l.entries.filter((e) => e.word !== word) } : l));
      return res;
    },
    suggest: (word, round) => call('suggest', { owner, word, round }),
    probe: async (word) => {
      spend(COST.probe);
      const res = await call('probe', { owner, word });
      absorb(res);
      return res;
    },
    openList: async (clientId) => {
      const res = await call('open', { owner: clientId });
      await loadLists();
      return res;
    },
    closeList: async (clientId) => {
      const res = await call('close', { owner: clientId });
      await loadLists();
      return res;
    },
    reload: load,
    reloadLists: loadLists,
  };

  return { list, lists, error, setError, busy, ...actions };
};

export default useWatch;
