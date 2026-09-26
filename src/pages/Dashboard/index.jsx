// src/pages/Dashboard/index.jsx
// SENTINEL: NB_PULSE_TODAY_V4
//
// Today, on Paper. What is waiting on you, then what was asked of volt for a
// person, then where things stand, then the forms, then what happened. The
// route is /today/, the folder stays Dashboard. One Promise.all feeds every
// count, VoltAsks, FormInbox and ActivityStream fetch their own rows.
//
// V3, 2026-09-25. VoltAsks sits under NeedsYou because an ask of volt is a
// thing waiting on a hand, the same emotional state as the queue above it.
// It reads desk_asks itself and refetches on the nb:desk-ask event the desk
// fires.
//
// V4, 2026-09-25. The page sits on the house column, src/components/common/
// Page.jsx, and every section below is a kicker and a list in the one
// format. No width, gutter or font size is typed here. No oxford commas, no
// dashes.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Page } from '../../components/common/Page';
import TodayHeader from './components/TodayHeader';
import NeedsYou from './components/NeedsYou';
import VoltAsks from './components/VoltAsks';
import Numbers from './components/Numbers';
import FormInbox from './components/FormInbox';
import ActivityStream from './components/ActivityStream';

const OPEN_STATUSES = ['sent', 'viewed', 'partial', 'overdue'];

const EMPTY = {
  activeClients: 0, totalClients: 0, openSprints: 0, collected: 0, outstanding: 0,
  overdueCount: 0, overdueTotal: 0, awaitingPayment: 0, awaitingTotal: 0,
  unreadForms: 0, unreadMessages: 0,
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(EMPTY);
  const [activities, setActivities] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [clientsRes, invoicesRes, formsRes, messagesRes, activitiesRes, profilesRes] = await Promise.all([
        supabase.from('clients').select('id, status'),
        supabase.from('invoices').select('id, status, total, total_paid, invoice_items(id, payment_status, locked, is_billable)').is('cancelled_at', null),
        supabase.from('form_submissions').select('id, status').is('archived_at', null),
        supabase.from('client_messages').select('id, sender_type, read_by_team'),
        supabase.from('activity_log').select('*').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(200),
        supabase.from('profiles').select('id, display_name, username, avatar_url'),
      ]);

      const clients = clientsRes.data || [];
      const invoices = invoicesRes.data || [];
      const forms = formsRes.data || [];
      const messages = messagesRes.data || [];

      const owed = (inv) => parseFloat(inv.total || 0) - parseFloat(inv.total_paid || 0);
      const open = invoices.filter((i) => OPEN_STATUSES.includes(i.status));
      const overdue = open.filter((i) => i.status === 'overdue');
      const awaiting = open.filter((i) => i.status !== 'overdue');

      setStats({
        activeClients: clients.filter((c) => c.status === 'active').length,
        totalClients: clients.length,
        openSprints: open.reduce((n, inv) => n + (inv.invoice_items || []).filter((it) => it.is_billable !== false && it.payment_status !== 'paid' && !it.locked).length, 0),
        collected: invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.total_paid || 0), 0),
        outstanding: open.reduce((sum, i) => sum + owed(i), 0),
        overdueCount: overdue.length,
        overdueTotal: overdue.reduce((sum, i) => sum + owed(i), 0),
        awaitingPayment: awaiting.length,
        awaitingTotal: awaiting.reduce((sum, i) => sum + owed(i), 0),
        unreadForms: forms.filter((f) => f.status === 'unread').length,
        unreadMessages: messages.filter((m) => m.sender_type === 'client' && !m.read_by_team).length,
      });

      setActivities(activitiesRes.data || []);
      const map = {};
      (profilesRes.data || []).forEach((p) => { map[p.id] = p; });
      setProfileMap(map);
      if (user?.id && map[user.id]) setMe(map[user.id]);
    } catch (err) {
      console.error('Today fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refresh = async () => { setRefreshing(true); await fetchAll(); };
  const myName = me?.display_name || me?.username || user?.email?.split('@')[0] || null;

  return (
    <Page>
      <TodayHeader name={myName} onRefresh={refresh} refreshing={refreshing} />
      <NeedsYou
        overdueCount={stats.overdueCount} overdueTotal={stats.overdueTotal}
        unreadForms={stats.unreadForms} unreadMessages={stats.unreadMessages}
        awaitingPayment={stats.awaitingPayment} awaitingTotal={stats.awaitingTotal}
        openSprints={stats.openSprints}
      />
      <VoltAsks />
      <Numbers outstanding={stats.outstanding} collected={stats.collected} activeClients={stats.activeClients} totalClients={stats.totalClients} openSprints={stats.openSprints} />
      <FormInbox />
      <ActivityStream activities={activities} profileMap={profileMap} loading={loading} />
    </Page>
  );
};

export default Dashboard;
