// src/pages/Invoicing/components/MarkPaidModal.jsx
// Off platform payment recording, on Paper. Used when a client pays via check,
// wire, cash and so on. Updates invoice status to paid, sets paid_at, total_paid,
// payment_method and payment_reference, logs to activity_log with method plus
// reference. Cream card, ink text, lime confirm, house fields. No oxford
// commas, no em dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Icon, Input, Textarea,
  Button, InputGroup, InputLeftElement,
} from '@chakra-ui/react';
import { TbCash, TbCheck } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET } from '../../../theme/layout';
import DotSelect from '../../../components/common/DotSelect';
import { Field } from '../../../components/common/Page';
import { PAYMENT_METHODS, formatCurrency } from '../../../lib/invoiceConstants';

const P = colors.paper;

const MarkPaidModal = ({ isOpen, onClose, invoice, onConfirm, processing }) => {
  const outstanding = invoice
    ? parseFloat(invoice.total || 0) - parseFloat(invoice.total_paid || 0)
    : 0;

  const [method, setMethod] = useState('check');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paidDate, setPaidDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMethod('check');
      setReference('');
      setAmount(outstanding.toString());
      setNotes('');
      setPaidDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, outstanding]);

  const selectedMethod = PAYMENT_METHODS.find((m) => m.value === method);
  const numericAmount = parseFloat(amount || 0);
  const canConfirm = numericAmount > 0 && paidDate;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      method,
      reference: reference.trim() || null,
      amount: numericAmount,
      notes: notes.trim() || null,
      paid_date: paidDate,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="rgba(36,26,22,0.55)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.mat} color={P.ink} border="1px solid" borderColor={P.hair} borderRadius="2xl" mx={4}>
        <ModalHeader pb={2} pt={6} px={6}>
          <HStack spacing={3}>
            <Box w="40px" h="40px" borderRadius="full" bg={`${P.lime}2E`} border="1px solid" borderColor={`${P.lime}`} display="flex" alignItems="center" justifyContent="center">
              <Icon as={TbCash} boxSize={4} color={P.limeDeep} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text color={P.ink} fontSize={TYPE.section} fontWeight="700">Mark as paid</Text>
              <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">
                {invoice?.invoice_number} · {formatCurrency(outstanding)} outstanding
              </Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <ModalBody px={6} py={4}>
          <VStack align="stretch" spacing={5}>
            <Text color={P.inkMuted} fontSize={TYPE.body} lineHeight={1.6}>
              Record an off platform payment. The invoice is marked paid, the payment link disabled and a snapshot preserved.
            </Text>

            <HStack spacing={4} align="start">
              <Box flex={1}>
                <Field label="Method">
                  <DotSelect value={method} onChange={setMethod} options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
                </Field>
              </Box>
              <Box flex={1}>
                <Field label="Paid date">
                  <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                </Field>
              </Box>
            </HStack>

            <Field label={selectedMethod?.referenceLabel || 'Reference'} hint="optional">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'check' ? '#1234' : 'Tracking number or note'} fontFamily={method === 'check' || method === 'wire' ? 'mono' : 'body'} />
            </Field>

            <Field label="Amount received" hint={numericAmount > 0 && numericAmount !== outstanding ? (numericAmount > outstanding ? `overpayment, ${formatCurrency(numericAmount - outstanding)} above outstanding` : `partial, ${formatCurrency(outstanding - numericAmount)} will remain due`) : undefined} hintColor={P.gold}>
              <InputGroup>
                <InputLeftElement pointerEvents="none" pl={INSET} w="auto">
                  <Text color={P.inkMuted} fontSize={TYPE.body} fontFamily="mono">$</Text>
                </InputLeftElement>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" fontFamily="mono" pl={8} />
              </InputGroup>
            </Field>

            <Field label="Internal notes" hint="optional">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know about this payment" rows={2} minH="72px" />
            </Field>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} pt={4} pb={6} px={6} gap={2}>
          <Button size="sm" variant="outline" onClick={onClose} isDisabled={processing}>
            Cancel
          </Button>
          <Button size="sm" leftIcon={<TbCheck size={14} />} onClick={handleConfirm} isDisabled={!canConfirm} isLoading={processing} loadingText="Recording">
            Mark paid
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MarkPaidModal;
