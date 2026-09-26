// src/pages/Dashboard/components/TodayHeader.jsx
// SENTINEL: NB_PULSE_TODAY_HEADER_V3
// The top of Today, on Paper. The house page head, kicker then title, the
// kicker is the day and the title is the greeting. The clock and refresh sit
// as the actions, who else is here sits under. The clock ticks once a
// minute, landing on the minute boundary. No oxford, no dashes.

import { useState, useEffect, useRef } from 'react';
import { HStack, Text, IconButton, Tooltip } from '@chakra-ui/react';
import { TbRefresh } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { PageHead } from '../../../components/common/Page';
import TeamOnlineStrip from './TeamOnlineStrip';

const P = colors.paper;

const greet = (h) => {
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late one';
};

const TodayHeader = ({ name, onRefresh, refreshing }) => {
  const [now, setNow] = useState(() => new Date());
  const timer = useRef(null);

  useEffect(() => {
    const toNextMinute = 60000 - (Date.now() % 60000);
    const start = setTimeout(() => {
      setNow(new Date());
      timer.current = setInterval(() => setNow(new Date()), 60000);
    }, toNextMinute);
    return () => { clearTimeout(start); if (timer.current) clearInterval(timer.current); };
  }, []);

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const first = name ? String(name).trim().split(/\s+/)[0] : null;

  return (
    <PageHead
      kicker={`${weekday} · ${date}`}
      title={first ? `${greet(now.getHours())}, ${first}.` : greet(now.getHours())}
      actions={(
        <HStack spacing={3} align="center">
          <Text display={{ base: 'none', sm: 'block' }} fontFamily="mono" fontSize={TYPE.small} fontWeight="500" color={P.inkMuted} sx={{ fontVariantNumeric: 'tabular-nums' }}>{time}</Text>
          <Tooltip label="Refresh" placement="bottom" hasArrow bg={P.ink} color={P.sheet} fontSize={TYPE.small} openDelay={400}>
            <IconButton icon={<TbRefresh size={15} />} onClick={onRefresh} isLoading={refreshing} variant="outline" size="sm" borderRadius="full" aria-label="Refresh" />
          </Tooltip>
        </HStack>
      )}
    >
      <TeamOnlineStrip />
    </PageHead>
  );
};

export default TodayHeader;
