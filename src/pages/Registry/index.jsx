// src/pages/Registry/index.jsx
// SENTINEL: NB_PULSE_REGISTRY_V2
//
// The Registry, the private book of the studio's own labeled wallets. Every
// wallet Tyler mints gets a row the moment it exists, ion and the vaults and
// the voice accounts and every fresh phantom, and the page reads SOL and
// NEONBURRO balances from the chain so the map never goes stale.
//
// ── WHAT THIS PAGE IS NOT ───────────────────────────────────────────────────
// Not public, not the token page's wallet map. That one is editorial and
// deliberate, this one is operational and complete. Public addresses and
// labels only, NEVER keys, NEVER seeds and nothing here ships to a public
// surface. If a row needs to become public it goes through wallets.js in
// the studio repo by hand.
//
// ── TWO DOORS INTO THE BOOK, 2026-09-25 ─────────────────────────────────────
// The one row form, and beside it a paste. The studio keeps its wallet map
// in a private csv with the columns label,address,app,burro,note, and the
// way that map gets into the book is a person pasting it here, inside
// Pulse, under the staff RLS that governs the table. The paste takes those
// five columns in that order, a header line is optional, tabs work when a
// spreadsheet was the source, every address passes the same base58 test
// the form uses, an address already in the book is skipped and the page
// says how many went in and how many were skipped. No csv is ever read by
// a machine on its way in and no address ever lands in a commit.
//
// ── THE BURRO COLUMN ────────────────────────────────────────────────────────
// The csv carries burro, the table from the studio's 2026082605 migration
// does not. The migration named token_wallets_burro in supabase/migrations
// here adds it, prepared and not applied. Until it lands, the page sees no
// burro key on the rows it reads and folds the burro name into the note as
// "burro name" so nothing typed is lost. Once the column exists the same
// paste writes it straight. Either order works.
//
// ── BALANCES ────────────────────────────────────────────────────────────────
// Through src/lib/registryBalances.js and registry-balances.js, in chunks,
// because the public RPC treats browsers worse than servers and treats a
// big batch worst of all. A figure the chain refused comes from the cache
// with the time it was read and the row says cached. Not read means neither
// the chain nor the cache had it.
//
// Paper system page. No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Container, Spinner, Input, Textarea,
} from '@chakra-ui/react';
import {
  TbPlus, TbCopy, TbCheck, TbExternalLink, TbRefresh, TbTrash, TbClipboardText,
} from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { readRegistryBalances, readTime, EMPTY_COUNTS } from '../../lib/registryBalances';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST } from '../../theme/layout';

const P = colors.paper;
const SUPPLY = 1_000_000_000;

const isAddress = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ''));
const isDuplicate = (error) => error?.code === '23505' || /duplicate/i.test(error?.message || '');

const shortAddr = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');
// A missing figure says not read in words. The old dash glyph was an en
// dash, which the house does not write, and a hyphen reads as a minus in
// a column of numbers.
const fmtM = (n) => {
  if (n === null || n === undefined) return 'not read';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(n < 10 ? 2 : 0);
};
const fmtSol = (n) => (n === null || n === undefined ? 'not read' : n.toFixed(n < 1 ? 3 : 2));

// One csv line into fields. Quoted fields may hold commas and doubled
// quotes. A line with tabs and no commas came from a spreadsheet.
const splitLine = (line) => {
  if (!line.includes(',') && line.includes('\t')) return line.split('\t').map((s) => s.trim());
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

const isHeader = (f) => /^label$/i.test(f[0] || '') || /^address$/i.test(f[1] || '');

// label,address,app,burro,note. Only the address is required. A line with
// one field that reads as an address is taken as an address alone. A note
// typed with commas and no quotes spills into extra fields, so the tail is
// joined back with the commas it lost.
const parsePaste = (text) => {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  let invalid = 0;
  lines.forEach((line, i) => {
    const f = splitLine(line);
    if (i === 0 && isHeader(f)) return;
    let label = f[0] || '';
    let address = f[1] || '';
    if (f.length === 1) { address = f[0]; label = ''; }
    if (!isAddress(address)) { invalid += 1; return; }
    rows.push({
      label: (label || 'unlabelled').toLowerCase(),
      address,
      app: f[2] || '',
      burro: (f[3] || '').toLowerCase(),
      note: f.slice(4).filter(Boolean).join(', '),
    });
  });
  return { rows, invalid };
};

// The row the table takes. burro rides its own column when the table has
// one and folds into the note when it does not, see the header.
const toPayload = ({ label, address, app, burro, note }, hasBurro) => {
  const payload = { label, address, app: app || '', note: note || '' };
  if (hasBurro) payload.burro = burro || '';
  else if (burro) payload.note = note ? `burro ${burro}, ${note}` : `burro ${burro}`;
  return payload;
};

const inputProps = {
  bg: P.sheet,
  border: '1px solid',
  borderColor: P.hair,
  borderRadius: '10px',
  color: P.ink,
  fontSize: TYPE.small,
  h: '38px',
  px: 3,
  _placeholder: { color: P.inkFaint },
  _hover: { borderColor: P.inkFaint },
  _focus: { borderColor: P.limeDeep, boxShadow: 'none', outline: 'none' },
};

const pill = {
  spacing: 1.5,
  bg: P.lime,
  color: P.limeInk,
  borderRadius: 'full',
  px: 4,
  h: '38px',
  fontWeight: '700',
  fontSize: 'sm',
  flexShrink: 0,
  transition: `all 0.18s ${EASE}`,
  _hover: { bg: '#D2E26B' },
  _disabled: { opacity: 0.6, cursor: 'wait' },
};

const EMPTY_DRAFT = { label: '', address: '', app: '', burro: '', note: '' };

const Registry = () => {
  const [rows, setRows] = useState([]);
  const [hasBurro, setHasBurro] = useState(false);
  const [balances, setBalances] = useState({});
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [progress, setProgress] = useState({ done: 0, of: 0 });
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  const [chainNotes, setChainNotes] = useState([]);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState('');

  const readChain = useCallback(async (list) => {
    if (!list.length) return;
    setReading(true);
    setProgress({ done: 0, of: list.length });
    const answer = await readRegistryBalances(list.map((r) => r.address), (partial) => {
      setBalances((prev) => ({ ...prev, ...partial.balances }));
      setProgress({ done: partial.done, of: partial.of });
    });
    setBalances(answer.balances);
    setCounts(answer.counts);
    setChainNotes(answer.notes);
    setReading(false);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('token_wallets')
      .select('*')
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true });
    const list = data || [];
    setRows(list);
    setHasBurro(list.length > 0 && Object.prototype.hasOwnProperty.call(list[0], 'burro'));
    setLoading(false);
    readChain(list);
  }, [readChain]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (e) => {
    e.preventDefault();
    const address = draft.address.trim();
    if (!draft.label.trim()) { setNote('a wallet needs a label'); return; }
    if (!isAddress(address)) { setNote('that does not read as a solana address'); return; }
    const payload = toPayload({
      label: draft.label.trim().toLowerCase(),
      address,
      app: draft.app.trim(),
      burro: draft.burro.trim().toLowerCase(),
      note: draft.note.trim(),
    }, hasBurro);
    const { error } = await supabase.from('token_wallets').insert(payload);
    if (error) {
      setNote(isDuplicate(error) ? 'that address is already in the book' : error.message);
      return;
    }
    setDraft(EMPTY_DRAFT);
    setAdding(false);
    setNote('');
    refresh();
  };

  const importPaste = async (e) => {
    e.preventDefault();
    const { rows: parsed, invalid } = parsePaste(paste);
    const known = new Set(rows.map((r) => r.address));
    const fresh = [];
    let skipped = 0;
    parsed.forEach((r) => {
      if (known.has(r.address)) { skipped += 1; return; }
      known.add(r.address);
      fresh.push(r);
    });
    const badLines = invalid ? `, ${invalid} ${invalid === 1 ? 'line' : 'lines'} did not read as a solana address` : '';
    if (!fresh.length) {
      setResult(`nothing to add, ${skipped} already in the book${badLines}`);
      return;
    }

    setImporting(true);
    const payloads = fresh.map((r) => toPayload(r, hasBurro));
    let added = 0;
    let halt = '';
    const { error } = await supabase.from('token_wallets').insert(payloads);
    if (!error) {
      added = payloads.length;
    } else if (isDuplicate(error)) {
      // Somebody added a row since this page loaded. One at a time so the
      // count stays exact and the duplicate is a skip, not a failure.
      for (const payload of payloads) {
        const { error: one } = await supabase.from('token_wallets').insert(payload);
        if (!one) added += 1;
        else if (isDuplicate(one)) skipped += 1;
        else { halt = one.message; break; }
      }
    } else {
      halt = error.message;
    }
    setImporting(false);
    setResult(halt
      ? `added ${added} then stopped, ${halt}`
      : `added ${added}, skipped ${skipped} already in the book${badLines}`);
    if (added) {
      setPaste('');
      refresh();
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Drop ${r.label} from the book? The wallet itself is untouched.`)) return;
    await supabase.from('token_wallets').delete().eq('id', r.id);
    refresh();
  };

  const copy = async (r) => {
    try {
      await navigator.clipboard.writeText(r.address);
      setCopied(r.id);
      setTimeout(() => setCopied(''), 1500);
    } catch { setNote('the clipboard said no'); }
  };

  // Only figures that exist go into a total, a null is not a zero.
  const totals = rows.reduce((sum, r) => {
    const b = balances[r.address];
    if (!b || !Number.isFinite(b.nb) || !Number.isFinite(b.sol)) return sum;
    return { nb: sum.nb + b.nb, sol: sum.sol + b.sol, wallets: sum.wallets + 1 };
  }, { nb: 0, sol: 0, wallets: 0 });

  return (
    <Box position="relative" minH="100vh" bg={P.mat}>
      <Box position="absolute" top={0} left={0} right={0} h="320px" bg={`radial-gradient(ellipse at top center, ${P.lime}12, transparent 70%)`} pointerEvents="none" />

      <Container maxW="1100px" mx={0} px={{ base: 5, md: 8 }} py={{ base: 6, md: 10 }} position="relative">
        <VStack spacing={{ base: 7, md: 9 }} align="stretch">

          <HStack justify="space-between" align="center" gap={3} flexWrap="wrap">
            <VStack align="start" spacing={1.5} minW={0}>
              <Text fontFamily="mono" fontSize={TYPE.micro} fontWeight="600" letterSpacing="0.22em" textTransform="uppercase" color={P.inkMuted}>
                Registry
              </Text>
              <Text fontSize={TYPE.title} fontWeight="600" letterSpacing="-0.03em" lineHeight="1.1" color={P.ink}>
                The book of our own wallets.
              </Text>
              <Text fontSize={TYPE.small} color={P.inkMuted}>
                Public addresses and labels, never keys, never published. Balances read from the chain, or from the last good read when the chain refuses, and a row says which.
              </Text>
            </VStack>

            <HStack spacing={3}>
              <HStack as="button" onClick={() => readChain(rows)} spacing={1.5} color={P.inkMuted} _hover={{ color: P.ink }} transition={`color ${FAST} ${EASE}`}>
                <Icon as={TbRefresh} boxSize={4} sx={reading ? { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } } : undefined} />
                {reading && progress.of > 0 && (
                  <Text fontFamily="mono" fontSize={TYPE.micro}>{progress.done} of {progress.of}</Text>
                )}
              </HStack>
              <HStack as="button" onClick={() => { setPasting((v) => !v); setAdding(false); }} spacing={1.5} border="1px solid" borderColor={P.hair} bg={pasting ? P.sunken : 'transparent'} color={P.ink} borderRadius="full" px={4} h="38px" fontWeight="700" fontSize="sm" transition={`all 0.18s ${EASE}`} _hover={{ bg: P.sunken }}>
                <Icon as={TbClipboardText} boxSize={4} />
                <Text>Paste</Text>
              </HStack>
              <HStack as="button" onClick={() => { setAdding((v) => !v); setPasting(false); }} {...pill} _hover={{ bg: '#D2E26B', transform: 'translateY(-1px)' }}>
                <Icon as={TbPlus} boxSize={4} />
                <Text>Wallet</Text>
              </HStack>
            </HStack>
          </HStack>

          <HStack spacing={0} flexWrap="wrap" rowGap={1}>
            <HStack spacing={1.5} align="baseline">
              <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{totals.wallets ? fmtM(totals.nb) : 'not read'}</Text>
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>neonburro in the book</Text>
            </HStack>
            <Text color={P.inkFaint} fontSize={TYPE.small} mx={2}>·</Text>
            <HStack spacing={1.5} align="baseline">
              <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{totals.wallets ? `${((totals.nb / SUPPLY) * 100).toFixed(1)}%` : 'not read'}</Text>
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>of supply</Text>
            </HStack>
            <Text color={P.inkFaint} fontSize={TYPE.small} mx={2}>·</Text>
            <HStack spacing={1.5} align="baseline">
              <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{totals.wallets ? fmtSol(totals.sol) : 'not read'}</Text>
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>sol</Text>
            </HStack>
            <Text color={P.inkFaint} fontSize={TYPE.small} mx={2}>·</Text>
            <HStack spacing={1.5} align="baseline">
              <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.inkMuted} sx={{ fontVariantNumeric: 'tabular-nums' }}>{totals.wallets} of {rows.length}</Text>
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>wallets in the total</Text>
            </HStack>
            {counts.cached > 0 && (
              <>
                <Text color={P.inkFaint} fontSize={TYPE.small} mx={2}>·</Text>
                <HStack spacing={1.5} align="baseline">
                  <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.gold} sx={{ fontVariantNumeric: 'tabular-nums' }}>{counts.cached}</Text>
                  <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>cached</Text>
                </HStack>
              </>
            )}
          </HStack>

          {(note || chainNotes.length > 0) && (
            <VStack align="start" spacing={1}>
              {note && <Text fontFamily="mono" fontSize={TYPE.small} color={P.limeDeep}>{note}</Text>}
              {chainNotes.map((line) => (
                <Text key={line} fontFamily="mono" fontSize={TYPE.small} color={P.inkFaint}>{line}</Text>
              ))}
            </VStack>
          )}

          {adding && (
            <Box as="form" onSubmit={add} bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="16px" p={4}>
              <HStack spacing={3} flexWrap="wrap" rowGap={3} align="end">
                <Box flex="0 1 160px"><Input {...inputProps} placeholder="label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></Box>
                <Box flex="1 1 320px"><Input {...inputProps} fontFamily="mono" placeholder="address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Box>
                <Box flex="0 1 130px"><Input {...inputProps} placeholder="app" value={draft.app} onChange={(e) => setDraft({ ...draft, app: e.target.value })} /></Box>
                <Box flex="0 1 130px"><Input {...inputProps} placeholder="burro" value={draft.burro} onChange={(e) => setDraft({ ...draft, burro: e.target.value })} /></Box>
                <Box flex="1 1 200px"><Input {...inputProps} placeholder="note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Box>
                <HStack as="button" type="submit" {...pill}>
                  <Text>Into the book</Text>
                </HStack>
              </HStack>
            </Box>
          )}

          {pasting && (
            <Box as="form" onSubmit={importPaste} bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="16px" p={4}>
              <VStack align="stretch" spacing={3}>
                <Text fontSize={TYPE.small} color={P.inkMuted}>
                  One wallet per line, label, address, app, burro, note, in that order. A header line is fine. Only the address is required and one already in the book is skipped.
                </Text>
                <Textarea
                  {...inputProps}
                  h="auto"
                  minH="160px"
                  py={3}
                  fontFamily="mono"
                  resize="vertical"
                  spellCheck={false}
                  placeholder={'label,address,app,burro,note'}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
                <HStack justify="space-between" flexWrap="wrap" rowGap={2}>
                  <Text fontFamily="mono" fontSize={TYPE.small} color={result.startsWith('added') ? P.limeDeep : P.inkMuted}>{result}</Text>
                  <HStack as="button" type="submit" disabled={importing || !paste.trim()} {...pill}>
                    <Text>{importing ? 'Writing' : 'Into the book'}</Text>
                  </HStack>
                </HStack>
              </VStack>
            </Box>
          )}

          {loading ? (
            <HStack py={16} justify="center"><Spinner color={P.limeDeep} /></HStack>
          ) : (
            <VStack spacing={2} align="stretch">
              {rows.map((r) => {
                const b = balances[r.address] || {};
                return (
                  <HStack key={r.id} bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="14px" px={{ base: 3.5, md: 5 }} py={3} justify="space-between" gap={4} flexWrap="wrap" rowGap={2}>
                    <VStack align="start" spacing={0.5} minW="150px" flex="1 1 180px">
                      <HStack spacing={2}>
                        <Text fontSize={TYPE.body} fontWeight="700" color={P.ink}>{r.label}</Text>
                        {r.app && <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{r.app}</Text>}
                        {r.burro && <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted}>{r.burro}</Text>}
                      </HStack>
                      {r.note && <Text fontSize={TYPE.label} color={P.inkMuted} noOfLines={1}>{r.note}</Text>}
                    </VStack>

                    <HStack spacing={1.5} flexShrink={0}>
                      <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>{shortAddr(r.address)}</Text>
                      <HStack as="button" onClick={() => copy(r)} color={copied === r.id ? P.limeDeep : P.inkFaint} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}>
                        <Icon as={copied === r.id ? TbCheck : TbCopy} boxSize={3.5} />
                      </HStack>
                      <Box as="a" href={`https://solscan.io/account/${r.address}`} target="_blank" rel="noopener noreferrer" color={P.inkFaint} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}>
                        <Icon as={TbExternalLink} boxSize={3.5} display="block" />
                      </Box>
                      {b.source === 'cache' && (
                        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold} pl={1}>cached {readTime(b.at)}</Text>
                      )}
                    </HStack>

                    <HStack spacing={5} flexShrink={0}>
                      <VStack align="end" spacing={0}>
                        <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtM(b.nb)}
                        </Text>
                        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                          {b.nb ? `${((b.nb / SUPPLY) * 100).toFixed(1)}%` : 'neonburro'}
                        </Text>
                      </VStack>
                      <VStack align="end" spacing={0} minW="52px">
                        <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtSol(b.sol)}
                        </Text>
                        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>sol</Text>
                      </VStack>
                      <HStack as="button" onClick={() => remove(r)} color={P.inkFaint} _hover={{ color: P.coral }} transition={`color ${FAST} ${EASE}`}>
                        <Icon as={TbTrash} boxSize={3.5} />
                      </HStack>
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Container>
    </Box>
  );
};

export default Registry;
