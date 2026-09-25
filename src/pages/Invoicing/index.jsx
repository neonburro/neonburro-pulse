// src/pages/Invoicing/index.jsx
// The invoicing surface, Paper. A cream worktable: kicker, a lime new-invoice
// button, a live stats line, a rounded search and the filter tabs over the list.
// Local Paper styles here rather than the shared dark uiConstants, since those
// still drive the not yet converted pages. When selectedInvoiceId is set the
// whole surface hands off to InvoiceEditor.
//
// Two ways a Volt draft arrives, 2026-09-25. The Draft with Volt door on
// this page hands it through onDraft the way it always has. The desk in
// src/components/Layout/VoltDesk.jsx, which sits on every page, navigates
// here with the same draft shape in router state under voltDraft, and the
// effect below opens the editor on it once and clears the state so a
// refresh does not open it twice. The key is spelled in both files.
// No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Input, Container,
} from '@chakra-ui/react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { TbPlus, TbSearch, TbSparkles } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { SENT_STATUSES, formatCurrencyCompact } from '../../lib/invoiceConstants';
import colors from '../../theme/colors';
import InvoiceList from './components/InvoiceList';
import InvoiceEditor from './components/InvoiceEditor';
import VoltComposer from './components/VoltComposer';

const P = colors.paper;

const Invoicing = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showVolt, setShowVolt] = useState(false);
  const [voltDraft, setVoltDraft] = useState(null);

  useEffect(() => {
    const invoiceParam = searchParams.get('invoice');
    if (invoiceParam) setSelectedInvoiceId(invoiceParam);
    else setSelectedInvoiceId(null);
  }, [searchParams]);

  useEffect(() => { fetchData(); }, []);

  // A draft handed over by the desk on another page.
  useEffect(() => {
    const handed = location.state?.voltDraft;
    if (!handed) return;
    setVoltDraft({ clientId: handed.client_id || '', notes: handed.notes || '', lines: handed.lines || [] });
    setSelectedInvoiceId('new');
    setSearchParams({ invoice: 'new' }, { replace: true, state: {} });
  }, [location.state, setSearchParams]);

  const fetchData = async () => {
    setLoading(true);
    const [invoicesRes, clientsRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, invoice_items(*), clients(id, name, company, email, phone, avatar_url)')
        .is('cancelled_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name, company, email, phone, status, client_type, address_line1, address_line2, city, region, postal_code, country')
        .order('name'),
    ]);
    setInvoices(invoicesRes.data || []);
    setClients(clientsRes.data || []);
    setLoading(false);
  };

  const handleNewInvoice = () => {
    const clientId = searchParams.get('client');
    setVoltDraft(null);
    setSelectedInvoiceId('new');
    setSearchParams({ invoice: 'new', ...(clientId ? { client: clientId } : {}) });
  };

  const handleVoltDraft = (draft) => {
    setVoltDraft({ clientId: draft.client_id || '', notes: draft.notes || '', lines: draft.lines || [] });
    setSelectedInvoiceId('new');
    setSearchParams({ invoice: 'new' });
  };

  const handleSelectInvoice = (id) => {
    setSelectedInvoiceId(id);
    setSearchParams({ invoice: id });
  };

  const handleCloseEditor = () => {
    setVoltDraft(null);
    setSelectedInvoiceId(null);
    setSearchParams({});
  };

  const handleQuickDelete = async (invoiceId) => {
    try {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'invoice_deleted',
        entity_type: 'invoice',
        entity_id: invoiceId,
        metadata: { hard_delete: true },
        created_at: new Date().toISOString(),
      });

      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = search
      ? inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        inv.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
        inv.clients?.company?.toLowerCase().includes(search.toLowerCase())
      : true;

    let matchStatus = true;
    if (filterStatus === 'draft') matchStatus = inv.status === 'draft';
    else if (filterStatus === 'sent') matchStatus = SENT_STATUSES.includes(inv.status);
    else if (filterStatus === 'paid') matchStatus = inv.status === 'paid';

    return matchSearch && matchStatus;
  });

  const stats = {
    totalOutstanding: invoices
      .filter((inv) => SENT_STATUSES.includes(inv.status))
      .reduce((sum, inv) => sum + (parseFloat(inv.total || 0) - parseFloat(inv.total_paid || 0)), 0),
    mtdRevenue: invoices
      .filter((inv) => {
        const paidAt = inv.paid_at ? new Date(inv.paid_at) : null;
        if (!paidAt) return false;
        const now = new Date();
        return paidAt.getFullYear() === now.getFullYear() && paidAt.getMonth() === now.getMonth();
      })
      .reduce((sum, inv) => sum + parseFloat(inv.total_paid || 0), 0),
    drafts: invoices.filter((inv) => inv.status === 'draft').length,
    totalCount: invoices.length,
  };

  const counts = {
    all: invoices.length,
    draft: invoices.filter((i) => i.status === 'draft').length,
    sent: invoices.filter((i) => SENT_STATUSES.includes(i.status)).length,
    paid: invoices.filter((i) => i.status === 'paid').length,
  };

  if (selectedInvoiceId) {
    return (
      <InvoiceEditor
        invoiceId={selectedInvoiceId === 'new' ? null : selectedInvoiceId}
        clientId={searchParams.get('client')}
        clients={clients}
        onClose={handleCloseEditor}
        onSaved={fetchData}
        voltDraft={selectedInvoiceId === 'new' ? voltDraft : null}
      />
    );
  }

  const FILTER_OPTIONS = [
    { value: 'all',   label: 'All' },
    { value: 'draft', label: 'Drafts' },
    { value: 'sent',  label: 'Sent' },
    { value: 'paid',  label: 'Paid' },
  ];

  return (
    <Box position="relative" minH="100vh" bg={P.mat}>
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h="320px"
        bg={`radial-gradient(ellipse at top center, ${P.lime}12, transparent 70%)`}
        pointerEvents="none"
      />

      <Container maxW="1500px" mx={0} px={{ base: 5, md: 8 }} py={{ base: 6, md: 10 }} position="relative">
        <VStack spacing={{ base: 7, md: 9 }} align="stretch">
          {/* Header */}
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
              <Text fontFamily="mono" fontSize="2xs" fontWeight="600" letterSpacing="0.22em" textTransform="uppercase" color={P.inkMuted}>
                Invoicing
              </Text>

              <HStack spacing={2}>
                <HStack
                  as="button"
                  onClick={() => setShowVolt(true)}
                  spacing={1.5}
                  bg="transparent"
                  border="1px solid"
                  borderColor={P.hair}
                  color={P.inkSec}
                  borderRadius="full"
                  px={4}
                  h="40px"
                  fontWeight="700"
                  fontSize="sm"
                  transition="all 0.18s"
                  _hover={{ borderColor: P.lime, color: P.ink, bg: `${P.lime}14` }}
                >
                  <Icon as={TbSparkles} boxSize={4} color={P.limeDeep} />
                  <Text>Draft with Volt</Text>
                </HStack>
                <HStack
                  as="button"
                  onClick={handleNewInvoice}
                  spacing={1.5}
                  bg={P.lime}
                  color={P.limeInk}
                  borderRadius="full"
                  px={4}
                  h="40px"
                  fontWeight="700"
                  fontSize="sm"
                  transition="all 0.18s"
                  _hover={{ bg: '#D2E26B', transform: 'translateY(-1px)' }}
                  _active={{ transform: 'scale(0.98)' }}
                >
                  <Icon as={TbPlus} boxSize={4} />
                  <Text>Invoice</Text>
                </HStack>
              </HStack>
            </HStack>

            <HStack spacing={0} fontSize="xs" fontFamily="mono" flexWrap="wrap" rowGap={1}>
              <Text color={P.ink} fontWeight="700">{stats.totalCount}</Text>
              <Text color={P.inkMuted} mx={1.5}>invoices</Text>
              <Text color={P.inkFaint} mx={1}>·</Text>
              <Text color={P.ink} fontWeight="700">{formatCurrencyCompact(stats.mtdRevenue)}</Text>
              <Text color={P.inkMuted} mx={1.5}>MTD</Text>
              {stats.totalOutstanding > 0 && (
                <>
                  <Text color={P.inkFaint} mx={1}>·</Text>
                  <Text color={P.gold} fontWeight="700">{formatCurrencyCompact(stats.totalOutstanding)}</Text>
                  <Text color={P.inkMuted} mx={1.5}>outstanding</Text>
                </>
              )}
              {stats.drafts > 0 && (
                <>
                  <Text color={P.inkFaint} mx={1}>·</Text>
                  <Text color={P.inkSec} fontWeight="700">{stats.drafts}</Text>
                  <Text color={P.inkMuted} mx={1.5}>draft{stats.drafts !== 1 ? 's' : ''}</Text>
                </>
              )}
            </HStack>
          </VStack>

          {/* Search */}
          <HStack
            spacing={3}
            bg={P.sheet}
            border="1px solid"
            borderColor={P.hair}
            borderRadius="full"
            px={5}
            h="52px"
            position="sticky"
            top={4}
            zIndex={2}
            _focusWithin={{ borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}22` }}
          >
            <Icon as={TbSearch} boxSize={4} color={P.inkMuted} flexShrink={0} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by number, client or company"
              variant="unstyled"
              color={P.ink}
              fontSize="sm"
              _placeholder={{ color: P.inkFaint }}
            />
          </HStack>

          {/* Filter tabs */}
          <HStack spacing={7} flexWrap="wrap" align="center">
            {FILTER_OPTIONS.map((opt) => {
              const active = filterStatus === opt.value;
              const count = counts[opt.value] || 0;
              return (
                <Box key={opt.value} onClick={() => setFilterStatus(opt.value)} position="relative" pb={2} cursor="pointer">
                  <HStack spacing={2}>
                    <Text fontSize="sm" fontWeight={active ? '700' : '500'} color={active ? P.ink : P.inkMuted}>
                      {opt.label}
                    </Text>
                    <Text fontSize="2xs" fontFamily="mono" fontWeight="700" color={active ? P.limeDeep : P.inkFaint}>
                      {count}
                    </Text>
                  </HStack>
                  {active && <Box position="absolute" bottom="-1px" left={0} right={0} h="2px" bg={P.lime} borderRadius="full" />}
                </Box>
              );
            })}
          </HStack>

          <InvoiceList
            invoices={filtered}
            loading={loading}
            onSelect={handleSelectInvoice}
            onNew={handleNewInvoice}
            onQuickDelete={handleQuickDelete}
          />
        </VStack>
      </Container>

      <VoltComposer isOpen={showVolt} onClose={() => setShowVolt(false)} clients={clients} onDraft={handleVoltDraft} />
    </Box>
  );
};

export default Invoicing;
