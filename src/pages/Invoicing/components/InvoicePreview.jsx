// src/pages/Invoicing/components/InvoicePreview.jsx
// Pixel exact preview of the client document, the SAME buildInvoiceEmailHTML the
// send function uses, so this is literally what lands in their inbox. The frame
// is Paper, a cream mat holding the warm document, the kicker on the left like
// every kicker. No dashes, no oxford.

import { useMemo } from 'react';
import { Box, VStack, HStack, Icon } from '@chakra-ui/react';
import { TbMailFast } from 'react-icons/tb';
import { buildInvoiceEmailHTML } from '../../../lib/invoiceEmailTemplate';
import { useInvoiceAttachments } from '../../../lib/useInvoiceAttachments';
import colors from '../../../theme/colors';
import { PLATE_RADIUS } from '../../../theme/layout';
import { Empty, Kicker } from '../../../components/common/Page';

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
      <Empty hint="WIP sprints are hidden from the client.">
        {!client ? 'Select a client to see the preview.' : 'Add at least one billable sprint to see the preview.'}
      </Empty>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      <HStack spacing={2}>
        <Icon as={TbMailFast} boxSize={3.5} color={P.limeDeep} />
        <Kicker>Exact client preview</Kicker>
      </HStack>

      <Box borderRadius={PLATE_RADIUS} overflow="hidden" border="1px solid" borderColor={P.hair} bg={P.mat}>
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
