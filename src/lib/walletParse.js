// src/lib/walletParse.js
// SENTINEL: NB_WALLET_PARSE_V1
//
// The address test and the paste parser, in one place because two pages read
// wallets now and a second copy of a base58 regex is a second answer to the
// question is this an address.
//
// ── WHO READS THIS ──────────────────────────────────────────────────────────
//   src/pages/Registry/index.jsx   the private book, complete and operational
//   src/pages/Wallets/index.jsx    the public map room, editorial
//
// Both take a paste. The Registry takes the studio's private csv shape,
// label,address,app,burro,note. The wallets room takes an address on its own,
// one per holder field, and uses nothing here but isAddress, shortAddr and
// isDuplicate. Lifting the whole thing rather than half of it keeps the two
// pages from drifting on what a valid address looks like, which was already
// written twice before this file existed.
//
// ── WHY THIS REGEX ──────────────────────────────────────────────────────────
// Base58 is the bitcoin alphabet, which drops the four characters a person
// misreads out loud, 0 O I and l. A solana address is 32 bytes rendered in it,
// which lands between 32 and 44 characters depending on leading zero bytes.
// This is a shape test and not a checksum. It catches a truncated paste, a
// transaction signature that wandered in at 88 characters and a line of prose.
// It does not catch a typo that happens to stay in the alphabet, and nothing
// short of decoding and re checking would. The chain is the real check and the
// explorer link on every row is how a person performs it.
//
// NEVER put a key, a seed phrase or a keypair through anything in this file.
// A public address is public by definition and safe to print. Nothing else in
// a wallet is.
//
// No oxford commas, no em dashes.

export const isAddress = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ''));

// Postgres raises 23505 on a unique violation. PostgREST sometimes hands back
// the message without the code, so both are checked.
export const isDuplicate = (error) =>
  error?.code === '23505' || /duplicate/i.test(error?.message || '');

export const shortAddr = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

// Solscan is the explorer the rest of the yard already links to, on the public
// token page and on the ledger receipts, so every surface points at the same
// reading of the same address.
export const explorerUrl = (address) => `https://solscan.io/account/${address}`;

// One csv line into fields. Quoted fields may hold commas and doubled
// quotes. A line with tabs and no commas came from a spreadsheet.
export const splitLine = (line) => {
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

export const isHeader = (f) => /^label$/i.test(f[0] || '') || /^address$/i.test(f[1] || '');

// label,address,app,burro,note. Only the address is required. A line with
// one field that reads as an address is taken as an address alone. A note
// typed with commas and no quotes spills into extra fields, so the tail is
// joined back with the commas it lost.
export const parsePaste = (text) => {
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

// A person pasting an address out of a wallet app brings whitespace, a
// trailing newline, sometimes a leading label and sometimes the whole
// solscan url. Pull the first thing in the text that reads as an address so
// the room does not make somebody clean up after their own clipboard.
export const addressFromPaste = (text) => {
  const raw = String(text || '').trim();
  if (isAddress(raw)) return raw;
  const found = raw.split(/[^1-9A-HJ-NP-Za-km-z]+/).find((part) => isAddress(part));
  return found || raw;
};

export default isAddress;
