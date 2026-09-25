// src/pages/Releases/components/MonthCalendar.jsx
// SENTINEL: NB_PULSE_SOCIALS_MONTH_V1
//
// The month, for the Socials desk. The same grid the Calendar page draws
// for appointments, six week rows on one cream sheet with hairline rules,
// built from the same matrix in src/pages/Calendar/calendarConstants.js so
// the two calendars never disagree on what a week is. It is not MonthGrid
// itself because that component reads appointment fields, meeting_type and
// starts_at, and a release has a channel and a release_at.
//
// A release is a pip on its day. The pip is tinted by channel, the left
// bar and the hour in the channel's accent, and carries the status as the
// small dot on the right, so a glance reads what is going where and how far
// along it is. Released pips fade. A failed pip gets a coral ring. Three
// pips per day and a quiet more line after that, the day click opens the
// rest. Click empty space in a day and the page starts a new release dated
// to it. Click a pip and the drawer opens.
//
// On a phone the grid is too dense so the month becomes a stacked agenda
// grouped by day, the way the Calendar page does it. Undated releases never
// reach here, they live on the ramp below.
//
// Lime is spent once on this sheet, the today disc. Channel tints are in
// shared.jsx and are deliberately not lime and not the voice tints.
//
// No oxford commas, no em dashes.

import { useMemo, useState } from 'react';
import { Box, VStack, HStack, Text, Icon, Divider } from '@chakra-ui/react';
import { TbChevronLeft, TbChevronRight, TbPlus, TbCalendarDot } from 'react-icons/tb';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  buildMonthMatrix,
  ymd,
  fmtDayLong,
} from '../../Calendar/calendarConstants';
import { P, STATUS_TINT, channelTint, VoiceDisc, Kicker } from './shared';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const MAX_PIPS = 3;

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

const Pip = ({ release, onOpen }) => {
  const tint = channelTint(release.channel);
  const failed = release.status === 'failed';
  return (
    <Box
      as="button"
      type="button"
      w="100%"
      textAlign="left"
      title={`${release.channel} · ${release.title}`}
      onClick={(event) => { event.stopPropagation(); onOpen(release); }}
      bg={tint.tint}
      borderLeft="2px solid"
      borderLeftColor={tint.accent}
      borderRadius="4px"
      px={1.5}
      py="3px"
      opacity={release.status === 'released' ? 0.6 : 1}
      boxShadow={failed ? `inset 0 0 0 1px ${P.coral}` : 'none'}
      transition={`all ${FAST} ${EASE}`}
      _hover={{ filter: 'brightness(0.97)', transform: 'translateX(1px)' }}
    >
      <HStack spacing={1} align="center">
        <Text fontFamily="mono" fontSize="10px" color={tint.accent} flexShrink={0} lineHeight="1.3">
          {hourLabel(release.release_at)}
        </Text>
        <Text fontSize="10px" fontWeight="600" color={P.ink} noOfLines={1} flex="1" minW={0} lineHeight="1.3">
          {release.title}
        </Text>
        <Box boxSize="5px" borderRadius="full" bg={STATUS_TINT[release.status] || P.inkFaint} flexShrink={0} />
      </HStack>
    </Box>
  );
};

const DayCell = ({ cell, list, isToday, onDay, onOpen }) => {
  const extra = list.length - MAX_PIPS;
  return (
    <Box
      role="group"
      position="relative"
      minH={{ md: '104px', xl: '116px' }}
      p={1.5}
      borderRight="1px solid"
      borderBottom="1px solid"
      borderColor={P.hairSoft}
      bg={cell.inMonth ? 'transparent' : P.sunken}
      cursor="pointer"
      transition={`background ${FAST} ${EASE}`}
      _hover={{ bg: cell.inMonth ? `${P.lime}12` : P.sunken }}
      onClick={() => onDay(cell.iso)}
    >
      <HStack justify="space-between" align="center" mb={1}>
        {isToday ? (
          <Box w="22px" h="22px" borderRadius="full" bg={P.lime} display="flex" alignItems="center" justifyContent="center">
            <Text fontFamily="display" fontSize="13px" fontWeight="700" color={P.limeInk} lineHeight="1">
              {cell.date.getDate()}
            </Text>
          </Box>
        ) : (
          <Text fontFamily="display" fontSize="15px" fontWeight="600" lineHeight="1" color={cell.inMonth ? P.inkSec : P.inkFaint} pl={0.5}>
            {cell.date.getDate()}
          </Text>
        )}
        <Icon as={TbPlus} boxSize={3} color={P.inkFaint} opacity={0} _groupHover={{ opacity: 0.7 }} transition={`opacity ${FAST} ${EASE}`} />
      </HStack>
      <VStack spacing="3px" align="stretch">
        {list.slice(0, MAX_PIPS).map((release) => (
          <Pip key={release.id} release={release} onOpen={onOpen} />
        ))}
        {extra > 0 && (
          <Text fontSize="10px" fontFamily="mono" color={P.inkMuted} pl={1} _groupHover={{ color: P.limeDeep }}>
            +{extra} more
          </Text>
        )}
      </VStack>
    </Box>
  );
};

const AgendaCard = ({ release, onOpen }) => {
  const tint = channelTint(release.channel);
  return (
    <HStack
      as="button"
      type="button"
      onClick={() => onOpen(release)}
      spacing={2.5}
      w="100%"
      px={3}
      py={2.5}
      borderRadius="12px"
      textAlign="left"
      bg={P.sheet}
      border="1px solid"
      borderColor={release.status === 'failed' ? P.coral : P.hair}
      borderLeftWidth="3px"
      borderLeftColor={tint.accent}
      opacity={release.status === 'released' ? 0.6 : 1}
      _hover={{ borderColor: release.status === 'failed' ? P.coral : P.inkFaint, borderLeftColor: tint.accent }}
      transition={`border-color ${FAST} ${EASE}`}
    >
      <VoiceDisc voice={release.voice} size="18px" />
      <VStack align="start" spacing={0} minW={0} flex="1">
        <Text fontSize={TYPE.small} fontWeight="600" color={P.ink} noOfLines={1}>{release.title}</Text>
        <HStack spacing={1.5}>
          <Text fontFamily="mono" fontSize={TYPE.micro} color={tint.accent}>{hourLabel(release.release_at)}</Text>
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted}>{release.channel}</Text>
        </HStack>
      </VStack>
      <HStack spacing={1.5} flexShrink={0}>
        <Box boxSize="6px" borderRadius="full" bg={STATUS_TINT[release.status] || P.inkFaint} />
        <Text fontFamily="mono" fontSize={TYPE.micro} color={STATUS_TINT[release.status] || P.inkFaint}>{release.status}</Text>
      </HStack>
    </HStack>
  );
};

const MonthCalendar = ({ rows, onOpen, onDay }) => {
  const now = new Date();
  const todayIso = ymd(now);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const weeks = useMemo(() => buildMonthMatrix(view.y, view.m), [view]);

  const byDay = useMemo(() => {
    const map = {};
    for (const release of rows) {
      if (!release.release_at) continue;
      const date = new Date(release.release_at);
      if (Number.isNaN(date.getTime())) continue;
      const key = ymd(date);
      (map[key] = map[key] || []).push(release);
    }
    Object.values(map).forEach((list) => (
      list.sort((a, b) => new Date(a.release_at) - new Date(b.release_at))
    ));
    return map;
  }, [rows]);

  const monthRows = useMemo(() => rows
    .filter((release) => {
      if (!release.release_at) return false;
      const date = new Date(release.release_at);
      return date.getFullYear() === view.y && date.getMonth() === view.m;
    })
    .sort((a, b) => new Date(a.release_at) - new Date(b.release_at)), [rows, view]);

  const agenda = useMemo(() => {
    const groups = [];
    let current = null;
    for (const release of monthRows) {
      const key = ymd(new Date(release.release_at));
      if (!current || current.key !== key) {
        current = { key, items: [] };
        groups.push(current);
      }
      current.items.push(release);
    }
    return groups;
  }, [monthRows]);

  const channels = useMemo(() => (
    [...new Set(monthRows.map((release) => release.channel))]
  ), [monthRows]);

  const goPrev = () => setView((value) => {
    const date = new Date(value.y, value.m - 1, 1);
    return { y: date.getFullYear(), m: date.getMonth() };
  });
  const goNext = () => setView((value) => {
    const date = new Date(value.y, value.m + 1, 1);
    return { y: date.getFullYear(), m: date.getMonth() };
  });
  const goToday = () => setView({ y: now.getFullYear(), m: now.getMonth() });

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={2} flexWrap="wrap" rowGap={2}>
        <HStack spacing={2} align="baseline">
          <Text fontFamily="display" fontSize={TYPE.title} fontWeight="600" color={P.ink} letterSpacing="-0.02em" lineHeight="1">
            {MONTH_NAMES[view.m]}
          </Text>
          <Text fontFamily="mono" fontSize={TYPE.body} color={P.inkFaint}>{view.y}</Text>
          <Kicker>· {monthRows.length}</Kicker>
        </HStack>
        <HStack spacing={1.5}>
          <StepButton label="back" icon={TbChevronLeft} onClick={goPrev} />
          <StepButton label="today" icon={TbCalendarDot} onClick={goToday} />
          <StepButton label="next" icon={TbChevronRight} onClick={goNext} />
        </HStack>
      </HStack>

      <Box display={{ base: 'none', md: 'block' }}>
        <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="20px" overflow="hidden">
          <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" bg={P.sunken} borderBottom="1px solid" borderColor={P.hair}>
            {WEEKDAY_SHORT.map((day) => (
              <Text key={day} py={2} textAlign="center" fontFamily="mono" fontSize="10px" fontWeight="600" letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>
                {day}
              </Text>
            ))}
          </Box>
          {weeks.map((week, index) => (
            <Box key={index} display="grid" gridTemplateColumns="repeat(7, 1fr)">
              {week.map((cell) => (
                <DayCell
                  key={cell.iso}
                  cell={cell}
                  list={byDay[cell.iso] || []}
                  isToday={cell.iso === todayIso}
                  onDay={onDay}
                  onOpen={onOpen}
                />
              ))}
            </Box>
          ))}
        </Box>

        {channels.length > 0 && (
          <HStack spacing={3} mt={2} px={1} flexWrap="wrap" rowGap={1}>
            {channels.map((channel) => (
              <HStack key={channel} spacing={1.5}>
                <Box w="10px" h="6px" borderRadius="2px" bg={channelTint(channel).accent} />
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted}>{channel}</Text>
              </HStack>
            ))}
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>· the dot is the status</Text>
          </HStack>
        )}
      </Box>

      <Box display={{ base: 'block', md: 'none' }}>
        {agenda.length === 0 ? (
          <Box bg={P.sheet} border="1px dashed" borderColor={P.hair} borderRadius="16px" p={5}>
            <Text fontSize={TYPE.small} color={P.inkMuted} textAlign="center">
              Nothing dated this month. Add one above with a date.
            </Text>
          </Box>
        ) : (
          <VStack spacing={4} align="stretch">
            {agenda.map((group) => (
              <Box key={group.key}>
                <HStack mb={2} spacing={2} align="center">
                  <Text fontFamily="mono" fontSize={TYPE.label} fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={group.key === todayIso ? P.limeDeep : P.inkSec}>
                    {group.key === todayIso ? 'Today' : fmtDayLong(group.items[0].release_at)}
                  </Text>
                  <Divider borderColor={P.hair} flex={1} />
                </HStack>
                <VStack spacing={2} align="stretch">
                  {group.items.map((release) => (
                    <AgendaCard key={release.id} release={release} onOpen={onOpen} />
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </Box>
  );
};

export default MonthCalendar;
