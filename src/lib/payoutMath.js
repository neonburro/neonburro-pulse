// src/lib/payoutMath.js
// SENTINEL: NB_PAYOUT_MATH_V1
//
// The payout arithmetic, the signature test and the currency list, in one
// place, because the split preview and the write that follows it must agree
// to the cent or the preview is decoration. The room shows a person the
// arithmetic before it writes anything and the only way that promise is worth
// making is if the same function produces both numbers.
//
// ── WHAT THE SHARE IS TAKEN ON ──────────────────────────────────────────────
// invoices.total_paid, the dollars that actually arrived, not invoices.total,
// which is what was asked for. A share of a promise is not a share of
// revenue, and an invoice sitting at partial has paid somebody something
// already. The room prints which column it read next to the figure.
//
// The currency the money arrived in does not enter the arithmetic at all.
// Stripe dollars and an on chain USDC settlement are the same revenue and are
// shared at the same percentage, which is the merged rail Tyler asked for on
// 2026-09-26. There is deliberately no function here that turns dollars into
// NEONBURRO. The studio distributes coin it already holds or it pays dollars,
// it never buys its own coin, and the reason is measured out in
// neonburro/docs/06-plans/2026-09-26-the-burro-is-the-product.md.
//
// ── EACH ROW IS DERIVED FROM THE INVOICE, NOT FROM A POOL ───────────────────
// A holder's dollars are the invoice's paid total times that holder's share,
// rounded to the cent, on its own. There is no pool that gets divided and so
// there is no remainder to hand to whoever is last in the list, which is the
// classic way a split ledger ends up a cent off and nobody can say whose cent
// it was. The cost of this choice is that the sum of the rows can differ from
// the invoice times the summed share by a cent or two of rounding, and that
// is the right place for the error to live, because every row can still be
// recomputed from the row alone.
//
// ── THE RULE IN FORCE ───────────────────────────────────────────────────────
// For a holder and a day, the latest payout_rules row for that holder whose
// effective_from is on or before that day. Rules are never edited, a change
// is a new row, so this is a lookup and never a merge. An invoice settled
// before any rule existed has no rule in force and the room says so rather
// than guessing zero, because zero and unknown are different states and a
// ledger that renders them the same is lying quietly.
//
// No oxford commas, no em dashes.

// ── currencies ──────────────────────────────────────────────────────────────
// No preference between them. USD is the default only because it is what a
// Stripe invoice already settled in and a default should be the common case,
// not a statement about which rail is better.
export const CURRENCIES = ['USD', 'USDC', 'SOL', 'NEONBURRO'];

export const isChainCurrency = (currency) => currency !== 'USD';

// ── the signature test ──────────────────────────────────────────────────────
// A Solana transaction signature is 64 bytes rendered in base58, which lands
// at 87 or 88 characters, and at 86 in the rare case of leading zero bytes.
// The alphabet is the bitcoin one, which drops 0 O I and l because a person
// reads those wrong out loud. This is a shape test and not a verification. It
// catches a truncated paste, a wallet address that wandered in at 44
// characters and a line of prose. It does not catch a signature that is well
// formed and belongs to some other transaction, and nothing short of asking a
// node would. The solscan link on every settled row is how a person performs
// the real check, and the room puts that link where a stranger would look
// first.
//
// src/lib/walletParse.js holds isAddress for the 32 to 44 character address
// case. The two live apart because they answer different questions and one
// loose regex that passed both would let a signature be saved as a
// destination.
export const isSignature = (s) => /^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(String(s || ''));

export const shortSignature = (s) => (s ? `${String(s).slice(0, 6)}…${String(s).slice(-6)}` : '');

export const signatureUrl = (s) => `https://solscan.io/tx/${s}`;

// A person pasting out of a wallet app or an explorer brings whitespace, a
// trailing newline or the whole solscan url. Pull the first thing in the text
// that reads as a signature so the room does not make somebody clean up after
// their own clipboard. Same trick as addressFromPaste in walletParse.
export const signatureFromPaste = (text) => {
  const raw = String(text || '').trim();
  if (isSignature(raw)) return raw;
  const found = raw.split(/[^1-9A-HJ-NP-Za-km-z]+/).find((part) => isSignature(part));
  return found || raw;
};

// ── money ───────────────────────────────────────────────────────────────────
// Cents everywhere. A payout ledger that rounds to whole dollars for display
// and stores cents will eventually be read off the screen and typed into
// something else, and the two will not match.
export const usd = (value) => {
  const n = Number(value || 0);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const roundCents = (value) => Math.round(Number(value || 0) * 100) / 100;

// A share is stored as a fraction and read by people as a percentage. Up to
// two decimal places of percent, so 0.025 prints as 2.5% and 0.0033 as 0.33%.
export const percent = (share) => {
  const n = Number(share || 0) * 100;
  const fixed = n.toFixed(2).replace(/\.?0+$/, '');
  return `${fixed}%`;
};

export const shareFromPercentInput = (text) => {
  const n = Number(String(text || '').replace('%', '').trim());
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 100) * 10000) / 10000;
};

// A coin amount is not money and is not rounded to cents. Up to nine places,
// trailing zeros trimmed, because a SOL figure with six meaningful decimals
// printed as two is a different number.
export const coin = (amount) => {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 9 });
};

// ── what the invoice actually paid ──────────────────────────────────────────
// Returns the figure and the column it came from, together, so a surface can
// print where a number came from beside the number. Nothing in this room
// shows a figure without being able to say that.
export const invoicePaid = (invoice) => ({
  value: roundCents(invoice?.total_paid),
  from: 'invoices.total_paid',
});

// The day a share is taken as of. paid_at when the invoice has one, otherwise
// the day it was created, because a rule is chosen by when the money landed
// and not by when somebody got round to splitting it.
export const settledOn = (invoice) => {
  const stamp = invoice?.paid_at || invoice?.created_at;
  if (!stamp) return null;
  return String(stamp).slice(0, 10);
};

// ── the rule in force ───────────────────────────────────────────────────────
export const ruleInForce = (rules, holder, onDate) => {
  if (!onDate) return null;
  const mine = (rules || [])
    .filter((r) => r.holder === holder && String(r.effective_from).slice(0, 10) <= onDate)
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
  return mine[0] || null;
};

// Every holder who has a rule in force on a day, with that rule. The order is
// the order the holders first appear in the rules list, which keeps a preview
// stable between renders rather than reordering as percentages change.
export const rulesInForce = (rules, onDate) => {
  const holders = [...new Set((rules || []).map((r) => r.holder))];
  return holders
    .map((holder) => ruleInForce(rules, holder, onDate))
    .filter(Boolean);
};

// ── the split ───────────────────────────────────────────────────────────────
// The preview and the write both read this. It returns the rows and the
// arithmetic around them, so a panel can show the total set aside and what
// the studio keeps without doing any sums of its own.
export const splitPreview = (invoice, rules) => {
  const paid = invoicePaid(invoice);
  const on = settledOn(invoice);
  const inForce = rulesInForce(rules, on);

  const rows = inForce.map((rule) => ({
    holder: rule.holder,
    rule_id: rule.id,
    share: Number(rule.share),
    usd_value: roundCents(paid.value * Number(rule.share)),
    note: rule.note || '',
  }));

  const setAside = roundCents(rows.reduce((sum, r) => sum + r.usd_value, 0));
  const totalShare = rows.reduce((sum, r) => sum + r.share, 0);

  return {
    rows,
    paid: paid.value,
    paidFrom: paid.from,
    on,
    setAside,
    kept: roundCents(paid.value - setAside),
    totalShare,
    // Over a hundred percent is arithmetic the studio cannot honour and the
    // room refuses to write it. It is reported rather than corrected, because
    // silently scaling everybody down would be the room deciding a thing the
    // published percentages are supposed to have decided.
    over: totalShare > 1,
  };
};

// ── the running total per holder ────────────────────────────────────────────
// owed, sent and the sum of the two, in dollars, off the stamped usd_value on
// every row. Void rows are counted separately and are in neither total,
// because a voided row is a withdrawn claim and adding it to either number
// would make the ledger read as though something happened.
export const holderTotals = (rows) => {
  const owed = (rows || []).filter((r) => r.status === 'owed');
  const sent = (rows || []).filter((r) => r.status === 'sent');
  const voided = (rows || []).filter((r) => r.status === 'void');
  const sum = (list) => roundCents(list.reduce((n, r) => n + Number(r.usd_value || 0), 0));
  return {
    owedCount: owed.length,
    sentCount: sent.length,
    voidCount: voided.length,
    owed: sum(owed),
    sent: sum(sent),
    total: roundCents(sum(owed) + sum(sent)),
  };
};

// The one sentence a surface prints about whether a row is believable. The
// wording is deliberate. Sent and proved on chain is the only state a
// stranger can check for themselves, so it is the only one that gets the word
// verifiable anywhere in this tool.
export const proofState = (row) => {
  if (!row) return { key: 'none', word: 'nothing recorded', verifiable: false };
  if (row.status === 'void') return { key: 'void', word: 'void, no money moved', verifiable: false };
  if (row.status === 'owed') return { key: 'owed', word: 'owed, no transaction yet', verifiable: false };
  if (row.tx_signature) return { key: 'chain', word: 'settled on chain', verifiable: true };
  if (row.reference) return { key: 'offchain', word: 'settled off chain, attested not verifiable', verifiable: false };
  // The database constraint payouts_sent_is_proved makes this unreachable
  // through any write this app performs. It is here because a row that got
  // into this state some other way is exactly the row a person needs to see
  // named, and silently rendering it as sent would hide it.
  return { key: 'unproved', word: 'marked sent with no proof, look at this row', verifiable: false };
};

export default splitPreview;
