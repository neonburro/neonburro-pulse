// src/pages/Dashboard/components/ActivityStream.jsx
// The activity stream, on Paper. Last 24h by default with a 7 day toggle, hides
// system noise, groups consecutive same client events into expandable rows,
// entity names link to the client, timestamps render MST via formatSmart. Entity
// tones carry meaning and are kept, deepened for cream. The house section
// format, the two toggles sit on the kicker row. No oxford, no dashes.

import { useState, useMemo } from 'react';
import { Box, VStack, HStack, Text, Icon, Image, Tooltip, Collapse } from '@chakra-ui/react';
import { TbCreditCard, TbBuildingBank, TbWriting, TbArrowsTransferUp, TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { FaCcVisa, FaCcMastercard, FaCcAmex, FaCcDiscover, FaApplePay, FaGooglePay } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../../components/common/Avatar';
import { usePresence } from '../../../hooks/usePresence';
import { formatSmart } from '../../../lib/time';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST, INSET } from '../../../theme/layout';
import { Section, Empty, Loading } from '../../../components/common/Page';

const P = colors.paper;

const VERB_MAP = {
  client_created: 'added client', client_updated: 'updated client', client_deleted: 'removed client',
  project_created: 'created project', project_updated: 'updated project', project_deleted: 'removed project',
  invoice_created: 'drafted invoice', invoice_sent: 'sent invoice', invoice_viewed: 'opened invoice',
  invoice_paid: 'received payment', invoice_cancelled: 'cancelled invoice', invoice_deleted: 'deleted invoice',
  payment_received: 'received payment', form_submitted: 'received form', message_sent: 'replied to',
  message_received: 'message from', note_added: 'added note to', portal_activated: 'activated portal for',
  deploy_succeeded: 'deployed', deploy_failed: 'deploy failed for',
};

const SLATE = '#6C6F97';
const PURPLE = '#7A5Fc9';
const ENTITY_COLORS = {
  client_created: SLATE, client_updated: SLATE, client_deleted: P.coral,
  invoice_created: P.inkMuted, invoice_sent: SLATE, invoice_viewed: P.limeDeep,
  invoice_paid: P.green, invoice_cancelled: P.coral, invoice_deleted: P.coral,
  payment_received: P.green, form_submitted: PURPLE, message_sent: PURPLE,
  message_received: PURPLE, note_added: P.inkMuted, portal_activated: SLATE,
  deploy_succeeded: P.green, deploy_failed: P.coral,
};

const PaymentMethodIcon = ({ type, brand, wallet }) => {
  const c = P.inkMuted;
  if (wallet === 'apple_pay') return <Icon as={FaApplePay} boxSize={4} color={c} />;
  if (wallet === 'google_pay') return <Icon as={FaGooglePay} boxSize={4} color={c} />;
  if (type === 'card') {
    if (brand === 'visa') return <Icon as={FaCcVisa} boxSize={3.5} color={c} />;
    if (brand === 'mastercard') return <Icon as={FaCcMastercard} boxSize={3.5} color={c} />;
    if (brand === 'amex') return <Icon as={FaCcAmex} boxSize={3.5} color={c} />;
    if (brand === 'discover') return <Icon as={FaCcDiscover} boxSize={3.5} color={c} />;
    return <Icon as={TbCreditCard} boxSize={3} color={c} />;
  }
  if (type === 'us_bank_account' || type === 'ach') return <Icon as={TbBuildingBank} boxSize={3} color={c} />;
  if (type === 'check') return <Icon as={TbWriting} boxSize={3} color={c} />;
  if (type === 'wire') return <Icon as={TbArrowsTransferUp} boxSize={3} color={c} />;
  return null;
};

const pmLabel = ({ type, brand, last4, wallet }) => {
  if (wallet === 'apple_pay') return 'Apple Pay';
  if (wallet === 'google_pay') return 'Google Pay';
  if (type === 'card' && brand && last4) return `${brand.charAt(0).toUpperCase() + brand.slice(1)} ··${last4}`;
  if (type === 'us_bank_account' || type === 'ach') return 'Bank transfer';
  if (type === 'check') return 'Check';
  if (type === 'wire') return 'Wire transfer';
  return null;
};

const Toggle = ({ on, onClick, children }) => (
  <Box as="button" type="button" onClick={onClick} color={on ? P.ink : P.inkMuted} _hover={{ color: P.ink }} fontFamily="mono" fontSize={TYPE.kicker} letterSpacing="0.14em" textTransform="uppercase" transition={`color ${FAST} ${EASE}`}>
    {children}
  </Box>
);

const ActivityItem = ({ activity, profileMap }) => {
  const navigate = useNavigate();
  const verb = VERB_MAP[activity.action] || activity.action?.replace(/_/g, ' ');
  const entityColor = ENTITY_COLORS[activity.action] || P.inkMuted;
  const profile = activity.user_id ? profileMap[activity.user_id] : null;
  const { getStatus } = usePresence();
  const status = activity.user_id ? getStatus(activity.user_id) : null;
  const isSystem = !activity.user_id;
  const displayName = isSystem ? 'Neon Burro' : (profile?.display_name || 'Unknown');
  const entityName = activity.metadata?.client_name || activity.metadata?.project_name || activity.metadata?.invoice_number || activity.metadata?.sender_name || activity.metadata?.site_name || activity.metadata?.form_type || '';
  const amount = activity.metadata?.total ?? activity.metadata?.amount ?? activity.metadata?.due_now;
  const amountDisplay = amount ? `$${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null;
  const pmType = activity.metadata?.payment_method_type;
  const pmBrand = activity.metadata?.payment_method_brand;
  const pmLast4 = activity.metadata?.payment_method_last4;
  const pmWallet = activity.metadata?.payment_method_wallet;
  const showPaymentMethod = (activity.action === 'invoice_paid' || activity.action === 'payment_received') && pmType;
  const isPayment = activity.action === 'invoice_paid' || activity.action === 'payment_received';

  const handleEntityClick = (e) => { e.stopPropagation(); if (activity.client_id) navigate(`/clients/${activity.client_id}/`); };

  return (
    <HStack spacing={3} py={2.5} px={INSET} align="center" role="group" borderBottom="1px solid" borderColor={P.hairSoft} transition={`all ${FAST} ${EASE}`} _hover={{ bg: P.sheet }}>
      {isSystem ? (
        <Box w="32px" h="32px" borderRadius="full" bg={P.sheet} border="1px solid" borderColor={P.hair} display="flex" alignItems="center" justifyContent="center" flexShrink={0} overflow="hidden">
          <Image src="/neon-burro-email-logo.png" alt="Neon Burro" w="22px" h="22px" borderRadius="full" />
        </Box>
      ) : (
        <Avatar name={displayName} url={profile?.avatar_url} size="sm" presence={status} />
      )}

      <Box flex={1} minW={0}>
        <HStack spacing={1.5} flexWrap="wrap" align="baseline">
          <Text color={P.ink} fontSize={TYPE.body} fontWeight="700">{displayName}</Text>
          <Text color={P.inkMuted} fontSize={TYPE.body}>{verb}</Text>
          {entityName && (
            <Text color={entityColor} fontSize={TYPE.body} fontWeight="700" fontFamily="mono" cursor={activity.client_id ? 'pointer' : 'default'} onClick={handleEntityClick} _hover={activity.client_id ? { textDecoration: 'underline', textDecorationColor: entityColor } : {}}>{entityName}</Text>
          )}
          {amountDisplay && <Text color={isPayment ? P.green : P.gold} fontSize={TYPE.body} fontWeight="700" fontFamily="mono">{amountDisplay}</Text>}
          {showPaymentMethod && (
            <Tooltip label={pmLabel({ type: pmType, brand: pmBrand, last4: pmLast4, wallet: pmWallet })} placement="top" hasArrow bg={P.ink} color={P.sheet} fontSize={TYPE.small}>
              <HStack spacing={1}>
                <PaymentMethodIcon type={pmType} brand={pmBrand} wallet={pmWallet} />
                {pmLast4 && <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">··{pmLast4}</Text>}
              </HStack>
            </Tooltip>
          )}
        </HStack>
        <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" mt={0.5}>{formatSmart(activity.created_at)}</Text>
      </Box>
    </HStack>
  );
};

const ClientGroup = ({ clientId, clientName, events, profileMap }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (events.length === 1) return <ActivityItem activity={events[0]} profileMap={profileMap} />;
  const latestEvent = events[0];

  return (
    <Box borderBottom="1px solid" borderColor={P.hairSoft}>
      <HStack spacing={3} py={2.5} px={INSET} cursor="pointer" onClick={() => setExpanded(!expanded)} transition={`all ${FAST} ${EASE}`} _hover={{ bg: P.sheet }}>
        <Icon as={expanded ? TbChevronDown : TbChevronRight} boxSize={3} color={P.inkMuted} flexShrink={0} />
        <Box flex={1} minW={0}>
          <HStack spacing={1.5}>
            <Text color={P.limeDeep} fontSize={TYPE.body} fontWeight="700" fontFamily="mono" _hover={{ textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); navigate(`/clients/${clientId}/`); }}>{clientName}</Text>
            <Text color={P.inkMuted} fontSize={TYPE.body}>{events.length} events</Text>
          </HStack>
          <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" mt={0.5}>latest {formatSmart(latestEvent.created_at)}</Text>
        </Box>
      </HStack>
      <Collapse in={expanded} animateOpacity>
        <Box pl={6} borderLeft="1px solid" borderColor={P.hairSoft} ml={4}>
          {events.map((event) => <ActivityItem key={event.id} activity={event} profileMap={profileMap} />)}
        </Box>
      </Collapse>
    </Box>
  );
};

const ActivityStream = ({ activities, profileMap = {}, loading }) => {
  const [range, setRange] = useState('24h');
  const [showSystem, setShowSystem] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = range === '24h' ? now - 24 * 60 * 60 * 1000 : now - 7 * 24 * 60 * 60 * 1000;
    return (activities || []).filter((a) => {
      if (new Date(a.created_at).getTime() < cutoff) return false;
      if (!showSystem && a.category === 'system') return false;
      return true;
    });
  }, [activities, range, showSystem]);

  const grouped = useMemo(() => {
    const result = [];
    let currentGroup = null;
    filtered.forEach((activity) => {
      const clientId = activity.client_id;
      const clientName = activity.metadata?.client_name || activity.metadata?.sender_name || null;
      if (clientId && currentGroup && currentGroup.clientId === clientId) {
        currentGroup.events.push(activity);
      } else {
        if (currentGroup) result.push(currentGroup);
        currentGroup = { clientId, clientName: clientName || 'Unknown', events: [activity] };
      }
    });
    if (currentGroup) result.push(currentGroup);
    return result;
  }, [filtered]);

  return (
    <Section
      kicker="Activity stream"
      action={(
        <HStack spacing={4}>
          <Toggle on onClick={() => setRange(range === '24h' ? '7d' : '24h')}>{range === '24h' ? 'Last 24h' : 'Last 7 days'}</Toggle>
          <Toggle on={showSystem} onClick={() => setShowSystem(!showSystem)}>{showSystem ? 'Hide system' : 'Show system'}</Toggle>
        </HStack>
      )}
    >
      {loading ? (
        <Loading label="loading the stream" />
      ) : filtered.length === 0 ? (
        <Empty
          action={range === '24h' ? <Toggle on onClick={() => setRange('7d')}>Show last 7 days</Toggle> : undefined}
        >
          No signals in the {range === '24h' ? 'last 24 hours' : 'last 7 days'}.
        </Empty>
      ) : (
        <Box borderTop="1px solid" borderColor={P.hair} mx={-INSET}>
          {grouped.map((group, idx) => <ClientGroup key={`${group.clientId || 'none'}-${idx}`} clientId={group.clientId} clientName={group.clientName} events={group.events} profileMap={profileMap} />)}
        </Box>
      )}
    </Section>
  );
};

export default ActivityStream;
