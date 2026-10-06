// src/pages/Settings/components/SettingsFrame.jsx
// SENTINEL: NB_PULSE_SETTINGS_FRAME_V1
//
// The list and the pane. Everything Settings draws sits inside this frame,
// and the frame fetches nothing. The page (src/pages/Settings/index.jsx)
// loads the profile and hands it in, and the dev review route hands in a
// sample one instead, which is the whole reason the two are apart.
//
// ── THE GEOMETRY ────────────────────────────────────────────────────────────
// From sm, 640, a grid of SETTINGS_NAV then the pane, the pane stopping at
// PANE so a control never sits a long walk from its label. Both numbers live
// in src/theme/layout.js. The list is sticky so a long pane scrolls past it
// without losing the way back. Pulse breaks at sm 640 and md 1024, not
// Chakra's defaults, so a 834 iPad already gets the two columns.
// Below sm there is one column and the URL decides it: /settings/ is the
// list, /settings/<key>/ is the pane with a back link. Both are rendered and
// one is hidden by display, so there is no width read in JavaScript and
// nothing to flash on the first paint.
//
// ── MOTION ──────────────────────────────────────────────────────────────────
// A pane arrives with a 6px rise and a fade on the house EASE, keyed by the
// pane so it plays on a change and never on a re-render. Under reduced
// motion it simply appears. Nothing else in Settings moves except the
// controls, see src/components/common/Controls.jsx.
//
// ── DEPS ────────────────────────────────────────────────────────────────────
// deps carries the few calls a pane makes on open, the team list, the tools
// function and the trademark watch, so the review route can pass sample
// answers. A pane falls back to the real call when deps leaves one out.
// Writes, saving a profile, an avatar, a password, are never in deps. The
// review route is for looking, a write there fails against no session and
// says so.
//
// No oxford commas, no em dashes.

import { Box, Grid, HStack, Text, Icon } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { TbChevronLeft } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, SETTINGS_NAV, PANE, EASE, FAST } from '../../../theme/layout';
import { Page } from '../../../components/common/Page';
import BUILD from '../../../lib/build';
import { groupsFor, isStudio, DEFAULT_PANE } from '../panes';
import SettingsNav from './SettingsNav';
import Profile from '../panes/Profile';
import Account from '../panes/Account';
import Notifications from '../panes/Notifications';
import Appearance from '../panes/Appearance';
import Team from '../panes/Team';
import Tools from '../panes/Tools';

const P = colors.paper;

const PANES = {
  profile: Profile,
  account: Account,
  notifications: Notifications,
  appearance: Appearance,
  team: Team,
  tools: Tools,
};

const Back = () => (
  <HStack
    as={RouterLink}
    to="/settings/"
    display={{ base: 'inline-flex', sm: 'none' }}
    spacing={1}
    mb={5}
    color={P.inkMuted}
    transition={`color ${FAST} ${EASE}`}
    _hover={{ color: P.ink }}
  >
    <Icon as={TbChevronLeft} boxSize={4} />
    <Text fontSize={TYPE.small} fontWeight="600">Settings</Text>
  </HStack>
);

const SettingsFrame = ({ user, profile, setProfile, pane, deps = {}, build = BUILD }) => {
  const still = useReducedMotion();
  const role = profile?.role;
  const studio = isStudio(role);
  const active = pane || DEFAULT_PANE;
  const Pane = PANES[active] || PANES[DEFAULT_PANE];

  return (
    <Page>
      <Grid
        templateColumns={{ base: 'minmax(0, 1fr)', sm: `${SETTINGS_NAV} minmax(0, 1fr)` }}
        columnGap={{ sm: 8, md: 12 }}
        alignItems="start"
      >
        <Box
          display={{ base: pane ? 'none' : 'block', sm: 'block' }}
          position={{ base: 'static', sm: 'sticky' }}
          top={{ sm: 6 }}
          ml={{ sm: -3 }}
        >
          <SettingsNav groups={groupsFor(role)} active={active} studio={studio} build={build} />
        </Box>

        <Box display={{ base: pane ? 'block' : 'none', sm: 'block' }} maxW={PANE} minW={0}>
          <Back />
          <motion.div
            key={active}
            initial={still ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <Pane user={user} profile={profile} setProfile={setProfile} deps={deps} build={build} />
          </motion.div>
        </Box>
      </Grid>
    </Page>
  );
};

export default SettingsFrame;
