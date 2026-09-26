// src/pages/Payouts/components/HolderLedger.jsx
// SENTINEL: NB_PAYOUTS_LEDGER_V1
//
// One holder, what is owed, what was sent, the running total and every row
// behind those three numbers.
//
// ── A ROW WITHOUT A TRANSACTION IS VISIBLY INCOMPLETE ───────────────────────
// Three ways at once, none of them a coloured dot on its own:
//   the plate is sunken and carries a dashed left edge
//   the figure sits in muted ink rather than full ink
//   a line of words says owed, no transaction yet
// The reason for three is that this is the distinction the whole room exists
// to make. A payout row on its own is the studio saying it paid somebody. The
// row plus the signature is the only version a stranger has a reason to
// believe. If those two states ever look similar at a glance the room has
// failed at its only job.
//
// ── THE TWO PROOFS ARE NOT EQUAL AND THE ROW SAYS WHICH ─────────────────────
// A chain row carries a signature and a solscan link, so anybody can check it
// without asking us. A dollar row carries a reference, a Stripe transfer id or
// a bank confirmation, which only somebody with account access can check. The
// row prints settled on chain for the first and settled off chain, attested
// not verifiable for the second. The wording comes from proofState in
// src/lib/payoutMath.js so every surface says it the same way. Do not shorten
// either to paid.
//
// ── PASTING A SIGNATURE IS RECORDING, NOT SENDING ───────────────────────────
// Nothing in this room moves money. A hue•man signs and sends the transaction
// from a wallet and then pastes what came back, and this form writes down what
// already happened. That is the house rule and the panel says it out loud
// rather than only here. The signature is shape tested before it is accepted,
// 64 bytes of base58 at 86 to 88 characters, which catches a truncated paste
// and an address pasted into the wrong field. It is not a verification and the
// room does not claim it is, the solscan link is how a person performs that.
//
// ── THE DESTINATION IS PICKED, NOT TYPED ────────────────────────────────────
// A chain destination comes from the addresses already in public.token_wallets
// for that holder, as a select. An address retyped by hand is an address with
// a chance of a typo in it, and the book already holds the right one. If the
// holder has no wallet in the book the form says so and refuses rather than
// opening a text field, because the fix is to write the wallet down in the
// registry where it belongs.
//
// No width, no gutter, no inset and no font size in this file, they come from
// the page kit. No oxford commas, no em dashes.

import { useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Icon, Input, Select,
} from '@chakra-ui/react';
import { TbExternalLink, TbSignature, TbCircleDashed, TbBan } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Plate, Kicker, Field } from '../../../components/common/Page';
import HolderFace from '../../../components/common/HolderFace';
import { shortAddr } from '../../../lib/walletParse';
import {
  CURRENCIES, isChainCurrency, usd, coin, percent, holderTotals,
  proofState, shortSignature, signatureUrl, signatureFromPaste, isSignature,
} from '../../../lib/payoutMath';

const P = colors.paper;

const EMPTY_SETTLE = {
  currency: 'USD', amountText: '', destination: '', proofText: '', note: '',
};

const SettleForm = ({ row, wallets, saving, onCancel, onSettle }) => {
  // A split writes every row as USD, so the form opens on dollars with the
  // obligation already in the amount field and no destination, and switching
  // the currency to a chain fills the destination from the book and empties
  // the amount. Prefilling an address into a dollar row's free text field was
  // the first version and it looked like the room had decided where the money
  // was going.
  const [draft, setDraft] = useState(() => {
    const currency = row.currency || 'USD';
    const chain = isChainCurrency(currency);
    return {
      ...EMPTY_SETTLE,
      currency,
      amountText: chain ? '' : String(row.usd_value || ''),
      destination: chain ? (wallets[0]?.address || '') : '',
    };
  });
  const [note, setNote] = useState('');

  const chain = isChainCurrency(draft.currency);
  const noWallet = chain && wallets.length === 0;

  const set = (patch) => setDraft((d) => {
    const next = { ...d, ...patch };
    // Switching to dollars refills the amount with the obligation, because on
    // a USD row the amount and the usd_value are the same number and making
    // somebody retype it is how they get typed differently.
    if (patch.currency === 'USD') {
      next.amountText = String(row.usd_value || '');
      next.destination = '';
    }
    if (patch.currency && patch.currency !== 'USD' && d.currency === 'USD') {
      next.amountText = '';
      next.destination = wallets[0]?.address || '';
    }
    return next;
  });

  const submit = async () => {
    const amount = Number(String(draft.amountText).trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setNote('how much actually moved, as a number above zero');
      return;
    }
    const proof = chain ? signatureFromPaste(draft.proofText) : String(draft.proofText).trim();
    if (chain) {
      if (!isSignature(proof)) {
        setNote('that does not read as a transaction signature, base58 and 86 to 88 characters');
        return;
      }
      if (!draft.destination) {
        setNote('no wallet is written down for this holder, put it in the registry first');
        return;
      }
    } else if (!proof) {
      setNote('a dollar payout needs a reference, the transfer id or the confirmation number');
      return;
    }

    const problem = await onSettle(row, {
      currency: draft.currency,
      amount,
      destination: chain ? draft.destination : String(draft.destination).trim(),
      tx_signature: chain ? proof : null,
      reference: chain ? null : proof,
      note: draft.note.trim(),
    });
    if (problem) setNote(problem);
  };

  return (
    <Plate sunken>
      <VStack align="stretch" spacing={3}>
        <Kicker>Record a transaction somebody already made</Kicker>

        <HStack spacing={3} align="flex-start" flexWrap="wrap" rowGap={3}>
          <Box flex="0 1 150px" minW="130px">
            <Field label="Currency">
              <Select value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </Box>
          <Box flex="0 1 170px" minW="150px">
            <Field label="Amount that moved" hint={chain ? draft.currency : 'dollars'}>
              <Input
                value={draft.amountText}
                onChange={(e) => set({ amountText: e.target.value })}
                placeholder={chain ? '0.0' : String(row.usd_value)}
                inputMode="decimal"
              />
            </Field>
          </Box>
          <Box flex="1 1 220px" minW="200px">
            <Field label={chain ? 'Destination, from the book' : 'Where it landed'}>
              {chain ? (
                <Select
                  value={draft.destination}
                  onChange={(e) => set({ destination: e.target.value })}
                  placeholder={wallets.length ? 'pick a wallet' : 'no wallet in the book'}
                  isDisabled={wallets.length === 0}
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.address}>
                      {`${w.label || 'unlabelled'} · ${shortAddr(w.address)}`}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={draft.destination}
                  onChange={(e) => set({ destination: e.target.value })}
                  placeholder="the account, in words"
                />
              )}
            </Field>
          </Box>
        </HStack>

        <Field
          label={chain ? 'Transaction signature' : 'Reference'}
          hint={chain ? 'the join' : 'attested, not verifiable'}
          hintColor={chain ? P.limeDeep : P.gold}
        >
          <Input
            value={draft.proofText}
            onChange={(e) => setDraft((d) => ({ ...d, proofText: e.target.value }))}
            placeholder={chain ? 'paste what the wallet handed back' : 'transfer id or confirmation number'}
            fontFamily="mono"
          />
        </Field>

        {chain ? (
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
            The signature is what makes this row believable to somebody who does not work here.
            Shape is checked, the chain is not asked. The solscan link on the row is the real
            check.
          </Text>
        ) : (
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold}>
            A dollar payout can only be checked by somebody with access to the account, so this
            row will read attested rather than verifiable for the rest of its life.
          </Text>
        )}

        {noWallet && (
          <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>
            No wallet is written down for this holder. Add it at /registry/ or /wallets/ first,
            this form will not take an address typed by hand.
          </Text>
        )}

        {note && <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>{note}</Text>}

        <HStack spacing={2}>
          <Button size="sm" onClick={submit} isLoading={saving} isDisabled={noWallet}>
            Mark it sent
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </HStack>
      </VStack>
    </Plate>
  );
};

const PayoutRow = ({
  row, invoice, wallets, canWrite, saving, settling, onOpenSettle, onCancelSettle, onSettle, onVoid,
}) => {
  const proof = proofState(row);
  const owed = row.status === 'owed';
  const voided = row.status === 'void';

  return (
    <VStack align="stretch" spacing={2}>
      <Plate
        pad={false}
        px={INSET}
        py={3}
        bg={owed ? P.sunken : undefined}
        borderLeft={owed ? '2px dashed' : undefined}
        borderLeftColor={owed ? P.gold : undefined}
        opacity={voided ? 0.55 : 1}
      >
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between" gap={4} flexWrap="wrap" rowGap={2}>
            <VStack align="start" spacing={1} minW={0} flex="1 1 280px">
              <HStack spacing={2} flexWrap="wrap" rowGap={1}>
                <Text fontFamily="mono" fontSize={TYPE.small} color={P.ink} fontWeight="700">
                  {invoice?.invoice_number || `invoice ${String(row.invoice_id).slice(0, 8)}`}
                </Text>
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                  {percent(row.share)} of {usd(invoice?.total_paid ?? 0)}
                </Text>
                {voided && <Kicker color={P.inkFaint}>void</Kicker>}
              </HStack>

              <HStack spacing={2} align="center">
                <Icon
                  as={owed ? TbCircleDashed : (voided ? TbBan : TbSignature)}
                  boxSize={3.5}
                  color={owed ? P.gold : (proof.verifiable ? P.limeDeep : P.inkFaint)}
                />
                <Text
                  fontFamily="mono"
                  fontSize={TYPE.micro}
                  color={owed ? P.gold : (proof.verifiable ? P.limeDeep : P.inkMuted)}
                >
                  {proof.word}
                </Text>
                {row.tx_signature && (
                  <>
                    <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                      {shortSignature(row.tx_signature)}
                    </Text>
                    <Box
                      as="a"
                      href={signatureUrl(row.tx_signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      color={P.inkFaint}
                      _hover={{ color: P.limeDeep }}
                      transition={`color ${FAST} ${EASE}`}
                      aria-label="Open the transaction on solscan"
                    >
                      <Icon as={TbExternalLink} boxSize={3.5} display="block" />
                    </Box>
                  </>
                )}
                {!row.tx_signature && row.reference && (
                  <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                    {row.reference}
                  </Text>
                )}
              </HStack>

              {row.destination && (
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                  to {row.destination.length > 40 ? shortAddr(row.destination) : row.destination}
                </Text>
              )}
            </VStack>

            <HStack spacing={5} flexShrink={0} align="flex-start">
              <VStack align="end" spacing={0}>
                <Text
                  fontFamily="mono"
                  fontSize={TYPE.body}
                  fontWeight="700"
                  color={owed || voided ? P.inkMuted : P.ink}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {usd(row.usd_value)}
                </Text>
                {row.amount && isChainCurrency(row.currency) && (
                  <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                    {coin(row.amount)} {row.currency}
                  </Text>
                )}
                {row.settled_at && (
                  <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                    {String(row.settled_at).slice(0, 10)}
                  </Text>
                )}
              </VStack>

              {canWrite && owed && !settling && (
                <HStack spacing={2}>
                  <Button size="xs" variant="outline" onClick={() => onOpenSettle(row)}>
                    Settle
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => onVoid(row)}>
                    Void
                  </Button>
                </HStack>
              )}
            </HStack>
          </HStack>
        </VStack>
      </Plate>

      {settling && (
        <SettleForm
          row={row}
          wallets={wallets}
          saving={saving}
          onCancel={onCancelSettle}
          onSettle={onSettle}
        />
      )}
    </VStack>
  );
};

const HolderLedger = ({
  holder, rows, invoicesById, wallets, canWrite, saving, settlingId,
  onOpenSettle, onCancelSettle, onSettle, onVoid,
}) => {
  const totals = holderTotals(rows);

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={3} align="center" flexWrap="wrap" rowGap={2}>
        <HolderFace holder={holder} />
        <VStack align="start" spacing={0} minW={0} flex="1 1 220px">
          <HStack spacing={2} align="baseline">
            <Text fontSize={TYPE.section} fontWeight="600" color={P.ink} letterSpacing="-0.01em">
              {holder?.name || 'Nobody named'}
            </Text>
            {holder?.kind && holder.kind !== 'burro' && <Kicker>{holder.kind}</Kicker>}
          </HStack>
          <Text fontSize={TYPE.small} color={P.inkFaint} noOfLines={1}>{holder?.line || ''}</Text>
        </VStack>
        <Box flex={1} h="1px" bg={P.hair} minW="20px" />
        <HStack spacing={4} flexShrink={0}>
          <VStack align="end" spacing={0}>
            <Text
              fontFamily="mono"
              fontSize={TYPE.small}
              fontWeight="700"
              color={totals.owed > 0 ? P.gold : P.inkFaint}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {usd(totals.owed)}
            </Text>
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>owed</Text>
          </VStack>
          <VStack align="end" spacing={0}>
            <Text
              fontFamily="mono"
              fontSize={TYPE.small}
              fontWeight="700"
              color={totals.sent > 0 ? P.limeDeep : P.inkFaint}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {usd(totals.sent)}
            </Text>
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>sent</Text>
          </VStack>
          <VStack align="end" spacing={0}>
            <Text
              fontFamily="mono"
              fontSize={TYPE.small}
              fontWeight="700"
              color={P.ink}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {usd(totals.total)}
            </Text>
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>running total</Text>
          </VStack>
        </HStack>
      </HStack>

      {rows.length === 0 ? (
        <Text fontSize={TYPE.small} color={P.inkMuted}>
          Nothing has been recorded against {holder?.name || 'this holder'} yet.
        </Text>
      ) : (
        rows.map((row) => (
          <PayoutRow
            key={row.id}
            row={row}
            invoice={invoicesById[row.invoice_id]}
            wallets={wallets}
            canWrite={canWrite}
            saving={saving}
            settling={settlingId === row.id}
            onOpenSettle={onOpenSettle}
            onCancelSettle={onCancelSettle}
            onSettle={onSettle}
            onVoid={onVoid}
          />
        ))
      )}

      {totals.voidCount > 0 && (
        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
          {totals.voidCount} voided {totals.voidCount === 1 ? 'row' : 'rows'} above, in neither
          total. A row is voided rather than deleted so the ledger can still be reconciled.
        </Text>
      )}
    </VStack>
  );
};

export default HolderLedger;
