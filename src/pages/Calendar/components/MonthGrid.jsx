// src/pages/Calendar/components/MonthGrid.jsx
// The month, desktop only. A single cream sheet with hairline rules, six week
// rows so the height never jumps as you page through the year. A day shows its
// number (faint when it spills out of the month, a lime disc when it is today)
// and up to three type coloured chips. Click empty space in a cell to open a
// new appointment on that day, click a chip to open that one. More than three
// and a quiet "+N more" opens the day. Cancelled ones never reach here, the
// page filters them. Type on the house scale. No oxford commas, no dashes.

import { Box, Text, VStack, HStack, Icon } from '@chakra-ui/react';
import { TbPlus } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, PLATE_RADIUS, EASE, FAST } from '../../../theme/layout';
import { WEEKDAY_SHORT, typeOf, fmtTime } from '../calendarConstants';

const P = colors.paper;
const MAX_CHIPS = 3;

const Chip = ({ appt, onClick }) => {
  const t = typeOf(appt.meeting_type);
  return (
    <Box
      as="button" type="button" w="100%" textAlign="left"
      onClick={(e) => { e.stopPropagation(); onClick(appt); }}
      bg={t.tint} borderLeft="2px solid" borderLeftColor={t.accent} borderRadius="4px"
      px={1.5} py="3px" transition={`all ${FAST} ${EASE}`} _hover={{ filter: 'brightness(0.97)', transform: 'translateX(1px)' }}
    >
      <Text fontSize={TYPE.label} fontWeight="700" color={t.accent} noOfLines={1} lineHeight="1.3">
        <Text as="span" fontFamily="mono" color={t.accent} opacity={0.9}>{fmtTime(appt.starts_at)}</Text>
        {'  '}<Text as="span" color={P.ink} fontWeight="600">{appt.title}</Text>
      </Text>
    </Box>
  );
};

const DayCell = ({ cell, appts, isToday, onDayClick, onApptClick }) => {
  const extra = appts.length - MAX_CHIPS;
  return (
    <Box
      role="group" position="relative" minH={{ md: '104px', xl: '116px' }} p={1.5}
      borderRight="1px solid" borderBottom="1px solid" borderColor={P.hairSoft}
      bg={cell.inMonth ? 'transparent' : P.sunken} cursor="pointer"
      transition={`background ${FAST} ${EASE}`} _hover={{ bg: cell.inMonth ? `${P.lime}12` : P.sunken }}
      onClick={() => onDayClick(cell.iso)}
    >
      <HStack justify="space-between" align="center" mb={1}>
        {isToday ? (
          <Box w="22px" h="22px" borderRadius="full" bg={P.lime} display="flex" alignItems="center" justifyContent="center">
            <Text fontFamily="display" fontSize={TYPE.small} fontWeight="700" color={P.limeInk} lineHeight="1">{cell.date.getDate()}</Text>
          </Box>
        ) : (
          <Text fontFamily="display" fontSize={TYPE.body} fontWeight="600" lineHeight="1" color={cell.inMonth ? P.inkSec : P.inkFaint} pl={0.5}>
            {cell.date.getDate()}
          </Text>
        )}
        <Icon as={TbPlus} boxSize={3} color={P.inkFaint} opacity={0} _groupHover={{ opacity: 0.7 }} transition={`opacity ${FAST} ${EASE}`} />
      </HStack>
      <VStack spacing="3px" align="stretch">
        {appts.slice(0, MAX_CHIPS).map((a) => <Chip key={a.id} appt={a} onClick={onApptClick} />)}
        {extra > 0 && (
          <Text fontSize={TYPE.label} fontFamily="mono" color={P.inkMuted} pl={1} _groupHover={{ color: P.limeDeep }}>
            +{extra} more
          </Text>
        )}
      </VStack>
    </Box>
  );
};

const MonthGrid = ({ weeks, apptsByDay, todayIso, onDayClick, onApptClick }) => (
  <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius={PLATE_RADIUS} overflow="hidden">
    <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" bg={P.sunken} borderBottom="1px solid" borderColor={P.hair}>
      {WEEKDAY_SHORT.map((d) => (
        <Text key={d} py={2} pl={2} fontFamily="mono" fontSize={TYPE.kicker} fontWeight="500" letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>
          {d}
        </Text>
      ))}
    </Box>
    {weeks.map((week, wi) => (
      <Box key={wi} display="grid" gridTemplateColumns="repeat(7, 1fr)">
        {week.map((cell) => (
          <DayCell
            key={cell.iso}
            cell={cell}
            appts={apptsByDay[cell.iso] || []}
            isToday={cell.iso === todayIso}
            onDayClick={onDayClick}
            onApptClick={onApptClick}
          />
        ))}
      </Box>
    ))}
  </Box>
);

export default MonthGrid;
