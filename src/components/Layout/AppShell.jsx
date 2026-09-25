// src/components/Layout/AppShell.jsx
// SENTINEL: NB_PULSE_SHELL_V5
//
// Two colors, cream everywhere and one dark. V3 inverted this: a dark ground with
// a cream sheet floated on it. Tyler's call is the opposite and cleaner: the whole
// tool is cream, and the ONLY dark things are the sidebar (desktop) and the bottom
// pill (phone), each a rounded rectangle floating on the cream.
//
// So the ground here is paper.mat. The sidebar is position fixed and inset from
// the window edges (SIDE_INSET), a floating dark rounded rectangle, and the content
// column is pushed right by the sidebar width plus that inset plus a gap. The
// content is plain cream, no sheet and no rounding, because it is the same cream as
// the ground now. The window scrolls normally, the sidebar stays because it is
// fixed. 100dvh so a phone's URL bar can never open a gap.
//
// V5, 2026-09-25. VoltDesk mounts here once, so Volt's bolt is in the bottom
// right corner of every signed in page. It is fixed and lives outside the
// content column, the same way MobileNav does, and it clears the pill on a
// phone by reading TABBAR_H from the theme. See VoltDesk.jsx for the rest.
//
// No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import VoltDesk from './VoltDesk';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { SIDEBAR_W, SIDEBAR_W_COLLAPSED, TABBAR_PAD, EASE, SLOW } from '../../theme/layout';

const P = colors.paper;
// The floating sidebar is inset 12px from the window and the content clears it by
// a 16px gap, so the offset is width + 28. Sidebar.jsx uses the same 12px inset.
const OFFSET = (w) => `calc(${w} + 28px)`;

const AppShell = ({ children }) => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('sidebar_collapsed')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data?.sidebar_collapsed) setCollapsed(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggle = async () => {
    const next = !collapsed;
    setCollapsed(next);
    if (!user) return;
    await supabase.from('profiles').update({ sidebar_collapsed: next }).eq('id', user.id);
  };

  return (
    <Flex minH="100dvh" bg={P.mat} align="stretch">
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <Box
        flex={1}
        minW={0}
        ml={{ base: 0, lg: OFFSET(collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W) }}
        minH="100dvh"
        transition={`margin-left ${SLOW} ${EASE}`}
        display="flex"
        flexDirection="column"
      >
        <Header />

        <Box
          as="main"
          w="100%"
          flex={1}
          bg={P.mat}
          color={P.ink}
          pb={{ base: TABBAR_PAD, lg: 0 }}
        >
          {children || <Outlet />}
        </Box>
      </Box>

      <MobileNav />
      <VoltDesk />
    </Flex>
  );
};

export default AppShell;
