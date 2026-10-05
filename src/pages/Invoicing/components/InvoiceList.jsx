// src/pages/Invoicing/components/InvoiceList.jsx
// Row based invoice list on Paper. Eye icon opens the sent snapshot, trash hard
// deletes a draft with a two click confirm, and a copy icon puts the pay link
// on the clipboard for anything sent and not yet paid, Tyler's ask of
// 2026-09-17, the link is the thing most often needed from a row. The link is
// built by payLinkFor in ResendModal.jsx so the row and the editor agree. The
// three row controls rest at low contrast rather than at zero, because a
// control at opacity 0 does not exist on a phone (ClientGrid.jsx says the same).
// The status dot warms toward lime as the invoice progresses. Lime is the paid win
// state and is not spent elsewhere in the row. Rows bleed the inset so the
// number sits on the column edge, the empty state is the house line. No
// oxford commas, no dashes.
//
// 2026-10-05, Volt. Each row now says what the invoice is FOR and WHEN, so it
// reads without being opened, Tyler's ask that day. The third line is the
// first billable line title with a count of the rest, then the due day, gold
// when it is close and coral once it has passed on anything still open. The
// figures print in full, $1,549 rather than $1.5k, because the compact form
// hid the cents and the hundreds on exactly the rows that get compared. The
// due date is a date column with no time, so dueDay() reads it as a local
// day, the same trap noted in ClientDetail.jsx.

import { useState } from 'react';
import {
  Box, HStack, VStack, Text, Icon, Button,
} from '@chakra-ui/react';
import {
  TbBolt, TbTrash, TbAlertTriangle, TbEye, TbCopy, TbCheck,
} from 'react-icons/tb';
import { timeAgo } from '../../../utils/phone';
import Avatar from '../../../components/common/Avatar';
import InvoiceSnapshotModal from './InvoiceSnapshotModal';
import { payLinkFor } from './ResendModal';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Empty, Loading } from '../../../components/common/Page';

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
  const whole = Math.round(num * 100) % 100 === 0;
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
};

const dueDay = (val) => {
  const m = String(val || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// What the invoice is for, in one line.
const forLine = (items) => {
  const billable = (items || []).filter((i) => i.is_billable !== false);
  if (billable.length === 0) return null;
  const first = (billable[0].title || '').trim() || 'Untitled line';
  return billable.length > 1 ? `${first} and ${billable.length - 1} more` : first;
};

// When, and how loudly to say it.
const dueNote = (invoice) => {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return null;
  const due = dueDay(invoice.due_date);
  if (!due) return invoice.status === 'draft' ? { text: 'no due date', color: P.inkFaint } : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  const day = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days < 0) return { text: `${invoice.status === 'draft' ? 'due date passed' : 'was due'} ${day}`, color: invoice.status === 'draft' ? P.gold : P.coral };
  if (days === 0) return { text: 'due today', color: P.gold };
  if (days <= 7) return { text: `due ${day}`, color: P.gold };
  return { text: `due ${day}`, color: P.inkMuted };
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
  const forText = forLine(invoice.invoice_items);
  const due = dueNote(invoice);

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
      px={INSET}
      borderBottom="1px solid"
      borderColor={P.hairSoft}
      borderLeft="2px solid"
      borderLeftColor="transparent"
      cursor="pointer"
      transition={`all ${FAST} ${EASE}`}
      role="group"
      onClick={() => onSelect(invoice.id)}
      _hover={{
        borderLeftColor: status.color,
        bg: P.sheet,
      }}
    >
      <HStack spacing={4} align="center">
        <Box w="6px" h="6px" borderRadius="full" bg={status.color} flexShrink={0} />

        <Avatar name={client?.name || '?'} url={client?.avatar_url} size="sm" border={false} />

        <VStack align="start" spacing={0} flex={1} minW={0}>
          <HStack spacing={2}>
            <Text color={P.ink} fontSize={TYPE.body} fontWeight="700" fontFamily="mono">
              {invoice.invoice_number || 'NEW'}
            </Text>
            <Text fontSize={TYPE.kicker} fontWeight="500" color={status.color} letterSpacing="0.1em" fontFamily="mono">
              {status.label}
            </Text>
          </HStack>
          <Text color={P.inkMuted} fontSize={TYPE.small} noOfLines={1}>
            {client?.name || 'No client'}
            {client?.company && ` · ${client.company}`}
          </Text>
          {(forText || due) && (
            <HStack spacing={2} mt={0.5} minW={0} maxW="100%">
              {forText && (
                <Text color={P.inkSec} fontSize={TYPE.small} noOfLines={1} minW={0}>{forText}</Text>
              )}
              {forText && due && <Text color={P.inkFaint} fontSize={TYPE.small} flexShrink={0}>·</Text>}
              {due && (
                <Text color={due.color} fontSize={TYPE.label} fontFamily="mono" flexShrink={0} whiteSpace="nowrap">{due.text}</Text>
              )}
            </HStack>
          )}
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
              <Text fontSize={TYPE.label} fontFamily="mono" color={openedUnpaid ? P.gold : P.inkMuted} whiteSpace="nowrap">
                {last ? `${last[0]} ${day}` : 'not sent'}
              </Text>
            </VStack>
          );
        })()}

        <HStack spacing={1.5} display={{ base: 'none', md: 'flex' }}>
          <Icon as={TbBolt} boxSize={3} color={P.inkFaint} />
          <Text color={P.inkSec} fontSize={TYPE.small} fontFamily="mono" fontWeight="700">
            {paidCount}/{sprintCount}
          </Text>
        </HStack>

        <VStack align="end" spacing={0} minW="80px">
          <Text color={P.ink} fontSize={TYPE.body} fontFamily="mono" fontWeight="700">
            {currency(invoice.total)}
          </Text>
          {outstanding > 0 && invoice.status !== 'draft' && (
            <Text color={P.gold} fontSize={TYPE.label} fontFamily="mono">
              {currency(outstanding)} due
            </Text>
          )}
        </VStack>

        <Text
          color={P.inkFaint}
          fontSize={TYPE.label}
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
              type="button"
              onClick={handleCopyClick}
              opacity={copied ? 1 : 0.4}
              color={copied ? P.limeDeep : P.inkFaint}
              p={1.5}
              borderRadius="md"
              transition={`all ${FAST} ${EASE}`}
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
              type="button"
              onClick={handleEyeClick}
              opacity={0.4}
              color={P.inkFaint}
              p={1.5}
              borderRadius="md"
              transition={`all ${FAST} ${EASE}`}
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
              type="button"
              onClick={handleTrashClick}
              opacity={confirmDelete ? 1 : 0.3}
              color={confirmDelete ? P.coral : P.inkFaint}
              p={1.5}
              borderRadius="md"
              transition={`all ${FAST} ${EASE}`}
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

  if (loading) return <Loading label="loading invoices" />;

  if (invoices.length === 0) {
    return (
      <Empty hint="Create the first one to start billing." action={<Button size="sm" onClick={onNew}>Create invoice</Button>}>
        No invoices yet.
      </Empty>
    );
  }

  return (
    <>
      <Box borderTop="1px solid" borderColor={P.hair} mx={-INSET}>
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
