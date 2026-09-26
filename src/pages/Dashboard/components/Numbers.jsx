// src/pages/Dashboard/components/Numbers.jsx
// SENTINEL: NB_PULSE_NUMBERS_V3
// The state of the business as four figures, on Paper. Tabular numerals
// everywhere. Two up on a phone, four across from md. A status, not an
// instruction, so it sits under the queue. The figures bleed the inset to
// the left so the first figure sits on the column edge under the kicker and
// the hover plate reaches past it. No oxford commas, no dashes.

import { SimpleGrid, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { TbArrowUpRight } from 'react-icons/tb';
import { TYPE, EASE, FAST, INSET } from '../../../theme/layout';
import { formatCurrency } from '../../../lib/uiConstants';
import colors from '../../../theme/colors';
import { Section } from '../../../components/common/Page';

const P = colors.paper;

const Figure = ({ value, label, sub, tone, to, onNavigate }) => {
  const interactive = Boolean(to);
  return (
    <VStack as={interactive ? 'button' : 'div'} onClick={interactive ? onNavigate : undefined} align="start" spacing={1.5} textAlign="left" py={4} px={INSET} borderRadius="14px" role="group" cursor={interactive ? 'pointer' : 'default'} transition={`background ${FAST} ${EASE}`} _hover={interactive ? { bg: P.sheet } : undefined}>
      <HStack spacing={1.5} align="center">
        <Text fontFamily="mono" fontSize={TYPE.figure} fontWeight="600" lineHeight="1" letterSpacing="-0.02em" color={tone || P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
        {interactive && <Icon as={TbArrowUpRight} boxSize="13px" color={P.inkFaint} transition={`color ${FAST} ${EASE}`} _groupHover={{ color: P.limeDeep }} />}
      </HStack>
      <Text fontFamily="mono" fontSize={TYPE.kicker} fontWeight="500" letterSpacing="0.18em" textTransform="uppercase" color={P.inkMuted}>{label}</Text>
      {sub && <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>{sub}</Text>}
    </VStack>
  );
};

const Numbers = ({ outstanding, collected, activeClients, totalClients, openSprints }) => {
  const navigate = useNavigate();
  return (
    <Section kicker="Where things stand">
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: 1, md: 2 }} mx={-INSET}>
        <Figure value={formatCurrency(outstanding)} label="Outstanding" sub={outstanding > 0 ? 'Sent and not yet paid' : 'Nothing out'} tone={outstanding > 0 ? P.gold : P.ink} to="/invoicing/" onNavigate={() => navigate('/invoicing/')} />
        <Figure value={formatCurrency(collected)} label="Collected" sub="Cleared, all time" tone={P.limeDeep} />
        <Figure value={activeClients} label="Active clients" sub={totalClients > activeClients ? `${totalClients} on the books` : 'All of them'} to="/clients/" onNavigate={() => navigate('/clients/')} />
        <Figure value={openSprints} label="Open sprints" sub={openSprints > 0 ? 'Billable, not locked' : 'All locked'} to="/invoicing/" onNavigate={() => navigate('/invoicing/')} />
      </SimpleGrid>
    </Section>
  );
};

export default Numbers;
