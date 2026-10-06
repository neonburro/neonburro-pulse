// src/pages/Settings/panes/Appearance.jsx
// SENTINEL: NB_PULSE_SETTINGS_APPEARANCE_V1
//
// Appearance. Two rows and only one of them is a choice, because Pulse has
// exactly one look a person can change.
//
// ── THE SIDEBAR, THE ONE REAL CHOICE ────────────────────────────────────────
// profiles.sidebar_collapsed has existed since the rail learned to narrow,
// and the only way to reach it was the chevron at the foot of the rail. It
// is a segmented choice here, Open or Narrow, and it goes through useShell
// from AppShell.jsx, so the rail moves while you watch and the shell stays
// the one hand that writes the column. Saved on the profile, so it follows
// a person to any computer they sign in on. The rail only shows from lg,
// 1440, and the row says that on a narrower window so nobody wonders why
// nothing moved.
//
// ── THE PAPER, NOT A CHOICE ─────────────────────────────────────────────────
// The Claude settings offer light, dark and system. Pulse runs on one
// paper, cream with dark ink, lightened on 2026-10-05 for contrast, and
// there is no dark mode to offer. A disabled Dark option would be a promise,
// so the row shows the three grounds as swatches and says so plainly.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE, HEAD_GAP } from '../../../theme/layout';
import { PageHead, Rows, Row } from '../../../components/common/Page';
import { Segmented } from '../../../components/common/Controls';
import { useShell } from '../../../components/Layout/AppShell';

const P = colors.paper;

const SWATCHES = [
  { name: 'ground', hex: P.mat },
  { name: 'sheet', hex: P.sheet },
  { name: 'ink', hex: P.ink },
];

const Paper = () => (
  <HStack spacing={2} aria-label="The paper, ground, sheet and ink">
    {SWATCHES.map((s) => (
      <Box key={s.name} title={s.name} w="24px" h="24px" borderRadius="full" bg={s.hex} border="1px solid" borderColor={P.hair} />
    ))}
  </HStack>
);

const Appearance = () => {
  const shell = useShell();
  const [note, setNote] = useState('');

  const choose = async (value) => {
    if (!shell) return;
    setNote('');
    const { kept } = await shell.setSidebar(value === 'narrow');
    setNote(kept ? 'Kept on your profile.' : 'The rail moved here, the choice was not saved.');
  };

  return (
    <VStack align="stretch" spacing={HEAD_GAP}>
      <PageHead kicker="Settings" title="Appearance" lede="How Pulse sits on your screen." />
      <Rows borderTop="1px solid" borderBottom="1px solid" borderColor={P.hair}>
        <Row
          label="Sidebar"
          desc="Open shows every label, narrow keeps the icons. It follows you to any computer you sign in on. The sidebar shows on a wide window, a phone and a tablet use the bar at the bottom."
          control={(
            <VStack align={{ base: 'start', sm: 'end' }} spacing={1.5}>
              <Segmented
                label="Sidebar width"
                value={shell?.collapsed ? 'narrow' : 'open'}
                onChange={choose}
                isDisabled={!shell}
                options={[{ value: 'open', label: 'Open' }, { value: 'narrow', label: 'Narrow' }]}
              />
              {note && <Text fontSize={TYPE.label} color={P.inkFaint}>{note}</Text>}
            </VStack>
          )}
        />
        <Row
          label="Paper"
          desc="Pulse runs on one paper, warm cream with dark ink, so every page reads the same. There is no dark mode."
          control={<Paper />}
        />
      </Rows>
    </VStack>
  );
};

export default Appearance;
