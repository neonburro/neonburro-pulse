// src/pages/Payouts/index.jsx
// SENTINEL: NB_PAYOUTS_ROOM_V1
//
// The payout ledger. Tyler's ask, 2026-09-26, in his words: how can we set up
// payments, I feel like we will do it through Pulse, so we are going to be
// able to see these wallets in Pulse too. When I am in Pulse, when I get paid
// from clients in there, I can pay out to the Burrow accounts. How do we leave
// a trail of payments. And we could be fully transparent that we are going to
// go 50/50 with everything, like crypto and USD, and everything is kind of
// merged together. We do not have a preference for either or.
//
// ── THE TRAIL IS A JOIN, AND THAT IS THE WHOLE POINT ────────────────────────
// A payout row on its own is the studio claiming it paid somebody. A
// transaction on a chain on its own is unreadable, an address moving a number
// to another address for no stated reason. The two together, with the row
// carrying the signature, is the only version a stranger has a reason to
// believe. Everything about how this room looks follows from that. A row
// waiting on a signature is drawn as incomplete on purpose, and the word
// verifiable is spent only on a row somebody outside this building can check
// for themselves.
//
// ── THE SHARE IS TAKEN ON THE REVENUE, NOT ON THE CURRENCY ──────────────────
// A published percentage of each settled invoice, whatever currency arrived.
// Stripe dollars and an on chain USDC settlement are the same revenue and are
// shared at the same rate, which is the merged rail in the ask. Nothing in
// this room converts dollars into NEONBURRO, and there is no code path that
// could. A burro is paid out of coin the studio already holds, or in dollars.
// Distribution, never purchase. The arithmetic behind that is in
// neonburro/docs/06-plans/2026-09-26-the-burro-is-the-product.md, and the
// short version is that the studio holds nearly all supply so buying more of
// it moves a price we are the only participant in.
//
// ── THIS ROOM MOVES NO MONEY ────────────────────────────────────────────────
// Volt drafts and a hue•man signs, which is the design and not modesty.
// Recording a split writes down what is owed. Settling a row writes down a
// transaction a person already made from a wallet they hold. There is no send
// button in here and there is not going to be one. The head of the page says
// this where a person reads it, not only in this comment.
//
// ── THE MIGRATION GATE ──────────────────────────────────────────────────────
// The two tables come from
// supabase/migrations/20260926043122_payout_ledger.sql, which is prepared and
// NOT applied. Until a hand runs it the room probes for both tables, says
// plainly on its face that the migration has not landed and refuses every
// write rather than half working. Same pattern as the wallets room and the
// desk doors. Three other migrations in that folder are also waiting and this
// one depends on none of them.
//
// ── WHERE EVERY NUMBER CAME FROM ────────────────────────────────────────────
// No balance is invented here and no figure is typed that could be read. The
// revenue figure is invoices.total_paid and the split panel prints that column
// name beside it. The owed and sent totals are sums of the stamped usd_value
// on the rows. A destination address is picked out of public.token_wallets
// rather than retyped. The one figure a person does type is how much of a
// currency actually moved, because only the hand that sent it knows that, and
// the rate is derived from it rather than typed beside it.
//
// This room reads no chain balance today and so it calls nothing in
// src/lib/registryBalances.js. If a figure off the chain ever belongs here it
// goes through that file, chunked, with the time it was read printed next to
// it, the way /registry/ does it. Do not add a second chain read path.
//
// ── LAYOUT ──────────────────────────────────────────────────────────────────
// Composed from src/components/common/Page.jsx on the law in
// src/theme/layout.js. This file types no width, no gutter, no inset and no
// font size. Read those two files before changing anything visual here.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { VStack, Text, Button, Icon } from '@chakra-ui/react';
import { TbRefresh } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import colors from '../../theme/colors';
import { TYPE } from '../../theme/layout';
import { Page, PageHead, Section, Plate, Stats, Loading, Kicker } from '../../components/common/Page';
import { HOLDERS, HOLDER_BY_KEY, UNCLAIMED } from '../../data/walletHolders';
import { isDuplicate } from '../../lib/walletParse';
import {
  splitPreview, rulesInForce, holderTotals, usd, roundCents, isChainCurrency,
} from '../../lib/payoutMath';
import RulesPanel from './components/RulesPanel';
import SplitPanel from './components/SplitPanel';
import HolderLedger from './components/HolderLedger';

const P = colors.paper;

const MIGRATION = 'supabase/migrations/20260926043122_payout_ledger.sql';

// The columns each table is asked for by name. Probing this way is the only
// check that also works on an empty table, which reading a row and looking at
// its keys does not. Same reasoning as the wallets room.
const PAYOUT_COLUMNS = [
  'id', 'invoice_id', 'holder', 'rule_id', 'share', 'currency', 'amount',
  'usd_value', 'usd_rate', 'status', 'destination', 'tx_signature', 'reference',
  'settled_at', 'note', 'recorded_by', 'settled_by', 'created_at',
].join(', ');

const RULE_COLUMNS = 'id, holder, share, effective_from, note, created_by, created_at';

// token_wallets has carried these since 2026082605. The six public map columns
// are in another prepared migration and this room deliberately does not ask
// for them, so it works whichever of the two lands first.
const WALLET_COLUMNS = 'id, label, address, burro';

const today = () => new Date().toISOString().slice(0, 10);

const Payouts = () => {
  const [rules, setRules] = useState([]);
  const [rows, setRows] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [splitNote, setSplitNote] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [settlingId, setSettlingId] = useState('');

  const refresh = useCallback(async () => {
    const [ruleRes, payoutRes, invoiceRes, walletRes] = await Promise.all([
      supabase.from('payout_rules').select(RULE_COLUMNS).order('effective_from', { ascending: false }),
      supabase.from('payouts').select(PAYOUT_COLUMNS).order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, total, total_paid, status, paid_at, created_at, clients(id, name, company)')
        .is('cancelled_at', null)
        .gt('total_paid', 0)
        .order('paid_at', { ascending: false, nullsFirst: false }),
      supabase.from('token_wallets').select(WALLET_COLUMNS).order('sort', { ascending: true }),
    ]);

    // Either table missing is the same state, the migration has not landed.
    const landed = !ruleRes.error && !payoutRes.error;
    setReady(landed);
    setRules(ruleRes.data || []);
    setRows(payoutRes.data || []);
    setInvoices(invoiceRes.data || []);
    setWallets(walletRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const invoicesById = useMemo(
    () => Object.fromEntries(invoices.map((inv) => [inv.id, inv])),
    [invoices],
  );

  // An invoice already carrying a payout row is out of the split list. The
  // unique index payouts_invoice_holder_uniq is the real guard, this is the
  // soft copy so a person is not offered work the database will refuse.
  const splitIds = useMemo(() => new Set(rows.map((r) => r.invoice_id)), [rows]);

  const splittable = useMemo(
    () => invoices.filter((inv) => !splitIds.has(inv.id)),
    [invoices, splitIds],
  );

  const selectedInvoice = selectedInvoiceId ? invoicesById[selectedInvoiceId] : null;

  const preview = useMemo(
    () => (selectedInvoice ? splitPreview(selectedInvoice, rules) : null),
    [selectedInvoice, rules],
  );

  const inForceIds = useMemo(
    () => new Set(rulesInForce(rules, today()).map((r) => r.id)),
    [rules],
  );

  // Every holder with a row or a rule in force, in the roster order, then one
  // block for rows whose holder key is not in the roster. Silently dropping a
  // row is how a ledger gets a hole in it.
  const blocks = useMemo(() => {
    const withRows = new Set(rows.map((r) => r.holder));
    const withRules = new Set(rules.map((r) => r.holder));
    const listed = HOLDERS.filter((h) => withRows.has(h.key) || withRules.has(h.key));
    const known = new Set(HOLDERS.map((h) => h.key));
    const loose = rows.filter((r) => !known.has(r.holder));
    return {
      listed: listed.map((holder) => ({
        holder,
        rows: rows.filter((r) => r.holder === holder.key),
      })),
      loose,
    };
  }, [rows, rules]);

  const walletsFor = useCallback(
    (holderKey) => wallets.filter((w) => String(w.burro || '').trim().toLowerCase() === holderKey),
    [wallets],
  );

  const totals = useMemo(() => holderTotals(rows), [rows]);

  const waiting = rows.filter((r) => r.status === 'owed').length;
  const unproved = rows.filter((r) => r.status === 'sent' && !r.tx_signature && !r.reference).length;
  const attested = rows.filter((r) => r.status === 'sent' && !r.tx_signature && r.reference).length;

  // ── writes ────────────────────────────────────────────────────────────────

  const whoami = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  // The second trail. The payout row already carries recorded_by, settled_by
  // and its two timestamps, which is who and when on the row itself. This
  // writes the same event into the house activity_log so a payout appears in
  // the same stream as every other admin action rather than only inside this
  // room.
  //
  // client_id is passed null on purpose and the metadata carries no invoice
  // number, no client and no invoice total. A payout is the studio's business
  // with a holder and it is not the client's business, so nothing here should
  // be capable of surfacing in a client facing stream even by accident. Keep
  // it that way if you add a field.
  const trail = (action, row, metadata = {}) => logActivity({
    action,
    entityType: 'payout',
    entityId: row?.id || null,
    clientId: null,
    metadata,
  });

  const addRule = async (rule) => {
    if (!ready) return 'the migration has not landed, nothing can be written yet';
    if (!HOLDER_BY_KEY[rule.holder]) return 'that holder is not in src/data/walletHolders.js';
    setSaving(true);
    const created_by = await whoami();
    const { data, error } = await supabase
      .from('payout_rules')
      .insert({ ...rule, created_by })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      if (isDuplicate(error)) return 'a rule for that holder already starts on that date, pick another day';
      return error.message;
    }
    await trail('payout_rule_published', data, {
      holder: rule.holder,
      share: rule.share,
      effective_from: rule.effective_from,
    });
    await refresh();
    return '';
  };

  const dropRule = async (rule) => {
    if (!ready) return;
    const holder = HOLDER_BY_KEY[rule.holder]?.name || rule.holder;
    const used = rows.some((r) => r.rule_id === rule.id);
    const ask = used
      ? `That rule has already produced payout rows. Dropping it leaves those rows carrying their own copy of the percentage and nothing to point back at. Drop the rule for ${holder}?`
      : `Drop the rule for ${holder}? Rules are meant to be superseded by a new row rather than removed, so only do this to a row typed wrong.`;
    if (!window.confirm(ask)) return;
    const { error } = await supabase.from('payout_rules').delete().eq('id', rule.id);
    if (error) { setNote(error.message); return; }
    setNote('');
    refresh();
  };

  const writeSplit = async () => {
    if (!ready) { setSplitNote('the migration has not landed, nothing can be written yet'); return; }
    if (!selectedInvoice || !preview) return;
    if (preview.over) { setSplitNote('the percentages sum past the invoice, nothing was written'); return; }
    if (preview.rows.length === 0) { setSplitNote('no percentage was in force, nothing was written'); return; }

    setSaving(true);
    const recorded_by = await whoami();
    const payload = preview.rows.map((row) => ({
      invoice_id: selectedInvoice.id,
      holder: row.holder,
      rule_id: row.rule_id,
      share: row.share,
      currency: 'USD',
      usd_value: row.usd_value,
      status: 'owed',
      note: row.note,
      recorded_by,
    }));
    const { error } = await supabase.from('payouts').insert(payload);
    setSaving(false);

    if (error) {
      if (isDuplicate(error)) {
        setSplitNote('that invoice has already been split, the database refused a second set of rows');
      } else {
        setSplitNote(error.message);
      }
      return;
    }
    await trail('payout_split_recorded', null, {
      holders: preview.rows.length,
      set_aside_usd: preview.setAside,
      total_share: preview.totalShare,
    });
    setSplitNote('');
    setSelectedInvoiceId('');
    refresh();
  };

  // A transaction somebody already made, written down. The rate is derived
  // from the two numbers on the row so the three cannot disagree, see the note
  // in src/lib/payoutMath.js.
  const settle = async (row, entry) => {
    if (!ready) return 'the migration has not landed, nothing can be written yet';
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'that amount does not read as a number above zero';

    setSaving(true);
    const settled_by = await whoami();
    const usd_rate = amount > 0 ? Math.round((Number(row.usd_value) / amount) * 1e8) / 1e8 : null;
    const { error } = await supabase
      .from('payouts')
      .update({
        status: 'sent',
        currency: entry.currency,
        amount: isChainCurrency(entry.currency) ? amount : roundCents(amount),
        usd_rate,
        destination: entry.destination || null,
        tx_signature: entry.tx_signature || null,
        reference: entry.reference || null,
        settled_at: new Date().toISOString(),
        settled_by,
        note: entry.note || row.note || '',
      })
      .eq('id', row.id);
    setSaving(false);

    if (error) {
      if (isDuplicate(error)) return 'that signature or reference is already on another payout row, one transaction is one payment';
      return error.message;
    }
    await trail('payout_settled', row, {
      holder: row.holder,
      usd_value: Number(row.usd_value),
      currency: entry.currency,
      proved: entry.tx_signature ? 'on chain' : 'off chain reference',
    });
    setSettlingId('');
    await refresh();
    return '';
  };

  const voidRow = async (row) => {
    if (!ready) return;
    const holder = HOLDER_BY_KEY[row.holder]?.name || row.holder;
    const ask = `Void ${usd(row.usd_value)} owed to ${holder}? The row stays in the ledger and reads void, because a ledger that loses rows cannot be reconciled. It leaves both totals.`;
    if (!window.confirm(ask)) return;
    const settled_by = await whoami();
    const { error } = await supabase
      .from('payouts')
      .update({ status: 'void', settled_by })
      .eq('id', row.id);
    if (error) { setNote(error.message); return; }
    await trail('payout_voided', row, {
      holder: row.holder,
      usd_value: Number(row.usd_value),
    });
    setNote('');
    refresh();
  };

  return (
    <Page>
      <PageHead
        kicker="Payouts"
        title="What is owed, and what can be checked."
        lede="A published percentage of each settled invoice, set aside for a holder whatever currency arrived. A row on its own is a claim. A row carrying the transaction that settled it is a record, and that join is the only version somebody outside this building has a reason to believe."
        actions={(
          <Button size="sm" variant="ghost" leftIcon={<Icon as={TbRefresh} boxSize={4} />} onClick={refresh}>
            Read
          </Button>
        )}
      >
        <Stats items={[
          { key: 'owed', n: usd(totals.owed), label: 'owed', tone: totals.owed > 0 ? P.gold : P.inkMuted },
          { key: 'sent', n: usd(totals.sent), label: 'sent', tone: totals.sent > 0 ? P.limeDeep : P.inkMuted },
          { key: 'waiting', n: waiting, label: 'waiting on a transaction', tone: waiting ? P.gold : P.inkMuted },
          { key: 'attested', n: attested, label: 'attested not verifiable', tone: P.inkMuted },
          unproved ? { key: 'unproved', n: unproved, label: 'sent with no proof', tone: P.coral } : null,
        ]}
        />
      </PageHead>

      <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>
        Nothing in this room moves money. Recording a split writes down what is owed. Settling a
        row writes down a transaction a person already signed and sent from a wallet they hold.
        There is no send button here and there is not going to be one.
      </Text>

      {!ready && (
        <Plate sunken>
          <VStack align="start" spacing={2}>
            <Kicker color={P.coral}>The migration has not landed</Kicker>
            <Text fontSize={TYPE.small} color={P.inkSec}>
              payout_rules and payouts do not exist yet, so the room writes nothing. It is
              prepared and waiting at
              {' '}
              <Text as="span" fontFamily="mono">{MIGRATION}</Text>
              {' '}
              in this repo. Tyler or Warbleur runs it through the dashboard SQL editor and the
              ledger row at the bottom of it records the run. Reading still works, so anything
              already written would be visible here either way.
            </Text>
          </VStack>
        </Plate>
      )}

      {note && (
        <Text fontFamily="mono" fontSize={TYPE.small} color={P.gold}>{note}</Text>
      )}

      {loading ? (
        <Loading label="opening the ledger" />
      ) : (
        <>
          <Section kicker="The published percentages" count={rules.length}>
            <RulesPanel
              rules={rules}
              holders={HOLDERS}
              inForceIds={inForceIds}
              canWrite={ready}
              saving={saving}
              onAdd={addRule}
              onDrop={dropRule}
            />
          </Section>

          <Section kicker="Split a settled invoice" count={splittable.length}>
            <SplitPanel
              invoices={splittable}
              selectedId={selectedInvoiceId}
              onSelect={(id) => { setSelectedInvoiceId(id); setSplitNote(''); }}
              invoice={selectedInvoice}
              preview={preview}
              canWrite={ready}
              saving={saving}
              onWrite={writeSplit}
              note={splitNote}
            />
          </Section>

          <Section kicker="Per holder" count={blocks.listed.length}>
            {blocks.listed.length === 0 && blocks.loose.length === 0 ? (
              <Text fontSize={TYPE.small} color={P.inkMuted}>
                Nobody is owed anything and nobody has been paid. Publish a percentage, then split
                a settled invoice.
              </Text>
            ) : (
              <VStack align="stretch" spacing={9}>
                {blocks.listed.map(({ holder, rows: holderRows }) => (
                  <HolderLedger
                    key={holder.key}
                    holder={holder}
                    rows={holderRows}
                    invoicesById={invoicesById}
                    wallets={walletsFor(holder.key)}
                    canWrite={ready}
                    saving={saving}
                    settlingId={settlingId}
                    onOpenSettle={(row) => { setSettlingId(row.id); setNote(''); }}
                    onCancelSettle={() => setSettlingId('')}
                    onSettle={settle}
                    onVoid={voidRow}
                  />
                ))}

                {blocks.loose.length > 0 && (
                  <HolderLedger
                    holder={UNCLAIMED}
                    rows={blocks.loose}
                    invoicesById={invoicesById}
                    wallets={[]}
                    canWrite={ready}
                    saving={saving}
                    settlingId={settlingId}
                    onOpenSettle={(row) => { setSettlingId(row.id); setNote(''); }}
                    onCancelSettle={() => setSettlingId('')}
                    onSettle={settle}
                    onVoid={voidRow}
                  />
                )}
              </VStack>
            )}
          </Section>
        </>
      )}
    </Page>
  );
};

export default Payouts;
