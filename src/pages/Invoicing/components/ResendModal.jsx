// src/pages/Invoicing/components/ResendModal.jsx
// Resend an invoice, on Paper. Tyler, 2026-09-17. Click any sent invoice, copy
// the link, resend it, and send it somewhere else when a bookkeeper or a
// partner needs it. The address field is prefilled with the client on file.
// Leave it and the same email goes again as a resend. Change it and the same
// stored document goes to that address and the history records a forward,
// see the note in netlify/functions/resend-invoice.js. A paid invoice goes out
// as the receipt with the stamp on it. House fields. No oxford commas, no
// dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Icon, Button, useToast,
} from '@chakra-ui/react';
import { TbRotateClockwise, TbSend, TbCopy, TbCheck } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET, FIELD_H, FIELD_RADIUS } from '../../../theme/layout';
import { Field } from '../../../components/common/Page';
import RecipientsField, { cleanList } from './RecipientsField';

const P = colors.paper;

export const payLinkFor = (invoice) => (invoice?.pay_token ? `https://neonburro.com/pay/?token=${invoice.pay_token}` : '');

const ResendModal = ({ isOpen, onClose, invoice, client, onSend, sending }) => {
  const toast = useToast();
  const [recipients, setRecipients] = useState([]);
  const [copied, setCopied] = useState(false);
  const clientEmail = String(client?.email || '').toLowerCase();
  const link = payLinkFor(invoice);
  const isPaid = invoice?.status === 'paid';

  // Starts as everyone who had it, the client and the cc list on the invoice.
  useEffect(() => {
    if (!isOpen) return;
    setRecipients(cleanList([clientEmail, ...(Array.isArray(invoice?.cc_emails) ? invoice.cc_emails : [])]));
    setCopied(false);
  }, [isOpen, clientEmail, invoice]);

  const valid = recipients.length > 0;
  const forwarding = valid && !recipients.includes(clientEmail);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: 'Link copied', description: 'Paste it anywhere the client will see it', status: 'success', duration: 2500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy', description: link, status: 'warning', duration: 6000 });
    }
  };

  const handleSend = () => { if (valid) onSend({ recipients, forwarding }); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay bg="rgba(36, 26, 22, 0.55)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.sheet} color={P.ink} borderRadius="2xl" border="1px solid" borderColor={P.hair} boxShadow="0 30px 80px rgba(36,26,22,0.25)">
        <ModalHeader pb={2}>
          <HStack spacing={3}>
            <Box p={2} borderRadius="lg" bg={`${P.limeDeep}18`} color={P.limeDeep}>
              <Icon as={TbRotateClockwise} boxSize={4} />
            </Box>
            <Box>
              <Text fontSize={TYPE.section} fontWeight="700">{isPaid ? 'Send the receipt' : 'Resend the invoice'}</Text>
              <Text fontSize={TYPE.small} color={P.inkMuted} fontFamily="mono">{invoice?.invoice_number}</Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} />
        <ModalBody>
          <VStack spacing={5} align="stretch">
            <RecipientsField
              value={recipients}
              onChange={setRecipients}
              label="send to"
              note={forwarding
                ? 'The client is not on this list, so the history records a forward, not a resend.'
                : isPaid
                  ? 'The stamped receipt goes to everyone listed, no pay button, nothing due.'
                  : 'The same email and the same files go to everyone listed.'}
            />

            {link && !isPaid && (
              <Field label="the pay link" hint="anyone with it can view and pay, send it the way you would send a cheque">
                <HStack spacing={2}>
                  <Box flex={1} px={INSET} h={FIELD_H} display="flex" alignItems="center" bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius={FIELD_RADIUS} minW={0}>
                    <Text fontSize={TYPE.small} fontFamily="mono" color={P.inkSec} isTruncated>{link}</Text>
                  </Box>
                  <Button size="md" variant="outline" color={copied ? P.green : undefined} leftIcon={<Icon as={copied ? TbCheck : TbCopy} boxSize={3.5} />} onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </HStack>
              </Field>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            leftIcon={<Icon as={TbSend} boxSize={3.5} />}
            onClick={handleSend}
            isDisabled={!valid}
            isLoading={sending}
            loadingText="Sending"
          >
            {isPaid ? 'Send receipt' : forwarding ? 'Send a copy' : 'Resend'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ResendModal;
