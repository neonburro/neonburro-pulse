// src/pages/Invoicing/components/InvoiceSnapshotModal.jsx
//
// Shows the exact email the client received, on Paper. Uses
// invoice_history.rendered_html if available, otherwise re-renders from the
// snapshot. The email itself is warm paper, so the frame around it is cream too.
//
// ── SAVE, DOWNLOAD AND FORWARD, ADDED 2026-09-07 ────────────────────────────
//
// The modal could show the exact invoice and could not give you a copy of it,
// so the only way to keep one was a screenshot. Three actions now, and all
// three work off the SAME rendered_html the client was actually sent. That is
// the whole point. Nothing here re-renders the invoice from current data, so a
// price change or a client rename later cannot alter a document somebody
// already received.
//
//   save as pdf     opens the stored html in a hidden iframe and prints it.
//                   The browser's own print to pdf is a vector rendering of the
//                   real document, so the text stays selectable and the file
//                   stays small. Rasterising it with canvas would be worse on
//                   both counts and would need a dependency
//   download html   the literal file, byte for byte what was emailed
//   forward         posts to resend-invoice with a recipient override
//
// ── WHY THE PRINT FRAME IS A SECOND IFRAME ──────────────────────────────────
//
// The preview iframe is sandboxed to allow-same-origin only, which is correct,
// it is displaying stored html and must not run scripts. A sandbox that strict
// also blocks print. So printing builds its own short lived frame, unsandboxed
// because it holds the same html we already trust enough to display, prints,
// and removes itself.
//
// A title is injected before printing because the browser names the saved pdf
// after the document title. Without it every invoice saves as "about:blank".
//
// No oxford commas, no em dashes.

import { useState, useEffect, useRef } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalBody, ModalHeader, ModalCloseButton,
  ModalFooter, Box, VStack, HStack, Text, Spinner, Center, Icon, Button,
  Input, useToast,
} from '@chakra-ui/react';
import { TbMail, TbClock, TbCalendar, TbPrinter, TbDownload, TbSend, TbX } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { buildInvoiceEmailHTML } from '../../../lib/invoiceEmailTemplate';
import colors from '../../../theme/colors';

const P = colors.paper;

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The saved file is named after this, so it is worth getting right.
const fileStem = (history, invoiceId) => {
  const n = history?.invoice_snapshot?.invoice_number;
  return n ? `invoice-${String(n).replace(/[^\w.-]+/g, '-')}` : `invoice-${invoiceId}`;
};

// Inject a title and a sane print margin without touching anything else in the
// stored document. If there is no head to inject into, prepend one.
const withPrintTitle = (html, title) => {
  const head = `<title>${title}</title><style>@page{margin:14mm}</style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  return head + html;
};

const InvoiceSnapshotModal = ({ isOpen, onClose, invoiceId }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState('');
  const [sending, setSending] = useState(false);
  const printFrame = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && invoiceId) loadSnapshot();
    else {
      setHistory(null); setRenderedHtml(null);
      setForwardOpen(false); setForwardTo('');
    }
  }, [isOpen, invoiceId]);

  useEffect(() => () => {
    if (printFrame.current?.parentNode) printFrame.current.parentNode.removeChild(printFrame.current);
  }, []);

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const { data: histRows } = await supabase
        .from('invoice_history')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false })
        .limit(1);

      const hist = histRows?.[0];
      if (!hist) { setHistory(null); setRenderedHtml(null); setLoading(false); return; }
      setHistory(hist);

      if (hist.rendered_html) {
        setRenderedHtml(hist.rendered_html);
      } else if (hist.invoice_snapshot) {
        const snap = hist.invoice_snapshot;
        const html = buildInvoiceEmailHTML({
          invoice: { invoice_number: snap.invoice_number },
          client: { name: snap.client_name, email: snap.client_email },
          project: snap.project_name ? { name: snap.project_name, project_number: snap.project_number } : null,
          lineItems: snap.line_items || [],
          invoiceDate: snap.invoice_date,
          payUrl: snap.pay_url || '#',
        });
        setRenderedHtml(html);
      }
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!renderedHtml) return;
    if (printFrame.current?.parentNode) printFrame.current.parentNode.removeChild(printFrame.current);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = withPrintTitle(renderedHtml, fileStem(history, invoiceId));
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (err) {
        console.error('Print failed:', err);
        toast({ title: 'Could not open the print dialog', status: 'error', duration: 4000 });
      }
    };
    document.body.appendChild(frame);
    printFrame.current = frame;
  };

  const handleDownload = () => {
    if (!renderedHtml) return;
    const blob = new Blob([renderedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileStem(history, invoiceId)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleForward = async () => {
    const to = forwardTo.trim();
    if (!EMAIL_RE.test(to)) {
      toast({ title: 'That does not look like an email address', status: 'warning', duration: 3500 });
      return;
    }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/.netlify/functions/resend-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, action: 'resend', toOverride: to, userId: user?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      toast({ title: `Sent to ${json.recipient}`, status: 'success', duration: 4000 });
      setForwardOpen(false);
      setForwardTo('');
      loadSnapshot();
    } catch (err) {
      toast({ title: 'Could not send', description: err.message, status: 'error', duration: 6000 });
    } finally {
      setSending(false);
    }
  };

  const canAct = !loading && !!renderedHtml;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay bg="rgba(36,26,22,0.55)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.mat} color={P.ink} border="1px solid" borderColor={P.hair} borderRadius="2xl" mx={4} maxH="90vh">
        <ModalHeader pb={3} pt={6} px={6}>
          <HStack spacing={3}>
            <Box w="40px" h="40px" borderRadius="full" bg={`${P.lime}1A`} border="1px solid" borderColor={`${P.lime}55`} display="flex" alignItems="center" justifyContent="center">
              <Icon as={TbMail} boxSize={4} color={P.limeDeep} />
            </Box>
            <VStack align="start" spacing={0} flex={1}>
              <Text color={P.ink} fontSize="md" fontWeight="800">Email snapshot</Text>
              {history && (
                <HStack spacing={2}>
                  <Icon as={TbCalendar} boxSize={2.5} color={P.inkFaint} />
                  <Text color={P.inkMuted} fontSize="2xs" fontFamily="mono">Sent {formatDate(history.sent_at)}</Text>
                  {history.sent_to && (
                    <>
                      <Text color={P.inkFaint} fontSize="2xs">·</Text>
                      <Text color={P.inkMuted} fontSize="2xs" fontFamily="mono">{history.sent_to}</Text>
                    </>
                  )}
                </HStack>
              )}
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <ModalBody px={6} pb={2}>
          {loading ? (
            <Center py={20}>
              <VStack spacing={3}>
                <Spinner size="md" color={P.limeDeep} thickness="2px" />
                <Text color={P.inkFaint} fontSize="xs" fontFamily="mono">Loading snapshot</Text>
              </VStack>
            </Center>
          ) : !history ? (
            <Center py={16}>
              <VStack spacing={3}>
                <Icon as={TbClock} boxSize={10} color={P.inkFaint} />
                <Text color={P.inkMuted} fontSize="sm" fontWeight="700">No snapshot available</Text>
                <Text color={P.inkFaint} fontSize="2xs" textAlign="center" maxW="280px">
                  This invoice has not been sent yet. Snapshots are created when an invoice is emailed to the client.
                </Text>
              </VStack>
            </Center>
          ) : (
            <Box borderRadius="xl" overflow="hidden" border="1px solid" borderColor={P.hair} bg={P.mat}>
              <Box
                as="iframe"
                srcDoc={renderedHtml}
                title="Invoice email snapshot"
                width="100%"
                minH="700px"
                border="none"
                display="block"
                sandbox="allow-same-origin"
                ref={(iframe) => {
                  if (!iframe) return;
                  const handleLoad = () => {
                    try {
                      const doc = iframe.contentDocument || iframe.contentWindow?.document;
                      if (doc?.body) {
                        iframe.style.height = `${doc.body.scrollHeight + 40}px`;
                      }
                    } catch {}
                  };
                  iframe.addEventListener('load', handleLoad);
                  setTimeout(handleLoad, 500);
                  setTimeout(handleLoad, 1500);
                }}
              />
            </Box>
          )}
        </ModalBody>

        {canAct && (
          <ModalFooter px={6} pb={6} pt={4} borderTop="1px solid" borderColor={P.hair} display="block">
            {!forwardOpen ? (
              <HStack spacing={2.5} flexWrap="wrap" rowGap={2.5}>
                <Button
                  size="sm" leftIcon={<Icon as={TbPrinter} boxSize={4} />} onClick={handlePrint}
                  bg={P.ink} color={P.mat} fontWeight="700" borderRadius="lg"
                  _hover={{ filter: 'brightness(1.12)' }}
                >
                  Save as PDF
                </Button>
                <Button
                  size="sm" variant="outline" leftIcon={<Icon as={TbDownload} boxSize={4} />} onClick={handleDownload}
                  borderColor={P.hair} color={P.ink} fontWeight="700" borderRadius="lg"
                  _hover={{ bg: `${P.ink}0A`, borderColor: P.inkFaint }}
                >
                  Download HTML
                </Button>
                <Button
                  size="sm" variant="ghost" leftIcon={<Icon as={TbSend} boxSize={4} />}
                  onClick={() => setForwardOpen(true)}
                  color={P.inkMuted} fontWeight="700" borderRadius="lg"
                  _hover={{ bg: `${P.ink}0A`, color: P.ink }}
                >
                  Send to someone else
                </Button>
              </HStack>
            ) : (
              <VStack align="stretch" spacing={2.5}>
                <Text color={P.inkMuted} fontSize="2xs" fontFamily="mono" letterSpacing="0.08em" textTransform="uppercase">
                  Send this exact invoice to
                </Text>
                <HStack spacing={2.5}>
                  <Input
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleForward(); }}
                    placeholder="name@company.com"
                    type="email"
                    size="sm"
                    autoFocus
                    bg={P.mat} borderColor={P.hair} color={P.ink} borderRadius="lg"
                    _placeholder={{ color: P.inkFaint }}
                    _focusVisible={{ borderColor: P.limeDeep, boxShadow: 'none' }}
                  />
                  <Button
                    size="sm" onClick={handleForward} isLoading={sending} loadingText="Sending"
                    bg={P.ink} color={P.mat} fontWeight="700" borderRadius="lg" flexShrink={0}
                    _hover={{ filter: 'brightness(1.12)' }}
                  >
                    Send
                  </Button>
                  <Button
                    size="sm" variant="ghost" onClick={() => { setForwardOpen(false); setForwardTo(''); }}
                    color={P.inkFaint} borderRadius="lg" flexShrink={0} px={2}
                    aria-label="Cancel"
                  >
                    <Icon as={TbX} boxSize={4} />
                  </Button>
                </HStack>
                <Text color={P.inkFaint} fontSize="2xs" lineHeight="1.5">
                  Sends the same document the client received, with the same attachments. It is logged
                  against this invoice and does not change who the invoice is addressed to.
                </Text>
              </VStack>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export default InvoiceSnapshotModal;
