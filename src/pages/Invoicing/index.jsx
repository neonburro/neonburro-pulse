// src/pages/Invoicing/index.jsx
// The invoicing surface, Paper. The house column, kicker, title, the two
// buttons, a stat strip, the house search and the house tabs over the list.
// When selectedInvoiceId is set the whole surface hands off to InvoiceEditor.
//
// Two ways a Volt draft arrives, 2026-09-25. The Draft with Volt door on
// this page hands it through onDraft the way it always has. The desk in
// src/components/Layout/VoltDesk.jsx, which sits on every page, navigates
// here with the same draft shape in router state under voltDraft, and the
// effect below opens the editor on it once and clears the state so a
// refresh does not open it twice. The key is spelled in both files.
// No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import { VStack, Button, Icon } from '@chakra-ui/react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { TbPlus, TbSparkles } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { SENT_STATUSES, formatCurrencyCompact } from '../../lib/invoiceConstants';
import colors from '../../theme/colors';
import { Page, PageHead, Stats, SearchBox, Tabs } from '../../components/common/Page';
import InvoiceList from './components/InvoiceList';
import InvoiceEditor from './components/InvoiceEditor';
import VoltComposer from './components/VoltComposer';

const P = colors.paper;

const FILTER_OPTIONS = [
  { key: 'all',   label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'sent',  label: 'Sent' },
  { key: 'paid',  label: 'Paid' },
];

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

  return (
    <Page>
      <PageHead
        kicker="Invoicing"
        title="Sprints, invoices and what is owed."
        actions={(
          <>
            <Button size="sm" variant="outline" leftIcon={<Icon as={TbSparkles} boxSize={4} color={P.limeDeep} />} onClick={() => setShowVolt(true)}>
              Draft with Volt
            </Button>
            <Button size="sm" leftIcon={<Icon as={TbPlus} boxSize={4} />} onClick={handleNewInvoice}>
              Invoice
            </Button>
          </>
        )}
      >
        <Stats items={[
          { key: 'count', n: stats.totalCount, label: 'invoices' },
          { key: 'mtd', n: formatCurrencyCompact(stats.mtdRevenue), label: 'MTD' },
          stats.totalOutstanding > 0 && { key: 'out', n: formatCurrencyCompact(stats.totalOutstanding), label: 'outstanding', tone: P.gold },
          stats.drafts > 0 && { key: 'drafts', n: stats.drafts, label: `draft${stats.drafts !== 1 ? 's' : ''}`, tone: P.inkSec },
        ]} />
      </PageHead>

      <VStack align="stretch" spacing={5}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by number, client or company" />
        <Tabs items={FILTER_OPTIONS.map((o) => ({ ...o, count: counts[o.key] || 0 }))} value={filterStatus} onChange={setFilterStatus} />
        <InvoiceList
          invoices={filtered}
          loading={loading}
          onSelect={handleSelectInvoice}
          onNew={handleNewInvoice}
          onQuickDelete={handleQuickDelete}
        />
      </VStack>

      <VoltComposer isOpen={showVolt} onClose={() => setShowVolt(false)} clients={clients} onDraft={handleVoltDraft} />
    </Page>
  );
};

export default Invoicing;
