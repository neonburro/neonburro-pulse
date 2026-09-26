// src/pages/Invoicing/components/SendHistoryStrip.jsx
// Timeline of every send for an invoice, initial, resends, reminders, on Paper.
// Lives on the InvoiceEditor between the header and the tabs. A plate with a
// kicker. No oxford commas.

import { useState, useEffect } from 'react';
import { VStack, HStack, Text, Icon, Tooltip, Box } from '@chakra-ui/react';
import { TbSend, TbRotateClockwise, TbBellRinging, TbEye } from 'react-icons/tb';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import { Plate, Kicker, Loading } from '../../../components/common/Page';

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

const TIP = { placement: 'top', hasArrow: true, bg: 'chrome.ground', color: 'chrome.text', fontSize: TYPE.small };

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

  if (loading) return <Loading label="loading history" py={1} />;

  if (history.length === 0) return null;

  return (
    <Plate py={3}>
      <HStack spacing={2} mb={2}>
        <Kicker>Send history</Kicker>
        <Text color={P.inkFaint} fontSize={TYPE.kicker} fontFamily="mono">{history.length} event{history.length !== 1 ? 's' : ''}</Text>
      </HStack>

      <VStack align="stretch" spacing={1} divider={<Box h="1px" bg={P.hairSoft} />}>
        {history.map((event, idx) => {
          const meta = SEND_TYPE_META[event.send_type] || SEND_TYPE_META.initial;
          const isLatest = idx === 0;
          return (
            <HStack key={event.id} spacing={3} py={2} role="group">
              <Icon as={meta.icon} boxSize={3.5} color={meta.color} flexShrink={0} />
              <Text color={isLatest ? P.ink : P.inkMuted} fontSize={TYPE.small} fontWeight={isLatest ? '700' : '500'} minW="70px">{meta.label}</Text>
              <Text color={P.inkMuted} fontSize={TYPE.small} fontFamily="mono" flex={1} noOfLines={1}>{event.sent_to || 'unknown'}</Text>
              <Tooltip label={format(new Date(event.sent_at), "MMM d, yyyy 'at' h:mma")} {...TIP}>
                <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" flexShrink={0}>{formatDistanceToNow(new Date(event.sent_at), { addSuffix: true })}</Text>
              </Tooltip>
              <Tooltip label="View this email" {...TIP}>
                <Box as="button" type="button" onClick={() => onViewSnapshot && onViewSnapshot(invoiceId, event.id)} color={P.inkFaint} _groupHover={{ color: P.inkMuted }} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`} p={1}>
                  <Icon as={TbEye} boxSize={3.5} />
                </Box>
              </Tooltip>
            </HStack>
          );
        })}
      </VStack>
    </Plate>
  );
};

export default SendHistoryStrip;
