// src/pages/Invoicing/components/ReviewSendModal.jsx
// SENTINEL: NB_SEND_GATE_V1
//
// The gate. Nothing reaches a client without passing through here first.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// Before this, Save & Send saved the draft and emailed the client in the same
// click, with only an optional Preview tab nobody had to open. Tyler's rule is
// simple: preview it, approve it, then send it. So the send button now saves the
// draft and opens this, which shows the EXACT document the client will receive
// (the same buildInvoiceEmailHTML the email uses, in an iframe), the recipient,
// the amount and the due date. Only Approve and send actually fires the email.
//
// ── PAPER ────────────────────────────────────────────────────────────────────
// This is a Paper surface (src/theme/colors.js paper.*): cream sheet, dark ink,
// one lime action. It sits over the still dark editor for now, a cream sheet on
// a dark desk, until the editor itself is repainted.
//
// ── SAFETY ───────────────────────────────────────────────────────────────────
// If the client has no email on file the send is blocked here with a clear
// reason, rather than failing in the function after the click.
//
// No oxford commas, no dashes.

import { useMemo, useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalBody,
  Box, VStack, HStack, Text, Icon, Button,
} from '@chakra-ui/react';
import { TbArrowLeft, TbSend, TbAlertTriangle, TbMailFast } from 'react-icons/tb';
import { buildInvoiceEmailHTML } from '../../../lib/invoiceEmailTemplate';
import { useInvoiceAttachments } from '../../../lib/useInvoiceAttachments';
import colors from '../../../theme/colors';
import RecipientsField from './RecipientsField';

const P = colors.paper;

const currency = (val) =>
  `$${parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDue = (val) => {
  if (!val) return 'On receipt';
  const s = String(val);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  if (Number.isNaN(dt.getTime())) return 'On receipt';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const Meta = ({ label, value, accent }) => (
  <VStack align="start" spacing={0.5} minW="0">
    <Text fontFamily="mono" fontSize="9px" letterSpacing="0.16em" textTransform="uppercase" color={P.inkMuted}>
      {label}
    </Text>
    <Text fontSize="sm" fontWeight="600" color={accent || P.ink} noOfLines={1}>
      {value}
    </Text>
  </VStack>
);

const ReviewSendModal = ({ isOpen, onClose, invoice, client, project, sprints, dueDate, sending, onConfirm }) => {
  // Extra addresses beyond the client, saved to the invoice as cc_emails on
  // approve so send-invoice.js carries them, Tyler's ask of 2026-09-17.
  const [cc, setCc] = useState(Array.isArray(invoice?.cc_emails) ? invoice.cc_emails : []);
  useEffect(() => { if (isOpen) setCc(Array.isArray(invoice?.cc_emails) ? invoice.cc_emails : []); }, [isOpen, invoice]);
  const billable = (sprints || []).filter((s) => s.is_billable !== false);
  const total = billable.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
  const hasEmail = !!client?.email;
  // THE GATE MUST SHOW WHAT WILL BE SENT. Somebody approves this document and
  // that approval fires the email, so if the email carries attachments and this
  // does not, they approved something they did not see.
  const attachments = useInvoiceAttachments(invoice?.id);

  const html = useMemo(() => {
    if (!client || billable.length === 0) return null;
    const invoiceDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return buildInvoiceEmailHTML({
      invoice: { ...invoice, due_date: dueDate || invoice?.due_date },
      client,
      project: project || null,
      lineItems: billable,
      invoiceDate,
      payUrl: '#preview',
      attachments,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, client, project, sprints, dueDate, attachments]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered scrollBehavior="inside">
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(3px)" />
      <ModalContent
        bg={P.sheet}
        borderRadius="20px"
        border="1px solid"
        borderColor={P.hair}
        overflow="hidden"
        mx={4}
        boxShadow="0 30px 80px rgba(23,17,12,0.5)"
      >
        {/* Header */}
        <Box px={{ base: 5, md: 7 }} pt={{ base: 5, md: 6 }} pb={4} borderBottom="1px solid" borderColor={P.hairSoft}>
          <HStack spacing={2} mb={4}>
            <Icon as={TbMailFast} boxSize={3.5} color={P.limeDeep} />
            <Text fontFamily="mono" fontSize="10px" letterSpacing="0.2em" textTransform="uppercase" color={P.inkMuted}>
              Review and send
            </Text>
          </HStack>

          {/* Recipient + amount + due */}
          <HStack spacing={6} align="flex-start" flexWrap="wrap" rowGap={3}>
            <Meta label="Amount" value={currency(total)} />
            <Meta label="Due" value={formatDue(dueDate || invoice?.due_date)} accent={P.limeDeep} />
            {invoice?.invoice_number && <Meta label="Invoice" value={invoice.invoice_number} />}
          </HStack>

          <Box mt={4}>
            <RecipientsField
              value={cc}
              onChange={setCc}
              fixed={hasEmail ? [client.email] : []}
              label="to"
              note="The client is fixed. Anyone else you add gets the same email and is kept on the invoice for reminders and resends."
            />
          </Box>

          {!hasEmail && (
            <HStack spacing={2} mt={4} bg={`${P.coral}12`} border="1px solid" borderColor={`${P.coral}40`} borderRadius="lg" px={3} py={2}>
              <Icon as={TbAlertTriangle} boxSize={3.5} color={P.coral} flexShrink={0} />
              <Text fontSize="xs" color={P.coral}>
                Add an email to this client before sending. Back out and set it on their profile.
              </Text>
            </HStack>
          )}
        </Box>

        {/* The document, exactly as sent */}
        <ModalBody p={0} bg={P.mat}>
          {html ? (
            <Box
              as="iframe"
              srcDoc={html}
              title="Invoice as the client sees it"
              width="100%"
              minH="520px"
              h="auto"
              border="none"
              display="block"
              sandbox="allow-same-origin"
              ref={(iframe) => {
                if (!iframe) return;
                const fit = () => {
                  try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc?.body) iframe.style.height = `${doc.body.scrollHeight + 24}px`;
                  } catch { /* ignore */ }
                };
                iframe.addEventListener('load', fit);
                setTimeout(fit, 400);
                setTimeout(fit, 1200);
              }}
            />
          ) : (
            <Box py={16} textAlign="center">
              <Text color={P.inkMuted} fontSize="sm">Add a client and a billable sprint to preview</Text>
            </Box>
          )}
        </ModalBody>

        {/* Actions */}
        <HStack
          justify="space-between"
          px={{ base: 5, md: 7 }}
          py={4}
          borderTop="1px solid"
          borderColor={P.hair}
          bg={P.sheet}
        >
          <Button
            variant="ghost"
            color={P.inkSec}
            fontWeight="600"
            borderRadius="full"
            leftIcon={<TbArrowLeft size={15} />}
            onClick={onClose}
            isDisabled={sending}
            _hover={{ bg: P.sunken, color: P.ink }}
          >
            Back to edit
          </Button>
          <Button
            bg={P.lime}
            color={P.limeInk}
            fontWeight="700"
            borderRadius="full"
            px={7}
            rightIcon={<TbSend size={15} />}
            onClick={() => onConfirm({ ccEmails: cc })}
            isLoading={sending}
            loadingText="Sending"
            isDisabled={!hasEmail || !html}
            _hover={{ bg: '#D2E26B', transform: 'translateY(-1px)' }}
            _active={{ transform: 'scale(0.98)' }}
          >
            Approve and send
          </Button>
        </HStack>
      </ModalContent>
    </Modal>
  );
};

export default ReviewSendModal;
