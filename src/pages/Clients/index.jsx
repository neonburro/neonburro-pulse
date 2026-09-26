// src/pages/Clients/index.jsx
// SENTINEL: NB_PULSE_CLIENTS_V3
//
// ── WHAT CHANGED ────────────────────────────────────────────────────────────
//
// SUBSCRIPTIONS ARE JOINED IN. The table has existed since the August migration
// and nothing in the app ever read it, so a client on a live monthly and a
// client who bought one sprint in March looked identical in this list. Each row
// now carries its newest non draft subscription and shows a health pip.
//
// The query is guarded: if the subscriptions table has not been created in this
// project yet, the join fails, the catch swallows it and every client simply
// renders with no pip. A missing migration should degrade, not white screen.
//
// MONEY MOVED OFF THIS PAGE. MTD revenue and outstanding belong on Today. The
// strip here counts clients, because that is what the page is a list of.
//
// V3, 2026-09-25. The house column. No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { useDisclosure } from '@chakra-ui/react';
import { supabase } from '../../lib/supabase';
import { Page } from '../../components/common/Page';
import ClientsHeader from './components/ClientsHeader';
import ClientFilters from './components/ClientFilters';
import ClientGrid from './components/ClientGrid';
import ClientModal from './components/ClientModal';

const LIVE_SUB_STATUSES = ['active', 'past_due', 'paused', 'pending'];

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [editingClient, setEditingClient] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Subscriptions are optional. A project without the migration should show a
    // client list with no pips rather than an error, so this one is isolated.
    const subsPromise = supabase
      .from('subscriptions')
      .select('id, client_id, status, amount, interval, interval_count, current_period_end')
      .in('status', LIVE_SUB_STATUSES)
      .then((r) => r.data || [])
      .catch(() => []);

    const [clientsRes, invoicesRes, projectsRes, subs] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('id, client_id, status, total, total_paid, created_at, paid_at, invoice_items(id)'),
      supabase.from('projects').select('id, client_id'),
      subsPromise,
    ]);

    const invoices = invoicesRes.data || [];
    const projects = projectsRes.data || [];

    const projectCount = {};
    projects.forEach((p) => {
      if (p.client_id) projectCount[p.client_id] = (projectCount[p.client_id] || 0) + 1;
    });

    const perClient = {};
    invoices.forEach((inv) => {
      if (!inv.client_id) return;
      const row = perClient[inv.client_id] || (perClient[inv.client_id] = {
        sprints: 0, funded: 0, last: null,
      });
      row.sprints += (inv.invoice_items || []).length;
      row.funded += parseFloat(inv.total_paid || 0);
      const when = inv.paid_at || inv.created_at;
      if (when && (!row.last || when > row.last)) row.last = when;
    });

    // Newest live subscription wins. A client with two is rare and the newest is
    // the one somebody just set up, which is the one they are looking for.
    const subByClient = {};
    (subs || []).forEach((s) => {
      const held = subByClient[s.client_id];
      if (!held || new Date(s.current_period_end || 0) > new Date(held.current_period_end || 0)) {
        subByClient[s.client_id] = s;
      }
    });

    setClients((clientsRes.data || []).map((c) => ({
      ...c,
      sprint_count: perClient[c.id]?.sprints || 0,
      total_funded: perClient[c.id]?.funded || 0,
      project_count: projectCount[c.id] || 0,
      last_activity_at: c.last_activity_at || perClient[c.id]?.last || c.created_at,
      subscription: subByClient[c.id] || null,
    })));

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => { setEditingClient(null); onOpen(); };
  const handleEdit = (client) => { setEditingClient(client); onOpen(); };

  const q = search.trim().toLowerCase();
  const filtered = clients.filter((c) => {
    const matchSearch = !q || [c.name, c.email, c.company, c.phone]
      .some((f) => f && String(f).toLowerCase().includes(q))
      || (c.tags || []).some((t) => t.toLowerCase().includes(q));
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical': return (a.name || '').localeCompare(b.name || '');
      case 'most_funded': return (b.total_funded || 0) - (a.total_funded || 0);
      case 'most_sprints': return (b.sprint_count || 0) - (a.sprint_count || 0);
      case 'activity': return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
      default: return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
  });

  const counts = {
    all: clients.length,
    active: clients.filter((c) => c.status === 'active').length,
    lead: clients.filter((c) => c.status === 'lead').length,
    inactive: clients.filter((c) => c.status === 'inactive').length,
  };

  const subscribed = clients.filter((c) => c.subscription).length;

  return (
    <Page>
      <ClientsHeader
        counts={counts}
        subscribed={subscribed}
        onAdd={handleAdd}
        onShowLeads={() => setFilterStatus('lead')}
      />

      <ClientFilters
        search={search}
        onSearch={setSearch}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        sortBy={sortBy}
        onSortBy={setSortBy}
        counts={counts}
      />

      <ClientGrid
        clients={sorted}
        loading={loading}
        onEdit={handleEdit}
        onAdd={handleAdd}
        isEmpty={clients.length === 0}
      />

      <ClientModal isOpen={isOpen} onClose={onClose} client={editingClient} onSave={fetchData} />
    </Page>
  );
};

export default Clients;
