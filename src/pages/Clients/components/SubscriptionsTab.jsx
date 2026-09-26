// src/pages/Clients/components/SubscriptionsTab.jsx
// SENTINEL: NB_PULSE_SUBS_TAB_V3
//
// Every recurring arrangement this client is on, and what happens next on each,
// on Paper. The column that matters is not the amount, it is what happens on the
// renewal date, and it differs per rail: a card charges itself, a stablecoin
// subscription raises an invoice that then sits until a hueman chases it. So each
// row carries its rail as a word and a push rail past its date gets an explicit
// Raise the invoice action rather than a red dot. Rail tones keep their meaning.
// House section, house empty line. No oxford commas, no dashes.

import { useState, useEffect, useCallback } from 'react';
import { Box, VStack, HStack, Text, Icon, Button, useDisclosure, useToast } from '@chakra-ui/react';
import { TbPlus, TbCreditCard, TbCoins, TbAlertTriangle, TbEdit, TbBolt } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { RAILS, railOf, renewalAction, cadenceLabel, renewalLabel, subscriptionHealth, HEALTH_TONE, daysToRenewal } from '../../../lib/billing';
import { formatCurrency } from '../../../lib/uiConstants';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import colors from '../../../theme/colors';
import { Section, Empty, Loading } from '../../../components/common/Page';
import SubscriptionModal from './SubscriptionModal';

const P = colors.paper;

const STATUS_LABEL = {
  draft: 'Draft', pending: 'Awaiting first payment', active: 'Active',
  past_due: 'Past due', paused: 'Paused', cancelled: 'Cancelled',
};

const Row = ({ sub, onEdit, onRaise, raising }) => {
  const rail = railOf(sub);
  const action = renewalAction(sub);
  const health = subscriptionHealth(sub);
  const days = daysToRenewal(sub);
  const needsRaising = !rail.canAutoCharge && days !== null && days <= 0 && ['active', 'past_due'].includes(sub.status);

  return (
    <VStack align="stretch" spacing={0} borderBottom="1px solid" borderColor={P.hairSoft}>
      <HStack align="flex-start" spacing={{ base: 3, md: 4 }} py={{ base: 4, md: 5 }}>
        <Box w="34px" h="34px" borderRadius="10px" bg={P.sunken} flexShrink={0} display="flex" alignItems="center" justifyContent="center">
          <Icon as={rail.id === 'card' ? TbCreditCard : TbCoins} boxSize="16px" color={rail.tone} />
        </Box>

        <VStack align="start" spacing={1.5} flex={1} minW={0}>
          <HStack spacing={2.5} flexWrap="wrap" rowGap={1}>
            <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} letterSpacing="-0.01em">{sub.name}</Text>
            <Box w="5px" h="5px" borderRadius="full" bg={HEALTH_TONE[health]} />
            <Text fontFamily="mono" fontSize={TYPE.kicker} letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>{STATUS_LABEL[sub.status] || sub.status}</Text>
          </HStack>

          <HStack spacing={2} fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted} flexWrap="wrap" rowGap={1}>
            <Text color={P.ink} fontWeight="600" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sub.amount)}</Text>
            <Text color={P.inkFaint}>·</Text>
            <Text>{cadenceLabel(sub)}</Text>
            <Text color={P.inkFaint}>·</Text>
            <Text color={health === 'late' ? P.coral : P.inkMuted}>{renewalLabel(sub)}</Text>
            <Text color={P.inkFaint}>·</Text>
            <Text color={rail.tone}>{rail.label}</Text>
          </HStack>

          <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
            On the renewal date it {action.verb} {action.happens}.{' '}
            <Box as="span" color={rail.canAutoCharge ? P.inkMuted : P.inkSec}>{action.ifNothing}</Box>
          </Text>

          {sub.subscription_number && <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{sub.subscription_number}</Text>}
        </VStack>

        <Box as="button" type="button" onClick={() => onEdit(sub)} p={1.5} borderRadius="8px" color={P.inkFaint} flexShrink={0} transition={`all ${FAST} ${EASE}`} _hover={{ color: P.limeDeep, bg: P.sunken }} aria-label="Edit subscription">
          <Icon as={TbEdit} boxSize="15px" />
        </Box>
      </HStack>

      {needsRaising && (
        <HStack spacing={3} pb={4} align="center" flexWrap="wrap" rowGap={2}>
          <Icon as={TbAlertTriangle} boxSize="14px" color={P.coral} />
          <Text fontSize={TYPE.small} color={P.inkSec} flex={1} minW="200px">This one bills on a push rail and its period has closed. Nothing has been sent.</Text>
          <Button size="xs" isLoading={raising === sub.id} leftIcon={<Icon as={TbBolt} boxSize="12px" />} onClick={() => onRaise(sub)}>Raise the invoice</Button>
        </HStack>
      )}
    </VStack>
  );
};

const SubscriptionsTab = ({ clientId, clientName }) => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [raising, setRaising] = useState(null);
  const [missing, setMissing] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('subscriptions').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (error) { setMissing(true); setSubs([]); }
    else { setMissing(false); setSubs(data || []); }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => { setEditing(null); onOpen(); };
  const openEdit = (sub) => { setEditing(sub); onOpen(); };

  const raise = async (sub) => {
    setRaising(sub.id);
    try {
      const start = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
      const end = new Date(start);
      if (sub.interval === 'year') end.setFullYear(end.getFullYear() + (sub.interval_count || 1));
      else end.setMonth(end.getMonth() + (sub.interval_count || 1));

      const { error } = await supabase.from('invoices').insert({
        client_id: clientId, subscription_id: sub.id, source: 'subscription', status: 'draft',
        total: sub.amount, total_paid: 0, period_start: start.toISOString(), period_end: end.toISOString(), rail_offered: [sub.rail],
      });
      if (error) throw error;

      await supabase.from('subscriptions').update({ current_period_start: start.toISOString(), current_period_end: end.toISOString() }).eq('id', sub.id);
      toast({ title: 'Invoice drafted', description: 'It is in Invoicing, unsent.', status: 'success', duration: 4000 });
      fetch();
    } catch (err) {
      toast({ title: 'Could not raise it', description: err.message, status: 'error', duration: 6000 });
    } finally {
      setRaising(null);
    }
  };

  if (loading) return <Loading label="loading subscriptions" />;

  if (missing) {
    return (
      <Empty hint="Run supabase/migrations/2026080601_subscriptions.sql and then 2026081001_billing_rails.sql in the SQL editor. Both are additive and safe to run twice.">
        The subscriptions table is not in this project yet.
      </Empty>
    );
  }

  return (
    <>
      <Section
        kicker={`${subs.length} ${subs.length === 1 ? 'subscription' : 'subscriptions'}`}
        action={<Button size="xs" variant="outline" leftIcon={<Icon as={TbPlus} boxSize="13px" />} onClick={openNew}>Subscription</Button>}
      >
        {!subs.length ? (
          <Empty hint="Everything they have bought so far was a one off. A subscription raises its own invoices on a schedule you set, on either rail.">
            {clientName} is not on a subscription.
          </Empty>
        ) : (
          <Box borderTop="1px solid" borderColor={P.hair}>
            {subs.map((s) => <Row key={s.id} sub={s} onEdit={openEdit} onRaise={raise} raising={raising} />)}
          </Box>
        )}

        <HStack spacing={{ base: 4, md: 8 }} pt={2} flexWrap="wrap" rowGap={3}>
          {Object.values(RAILS).map((r) => (
            <HStack key={r.id} spacing={2.5} align="flex-start" maxW="34ch">
              <Icon as={r.id === 'card' ? TbCreditCard : TbCoins} boxSize="13px" color={r.tone} mt="3px" />
              <Box>
                <Text fontSize={TYPE.small} color={P.inkSec} fontWeight="500">{r.label} · {r.settles}</Text>
                <Text fontSize={TYPE.label} color={P.inkMuted} lineHeight="1.6">{r.note}</Text>
              </Box>
            </HStack>
          ))}
        </HStack>
      </Section>

      <SubscriptionModal isOpen={isOpen} onClose={onClose} clientId={clientId} clientName={clientName} subscription={editing} onSaved={fetch} />
    </>
  );
};

export default SubscriptionsTab;
