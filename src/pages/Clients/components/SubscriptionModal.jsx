// src/pages/Clients/components/SubscriptionModal.jsx
// SENTINEL: NB_PULSE_SUB_MODAL_V3
//
// Create or edit one recurring arrangement, on Paper. The rail is the first
// question, not a setting: two large cards at the top, and choosing one rewrites
// the sentence underneath. Every client renews on their own anchor, the date the
// first period closes, counting forward. This writes the record at status draft
// and does NOT talk to Stripe, sending it is a separate deliberate act. House
// fields and labels. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Input, Textarea, Select,
  Button, Icon, useToast, SimpleGrid,
} from '@chakra-ui/react';
import { TbCreditCard, TbCoins, TbCheck } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { RAILS, cadenceLabel, renewalAction } from '../../../lib/billing';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import colors from '../../../theme/colors';
import { Field, Kicker } from '../../../components/common/Page';

const P = colors.paper;

const RailCard = ({ rail, selected, onSelect }) => (
  <VStack as="button" type="button" onClick={onSelect} align="start" spacing={2} p={4} borderRadius="14px" textAlign="left" w="100%"
    border="1px solid" borderColor={selected ? P.lime : P.hair} bg={selected ? P.sheet : 'transparent'}
    transition={`all ${FAST} ${EASE}`} _hover={{ borderColor: selected ? P.lime : P.inkFaint }}>
    <HStack spacing={2.5} w="100%">
      <Icon as={rail.id === 'card' ? TbCreditCard : TbCoins} boxSize="16px" color={rail.tone} />
      <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} flex={1}>{rail.label}</Text>
      {selected && <Icon as={TbCheck} boxSize="14px" color={P.limeDeep} />}
    </HStack>
    <Text fontSize={TYPE.micro} fontFamily="mono" color={P.inkMuted} letterSpacing="0.08em">{rail.processor} · {rail.model === 'pull' ? 'we charge' : 'they send'}</Text>
    <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.55">{rail.settles}</Text>
  </VStack>
);

const blank = {
  name: '', description: '', amount: '', setup_fee: '',
  interval: 'month', interval_count: 1, rail: 'card', payer_address: '',
  current_period_end: '', notes: '',
};

const toDateInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const SubscriptionModal = ({ isOpen, onClose, clientId, clientName, subscription, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(subscription?.id);

  useEffect(() => {
    if (!isOpen) return;
    if (subscription) {
      setForm({
        name: subscription.name || '',
        description: subscription.description || '',
        amount: subscription.amount ?? '',
        setup_fee: subscription.setup_fee ?? '',
        interval: subscription.interval || 'month',
        interval_count: subscription.interval_count || 1,
        rail: subscription.rail || 'card',
        payer_address: subscription.payer_address || '',
        current_period_end: toDateInput(subscription.current_period_end),
        notes: subscription.notes || '',
      });
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      setForm({ ...blank, current_period_end: d.toISOString().slice(0, 10) });
    }
  }, [isOpen, subscription]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const action = renewalAction({ rail: form.rail });
  const valid = form.name.trim() && parseFloat(form.amount) > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const end = form.current_period_end ? new Date(`${form.current_period_end}T12:00:00`) : null;
      const payload = {
        client_id: clientId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount: parseFloat(form.amount),
        setup_fee: form.setup_fee ? parseFloat(form.setup_fee) : 0,
        interval: form.interval,
        interval_count: Math.max(1, parseInt(form.interval_count, 10) || 1),
        rail: form.rail,
        payer_address: form.rail === 'stablecoin' ? (form.payer_address.trim() || null) : null,
        current_period_end: end ? end.toISOString() : null,
        next_invoice_at: form.rail === 'stablecoin' && end ? end.toISOString() : null,
        notes: form.notes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from('subscriptions').update(payload).eq('id', subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscriptions').insert({ ...payload, status: 'draft' });
        if (error) throw error;
      }

      toast({
        title: editing ? 'Subscription updated' : 'Subscription drafted',
        description: editing ? null : 'It is a draft until you send it. Nothing has been charged.',
        status: 'success', duration: 4500,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Could not save', description: err.message, status: 'error', duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(6px)" />
      <ModalContent bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius="18px" mx={4}>
        <ModalHeader pb={2}>
          <Kicker color={P.limeDeep} mb={1.5}>{editing ? 'Edit subscription' : 'New subscription'}</Kicker>
          <Text fontSize={TYPE.section} fontWeight="600" letterSpacing="-0.02em" color={P.ink}>{clientName}</Text>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} borderRadius="full" top={4} right={4} _hover={{ color: P.ink, bg: P.sunken }} />

        <ModalBody pb={2}>
          <VStack align="stretch" spacing={7}>
            <Field label="How it gets paid">
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                {Object.values(RAILS).map((r) => (
                  <RailCard key={r.id} rail={r} selected={form.rail === r.id} onSelect={() => setForm((p) => ({ ...p, rail: r.id }))} />
                ))}
              </SimpleGrid>
              <Text fontSize={TYPE.small} color={P.inkMuted} mt={1} lineHeight="1.65">
                On the renewal date it <Box as="span" color={P.ink}>{action.verb} {action.happens}</Box>.{' '}
                {action.ifNothing}
                {action.staffAction && <Box as="span" color={P.gold}> {action.staffAction} lands in this tab.</Box>}
              </Text>
            </Field>

            <VStack align="stretch" spacing={5}>
              <Field label="What are they buying">
                <Input value={form.name} onChange={set('name')} placeholder="Hosting and care" />
              </Field>
              <Field label="In their words" hint="optional">
                <Textarea rows={2} minH="72px" value={form.description} onChange={set('description')} placeholder="What they actually get for it" />
              </Field>
            </VStack>

            <SimpleGrid columns={{ base: 2, sm: 4 }} spacing={4}>
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="250" />
              </Field>
              <Field label="Setup" hint="once">
                <Input type="number" min="0" step="0.01" value={form.setup_fee} onChange={set('setup_fee')} placeholder="0" />
              </Field>
              <Field label="Every">
                <Input type="number" min="1" value={form.interval_count} onChange={set('interval_count')} />
              </Field>
              <Field label="Unit">
                <Select value={form.interval} onChange={set('interval')}>
                  <option value="month">Months</option>
                  <option value="year">Years</option>
                </Select>
              </Field>
            </SimpleGrid>

            <Field label="First period closes" hint="their anchor, not a shared billing day">
              <Input type="date" value={form.current_period_end} onChange={set('current_period_end')} />
              <Text fontSize={TYPE.small} color={P.inkMuted}>
                {cadenceLabel({ interval: form.interval, interval_count: form.interval_count })}, counting forward from that date.
              </Text>
            </Field>

            {form.rail === 'stablecoin' && (
              <Field label="Wallet they will send from" hint="optional">
                <Input value={form.payer_address} onChange={set('payer_address')} placeholder="Address, so an incoming transfer matches itself" fontFamily="mono" fontSize={TYPE.small} />
              </Field>
            )}

            <Field label="Notes" hint="internal">
              <Textarea rows={2} minH="72px" value={form.notes} onChange={set('notes')} placeholder="Nobody outside sees this" />
            </Field>
          </VStack>
        </ModalBody>

        <ModalFooter gap={2} pt={6}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" isLoading={saving} isDisabled={!valid} onClick={save}>
            {editing ? 'Save' : 'Create as draft'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SubscriptionModal;
