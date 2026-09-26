// src/pages/Invoicing/components/SprintEditRow.jsx
// One row in the sprint list of the invoice editor. Paper surface.
// Inline editing for title, amount, payment_mode. Expand for description.
// Locked when the sprint is paid. The billable checkbox hides a WIP sprint from
// the client and from the billable total.
//
// The funding chips use the SAME warm tints as the invoice document
// (invoiceEmailTemplate.js CHIP), so what you set here reads identically to what
// the client sees. The title and amount are naked inline fields, they sit in a
// row with no rounded edge so they carry no inset, the description opens as
// a house textarea. No oxford commas, no dashes.

import { useState } from 'react';
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

const SprintEditRow = ({ sprint, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const isLocked = sprint.locked || sprint.payment_status === 'paid';
  const isWip = sprint.is_billable === false;

  return (
    <Box py={4} borderBottom="1px solid" borderColor={P.hairSoft} role="group">
      <HStack align="start" spacing={3.5}>
        <Box
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
          mt="2px"
          cursor={isLocked ? 'not-allowed' : 'pointer'}
          flexShrink={0}
          transition={`all ${FAST} ${EASE}`}
        >
          {!isWip && <Icon as={TbCheck} boxSize={2.5} color={P.limeInk} strokeWidth={3} />}
        </Box>

        <Box flex={1} minW={0}>
          <HStack spacing={3} align="center" mb={1}>
            <Input
              value={sprint.title || ''}
              onChange={(e) => onUpdate({ ...sprint, title: e.target.value })}
              placeholder="Sprint title"
              variant="unstyled"
              color={P.ink}
              fontSize={TYPE.body}
              fontWeight="600"
              letterSpacing="-0.01em"
              h="28px"
              flex={1}
              isReadOnly={isLocked}
              _placeholder={{ color: PLACEHOLDER, fontWeight: '500' }}
            />
            <Input
              value={sprint.amount || ''}
              onChange={(e) => onUpdate({ ...sprint, amount: e.target.value })}
              placeholder="0"
              type="number"
              step="0.01"
              variant="unstyled"
              color={P.ink}
              fontSize={TYPE.body}
              fontFamily="mono"
              fontWeight="600"
              h="28px"
              textAlign="right"
              w="90px"
              isReadOnly={isLocked}
              _placeholder={{ color: PLACEHOLDER }}
            />
            <Text color={P.inkMuted} fontSize={TYPE.small} fontFamily="mono">USD</Text>
          </HStack>

          <HStack spacing={3} mt={1.5} flexWrap="wrap" rowGap={2}>
            <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" fontWeight="600" letterSpacing="0.04em">
              {sprint.sprint_number || 'number on save'}
            </Text>

            <HStack spacing={1.5}>
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
              <Kicker color={P.inkFaint}>WIP</Kicker>
            )}

            <Box flex={1} />

            <Box
              as="button"
              type="button"
              onClick={() => setExpanded(!expanded)}
              color={P.inkMuted}
              _hover={{ color: P.ink }}
            >
              <Kicker color="inherit">{expanded ? 'Less' : 'Details'}</Kicker>
            </Box>

            {!isLocked && (
              <Box as="button" type="button" onClick={onDelete} color={P.inkFaint} _hover={{ color: P.coral }} transition={`color ${FAST} ${EASE}`}>
                <Icon as={TbTrash} boxSize={3.5} />
              </Box>
            )}
          </HStack>

          {/* ── ONE FIELD, DELIBERATELY ─────────────────────────────────────
              This briefly had two, a plain sentence above a technical
              paragraph. It was reverted: two blocks of prose per line turned a
              one page invoice into a document, and being readable at a glance
              was the thing that made the letterhead good.

              The readability fix that survived is the SIZE. It was rows 2.
              These paragraphs run sixty words, and reading one through a two
              line slot is why nobody proofreads them. Six rows, and draggable
              taller.

              Write it opening with where the work is, "Second pass." or
              "Initial build, in progress.", then the detail. */}
          {expanded && (
            <Textarea
              value={sprint.description || ''}
              onChange={(e) => onUpdate({ ...sprint, description: e.target.value })}
              placeholder="Where the work is, then what it covers. Drag the corner for more room."
              mt={3}
              color={P.inkSec}
              rows={6}
              minH="140px"
              isReadOnly={isLocked}
            />
          )}
        </Box>
      </HStack>
    </Box>
  );
};

export default SprintEditRow;
