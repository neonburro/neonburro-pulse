// src/pages/Invoicing/components/InvoicePreview.jsx
// Pixel-exact preview of the client document, the SAME buildInvoiceEmailHTML the
// send function uses, so this is literally what lands in their inbox. The frame
// is Paper now, a cream mat holding the warm document. No dashes, no oxford.

import { useMemo } from 'react';
import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { TbClock, TbMailFast } from 'react-icons/tb';
import { buildInvoiceEmailHTML } from '../../../lib/invoiceEmailTemplate';
import { useInvoiceAttachments } from '../../../lib/useInvoiceAttachments';
import colors from '../../../theme/colors';

const P = colors.paper;

const InvoicePreview = ({ invoice, client, sprints }) => {
  const attachments = useInvoiceAttachments(invoice?.id);
  const html = useMemo(() => {
    if (!client || !sprints || sprints.length === 0) return null;
    const invoiceDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    return buildInvoiceEmailHTML({
      invoice: { invoice_number: invoice?.invoice_number || 'NB______', due_date: invoice?.due_date },
      client,
      project: null,
      lineItems: sprints,
      invoiceDate,
      payUrl: '#preview',
      attachments,
      paid: invoice?.status === 'paid',
      paidAt: invoice?.paid_at || null,
    });
  }, [invoice, client, sprints, attachments]);

  if (!html) {
    return (
      <Box py={20} textAlign="center" border="1px dashed" borderColor={P.hair} borderRadius="2xl" bg={P.sheet}>
        <VStack spacing={3}>
          <Icon as={TbClock} boxSize={10} color={P.inkFaint} />
          <Text color={P.inkMuted} fontSize="sm">
            {!client ? 'Select a client to see the preview' : 'Add at least one billable sprint to see the preview'}
          </Text>
          <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">
            WIP sprints are hidden from the client
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      <HStack spacing={2} justify="center" pb={1}>
        <Icon as={TbMailFast} boxSize={3.5} color={P.limeDeep} />
        <Text fontSize="2xs" color={P.inkMuted} fontWeight="600" letterSpacing="0.16em" textTransform="uppercase" fontFamily="mono">
          Exact client preview
        </Text>
      </HStack>

      <Box borderRadius="2xl" overflow="hidden" border="1px solid" borderColor={P.hair} bg={P.mat}>
        <Box
          as="iframe"
          srcDoc={html}
          title="Invoice preview"
          width="100%"
          minH="900px"
          h="auto"
          border="none"
          display="block"
          sandbox="allow-same-origin"
          ref={(iframe) => {
            if (!iframe) return;
            const handleLoad = () => {
              try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc?.body) iframe.style.height = `${doc.body.scrollHeight + 40}px`;
              } catch { /* cross-origin, ignore */ }
            };
            iframe.addEventListener('load', handleLoad);
            setTimeout(handleLoad, 500);
            setTimeout(handleLoad, 1500);
          }}
        />
      </Box>
    </VStack>
  );
};

export default InvoicePreview;
