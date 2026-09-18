// src/pages/Invoicing/components/SendHistoryStrip.jsx
// Timeline of every send for an invoice, initial, resends, reminders, on Paper.
// Lives on the InvoiceEditor between the header and the tabs. No oxford commas.

import { useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Icon, Tooltip, Spinner } from '@chakra-ui/react';
import { TbSend, TbRotateClockwise, TbBellRinging, TbEye } from 'react-icons/tb';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';

const P = colors.paper;

// Every send_type the functions write. forward and receipt were written by
// resend-invoice.js for a while with no row here, so the strip called them
// Sent. A forward is a copy to someone who is not the client, a receipt is
// the paid document, stamped.
const SEND_TYPE_META = {
  initial:  { icon: TbSend,            label: 'Sent',     color: P.limeDeep },
  resend:   { icon: TbRotateClockwise, label: 'Resent',   color: P.inkMuted },
  forward:  { icon: TbSend,            label: 'Copied to', color: P.inkMuted },
  receipt:  { icon: TbRotateClockwise, label: 'Receipt',  color: P.limeDeep },
  reminder: { icon: TbBellRinging,     label: 'Reminder', color: P.gold },
};

const TIP = { placement: 'top', hasArrow: true, bg: 'chrome.ground', color: 'chrome.text', fontSize: 'xs' };

const SendHistoryStrip = ({ invoiceId, refreshKey, onViewSnapshot }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('invoice_history')
        .select('id, sent_at, sent_to, send_type, sent_by')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });
      if (!cancelled) { setHistory(data || []); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [invoiceId, refreshKey]);

  if (!invoiceId) return null;

  if (loading) {
    return (
      <HStack py={3} spacing={2}>
        <Spinner size="xs" color={P.limeDeep} thickness="1.5px" />
        <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">Loading history</Text>
      </HStack>
    );
  }

  if (history.length === 0) return null;

  return (
    <Box py={3} px={4} borderRadius="lg" bg={P.sheet} border="1px solid" borderColor={P.hair}>
      <HStack spacing={2} mb={2}>
        <Box w="6px" h="6px" borderRadius="full" bg={P.lime} boxShadow={`0 0 6px ${P.lime}88`} />
        <Text color={P.limeDeep} fontSize="2xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.12em" fontFamily="mono">Send history</Text>
        <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">{history.length} event{history.length !== 1 ? 's' : ''}</Text>
      </HStack>

      <VStack align="stretch" spacing={1} divider={<Box h="1px" bg={P.hairSoft} />}>
        {history.map((event, idx) => {
          const meta = SEND_TYPE_META[event.send_type] || SEND_TYPE_META.initial;
          const isLatest = idx === 0;
          return (
            <HStack key={event.id} spacing={3} py={2} role="group">
              <Icon as={meta.icon} boxSize={3.5} color={meta.color} flexShrink={0} />
              <Text color={isLatest ? P.ink : P.inkMuted} fontSize="xs" fontWeight={isLatest ? '700' : '500'} minW="70px">{meta.label}</Text>
              <Text color={P.inkMuted} fontSize="xs" fontFamily="mono" flex={1} noOfLines={1}>{event.sent_to || '—'}</Text>
              <Tooltip label={format(new Date(event.sent_at), "MMM d, yyyy 'at' h:mma")} {...TIP}>
                <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono" flexShrink={0}>{formatDistanceToNow(new Date(event.sent_at), { addSuffix: true })}</Text>
              </Tooltip>
              <Tooltip label="View this email" {...TIP}>
                <Box as="button" onClick={() => onViewSnapshot && onViewSnapshot(invoiceId, event.id)} color={P.inkFaint} _groupHover={{ color: P.inkMuted }} _hover={{ color: P.limeDeep }} transition="color 0.15s" p={1}>
                  <Icon as={TbEye} boxSize={3.5} />
                </Box>
              </Tooltip>
            </HStack>
          );
        })}
      </VStack>
    </Box>
  );
};

export default SendHistoryStrip;
