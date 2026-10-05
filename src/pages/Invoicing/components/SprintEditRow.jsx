// src/pages/Invoicing/components/SprintEditRow.jsx
// One row in the sprint list of the invoice editor. Paper surface.
// Inline editing for title, amount, description and payment_mode. Locked when
// the sprint is paid. The billable checkbox hides a WIP sprint from the client
// and from the billable total.
//
// The funding chips use the SAME warm tints as the invoice document
// (invoiceEmailTemplate.js CHIP), so what you set here reads identically to what
// the client sees. The title and amount are naked inline fields, they sit in a
// row with no rounded edge so they carry no inset, the description is a house
// textarea. No oxford commas, no dashes.
//
// ── THE DESCRIPTION IS ALWAYS OPEN, 2026-10-05 ──────────────────────────────
// It sat behind a Details toggle and Tyler asked for the opposite, "I don't
// want to have to tap on details." So the row now reads in the order the
// document prints it, title then description, then the funding chips. The
// textarea grows to fit whatever is written, three rows when empty, so a
// sixty word paragraph is read whole without dragging a corner and an empty
// one does not take a screen. A paid sprint shows its description as plain
// text, there is nothing left to edit.
//
// The earlier reasoning still holds and is kept here. This briefly had two
// fields, a plain sentence above a technical paragraph. It was reverted, two
// blocks of prose per line turned a one page invoice into a document, and
// being readable at a glance was the thing that made the letterhead good.
// Write it opening with where the work is, "Second pass." or "Initial build,
// in progress.", then the detail.

import { useRef, useLayoutEffect } from 'react';
import { Box, HStack, Input, Textarea, Text, Icon } from '@chakra-ui/react';
import { TbCheck, TbTrash, TbLock } from 'react-icons/tb';
import { FUNDING_MODES } from '../../../lib/invoiceConstants';
import colors from '../../../theme/colors';
import { TYPE, PLACEHOLDER, EASE, FAST } from '../../../theme/layout';
import { Kicker } from '../../../components/common/Page';

const P = colors.paper;

// Same tints as the document chips.
const CHIP = {
  pay_full:     { bg: '#EAF0D2', ink: '#3A4319' },
  deposit_50:   { bg: '#F3EAD3', ink: '#7A5A1E' },
  approve_only: { bg: '#ECE6DA', ink: '#5A4636' },
};

// A textarea that is as tall as its words. Height is reset to auto first so it
// can shrink when text is deleted, then set to the scroll height.
const GrowingTextarea = ({ value, ...rest }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight + 2, 84)}px`;
  }, [value]);
  return <Textarea ref={ref} value={value} rows={3} resize="none" overflow="hidden" {...rest} />;
};

const SprintEditRow = ({ sprint, onUpdate, onDelete }) => {
  const isLocked = sprint.locked || sprint.payment_status === 'paid';
  const isWip = sprint.is_billable === false;
  const untitled = !isWip && !(sprint.title || '').trim();

  return (
    <Box py={5} borderBottom="1px solid" borderColor={P.hairSoft} role="group">
      <HStack align="start" spacing={3.5}>
        <Box
          as="button"
          type="button"
          aria-label={isWip ? 'Mark billable' : 'Mark as WIP, hidden from the client'}
          title={isWip ? 'WIP, hidden from the client. Press to bill it.' : 'Billable. Press to hide it as WIP.'}
          w="18px"
          h="18px"
          borderRadius="6px"
          border="1.5px solid"
          borderColor={isWip ? P.hair : P.lime}
          bg={isWip ? 'transparent' : P.lime}
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={() => !isLocked && onUpdate({ ...sprint, is_billable: isWip })}
          mt="5px"
          cursor={isLocked ? 'not-allowed' : 'pointer'}
          flexShrink={0}
          transition={`all ${FAST} ${EASE}`}
        >
          {!isWip && <Icon as={TbCheck} boxSize={2.5} color={P.limeInk} strokeWidth={3} />}
        </Box>

        <Box flex={1} minW={0}>
          <HStack spacing={3} align="center">
            <Input
              value={sprint.title || ''}
              onChange={(e) => onUpdate({ ...sprint, title: e.target.value })}
              placeholder="Line title, the first thing the client reads"
              variant="unstyled"
              color={P.ink}
              fontSize={TYPE.section}
              fontWeight="600"
              letterSpacing="-0.01em"
              h="30px"
              flex={1}
              isReadOnly={isLocked}
              _placeholder={{ color: untitled ? P.gold : PLACEHOLDER, fontWeight: '500' }}
            />
            <HStack spacing={1.5} flexShrink={0} align="baseline">
              <Text color={P.inkMuted} fontSize={TYPE.body} fontFamily="mono">$</Text>
              <Input
                value={sprint.amount || ''}
                onChange={(e) => onUpdate({ ...sprint, amount: e.target.value })}
                placeholder="0"
                type="number"
                step="0.01"
                variant="unstyled"
                color={P.ink}
                fontSize={TYPE.section}
                fontFamily="mono"
                fontWeight="600"
                h="30px"
                textAlign="right"
                w="96px"
                isReadOnly={isLocked}
                _placeholder={{ color: PLACEHOLDER }}
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </HStack>
          </HStack>

          {isLocked ? (
            sprint.description ? (
              <Text mt={2} fontSize={TYPE.body} color={P.inkSec} lineHeight="1.65" whiteSpace="pre-wrap" maxW="70ch">
                {sprint.description}
              </Text>
            ) : null
          ) : (
            <GrowingTextarea
              value={sprint.description || ''}
              onChange={(e) => onUpdate({ ...sprint, description: e.target.value })}
              placeholder="Where the work is, then what it covers. The client reads this under the title."
              mt={2.5}
              color={P.inkSec}
              lineHeight="1.65"
            />
          )}

          <HStack spacing={3} mt={3} flexWrap="wrap" rowGap={2}>
            <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" fontWeight="600" letterSpacing="0.04em">
              {sprint.sprint_number || 'number on save'}
            </Text>

            <HStack spacing={1.5} flexWrap="wrap" rowGap={1.5}>
              {FUNDING_MODES.map((mode) => {
                const active = (sprint.payment_mode || 'approve_only') === mode.value;
                const chip = CHIP[mode.value] || CHIP.approve_only;
                return (
                  <Box
                    key={mode.value}
                    as="button"
                    type="button"
                    onClick={() => !isLocked && onUpdate({ ...sprint, payment_mode: mode.value })}
                    px={2.5}
                    h="26px"
                    borderRadius="full"
                    border="1px solid"
                    borderColor={active ? 'transparent' : P.hair}
                    bg={active ? chip.bg : 'transparent'}
                    transition={`all ${FAST} ${EASE}`}
                    cursor={isLocked ? 'not-allowed' : 'pointer'}
                    _hover={isLocked ? {} : { borderColor: active ? 'transparent' : P.inkFaint }}
                  >
                    <Text
                      fontSize={TYPE.kicker}
                      fontWeight="500"
                      fontFamily="mono"
                      letterSpacing="0.1em"
                      textTransform="uppercase"
                      color={active ? chip.ink : P.inkMuted}
                    >
                      {mode.label}
                    </Text>
                  </Box>
                );
              })}
            </HStack>

            {isLocked && (
              <HStack spacing={1} color={P.limeDeep}>
                <Icon as={TbLock} boxSize={3} />
                <Kicker color="inherit">PAID</Kicker>
              </HStack>
            )}
            {isWip && !isLocked && (
              <Kicker color={P.inkFaint}>WIP, hidden from the client</Kicker>
            )}
            {untitled && !isLocked && (
              <Kicker color={P.gold}>Needs a title before it can send</Kicker>
            )}

            <Box flex={1} />

            {!isLocked && (
              <Box as="button" type="button" onClick={onDelete} color={P.inkFaint} _hover={{ color: P.coral }} transition={`color ${FAST} ${EASE}`} aria-label="Remove this line">
                <Icon as={TbTrash} boxSize={3.5} />
              </Box>
            )}
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
};

export default SprintEditRow;
