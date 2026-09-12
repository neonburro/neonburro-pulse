// src/pages/Releases/components/Timeline.jsx
// SENTINEL: NB_PULSE_RELEASES_TIMELINE_V1
//
// The next fourteen days as columns, two rows of seven so a fortnight fits
// the 880px sheet without a scrollbar on a desktop. On a phone the week row
// keeps its 784px and scrolls sideways inside its own box, the page never
// scrolls sideways. Each release lands in its day as a small card, sorted by
// its hour, coloured by its voice: the disc carries one letter of the burro
// and the card's left rule carries the same tint. The channel label and the
// hour are the only words. The dot at the right is the status tint, so a
// failed post reads coral from across the room and a released one dims.
//
// Undated rows and rows outside the window are not drawn here, the shelves
// below the timeline are the full ledger. Clicking a card opens the editor.
//
// No oxford commas, no em dashes.

import { Box, VStack, HStack, Text, SimpleGrid } from '@chakra-ui/react';
import { P, STATUS_TINT, VoiceDisc, voiceTint, dayKey, Kicker } from './shared';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const DAYS = 14;

const hourLabel = (iso) => new Date(iso)
  .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  .toLowerCase()
  .replace(' ', '');

const Card = ({ r, onOpen }) => (
  <HStack as="button" type="button" onClick={() => onOpen(r)} spacing={1.5} w="100%"
    px={1.5} py={1} borderRadius="8px" textAlign="left" title={r.title}
    bg={P.sheet} border="1px solid" borderColor={r.status === 'failed' ? P.coral : P.hair}
    borderLeftWidth="3px" borderLeftColor={voiceTint(r.voice)}
    opacity={r.status === 'released' ? 0.55 : 1}
    _hover={{ borderColor: r.status === 'failed' ? P.coral : P.inkFaint, borderLeftColor: voiceTint(r.voice) }}
    transition={`border-color ${FAST} ${EASE}`}>
    <VoiceDisc voice={r.voice} size="16px" />
    <VStack align="start" spacing={0} minW={0} flex="1">
      <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted} lineHeight="1.25">{hourLabel(r.release_at)}</Text>
      <Text fontFamily="mono" fontSize={TYPE.micro} color={P.ink} lineHeight="1.25" noOfLines={1}>{r.channel}</Text>
    </VStack>
    <Box boxSize="5px" borderRadius="full" bg={STATUS_TINT[r.status] || P.inkFaint} flexShrink={0} />
  </HStack>
);

const Timeline = ({ rows, onOpen }) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const todayKey = dayKey(start);

  const byDay = {};
  for (const r of rows) {
    if (!r.release_at) continue;
    const d = new Date(r.release_at);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(r);
  }
  Object.values(byDay).forEach((list) => list.sort((a, b) => new Date(a.release_at) - new Date(b.release_at)));

  const weeks = [days.slice(0, 7), days.slice(7)];
  const inWindow = days.reduce((n, d) => n + (byDay[dayKey(d)] || []).length, 0);

  return (
    <Box>
      <Kicker mb={2}>the next fourteen days · {inWindow}</Kicker>
      <Box overflowX="auto" mx={{ base: -4, md: 0 }} px={{ base: 4, md: 0 }}>
        <VStack align="stretch" spacing={1.5} minW="784px">
          {weeks.map((week, wi) => (
            <SimpleGrid key={wi} columns={7} spacing={1.5}>
              {week.map((d) => {
                const k = dayKey(d);
                const today = k === todayKey;
                const list = byDay[k] || [];
                return (
                  <VStack key={k} align="stretch" spacing={1} p={1.5} minH="96px" borderRadius="12px"
                    bg={today ? P.sheet : P.sunken} border="1px solid" borderColor={today ? P.limeDeep : P.hairSoft}>
                    <HStack justify="space-between" px={0.5}>
                      <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.1em" textTransform="uppercase"
                        color={today ? P.limeDeep : P.inkMuted}>
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                      <Text fontFamily="mono" fontSize={TYPE.micro} color={today ? P.ink : P.inkFaint}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </HStack>
                    {list.map((r) => <Card key={r.id} r={r} onOpen={onOpen} />)}
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
