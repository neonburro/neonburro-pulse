// src/lib/walletExport.js
// SENTINEL: NB_WALLET_EXPORT_V1
//
// The point of the wallets room. Turns the published rows of
// public.token_wallets into the exact body of the WALLETS array in
// neonburro/src/data/wallets.js, and says in words how that body differs from
// what the repo holds today.
//
// ── WHY A FILE AND NOT A FETCH ──────────────────────────────────────────────
// The public token page must never read the address list from a database at
// render. wallets.js says why in its own header and it is worth repeating
// because it is the whole reason this room exists in this shape. The page
// carries a published sentence saying an address not on it is not ours. That
// is a completeness claim. A node or a table that refuses for one second
// blanks a band that is making a completeness claim, which turns a
// transparency promise into a hole. A committed file cannot refuse.
//
// So Pulse is where a person types and Pulse produces the text. A hue man
// pastes it into the studio repo, reads it, and commits it. Nothing here
// writes to the studio repo and nothing here publishes anything.
//
// ── THE SHAPE IS THE REPO'S, NOT OURS ───────────────────────────────────────
// Field order below matches wallets.js exactly as it stands on 2026-09-26:
//
//   address, burro, label, burn when true, purpose, since, retired when set
//
// burn sits after label in that file and not at the end, so it sits after
// label here. retired is new with this room and had no place in the file yet,
// so it goes last, after since. If the file's order ever moves, move it here
// in the same commit or the export starts producing diffs that are only
// whitespace and nobody will read them any more.
//
// purpose is always broken onto its own line with a six space indent because
// every entry in the file does that today, including the short ones, and a
// generated file that is formatted differently from the hand written one it
// replaces reads as a bigger change than it is.
//
// ── WHAT NEVER COMES OUT OF HERE ────────────────────────────────────────────
// No balance. wallets.js says a number typed into a repo is out of date the
// moment somebody transacts, and a stale balance on a transparency page reads
// as a claim. No key, no seed, no keypair, there is nowhere for one to come
// from and nowhere for one to go. No row with published false.
//
// No oxford commas, no em dashes.

// Single quoted strings the way the file writes them. Backslash first or the
// escape gets escaped. A newline inside a purpose would break the literal, so
// it collapses to a space, which is also the right answer editorially because
// a purpose is one sentence.
const jsString = (value) => {
  const flat = String(value == null ? '' : value).replace(/\s*\n\s*/g, ' ').trim();
  return `'${flat.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
};

// A table row into the shape the file wants. Everything past this point works
// on this shape and not on a supabase row, so the formatter and the diff
// cannot disagree about what a row is.
export const toMapRow = (row, holder) => ({
  address: String(row.address || '').trim(),
  // A treasury holder is fronted by nobody and the public file says so with
  // null. A burro or an agent writes its slug, which the studio's everyone.js
  // resolves into a name and a face on the band.
  burro: holder && holder.kind !== 'treasury' && row.burro ? String(row.burro).trim() : null,
  label: String(row.label || '').trim(),
  purpose: String(row.purpose || '').trim(),
  since: row.since ? String(row.since).slice(0, 10) : null,
  burn: row.burn === true,
  retired: row.retired ? String(row.retired).slice(0, 10) : null,
});

const entry = (row) => {
  const lines = [];
  lines.push('  {');
  lines.push(`    address: ${jsString(row.address)},`);
  lines.push(`    burro: ${row.burro ? jsString(row.burro) : 'null'},`);
  lines.push(`    label: ${jsString(row.label)},`);
  if (row.burn) lines.push('    burn: true,');
  lines.push('    purpose:');
  lines.push(`      ${jsString(row.purpose)},`);
  lines.push(`    since: ${row.since ? jsString(row.since) : 'null'},`);
  if (row.retired) lines.push(`    retired: ${jsString(row.retired)},`);
  lines.push('  },');
  return lines.join('\n');
};

// The body between the brackets. The caller pastes this inside
// export const WALLETS = [ ... ]; and the brackets are included so a person
// pasting has something obvious to line up with.
export const exportBody = (rows) =>
  ['export const WALLETS = [', ...rows.map(entry), '];'].join('\n');

// ── the diff, in words ──────────────────────────────────────────────────────
// Nobody should publish a map with a hole in it by accident, which is exactly
// what happened on 2026-08-22 when the file listed two wallets and the yard
// held four. So the room never shows the text without also saying what it
// does to the file.
//
// missing is the dangerous one and it is listed first. A row the repo holds
// that the table does not means pasting this text DELETES a published wallet
// from the map, and the file's header says taking an entry out means taking
// the completeness sentence out with it.

const FIELDS = ['burro', 'label', 'purpose', 'since', 'burn', 'retired'];

const same = (a, b) => {
  if (a === b) return true;
  const av = a === undefined || a === '' ? null : a;
  const bv = b === undefined || b === '' ? null : b;
  return av === bv;
};

export const diffAgainstRepo = (rows, repo) => {
  const byAddress = new Map(rows.map((r) => [r.address, r]));
  const repoByAddress = new Map((repo || []).map((r) => [r.address, r]));

  const added = rows.filter((r) => !repoByAddress.has(r.address));
  const missing = (repo || []).filter((r) => !byAddress.has(r.address));
  const changed = [];

  rows.forEach((row) => {
    const was = repoByAddress.get(row.address);
    if (!was) return;
    const fields = FIELDS.filter((f) => !same(row[f], was[f] === undefined ? null : was[f]));
    if (fields.length) changed.push({ row, was, fields });
  });

  return { added, changed, missing };
};

const nameOf = (row) => row.label || row.address.slice(0, 8);

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One sentence per kind of change, plus a line per row so a person reads what
// moved rather than a number. Returns an array of { tone, text } so the page
// can colour the dangerous line and does not have to parse a string.
export const diffLines = ({ added, changed, missing }) => {
  const out = [];

  if (missing.length) {
    const one = missing.length === 1;
    out.push({
      tone: 'alarm',
      text: `${count(missing.length, 'row', 'rows')} the repo publishes ${one ? 'is' : 'are'} not in this export, pasting it takes ${one ? 'it' : 'them'} off the map.`,
    });
    missing.forEach((row) => {
      out.push({ tone: 'alarm', text: `  gone, ${nameOf(row)}, ${row.address}` });
    });
  }

  if (added.length) {
    out.push({ tone: 'note', text: `${count(added.length, 'row', 'rows')} the repo does not hold yet.` });
    added.forEach((row) => {
      out.push({ tone: 'note', text: `  new, ${nameOf(row)}, ${row.address}` });
    });
  }

  if (changed.length) {
    out.push({ tone: 'note', text: `${count(changed.length, 'row', 'rows')} the repo holds with different words.` });
    changed.forEach(({ row, fields }) => {
      out.push({ tone: 'note', text: `  changed, ${nameOf(row)}, ${fields.join(' and ')}` });
    });
  }

  if (!out.length) {
    out.push({ tone: 'quiet', text: 'Nothing to do, this is what the repo already holds.' });
  }

  return out;
};

// What the room says a published row is still missing. These become public
// copy, so an empty one is not a formatting problem, it is a blank on a page
// that promises to explain itself.
export const shortfalls = (row) => {
  const gaps = [];
  if (!String(row.label || '').trim()) gaps.push('a label');
  if (!String(row.purpose || '').trim()) gaps.push('a purpose');
  return gaps;
};

export default exportBody;
