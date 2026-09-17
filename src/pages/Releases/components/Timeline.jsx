// src/pages/Releases/components/Timeline.jsx
// SENTINEL: NB_PULSE_SOCIALS_TIMELINE_V2
//
// The Socials calendar keeps the compact two week field but it is no longer
// trapped on today. Previous, today and next move in fourteen day steps. The
// ledger below remains the complete record, so the calendar can stay quiet and
// visual. On phones each week scrolls inside its own rail rather than widening
// the whole page.
//
// Cards show the hour, channel and council voice. A small Lyra mark appears
// while an asset is waiting or generating. The release drawer holds the full
// creative brief and publishing account.
//
// No oxford commas, no em dashes.

import { useMemo, useState } from 'react';
import { Box, VStack, HStack, Text, SimpleGrid, Icon } from '@chakra-ui/react';
import { TbChevronLeft, TbChevronRight, TbCalendarDot } from 'react-icons/tb';
import {
  P,
  STATUS_TINT,
  VoiceDisc,
  voiceTint,
  dayKey,
  Kicker,
} from './shared';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const DAYS = 14;

const hourLabel = (iso) => new Date(iso)
  .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  .toLowerCase()
  .replace(' ', '');

const StepButton = ({ label, icon, onClick }) => (
  <HStack
    as="button"
    type="button"
    onClick={onClick}
    spacing={1}
    h="30px"
    px={2.5}
    borderRadius="full"
    border="1px solid"
    borderColor={P.hair}
    color={P.inkMuted}
    bg={P.sheet}
    _hover={{ color: P.ink, borderColor: P.inkFaint }}
    transition={`all ${FAST} ${EASE}`}
  >
    <Icon as={icon} boxSize={3.5} />
    <Text fontFamily="mono" fontSize={TYPE.micro}>{label}</Text>
  </HStack>
);

const Card = ({ release, onOpen }) => {
  const waitingOnArt = ['needs_lyra', 'generating'].includes(release.asset_status);

  return (
    <HStack
      as="button"
      type="button"
      onClick={() => onOpen(release)}
      spacing={1.5}
      w="100%"
      px={1.5}
      py={1}
      borderRadius="8px"
      textAlign="left"
      title={release.title}
      bg={P.sheet}
      border="1px solid"
      borderColor={release.status === 'failed' ? P.coral : P.hair}
      borderLeftWidth="3px"
      borderLeftColor={voiceTint(release.voice)}
      opacity={release.status === 'released' ? 0.55 : 1}
      _hover={{
        borderColor: release.status === 'failed' ? P.coral : P.inkFaint,
        borderLeftColor: voiceTint(release.voice),
      }}
      transition={`border-color ${FAST} ${EASE}`}
    >
      <VoiceDisc voice={release.voice} size="16px" />
      <VStack align="start" spacing={0} minW={0} flex="1">
        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted} lineHeight="1.25">
          {hourLabel(release.release_at)}
        </Text>
        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.ink} lineHeight="1.25" noOfLines={1}>
          {release.channel}
        </Text>
      </VStack>
      {waitingOnArt && (
        <Text fontFamily="mono" fontSize="8px" color={P.gold} lineHeight="1">
          lyra
        </Text>
      )}
      <Box boxSize="5px" borderRadius="full" bg={STATUS_TINT[release.status] || P.inkFaint} flexShrink={0} />
    </HStack>
  );
};

const Timeline = ({ rows, onOpen }) => {
  const [windowOffset, setWindowOffset] = useState(0);

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + (windowOffset * DAYS));
    return Array.from({ length: DAYS }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [windowOffset]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dayKey(today);

  const byDay = {};
  for (const release of rows) {
    if (!release.release_at) continue;
    const date = new Date(release.release_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(release);
  }
  Object.values(byDay).forEach((list) => (
    list.sort((a, b) => new Date(a.release_at) - new Date(b.release_at))
  ));

  const weeks = [days.slice(0, 7), days.slice(7)];
  const inWindow = days.reduce((count, date) => count + (byDay[dayKey(date)] || []).length, 0);
  const startLabel = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = days[days.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={2} flexWrap="wrap" rowGap={2}>
        <Kicker>{startLabel} to {endLabel} · {inWindow}</Kicker>
        <HStack spacing={1.5}>
          <StepButton label="back" icon={TbChevronLeft} onClick={() => setWindowOffset((value) => value - 1)} />
          <StepButton label="today" icon={TbCalendarDot} onClick={() => setWindowOffset(0)} />
          <StepButton label="next" icon={TbChevronRight} onClick={() => setWindowOffset((value) => value + 1)} />
        </HStack>
      </HStack>

      <Box overflowX="auto" mx={{ base: -4, md: 0 }} px={{ base: 4, md: 0 }}>
        <VStack align="stretch" spacing={1.5} minW="784px">
          {weeks.map((week, weekIndex) => (
            <SimpleGrid key={weekIndex} columns={7} spacing={1.5}>
              {week.map((date) => {
                const key = dayKey(date);
                const isToday = key === todayKey;
                const list = byDay[key] || [];
                return (
                  <VStack
                    key={key}
                    align="stretch"
                    spacing={1}
                    p={1.5}
                    minH="106px"
                    borderRadius="12px"
                    bg={isToday ? P.sheet : P.sunken}
                    border="1px solid"
                    borderColor={isToday ? P.limeDeep : P.hairSoft}
                  >
                    <HStack justify="space-between" px={0.5}>
                      <Text
                        fontFamily="mono"
                        fontSize={TYPE.micro}
                        letterSpacing="0.1em"
                        textTransform="uppercase"
                        color={isToday ? P.limeDeep : P.inkMuted}
                      >
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                      <Text fontFamily="mono" fontSize={TYPE.micro} color={isToday ? P.ink : P.inkFaint}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </HStack>
                    {list.map((release) => (
                      <Card key={release.id} release={release} onOpen={onOpen} />
                    ))}
                  </VStack>
                );
              })}
            </SimpleGrid>
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

export default Timeline;
