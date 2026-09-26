// src/pages/Payouts/components/SplitPanel.jsx
// SENTINEL: NB_PAYOUTS_SPLIT_V1
//
// One settled invoice into payout rows, in one action, with the arithmetic on
// screen before anything is written.
//
// ── THE ARITHMETIC IS SHOWN, AND IT IS THE SAME ARITHMETIC ──────────────────
// The table below and the rows that get inserted both come out of
// splitPreview in src/lib/payoutMath.js, one call, held in the parent. That is
// the only reason showing a person the numbers first is worth doing. A preview
// computed one way and a write computed another is a preview that will be
// right until the day it is not, and the day it is not is the day somebody is
// owed the wrong amount.
//
// ── WHERE EVERY FIGURE CAME FROM ────────────────────────────────────────────
// The paid figure is invoices.total_paid and the panel prints that column name
// next to it. Not invoices.total, because a share of what was asked for is a
// share of a promise. The day is invoices.paid_at, and it is the day that
// picks which rule was in force, so it is printed too. Nothing on this panel
// is a number somebody typed.
//
// ── IT REFUSES RATHER THAN GUESSES ──────────────────────────────────────────
// Three states where it will not write, each named in words on the panel.
//   no rule in force   the invoice settled before any percentage was
//                      published. Splitting at zero would record that nobody
//                      was owed anything, which is a claim, and unknown is
//                      not zero.
//   over a hundred     the published percentages sum past the whole invoice.
//                      Scaling everybody down would be this panel deciding
//                      something the published rules are supposed to decide.
//   nothing paid       total_paid is zero, so there is no revenue to share
//                      yet whatever the invoice says.
//
// ── ONCE, AND THE DATABASE AGREES ───────────────────────────────────────────
// An invoice already split is out of the list. The unique index
// payouts_invoice_holder_uniq is the real guard and it will refuse the second
// attempt even if this list is stale, which is the order those two protections
// belong in. The front end filter is the soft copy, the index is the rule.
//
// No width, no gutter, no inset and no font size in this file, they come from
// the page kit. No oxford commas, no em dashes.

import { HStack, VStack, Box, Text, Button, Select, Icon } from '@chakra-ui/react';
import { TbArrowsSplit2 } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Plate, Kicker, Field, Empty } from '../../../components/common/Page';
import HolderFace from '../../../components/common/HolderFace';
import { HOLDER_BY_KEY } from '../../../data/walletHolders';
import { usd, percent } from '../../../lib/payoutMath';

const P = colors.paper;

const Line = ({ label, value, tone, mono = true, hint }) => (
  <HStack justify="space-between" gap={4} align="baseline">
    <VStack align="start" spacing={0} minW={0}>
      <Text fontSize={TYPE.small} color={P.inkMuted}>{label}</Text>
      {hint && <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{hint}</Text>}
    </VStack>
    <Text
      fontFamily={mono ? 'mono' : undefined}
      fontSize={TYPE.body}
      fontWeight="700"
      color={tone || P.ink}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
      flexShrink={0}
    >
      {value}
    </Text>
  </HStack>
);

const SplitPanel = ({
  invoices, selectedId, onSelect, invoice, preview, canWrite, saving, onWrite, note,
}) => {
  const nothingPaid = Boolean(invoice) && preview && preview.paid <= 0;
  const noRule = Boolean(invoice) && preview && preview.rows.length === 0;
  const blocked = !canWrite || !invoice || !preview || nothingPaid || noRule || preview.over;

  return (
    <VStack align="stretch" spacing={3}>
      <Text fontSize={TYPE.small} color={P.inkMuted}>
        Pick a settled invoice and read the arithmetic. Writing the rows records what is owed.
        It does not move any money and it does not send anybody anything.
      </Text>

      {invoices.length === 0 ? (
        <Plate sunken>
          <Empty hint="An invoice appears here once money has actually landed on it and nobody has split it yet.">
            No settled invoice is waiting to be split.
          </Empty>
        </Plate>
      ) : (
        <Field label="A settled invoice">
          <Select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            placeholder={`${invoices.length} waiting`}
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {`${inv.invoice_number || inv.id.slice(0, 8)} · ${inv.clients?.company || inv.clients?.name || 'no client'} · ${usd(inv.total_paid)} paid`}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {invoice && preview && (
        <Plate>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between" gap={3} flexWrap="wrap" rowGap={2}>
              <VStack align="start" spacing={0.5} minW={0}>
                <Kicker>The arithmetic, before anything is written</Kicker>
                <Text fontSize={TYPE.section} fontWeight="600" color={P.ink} letterSpacing="-0.01em">
                  {invoice.invoice_number || invoice.id.slice(0, 8)}
                </Text>
                <Text fontSize={TYPE.small} color={P.inkMuted}>
                  {invoice.clients?.company || invoice.clients?.name || 'no client on the invoice'}
                </Text>
              </VStack>
              <VStack align="end" spacing={0} flexShrink={0}>
                <Text
                  fontFamily="mono"
                  fontSize={TYPE.figure}
                  fontWeight="700"
                  color={P.ink}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {usd(preview.paid)}
                </Text>
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                  read from {preview.paidFrom}
                </Text>
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                  settled {preview.on || 'no date on the invoice'}
                </Text>
              </VStack>
            </HStack>

            {noRule && (
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>
                No percentage was in force on {preview.on || 'that day'}, so there is nothing to
                split. Publish a rule first. Splitting at zero would record that nobody was owed
                anything and unknown is not zero.
              </Text>
            )}

            {nothingPaid && (
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>
                That invoice has taken no money yet, so there is no revenue to share.
              </Text>
            )}

            {preview.rows.length > 0 && (
              <Box borderTop="1px solid" borderColor={P.hairSoft} px={0}>
                <VStack align="stretch" spacing={0}>
                  {preview.rows.map((row) => {
                    const holder = HOLDER_BY_KEY[row.holder];
                    return (
                      <HStack
                        key={row.holder}
                        justify="space-between"
                        gap={4}
                        py={2.5}
                        borderBottom="1px solid"
                        borderColor={P.hairSoft}
                        flexWrap="wrap"
                        rowGap={1}
                      >
                        <HStack spacing={2.5} minW={0} flex="1 1 220px">
                          <HolderFace holder={holder} size="22px" />
                          <Text fontSize={TYPE.body} color={P.ink} fontWeight="600" noOfLines={1}>
                            {holder?.name || row.holder}
                          </Text>
                        </HStack>
                        <HStack spacing={5} flexShrink={0}>
                          <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>
                            {percent(row.share)}
                          </Text>
                          <Text
                            fontFamily="mono"
                            fontSize={TYPE.body}
                            fontWeight="700"
                            color={P.ink}
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                            minW="86px"
                            textAlign="right"
                          >
                            {usd(row.usd_value)}
                          </Text>
                        </HStack>
                      </HStack>
                    );
                  })}
                </VStack>
              </Box>
            )}

            <VStack align="stretch" spacing={1.5}>
              <Line
                label="Set aside for holders"
                value={usd(preview.setAside)}
                hint={`${percent(preview.totalShare)} of the invoice across ${preview.rows.length} ${preview.rows.length === 1 ? 'holder' : 'holders'}`}
                tone={preview.over ? P.coral : P.limeDeep}
              />
              <Line label="Kept by the studio" value={usd(preview.kept)} />
            </VStack>

            {preview.over && (
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>
                The published percentages sum to {percent(preview.totalShare)}, which is more than
                the invoice. Nothing will be written. Fix the rules, this panel will not scale
                anybody down on its own.
              </Text>
            )}

            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
              Each holder's dollars are the paid total times that holder's share, rounded to the
              cent on its own row. No pool is divided, so the sum above can sit a cent from the
              paid total times the summed share, and every row can still be recomputed from the
              row alone.
            </Text>

            {note && (
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>{note}</Text>
            )}

            <HStack>
              <Button
                size="sm"
                leftIcon={<Icon as={TbArrowsSplit2} boxSize={4} />}
                onClick={onWrite}
                isDisabled={blocked}
                isLoading={saving}
              >
                {`Record ${preview.rows.length} ${preview.rows.length === 1 ? 'row' : 'rows'} as owed`}
              </Button>
            </HStack>
          </VStack>
        </Plate>
      )}
    </VStack>
  );
};

export default SplitPanel;
