// src/components/common/Controls.jsx
// SENTINEL: NB_PULSE_CONTROLS_V1
//
// The two controls a settings row carries on its right, from the Claude
// desktop settings Tyler pointed at on 2026-10-05: a toggle for a yes or no
// and a segmented choice for two to four answers. Built here once so the
// next page that wants one does not paint its own. The segmented choice is
// the sidebar width in Settings, Appearance. The toggle has no caller yet on
// purpose: it waits for the first real yes or no, which will be a
// notification preference once one is kept somewhere. Never wire it to a
// switch that saves nothing.
//
// ── WHY INK AND NOT LIME ────────────────────────────────────────────────────
// Lime is spent once per screen, on the page's one primary button. A pane
// with three toggles in lime would spend it three times and the button that
// matters would stop reading as the button. So on is ink, off is hair, and
// the thumb is the sheet. Chakra's Switch is not used because its track
// takes a colour scheme from the brand ramp, which is lime.
//
// ── MOTION ──────────────────────────────────────────────────────────────────
// The toggle thumb travels on a CSS transform with the house EASE, which is
// all a 16px move needs. The segmented thumb is one framer element shared
// across the options by layoutId, so it slides from the old answer to the
// new one instead of blinking, and it holds still under reduced motion. The
// layoutId carries useId so two segmented controls on one page never chase
// each other's thumb.
//
// ── ACCESSIBILITY ───────────────────────────────────────────────────────────
// The toggle is a button with role switch and aria-checked. The segmented
// control is a radiogroup of radio buttons, so a screen reader hears the
// choice and the answer, not a row of unlabeled buttons. Both take a label
// for the reader even when the row beside them already says it.
//
// No oxford commas, no em dashes.

import { useId } from 'react';
import { Box, HStack, Text } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST, FIELD_H_SM } from '../../theme/layout';

const P = colors.paper;

export const Toggle = ({ checked, onChange, label, isDisabled = false }) => (
  <Box
    as="button"
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={isDisabled}
    onClick={() => !isDisabled && onChange(!checked)}
    position="relative"
    w="40px"
    h="24px"
    borderRadius="full"
    bg={checked ? P.ink : P.hair}
    transition={`background ${FAST} ${EASE}`}
    opacity={isDisabled ? 0.5 : 1}
    cursor={isDisabled ? 'not-allowed' : 'pointer'}
    _focusVisible={{ outline: `2px solid ${P.limeDeep}`, outlineOffset: '2px' }}
  >
    <Box
      position="absolute"
      top="3px"
      left="3px"
      w="18px"
      h="18px"
      borderRadius="full"
      bg={P.sheet}
      boxShadow="0 1px 2px rgba(36,26,22,0.18)"
      transform={checked ? 'translateX(16px)' : 'translateX(0)'}
      transition={`transform ${FAST} ${EASE}`}
    />
  </Box>
);

export const Segmented = ({ value, onChange, options, label, isDisabled = false }) => {
  const id = useId();
  const still = useReducedMotion();
  return (
    <HStack
      role="radiogroup"
      aria-label={label}
      spacing={0}
      p="3px"
      h={FIELD_H_SM}
      bg={P.sunken}
      border="1px solid"
      borderColor={P.hair}
      borderRadius="full"
      opacity={isDisabled ? 0.5 : 1}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Box
            key={option.value}
            as="button"
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isDisabled}
            onClick={() => !isDisabled && !active && onChange(option.value)}
            position="relative"
            h="100%"
            px={3.5}
            borderRadius="full"
            cursor={isDisabled ? 'not-allowed' : active ? 'default' : 'pointer'}
            _focusVisible={{ outline: `2px solid ${P.limeDeep}`, outlineOffset: '1px' }}
            sx={{ '&:hover > p': { color: P.ink } }}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={still ? { duration: 0 } : { duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 9999,
                  background: P.sheet,
                  border: `1px solid ${P.hair}`,
                  boxShadow: '0 1px 2px rgba(36,26,22,0.08)',
                }}
              />
            )}
            <Text
              position="relative"
              fontSize={TYPE.small}
              fontWeight={active ? '600' : '500'}
              color={active ? P.ink : P.inkMuted}
              whiteSpace="nowrap"
              transition={`color ${FAST} ${EASE}`}
            >
              {option.label}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
};

export default Toggle;
