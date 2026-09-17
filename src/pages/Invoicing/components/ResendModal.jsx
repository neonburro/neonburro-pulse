// src/pages/Invoicing/components/ResendModal.jsx
// Resend an invoice, on Paper. Tyler, 2026-09-17. Click any sent invoice, copy
// the link, resend it, and send it somewhere else when a bookkeeper or a
// partner needs it. The address field is prefilled with the client on file.
// Leave it and the same email goes again as a resend. Change it and the same
// stored document goes to that address and the history records a forward,
// see the note in netlify/functions/resend-invoice.js. A paid invoice goes out
// as the receipt with the stamp on it. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Icon, Input, Button, useToast,
} from '@chakra-ui/react';
import { TbRotateClockwise, TbSend, TbCopy, TbCheck } from 'react-icons/tb';
import colors from '../../../theme/colors';

const P = colors.paper;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const FIELD_LABEL = {
  fontSize: '2xs', fontWeight: '700', color: P.inkMuted,
  textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'mono',
};

export const payLinkFor = (invoice) => (invoice?.pay_token ? `https://neonburro.com/pay/?token=${invoice.pay_token}` : '');

const ResendModal = ({ isOpen, onClose, invoice, client, onSend, sending }) => {
  const toast = useToast();
  const [to, setTo] = useState('');
  const [copied, setCopied] = useState(false);
  const clientEmail = client?.email || '';
  const link = payLinkFor(invoice);
  const isPaid = invoice?.status === 'paid';

  useEffect(() => {
    if (!isOpen) return;
    setTo(clientEmail);
    setCopied(false);
  }, [isOpen, clientEmail]);

  const trimmed = to.trim();
  const valid = EMAIL_RE.test(trimmed);
  const forwarding = valid && trimmed.toLowerCase() !== clientEmail.toLowerCase();

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

  const handleSend = () => { if (valid) onSend({ to: trimmed, forwarding }); };

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
              <Text fontSize="md" fontWeight="700">{isPaid ? 'Send the receipt' : 'Resend the invoice'}</Text>
              <Text fontSize="xs" color={P.inkMuted} fontFamily="mono">{invoice?.invoice_number}</Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} />
        <ModalBody>
          <VStack spacing={5} align="stretch">
            <Box>
              <Text {...FIELD_LABEL} mb={2}>send to</Text>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                type="email"
                placeholder="name@company.com"
                bg={P.mat}
                borderColor={valid || !trimmed ? P.hair : '#B5462F'}
                color={P.ink}
                fontSize="sm"
                _focus={{ borderColor: P.limeDeep, boxShadow: 'none' }}
              />
              <Text mt={2} fontSize="xs" color={P.inkMuted} lineHeight="1.6">
                {forwarding
                  ? 'A different address. The same document goes there and the history records it as a forward, not a resend.'
                  : isPaid
                    ? 'The client on file. The stamped receipt goes out, no pay button, nothing due.'
                    : 'The client on file. The same email and the same files go again.'}
              </Text>
            </Box>

            {link && !isPaid && (
              <Box>
                <Text {...FIELD_LABEL} mb={2}>the pay link</Text>
                <HStack spacing={2}>
                  <Box flex={1} px={3} py={2} bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius="lg" minW={0}>
                    <Text fontSize="xs" fontFamily="mono" color={P.inkSec} isTruncated>{link}</Text>
                  </Box>
                  <Button size="sm" variant="outline" borderColor={P.hair} color={copied ? P.green : P.inkSec} borderRadius="full" leftIcon={<Icon as={copied ? TbCheck : TbCopy} boxSize={3.5} />} onClick={copy} _hover={{ bg: P.sheet, borderColor: P.limeDeep }}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </HStack>
                <Text mt={2} fontSize="xs" color={P.inkMuted}>Anyone with the link can view and pay this invoice. Send it the way you would send a cheque.</Text>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" color={P.inkMuted} onClick={onClose} borderRadius="full" size="sm">Cancel</Button>
          <Button
            size="sm"
            bg={P.limeDeep}
            color="white"
            fontWeight="700"
            borderRadius="full"
            leftIcon={<Icon as={TbSend} boxSize={3.5} />}
            onClick={handleSend}
            isDisabled={!valid}
            isLoading={sending}
            loadingText="Sending"
            _hover={{ bg: '#85953A' }}
          >
            {isPaid ? 'Send receipt' : forwarding ? 'Send a copy' : 'Resend'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ResendModal;
