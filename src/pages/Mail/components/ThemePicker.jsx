// src/pages/Mail/components/ThemePicker.jsx
// The colours of one letter. A letter wears its client's colours above the
// signature, the way Greenville's September letter wore navy and red, and
// the house colours when there is no client. Tyler, 2026-10-05, "styled
// subtly, really clean".
//
// Presets first, because a preset carries every tone exactly as measured
// off a real letter. Then the four colours a person can move, ground, card,
// accent and ink. Move any of them and the label says custom colours,
// because from that point the other eleven tones are mixed by
// resolvePalette in src/lib/mailDocument.js rather than measured. A half
// typed hex is kept in the field and never reaches the render, cleanTheme
// falls back to the preset until it is six digits.
//
// No oxford commas, no em dashes.

import { Box, HStack, VStack, Text, Input, SimpleGrid } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE, FIELD_RADIUS, EASE, FAST } from '../../../theme/layout';
import { Field, Kicker } from '../../../components/common/Page';
import { PRESET_LIST, PRESETS, HEX_RE, themeMatchesPreset } from '../../../lib/mailDocument';

const P = colors.paper;

const NAMES = {
  ground: { label: 'ground', hint: 'behind everything' },
  card: { label: 'card', hint: 'the hero and link cards' },
  accent: { label: 'accent', hint: 'the button and the rules' },
  ink: { label: 'ink', hint: 'the opening and the name' },
};

const Swatches = ({ base }) => (
  <HStack spacing={1}>
    {['ground', 'card', 'accent'].map((k) => (
      <Box key={k} w="14px" h="14px" borderRadius="full" bg={base[k]} border="1px solid" borderColor={P.hair} />
    ))}
  </HStack>
);

const ColourField = ({ name, value, onChange }) => {
  const valid = HEX_RE.test(String(value || '').trim());
  return (
    <Field label={NAMES[name].label} hint={NAMES[name].hint}>
      <HStack spacing={2}>
        <Box
          as="input"
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`Pick the ${name} colour`}
          w="44px"
          h="44px"
          flexShrink={0}
          p="3px"
          bg={P.sheet}
          border="1px solid"
          borderColor={P.hair}
          borderRadius={FIELD_RADIUS}
          cursor="pointer"
          sx={{
            '&::-webkit-color-swatch-wrapper': { padding: 0 },
            '&::-webkit-color-swatch': { border: 'none', borderRadius: '8px' },
            '&::-moz-color-swatch': { border: 'none', borderRadius: '8px' },
          }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          fontFamily="mono"
          maxW="140px"
          spellCheck={false}
          borderColor={valid ? P.hair : P.coral}
          aria-label={`The ${name} colour as hex`}
        />
      </HStack>
    </Field>
  );
};

const ThemePicker = ({ theme, onChange }) => {
  const exact = themeMatchesPreset(theme);
  const apply = (key) => onChange({ preset: key, ...PRESETS[key].base });
  const set = (k, v) => onChange({ ...theme, [k]: v });

  return (
    <VStack align="stretch" spacing={4}>
      <HStack spacing={2} flexWrap="wrap" rowGap={2}>
        {PRESET_LIST.map((p) => {
          const active = theme.preset === p.key && exact;
          return (
            <HStack
              key={p.key}
              as="button"
              type="button"
              onClick={() => apply(p.key)}
              spacing={2.5}
              px={3.5}
              h="36px"
              borderRadius="full"
              border="1px solid"
              borderColor={active ? P.ink : P.hair}
              bg={active ? P.sunken : P.sheet}
              transition={`all ${FAST} ${EASE}`}
              _hover={{ borderColor: P.inkFaint }}
            >
              <Swatches base={p.base} />
              <Text fontSize={TYPE.small} fontWeight={active ? '600' : '500'} color={P.ink}>{p.label}</Text>
            </HStack>
          );
        })}
      </HStack>

      {!exact && (
        <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
          Custom colours. The card text and the quiet tones are mixed from these four rather than measured,
          so press a preset to go back to an exact set.
        </Text>
      )}

      <SimpleGrid minChildWidth="220px" spacing={4}>
        {Object.keys(NAMES).map((k) => (
          <ColourField key={k} name={k} value={theme[k] || ''} onChange={(v) => set(k, v)} />
        ))}
      </SimpleGrid>

      <Kicker color={P.inkFaint}>the signature card stays light in every theme</Kicker>
    </VStack>
  );
};

export default ThemePicker;
