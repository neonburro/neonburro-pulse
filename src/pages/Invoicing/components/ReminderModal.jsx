// src/pages/Invoicing/components/ReminderModal.jsx
// Compose and send a NeonBurro reminder, on Paper. Pre-fills on-brand copy, fully
// editable. Cream card, gold reminder mark, lime send. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Icon, Input, Textarea, Button,
} from '@chakra-ui/react';
import { TbBellRinging, TbSend } from 'react-icons/tb';
import colors from '../../../theme/colors';
import RecipientsField, { cleanList } from './RecipientsField';

const P = colors.paper;

const formatCurrency = (n) => {
  const num = parseFloat(n || 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const buildDefaultBody = ({ clientName, invoiceNumber, amountDue, daysSinceSent }) => {
  const firstName = (clientName || 'there').split(' ')[0];
  const dayContext = daysSinceSent
    ? `It's been ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''} since we sent it over`
    : 'Just floating this back to the top';

  return `Hi ${firstName},

A gentle signal from our side. ${dayContext}, and we wanted to make sure invoice ${invoiceNumber} didn't get buried.

The amount due is ${formatCurrency(amountDue)}. The original payment link is still active below, one click and you're set.

If anything has changed on your end, or you have any questions about the work, just reply to this email and we'll sort it out together.

Thanks for being part of the journey.`;
};

const FIELD_LABEL = {
  fontSize: '2xs', fontWeight: '700', color: P.inkMuted,
  textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'mono',
};

const ReminderModal = ({ isOpen, onClose, invoice, client, onSend, sending }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    const amountDue = parseFloat(invoice.total || 0) - parseFloat(invoice.total_paid || 0);
    let daysSinceSent = null;
    if (invoice.sent_at) {
      const ms = Date.now() - new Date(invoice.sent_at).getTime();
      daysSinceSent = Math.floor(ms / (1000 * 60 * 60 * 24));
    }
    setRecipients(cleanList([client?.email, ...(Array.isArray(invoice.cc_emails) ? invoice.cc_emails : [])]));
    setSubject(`A gentle reminder about ${invoice.invoice_number}`);
    setBody(buildDefaultBody({ clientName: client?.name, invoiceNumber: invoice.invoice_number, amountDue, daysSinceSent }));
  }, [isOpen, invoice, client]);

  const handleSend = () => { if (body.trim() && recipients.length) onSend({ subject, body, recipients }); };

  const amountDue = invoice ? parseFloat(invoice.total || 0) - parseFloat(invoice.total_paid || 0) : 0;

  const INPUT = {
    bg: P.sheet, border: '1px solid', borderColor: P.hair, color: P.ink, fontSize: 'sm',
    _focus: { borderColor: P.lime, boxShadow: 'none' }, _placeholder: { color: P.inkFaint },
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" motionPreset="slideInBottom">
      <ModalOverlay bg="rgba(36,26,22,0.55)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.mat} color={P.ink} border="1px solid" borderColor={P.hair} borderRadius="2xl" mx={4}>
        <ModalHeader pb={3} pt={6} px={6}>
          <HStack spacing={3}>
            <Box w="40px" h="40px" borderRadius="full" bg={`${P.gold}1A`} border="1px solid" borderColor={`${P.gold}55`} display="flex" alignItems="center" justifyContent="center">
              <Icon as={TbBellRinging} boxSize={4} color={P.gold} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text color={P.ink} fontSize="md" fontWeight="800">Send reminder</Text>
              <Text color={P.inkMuted} fontSize="2xs" fontFamily="mono">
                {invoice?.invoice_number} · {client?.name} · {formatCurrency(amountDue)} due
              </Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <ModalBody px={6} py={4}>
          <VStack align="stretch" spacing={4}>
            <RecipientsField value={recipients} onChange={setRecipients} label="send to" note="Everyone listed gets the nudge and the pay link." />
            <Box>
              <Text {...FIELD_LABEL} mb={2} display="block">Subject</Text>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} {...INPUT} />
            </Box>

            <Box>
              <HStack justify="space-between" mb={2}>
                <Text {...FIELD_LABEL}>Message</Text>
                <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">Editorial · NeonBurro voice · fully editable</Text>
              </HStack>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} {...INPUT} minH="240px" lineHeight={1.7} />
            </Box>

            <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="lg" p={3}>
              <Text color={P.limeDeep} fontSize="2xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" mb={1.5}>Email will include</Text>
              <VStack align="start" spacing={1} fontSize="xs" color={P.inkMuted}>
                <Text>· The warm-paper NeonBurro letterhead</Text>
                <Text>· Invoice number ({invoice?.invoice_number}) and amount due ({formatCurrency(amountDue)})</Text>
                <Text>· A View and pay button linking to the original pay page</Text>
                <Text>· Your name in the signature</Text>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} pt={4} pb={6} px={6}>
          <HStack spacing={2} w="100%">
            <Button flex={1} size="md" variant="outline" borderColor={P.hair} color={P.inkMuted} borderRadius="lg" onClick={onClose} _hover={{ borderColor: P.inkFaint, color: P.ink, bg: P.sunken }} isDisabled={sending}>
              Cancel
            </Button>
            <Button flex={1} size="md" bg={P.lime} color={P.limeInk} fontWeight="700" borderRadius="lg" leftIcon={<TbSend size={14} />} onClick={handleSend} isLoading={sending} loadingText="Sending" isDisabled={!body.trim()} _hover={{ bg: '#B8CC4A' }}>
              Send reminder
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReminderModal;
