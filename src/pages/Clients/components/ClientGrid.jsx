// src/pages/Clients/components/ClientGrid.jsx
// SENTINEL: NB_PULSE_CLIENT_GRID_V4
//
// One row per client, on Paper. Press it to open them. Built mobile first: the
// money line and the sprint count ride along at every width, not hidden behind a
// desktop breakpoint. The subscription pip is a small repeat glyph coloured by
// health so a past due plan is visible from the list. The edit control is always
// visible at low contrast, because a control at opacity 0 does not exist on a
// phone. Rows bleed the inset so the name sits on the column edge. The empty
// state is the house line. No oxford commas, no dashes.

import {
  Box, VStack, HStack, Text, Icon, Button, Tooltip,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { TbBolt, TbEdit, TbRepeat, TbChevronRight } from 'react-icons/tb';
import { timeAgo } from '../../../utils/phone';
import { subscriptionHealth, cadenceLabel, renewalLabel } from '../../../lib/billing';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST, INSET } from '../../../theme/layout';
import Avatar from '../../../components/common/Avatar';
import { Empty, Loading } from '../../../components/common/Page';

const P = colors.paper;

const STATUS_DOT = { active: P.green, lead: P.gold, inactive: P.inkFaint };

const TAG_COLORS = {
  local: '#6E7A30', recurring: '#5E7A1E', vip: '#9A7B00', lab: '#7A5Fc9',
  hosting: '#6C6F97', web3: '#B23A80', subscription: '#C2402F',
};

const HEALTH_PAPER = { active: P.limeDeep, past_due: P.coral, paused: P.gold, pending: P.gold, none: P.inkFaint };

const money = (v) => {
  const n = parseFloat(v || 0);
  if (!n) return '$0';
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

const ClientRow = ({ client, onEdit }) => {
  const navigate = useNavigate();
  const status = STATUS_DOT[client.status] || STATUS_DOT.active;
  const tags = client.tags || [];
  const sub = client.subscription || null;
  const health = subscriptionHealth(sub);

  return (
    <HStack
      as="button"
      type="button"
      onClick={() => navigate(`/clients/${client.id}/`)}
      w="100%"
      align="center"
      spacing={{ base: 3, md: 4 }}
      textAlign="left"
      py={{ base: 3.5, md: 4 }}
      px={INSET}
      borderBottom="1px solid"
      borderColor={P.hairSoft}
      borderLeft="2px solid"
      borderLeftColor="transparent"
      role="group"
      transition={`all ${FAST} ${EASE}`}
      _hover={{ bg: P.sheet, borderLeftColor: status }}
      _active={{ bg: P.sunken }}
    >
      <Box w="6px" h="6px" borderRadius="full" bg={status} flexShrink={0} />

      <Avatar name={client.name} url={client.avatar_url} size="sm" border={false} />

      <VStack align="start" spacing={0.5} flex={1} minW={0}>
        <HStack spacing={2} minW={0} w="100%">
          <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} letterSpacing="-0.01em" noOfLines={1}>
            {client.name}
          </Text>

          {health !== 'none' && (
            <Tooltip label={`${cadenceLabel(sub)} · ${renewalLabel(sub)}`} placement="top" hasArrow bg={P.ink} color={P.sheet} fontSize={TYPE.small} openDelay={300}>
              <HStack spacing={1} flexShrink={0}>
                <Icon as={TbRepeat} boxSize="11px" color={HEALTH_PAPER[health] || P.inkFaint} />
              </HStack>
            </Tooltip>
          )}

          {tags.length > 0 && (
            <HStack spacing={1} flexShrink={0} display={{ base: 'none', sm: 'flex' }}>
              {tags.slice(0, 3).map((t) => (
                <Box key={t} w="5px" h="5px" borderRadius="full" bg={TAG_COLORS[t] || P.inkFaint} />
              ))}
            </HStack>
          )}
        </HStack>

        <HStack spacing={2} fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted} minW={0}>
          <Text color={client.total_funded > 0 ? P.inkSec : P.inkFaint} fontWeight="500" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(client.total_funded)}
          </Text>
          <Text color={P.inkFaint}>·</Text>
          <HStack spacing={1}>
            <Icon as={TbBolt} boxSize="10px" />
            <Text sx={{ fontVariantNumeric: 'tabular-nums' }}>{client.sprint_count || 0}</Text>
          </HStack>
          {client.company && (
            <>
              <Text color={P.inkFaint} display={{ base: 'none', sm: 'block' }}>·</Text>
              <Text noOfLines={1} display={{ base: 'none', sm: 'block' }}>{client.company}</Text>
            </>
          )}
        </HStack>
      </VStack>

      <Text display={{ base: 'none', lg: 'block' }} fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} minW="58px" textAlign="right" flexShrink={0}>
        {timeAgo(client.last_activity_at || client.created_at)}
      </Text>

      <Box as="span" role="button" tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onEdit(client); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit(client); } }}
        p={1.5} borderRadius="8px" color={P.inkFaint} flexShrink={0}
        transition={`all ${FAST} ${EASE}`}
        _hover={{ color: P.limeDeep, bg: P.sunken }}
        aria-label={`Edit ${client.name}`}>
        <Icon as={TbEdit} boxSize="15px" />
      </Box>

      <Icon as={TbChevronRight} boxSize="14px" color={P.inkFaint} flexShrink={0} display={{ base: 'block', md: 'none' }} />
    </HStack>
  );
};

const ClientGrid = ({ clients, loading, onEdit, onAdd, isEmpty }) => {
  if (loading) return <Loading label="loading clients" />;

  if (!clients.length) {
    return (
      <Empty
        hint={isEmpty ? 'Add the first one to the herd.' : 'Try a different search or filter.'}
        action={isEmpty ? <Button size="sm" onClick={onAdd}>Add your first client</Button> : undefined}
      >
        {isEmpty ? 'No clients yet.' : 'No matches.'}
      </Empty>
    );
  }

  return (
    <Box borderTop="1px solid" borderColor={P.hair} mx={-INSET}>
      {clients.map((c) => <ClientRow key={c.id} client={c} onEdit={onEdit} />)}
    </Box>
  );
};

export default ClientGrid;
