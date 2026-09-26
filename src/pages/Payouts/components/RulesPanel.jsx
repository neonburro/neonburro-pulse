// src/pages/Payouts/components/RulesPanel.jsx
// SENTINEL: NB_PAYOUTS_RULES_V1
//
// The published percentages. Which holder, what share, from when, and why.
//
// ── HISTORY IS NEVER EDITED, AND THE PANEL SAYS SO OUT LOUD ─────────────────
// There is no edit control on a rule and there is no edit policy on the table
// either, see the note in supabase/migrations/20260926043122_payout_ledger.sql
// on why the absence is the enforcement. A change is a new row with a later
// effective date, and the old row stays on screen underneath it, greyed and
// still readable. That is the point. A percentage that can be quietly revised
// after the invoices it governed have been split is a percentage nobody
// outside the building has a reason to trust, and the whole reason this room
// exists is to be trusted by somebody who does not work here.
//
// ── THE ROW IN FORCE IS MARKED, NOT SORTED TO THE TOP ───────────────────────
// Each holder's rules are listed newest first, and the one in force today
// carries the word. Rules are not reordered as they change, because a list
// whose order moves is a list that is harder to check against a screenshot
// somebody took last week.
//
// ── NOT BACKDATED ───────────────────────────────────────────────────────────
// The date field defaults to today and the panel warns when a person types an
// earlier one, because the rule in force for an invoice is chosen by the day
// the money landed. Backdating a rule silently changes what past invoices
// should have paid without touching a single payout row, so the payouts and
// the rules stop agreeing and nothing on screen says which is wrong. It is a
// warning and not a refusal, because a correction typed on the day after a
// mistake is a real thing a person needs to be able to do.
//
// No width, no gutter, no inset and no font size in this file, they come from
// the page kit. No oxford commas, no em dashes.

import { useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Icon, Input, Select,
} from '@chakra-ui/react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Plate, Kicker, Field, Empty } from '../../../components/common/Page';
import HolderFace from '../../../components/common/HolderFace';
import { HOLDER_BY_KEY } from '../../../data/walletHolders';
import { percent, shareFromPercentInput } from '../../../lib/payoutMath';

const P = colors.paper;

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_RULE = { holder: '', percentText: '', effective_from: '', note: '' };

const RuleRow = ({ rule, inForce, canWrite, onDrop }) => {
  const holder = HOLDER_BY_KEY[rule.holder];
  return (
    <HStack
      justify="space-between"
      gap={4}
      flexWrap="wrap"
      rowGap={2}
      py={2.5}
      borderTop="1px solid"
      borderColor={P.hairSoft}
      opacity={inForce ? 1 : 0.6}
    >
      <HStack spacing={2.5} minW={0} flex="1 1 260px">
        <HolderFace holder={holder} size="22px" />
        <VStack align="start" spacing={0} minW={0}>
          <HStack spacing={2} align="baseline" flexWrap="wrap" rowGap={0}>
            <Text fontSize={TYPE.body} fontWeight="700" color={P.ink}>
              {holder?.name || rule.holder || 'nobody named'}
            </Text>
            {inForce && <Kicker color={P.limeDeep}>in force</Kicker>}
          </HStack>
          {rule.note && (
            <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>{rule.note}</Text>
          )}
        </VStack>
      </HStack>

      <HStack spacing={5} flexShrink={0}>
        <VStack align="end" spacing={0}>
          <Text
            fontFamily="mono"
            fontSize={TYPE.body}
            fontWeight="700"
            color={P.ink}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {percent(rule.share)}
          </Text>
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
            from {String(rule.effective_from).slice(0, 10)}
          </Text>
        </VStack>
        {canWrite && (
          <Box
            as="button"
            type="button"
            onClick={() => onDrop(rule)}
            color={P.inkFaint}
            _hover={{ color: P.coral }}
            transition={`color ${FAST} ${EASE}`}
            aria-label="Drop this rule"
          >
            <Icon as={TbTrash} boxSize={3.5} display="block" />
          </Box>
        )}
      </HStack>
    </HStack>
  );
};

const RulesPanel = ({ rules, holders, inForceIds, canWrite, saving, onAdd, onDrop }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_RULE);
  const [note, setNote] = useState('');

  const byHolder = [...new Set(rules.map((r) => r.holder))].map((key) => ({
    key,
    holder: HOLDER_BY_KEY[key],
    rows: rules
      .filter((r) => r.holder === key)
      .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from))),
  }));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async () => {
    const share = shareFromPercentInput(draft.percentText);
    if (!draft.holder) { setNote('a rule needs a holder'); return; }
    if (share === null || share <= 0) { setNote('a share has to be a number above zero'); return; }
    if (share > 1) { setNote('a share cannot be more than a hundred percent'); return; }
    const from = draft.effective_from || today();
    const problem = await onAdd({
      holder: draft.holder,
      share,
      effective_from: from,
      note: draft.note.trim(),
    });
    if (problem) { setNote(problem); return; }
    setDraft(EMPTY_RULE);
    setNote('');
    setOpen(false);
  };

  const backdated = Boolean(draft.effective_from) && draft.effective_from < today();

  return (
    <VStack align="stretch" spacing={3}>
      <Text fontSize={TYPE.small} color={P.inkMuted}>
        A share is taken on the revenue, whatever currency it arrived in. A rule is never
        edited. A change is a new row from a later date and the old row stays readable
        underneath it.
      </Text>

      {canWrite && (
        <HStack>
          <Button
            size="sm"
            variant={open ? 'ghost' : 'outline'}
            leftIcon={<Icon as={TbPlus} boxSize={4} />}
            onClick={() => { setOpen((v) => !v); setNote(''); }}
          >
            {open ? 'Never mind' : 'A new rule'}
          </Button>
        </HStack>
      )}

      {open && canWrite && (
        <Plate sunken>
          <VStack align="stretch" spacing={3}>
            <Kicker>A new rule, from a date</Kicker>
            <HStack spacing={3} align="flex-start" flexWrap="wrap" rowGap={3}>
              <Box flex="1 1 200px" minW="180px">
                <Field label="Holder">
                  <Select
                    value={draft.holder}
                    onChange={(e) => set({ holder: e.target.value })}
                    placeholder="pick a holder"
                  >
                    {holders.map((h) => (
                      <option key={h.key} value={h.key}>{h.name}</option>
                    ))}
                  </Select>
                </Field>
              </Box>
              <Box flex="0 1 130px" minW="120px">
                <Field label="Share">
                  <Input
                    value={draft.percentText}
                    onChange={(e) => set({ percentText: e.target.value })}
                    placeholder="2.5"
                    inputMode="decimal"
                  />
                </Field>
              </Box>
              <Box flex="0 1 170px" minW="150px">
                <Field label="Effective from" hint={backdated ? 'earlier than today' : ''} hintColor={P.gold}>
                  <Input
                    type="date"
                    value={draft.effective_from || today()}
                    onChange={(e) => set({ effective_from: e.target.value })}
                  />
                </Field>
              </Box>
              <Box flex="2 1 260px" minW="200px">
                <Field label="Why">
                  <Input
                    value={draft.note}
                    onChange={(e) => set({ note: e.target.value })}
                    placeholder="what this share is for"
                  />
                </Field>
              </Box>
            </HStack>

            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
              The share is typed as a percentage and stored as a fraction to four places, so
              2.5 becomes 0.0250.
            </Text>

            {backdated && (
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold}>
                A date earlier than today changes what already settled invoices should have
                paid without touching a payout row. Write it only as a correction.
              </Text>
            )}

            {note && (
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>{note}</Text>
            )}

            <HStack spacing={2}>
              <Button size="sm" onClick={submit} isLoading={saving}>Write the rule</Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setNote(''); }}>
                Cancel
              </Button>
            </HStack>
          </VStack>
        </Plate>
      )}

      <Plate pad={false} px={INSET} py={1}>
        {byHolder.length === 0 ? (
          <Empty hint="Until a rule exists an invoice cannot be split, and the room says so rather than splitting at zero.">
            Nobody has published a percentage yet.
          </Empty>
        ) : (
          <VStack align="stretch" spacing={0}>
            {byHolder.map((group) => (
              <VStack key={group.key} align="stretch" spacing={0}>
                {group.rows.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    inForce={inForceIds.has(rule.id)}
                    canWrite={canWrite}
                    onDrop={onDrop}
                  />
                ))}
              </VStack>
            ))}
          </VStack>
        )}
      </Plate>
    </VStack>
  );
};

export default RulesPanel;
