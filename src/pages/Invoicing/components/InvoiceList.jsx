// src/pages/Invoicing/components/InvoiceList.jsx
// Row based invoice list on Paper. Eye icon opens the sent snapshot, trash hard
// deletes a draft with a two click confirm, and a copy icon puts the pay link
// on the clipboard for anything sent and not yet paid, Tyler's ask of
// 2026-09-17, the link is the thing most often needed from a row. The link is
// built by payLinkFor in ResendModal.jsx so the row and the editor agree. The
// status dot warms toward lime as the invoice progresses. Lime is the paid win
// state and is not spent elsewhere in the row. No oxford commas, no dashes.

import { useState } from 'react';
import {
  Box, HStack, VStack, Text, Icon, Center, Spinner, Button,
} from '@chakra-ui/react';
import {
  TbCash, TbBolt, TbTrash, TbAlertTriangle, TbEye, TbCopy, TbCheck,
} from 'react-icons/tb';
import { timeAgo } from '../../../utils/phone';
import Avatar from '../../../components/common/Avatar';
import InvoiceSnapshotModal from './InvoiceSnapshotModal';
import { payLinkFor } from './ResendModal';
import colors from '../../../theme/colors';

const P = colors.paper;

const STATUS_COLORS = {
  draft:     { color: P.inkMuted, label: 'DRAFT' },
  sent:      { color: '#6C6F97',  label: 'SENT' },
  viewed:    { color: P.limeDeep, label: 'VIEWED' },
  partial:   { color: P.gold,     label: 'PARTIAL' },
  overdue:   { color: P.coral,    label: 'OVERDUE' },
  paid:      { color: P.green,    label: 'PAID' },
  cancelled: { color: P.inkFaint, label: 'CANCELLED' },
};

const SENT_LIKE_STATUSES = ['sent', 'viewed', 'partial', 'overdue', 'paid'];

const currency = (val) => {
  const num = parseFloat(val || 0);
  if (num === 0) return '$0';
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${num.toLocaleString()}`;
};

const InvoiceRow = ({ invoice, onSelect, onQuickDelete, onViewSnapshot }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const client = invoice.clients;
  const status = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft;
  const sprintCount = invoice.invoice_items?.length || 0;
  const paidCount = (invoice.invoice_items || []).filter(
    (i) => i.payment_status === 'paid' || i.locked
  ).length;
  const outstanding = parseFloat(invoice.total || 0) - parseFloat(invoice.total_paid || 0);
  const isDraft = invoice.status === 'draft';
  const wasSent = SENT_LIKE_STATUSES.includes(invoice.status);
  const payLink = invoice.status !== 'paid' && invoice.status !== 'cancelled' ? payLinkFor(invoice) : null;

  const handleTrashClick = (e) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onQuickDelete(invoice.id);
  };

  const handleEyeClick = (e) => {
    e.stopPropagation();
    onViewSnapshot(invoice.id);
  };

  const handleCopyClick = async (e) => {
    e.stopPropagation();
    if (!payLink) return;
    try {
      await navigator.clipboard.writeText(payLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy the pay link', payLink);
    }
  };

  return (
    <Box
      py={3.5}
      px={4}
      borderBottom="1px solid"
      borderColor={P.hairSoft}
      borderLeft="2px solid"
      borderLeftColor="transparent"
      cursor="pointer"
      transition="all 0.15s ease-out"
      role="group"
      onClick={() => onSelect(invoice.id)}
      _hover={{
        borderLeftColor: status.color,
        bg: P.sheet,
        transform: 'translateX(2px)',
      }}
    >
      <HStack spacing={4} align="center">
        <Box w="6px" h="6px" borderRadius="full" bg={status.color} flexShrink={0} />

        <Avatar name={client?.name || '?'} url={client?.avatar_url} size="sm" border={false} />

        <VStack align="start" spacing={0} flex={1} minW={0}>
          <HStack spacing={2}>
            <Text color={P.ink} fontSize="sm" fontWeight="700" fontFamily="mono">
              {invoice.invoice_number || 'NEW'}
            </Text>
            <Text fontSize="2xs" fontWeight="700" color={status.color} letterSpacing="0.05em" fontFamily="mono">
              {status.label}
            </Text>
          </HStack>
          <Text color={P.inkMuted} fontSize="xs" noOfLines={1}>
            {client?.name || 'No client'}
            {client?.company && ` · ${client.company}`}
          </Text>
        </VStack>

        {/* sent, opened, paid. three dots and the last one that lit, with its day.
            Tyler, 2026-09-17, opened and not paid is the thing a list should say. */}
        {!isDraft && (() => {
          const steps = [
            ['sent', invoice.sent_at],
            ['opened', invoice.viewed_at],
            ['paid', invoice.paid_at],
          ];
          const lit = steps.filter(([, t]) => !!t);
          const last = lit[lit.length - 1];
          const day = last ? new Date(last[1]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
          const openedUnpaid = !!invoice.viewed_at && !invoice.paid_at;
          return (
            <VStack spacing={1} align="start" minW="118px" display={{ base: 'none', md: 'flex' }}>
              <HStack spacing={1.5}>
                {steps.map(([name, t]) => (
                  <Box
                    key={name}
                    w="6px"
                    h="6px"
                    borderRadius="full"
                    bg={t ? (name === 'paid' ? P.green : name === 'opened' && openedUnpaid ? P.gold : P.inkSec) : 'transparent'}
                    border="1px solid"
                    borderColor={t ? 'transparent' : P.hair}
                    title={name}
                  />
                ))}
              </HStack>
              <Text fontSize="2xs" fontFamily="mono" color={openedUnpaid ? P.gold : P.inkMuted} whiteSpace="nowrap">
                {last ? `${last[0]} ${day}` : 'not sent'}
              </Text>
            </VStack>
          );
        })()}

        <HStack spacing={1.5} display={{ base: 'none', md: 'flex' }}>
          <Icon as={TbBolt} boxSize={3} color={P.inkFaint} />
          <Text color={P.inkSec} fontSize="xs" fontFamily="mono" fontWeight="700">
            {paidCount}/{sprintCount}
          </Text>
        </HStack>

        <VStack align="end" spacing={0} minW="80px">
          <Text color={P.ink} fontSize="sm" fontFamily="mono" fontWeight="700">
            {currency(invoice.total)}
          </Text>
          {outstanding > 0 && invoice.status !== 'draft' && (
            <Text color={P.gold} fontSize="2xs" fontFamily="mono">
              {currency(outstanding)} due
            </Text>
          )}
        </VStack>

        <Text
          color={P.inkFaint}
          fontSize="2xs"
          fontFamily="mono"
          minW="60px"
          textAlign="right"
          display={{ base: 'none', lg: 'block' }}
        >
          {timeAgo(invoice.sent_at || invoice.created_at)}
        </Text>

        <HStack spacing={0.5}>
          {payLink ? (
            <Box
              as="button"
              onClick={handleCopyClick}
              opacity={copied ? 1 : 0}
              color={copied ? P.limeDeep : P.inkFaint}
              p={1.5}
              borderRadius="md"
              transition="all 0.15s"
              _groupHover={{ opacity: copied ? 1 : 0.6 }}
              _hover={{ opacity: '1 !important', color: P.limeDeep, bg: `${P.lime}22` }}
              title={copied ? 'Copied' : 'Copy the pay link'}
              aria-label={copied ? 'Pay link copied' : 'Copy the pay link'}
            >
              <Icon as={copied ? TbCheck : TbCopy} boxSize={3.5} />
            </Box>
          ) : (
            <Box w="28px" />
          )}

          {wasSent ? (
            <Box
              as="button"
              onClick={handleEyeClick}
              opacity={0}
              color={P.inkFaint}
              p={1.5}
              borderRadius="md"
              transition="all 0.15s"
              _groupHover={{ opacity: 0.6 }}
              _hover={{ opacity: '1 !important', color: P.limeDeep, bg: `${P.lime}22` }}
              title="View sent email"
            >
              <Icon as={TbEye} boxSize={3.5} />
            </Box>
          ) : (
            <Box w="28px" />
          )}

          {isDraft ? (
            <Box
              as="button"
              onClick={handleTrashClick}
              opacity={confirmDelete ? 1 : 0}
              color={confirmDelete ? P.coral : P.inkFaint}
              p={1.5}
              borderRadius="md"
              transition="all 0.15s"
              _groupHover={{ opacity: confirmDelete ? 1 : 0.6 }}
              _hover={{ opacity: '1 !important', color: P.coral, bg: `${P.coral}14` }}
              title={confirmDelete ? 'Click again to confirm' : 'Delete draft'}
            >
              <Icon as={confirmDelete ? TbAlertTriangle : TbTrash} boxSize={3.5} />
            </Box>
          ) : (
            <Box w="28px" />
          )}
        </HStack>
      </HStack>
    </Box>
  );
};

const InvoiceList = ({ invoices, loading, onSelect, onNew, onQuickDelete }) => {
  const [snapshotInvoiceId, setSnapshotInvoiceId] = useState(null);

  if (loading) {
    return (
      <Center py={16}>
        <VStack spacing={3}>
          <Spinner size="md" color={P.limeDeep} thickness="2px" />
          <Text color={P.inkMuted} fontSize="xs" fontFamily="mono">Loading invoices</Text>
        </VStack>
      </Center>
    );
  }

  if (invoices.length === 0) {
    return (
      <Box py={20} textAlign="center">
        <VStack spacing={4}>
          <Icon as={TbCash} boxSize={10} color={P.inkFaint} />
          <VStack spacing={1}>
            <Text color={P.ink} fontSize="md" fontWeight="700">No invoices yet</Text>
            <Text color={P.inkMuted} fontSize="xs">Create your first invoice to start billing</Text>
          </VStack>
          <Button
            size="sm"
            bg={P.lime}
            color={P.limeInk}
            fontWeight="700"
            borderRadius="full"
            onClick={onNew}
            mt={2}
            _hover={{ bg: '#D2E26B' }}
          >
            Create invoice
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <>
      <Box borderTop="1px solid" borderColor={P.hair}>
        {invoices.map((inv) => (
          <InvoiceRow
            key={inv.id}
            invoice={inv}
            onSelect={onSelect}
            onQuickDelete={onQuickDelete}
            onViewSnapshot={setSnapshotInvoiceId}
          />
        ))}
      </Box>

      <InvoiceSnapshotModal
        isOpen={!!snapshotInvoiceId}
        onClose={() => setSnapshotInvoiceId(null)}
        invoiceId={snapshotInvoiceId}
      />
    </>
  );
};

export default InvoiceList;
