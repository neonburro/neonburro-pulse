// src/pages/Settings/components/SettingsNav.jsx
// SENTINEL: NB_PULSE_SETTINGS_NAV_V1
//
// The grouped list on the left of Settings, and the whole page on a phone.
// It reads src/pages/Settings/panes.js and types no pane of its own.
//
// ── TWO SHAPES, ONE LIST ────────────────────────────────────────────────────
// From sm, 640, the list is a quiet column beside the pane. Each item is a
// label and its icon, the active one on a hairSoft fill with ink text, the
// way the Claude desktop list marks the open pane. No lime here, the pane
// spends it.
// Below sm the list is the page. Each item grows a muted line and a chevron
// and the rows sit on hairlines with no box around them, the house rule for
// a phone. Tapping one opens /settings/<key>/ and the pane brings its own
// back link. Both shapes are the same elements with responsive props, so
// there is one list to keep and nothing that flashes between them.
//
// The version line closes the list. It used to sit at the foot of the old
// single column page, it carries the commit when Netlify built this.
//
// No oxford commas, no em dashes.

import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { TbChevronRight } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import { PageHead, Kicker } from '../../../components/common/Page';
import { panePath } from '../panes';

const P = colors.paper;

// On a phone nothing is open while the list is showing, so every item reads
// the same there and only the wide list marks the open pane.
const NavItem = ({ pane, active }) => (
  <HStack
    as={RouterLink}
    to={panePath(pane.key)}
    aria-current={active ? 'page' : undefined}
    spacing={3}
    align="center"
    minH={{ base: '60px', sm: '36px' }}
    py={{ base: 3, sm: 0 }}
    px={{ base: 0, sm: 3 }}
    borderRadius={{ base: 0, sm: '10px' }}
    bg={{ base: 'transparent', sm: active ? P.hairSoft : 'transparent' }}
    color={{ base: P.ink, sm: active ? P.ink : P.inkSec }}
    transition={`background ${FAST} ${EASE}, color ${FAST} ${EASE}`}
    sx={{ '@media (min-width: 640px)': { '&:hover': { background: active ? P.hairSoft : P.sunken, color: P.ink } } }}
    _focusVisible={{ outline: `2px solid ${P.limeDeep}`, outlineOffset: '1px' }}
  >
    <Icon as={pane.icon} boxSize={{ base: 5, sm: 4 }} color={{ base: P.inkSec, sm: active ? P.ink : P.inkMuted }} flexShrink={0} />
    <VStack align="start" spacing={0.5} flex={1} minW={0}>
      <Text fontSize={TYPE.body} fontWeight={{ base: '600', sm: active ? '600' : '500' }} lineHeight="1.3" noOfLines={1}>
        {pane.label}
      </Text>
      <Text display={{ base: 'block', sm: 'none' }} fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.4">
        {pane.desc}
      </Text>
    </VStack>
    <Icon display={{ base: 'block', sm: 'none' }} as={TbChevronRight} boxSize={4} color={P.inkFaint} flexShrink={0} />
  </HStack>
);

const SettingsNav = ({ groups, active, studio, build }) => (
  <VStack align="stretch" spacing={{ base: 7, sm: 6 }}>
    <Box display={{ base: 'block', sm: 'none' }}>
      <PageHead
        kicker="Pulse"
        title="Settings"
        lede={studio
          ? 'Yours first, then the studio\'s team and the tools it runs on.'
          : 'Your profile, your account and how Pulse looks to you.'}
      />
    </Box>

    {groups.map((group) => (
      <VStack key={group.key} as="nav" aria-label={group.label} align="stretch" spacing={{ base: 0, sm: 0.5 }}>
        <Kicker px={{ base: 0, sm: 3 }} pb={{ base: 1, sm: 2 }}>{group.label}</Kicker>
        <VStack
          align="stretch"
          spacing={{ base: 0, sm: 0.5 }}
          sx={{ '@media (max-width: 639px)': { '& > a + a': { borderTop: `1px solid ${P.hairSoft}` } } }}
        >
          {group.panes.map((pane) => (
            <NavItem key={pane.key} pane={pane} active={pane.key === active} />
          ))}
        </VStack>
      </VStack>
    ))}

    <Text px={{ base: 0, sm: 3 }} fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>
      neonburro pulse v1.1.0{build?.short ? ` · ${build.short}` : ''}
    </Text>
  </VStack>
);

export default SettingsNav;
