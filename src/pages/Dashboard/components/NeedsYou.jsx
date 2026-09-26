// src/pages/Dashboard/components/NeedsYou.jsx
// SENTINEL: NB_PULSE_NEEDS_YOU_V3
// The queue, on Paper. A list of things waiting on a hueman, sorted by the cost
// of ignoring them. Rows only appear when they are non zero, so the presence of
// the list is itself the signal. The empty state is the house one line, not
// an apology. Tones carry meaning and are kept, deepened for cream. Rows bleed
// the inset so the text sits on the column edge under the kicker. No oxford,
// no dashes.

import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { TbAlertTriangle, TbClockDollar, TbInbox, TbMessageCircle, TbProgressCheck, TbArrowRight } from 'react-icons/tb';
import { TYPE, EASE, FAST, INSET } from '../../../theme/layout';
import { formatCurrency } from '../../../lib/uiConstants';
import colors from '../../../theme/colors';
import { Section, Empty } from '../../../components/common/Page';

const P = colors.paper;

const build = ({ overdueCount, overdueTotal, unreadForms, unreadMessages, awaitingPayment, awaitingTotal, openSprints }) => [
  overdueCount > 0 && { key: 'overdue', icon: TbAlertTriangle, tone: P.coral, count: overdueCount, label: overdueCount === 1 ? 'invoice overdue' : 'invoices overdue', detail: `${formatCurrency(overdueTotal)} past its date`, to: '/invoicing/' },
  unreadMessages > 0 && { key: 'messages', icon: TbMessageCircle, tone: '#7A5Fc9', count: unreadMessages, label: unreadMessages === 1 ? 'message unread' : 'messages unread', detail: 'A client is waiting on a reply', to: '/messages/' },
  unreadForms > 0 && { key: 'forms', icon: TbInbox, tone: P.limeDeep, count: unreadForms, label: unreadForms === 1 ? 'form unread' : 'forms unread', detail: 'Came in through the site', to: '/forms/' },
  awaitingPayment > 0 && { key: 'awaiting', icon: TbClockDollar, tone: P.gold, count: awaitingPayment, label: awaitingPayment === 1 ? 'invoice out' : 'invoices out', detail: `${formatCurrency(awaitingTotal)} sent and not yet paid`, to: '/invoicing/' },
  openSprints > 0 && { key: 'sprints', icon: TbProgressCheck, tone: P.inkMuted, count: openSprints, label: openSprints === 1 ? 'sprint open' : 'sprints open', detail: 'Billable and not yet locked', to: '/invoicing/' },
].filter(Boolean);

const Row = ({ item, onClick }) => (
  <HStack as="button" type="button" onClick={onClick} w="100%" spacing={{ base: 3.5, md: 5 }} align="center" textAlign="left" py={4} px={INSET} borderRadius="14px" role="group" transition={`background ${FAST} ${EASE}, transform ${FAST} ${EASE}`} _hover={{ bg: P.sheet }} _active={{ transform: 'scale(0.995)' }}>
    <Box w="36px" h="36px" borderRadius="11px" bg={P.sheet} border="1px solid" borderColor={P.hair} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
      <Icon as={item.icon} boxSize="17px" color={item.tone} />
    </Box>
    <HStack spacing={2.5} align="baseline" flex={1} minW={0} flexWrap="wrap" rowGap={0}>
      <Text fontFamily="mono" fontSize={TYPE.figure} fontWeight="600" lineHeight="1" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{item.count}</Text>
      <Text fontSize={TYPE.body} fontWeight="500" color={P.ink} letterSpacing="-0.01em">{item.label}</Text>
      <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>{item.detail}</Text>
    </HStack>
    <Icon as={TbArrowRight} boxSize="15px" color={P.inkFaint} flexShrink={0} transition={`transform ${FAST} ${EASE}, color ${FAST} ${EASE}`} _groupHover={{ color: P.limeDeep, transform: 'translateX(3px)' }} />
  </HStack>
);

const NeedsYou = (props) => {
  const navigate = useNavigate();
  const items = build(props);

  return (
    <Section kicker="Needs you" count={items.length || undefined}>
      {!items.length ? (
        <Empty hint="Everything sent, read and locked. Go outside.">Nothing is waiting on you.</Empty>
      ) : (
        <VStack align="stretch" spacing={0.5} mx={-INSET}>
          {items.map((item) => <Row key={item.key} item={item} onClick={() => navigate(item.to)} />)}
        </VStack>
      )}
    </Section>
  );
};

export default NeedsYou;
