// src/pages/Invoicing/components/CancelInvoiceModal.jsx
// Soft cancel modal for sent invoices, on Paper. Requires typing CANCEL to
// confirm, captures an optional reason. Caller owns the Supabase update. Cream
// card, coral accent for the destructive edge. House fields. No oxford commas,
// no em dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Icon, Input, Button,
} from '@chakra-ui/react';
import { TbAlertTriangle } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Field, Kicker, Plate } from '../../../components/common/Page';

const P = colors.paper;

const CancelInvoiceModal = ({ isOpen, onClose, invoice, onConfirm, processing }) => {
  const [typedConfirm, setTypedConfirm] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) { setTypedConfirm(''); setReason(''); }
  }, [isOpen]);

  const canConfirm = typedConfirm === 'CANCEL';

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="rgba(36,26,22,0.55)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.mat} color={P.ink} border="1px solid" borderColor={`${P.coral}66`} borderRadius="2xl" mx={4}>
        <ModalHeader pb={2} pt={6} px={6}>
          <HStack spacing={3}>
            <Box w="40px" h="40px" borderRadius="full" bg={`${P.coral}1A`} border="1px solid" borderColor={`${P.coral}55`} display="flex" alignItems="center" justifyContent="center">
              <Icon as={TbAlertTriangle} boxSize={4} color={P.coral} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text color={P.ink} fontSize={TYPE.section} fontWeight="700">Cancel invoice</Text>
              <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{invoice?.invoice_number}</Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <ModalBody px={6} py={5}>
          <VStack spacing={5} align="stretch">
            <Text color={P.inkSec} fontSize={TYPE.body} lineHeight="1.6">
              This marks the invoice cancelled and invalidates the payment link in the client's email. The sprint history and snapshot are preserved.
            </Text>

            <Plate sunken>
              <Kicker color={P.gold} mb={1}>What happens</Kicker>
              <VStack align="start" spacing={1} fontSize={TYPE.small} color={P.inkMuted}>
                <Text>· Invoice hidden from all lists</Text>
                <Text>· Pay link in the email is killed</Text>
                <Text>· Snapshot preserved for records</Text>
                <Text>· Activity log entry created</Text>
              </VStack>
            </Plate>

            <Field label="Reason" hint="optional">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you cancelling?" />
            </Field>

            <Field label="Type CANCEL to confirm">
              <Input value={typedConfirm} onChange={(e) => setTypedConfirm(e.target.value.toUpperCase())} placeholder="CANCEL" fontFamily="mono" letterSpacing="0.1em" />
            </Field>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} pt={4} pb={6} px={6} gap={2}>
          <Button size="sm" variant="outline" onClick={onClose}>
            Keep invoice
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onConfirm(reason)} isDisabled={!canConfirm} isLoading={processing} loadingText="Cancelling">
            Cancel invoice
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CancelInvoiceModal;
