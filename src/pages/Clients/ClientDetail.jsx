// src/pages/Clients/ClientDetail.jsx
// path: /clients/:clientId/
//
// The client profile, on Paper. The house column, the avatar and the name up
// top as the head, a row of actions, the house tabs, and seven tabs: Overview,
// Sprints, Invoices, Recurring, Projects, Sites, Messages. The Overview leads
// with four stat plates.
//
// Admin can manage the avatar, the PIN, impersonation and activation. Every
// colour resolves from colors.paper, every empty state is the house line.
// No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Button, SimpleGrid, Input, useToast, useDisclosure,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TbMail, TbPhone, TbWorld, TbPlus, TbFolder, TbTrash, TbX, TbEdit,
} from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST, INSET } from '../../theme/layout';
import { formatPhoneDisplay, timeAgo } from '../../utils/phone';
import { Page, Section, Plate, Empty, Loading, Tabs, Kicker } from '../../components/common/Page';
import SitesTab from './components/SitesTab';
import SubscriptionsTab from './components/SubscriptionsTab';
import ClientModal from './components/ClientModal';
import ClientAvatarUpload from '../../components/common/ClientAvatarUpload';
import PortalAccessCard from '../../components/common/PortalAccessCard';
import ImpersonateButton from '../../components/common/ImpersonateButton';
import ActivateClientButton from '../../components/common/ActivateClientButton';

const P = colors.paper;

const TAB_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sprints', label: 'Sprints' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'subscriptions', label: 'Recurring' },
  { key: 'projects', label: 'Projects' },
  { key: 'sites', label: 'Sites' },
  { key: 'messages', label: 'Messages' },
];

const STATUS_COLORS = {
  draft:   P.inkMuted,
  sent:    '#6C6F97',
  viewed:  P.gold,
  partial: P.gold,
  overdue: P.coral,
  paid:    P.green,
};

const currency = (val) => {
  const num = parseFloat(val || 0);
  if (num === 0) return '$0';
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${num.toLocaleString()}`;
};

// ============================================================
// OVERVIEW TAB
// ============================================================
const OverviewTab = ({ client, stats, activity, onClientUpdate }) => (
  <VStack spacing={8} align="stretch">
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: 3, md: 4 }}>
      {[
        { label: 'Sprints', value: stats.totalSprints, color: P.limeDeep },
        { label: 'Funded', value: currency(stats.totalFunded), color: P.green },
        { label: 'Outstanding', value: currency(stats.outstanding), color: P.gold },
        { label: 'Invoices', value: stats.totalInvoices, color: P.inkSec },
      ].map((stat) => (
        <Plate key={stat.label}>
          <Kicker>{stat.label}</Kicker>
          <Text fontFamily="mono" fontSize={TYPE.figure} fontWeight="600" color={P.ink} lineHeight="1" mt={2} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {stat.value}
          </Text>
          <Box mt={3} h="2px" w="24px" bg={stat.color} borderRadius="full" />
        </Plate>
      ))}
    </SimpleGrid>

    <Section kicker="Contact">
      <VStack spacing={3} align="stretch">
        {client.email && (
          <HStack spacing={3}>
            <Icon as={TbMail} boxSize={3.5} color={P.inkMuted} />
            <Text as="a" href={`mailto:${client.email}`} color={P.limeDeep} fontSize={TYPE.body} _hover={{ textDecoration: 'underline' }}>{client.email}</Text>
          </HStack>
        )}
        {client.phone && (
          <HStack spacing={3}>
            <Icon as={TbPhone} boxSize={3.5} color={P.inkMuted} />
            <Text as="a" href={`tel:${client.phone}`} color={P.inkSec} fontSize={TYPE.body} fontFamily="mono" _hover={{ color: P.limeDeep }}>{formatPhoneDisplay(client.phone)}</Text>
          </HStack>
        )}
        {client.website && (
          <HStack spacing={3}>
            <Icon as={TbWorld} boxSize={3.5} color={P.inkMuted} />
            <Text as="a" href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" color={P.inkSec} fontSize={TYPE.body} _hover={{ color: P.limeDeep }}>{client.website}</Text>
          </HStack>
        )}
        {(client.address_line1 || client.city) && (
          <HStack spacing={3} align="start">
            <Icon as={TbFolder} boxSize={3.5} color={P.inkMuted} mt={0.5} style={{ visibility: 'hidden' }} />
            <Text color={P.inkSec} fontSize={TYPE.body} lineHeight="1.6">
              {[client.address_line1, client.address_line2].filter(Boolean).join(', ')}
              {(client.address_line1 || client.address_line2) && <br />}
              {[[client.city, client.region].filter(Boolean).join(', '), client.postal_code].filter(Boolean).join(' ')}
            </Text>
          </HStack>
        )}
        {!client.email && !client.phone && !client.website && !client.address_line1 && !client.city && (
          <Empty py={2}>Nothing on file yet. Edit the client to add a way to reach them.</Empty>
        )}
      </VStack>
    </Section>

    <PortalAccessCard client={client} onUpdate={onClientUpdate} />

    {client.notes && (
      <Section kicker="Notes">
        <Text color={P.inkSec} fontSize={TYPE.body} lineHeight="1.7" whiteSpace="pre-wrap">{client.notes}</Text>
      </Section>
    )}

    {activity.length > 0 && (
      <Section kicker="Recent activity">
        <VStack spacing={3} align="stretch">
          {activity.slice(0, 10).map((a) => (
            <HStack key={a.id} spacing={3} py={1}>
              <Box w="5px" h="5px" borderRadius="full" bg={P.inkFaint} flexShrink={0} />
              <Text color={P.inkSec} fontSize={TYPE.small} flex={1}>
                {a.action?.replace(/_/g, ' ')}
                {a.metadata?.note && `, ${a.metadata.note}`}
              </Text>
              <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{timeAgo(a.created_at)}</Text>
            </HStack>
          ))}
        </VStack>
      </Section>
    )}
  </VStack>
);

// ============================================================
// SPRINTS TAB
// ============================================================
const SprintsTab = ({ sprints, loading }) => {
  const [filter, setFilter] = useState('all');
  if (loading) return <Loading label="loading sprints" />;

  const filtered = sprints.filter((s) => {
    if (filter === 'billable') return s.is_billable !== false && s.payment_status !== 'paid';
    if (filter === 'draft') return s.is_billable === false;
    if (filter === 'paid') return s.payment_status === 'paid' || s.locked;
    return true;
  });

  const counts = {
    all: sprints.length,
    billable: sprints.filter((s) => s.is_billable !== false && s.payment_status !== 'paid').length,
    draft: sprints.filter((s) => s.is_billable === false).length,
    paid: sprints.filter((s) => s.payment_status === 'paid' || s.locked).length,
  };

  return (
    <VStack spacing={5} align="stretch">
      <Tabs
        items={[{ key: 'all', label: 'All' }, { key: 'billable', label: 'Billable' }, { key: 'draft', label: 'Draft' }, { key: 'paid', label: 'Paid' }].map((o) => ({ ...o, count: counts[o.key] }))}
        value={filter}
        onChange={setFilter}
      />

      {filtered.length === 0 ? (
        <Empty>No sprints in this view.</Empty>
      ) : (
        <VStack spacing={0} align="stretch">
          {filtered.map((s) => {
            const isPaid = s.payment_status === 'paid' || s.locked;
            const isDraft = s.is_billable === false;
            const statusColor = isPaid ? P.green : isDraft ? P.inkFaint : P.gold;
            return (
              <HStack key={s.id} py={3.5} spacing={4} borderBottom="1px solid" borderColor={P.hairSoft} role="group" _hover={{ bg: P.sheet }}>
                <Box w="6px" h="6px" borderRadius="full" bg={statusColor} flexShrink={0} />
                <Box flex={1} minW={0}>
                  <HStack spacing={2}>
                    <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" fontWeight="700">{s.sprint_number || 'unnumbered'}</Text>
                    {isDraft && <Text fontSize={TYPE.label} fontFamily="mono" color={P.inkFaint} textTransform="uppercase">Draft</Text>}
                  </HStack>
                  <Text color={P.ink} fontSize={TYPE.body} fontWeight="600" noOfLines={1}>{s.title}</Text>
                </Box>
                <Text color={isPaid ? P.green : P.ink} fontSize={TYPE.body} fontFamily="mono" fontWeight="700" minW="80px" textAlign="right">{currency(s.amount)}</Text>
              </HStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
};

// ============================================================
// INVOICES TAB
// ============================================================
const InvoicesTab = ({ invoices, loading, navigate }) => {
  if (loading) return <Loading label="loading invoices" />;

  if (invoices.length === 0) {
    return (
      <Empty action={<Button size="sm" onClick={() => navigate('/invoicing/')}>Create invoice</Button>}>
        No invoices yet.
      </Empty>
    );
  }

  return (
    <VStack spacing={0} align="stretch">
      {invoices.map((inv) => {
        const color = STATUS_COLORS[inv.status] || P.inkMuted;
        const outstanding = parseFloat(inv.total || 0) - parseFloat(inv.total_paid || 0);
        return (
          <HStack key={inv.id} py={4} spacing={4} borderBottom="1px solid" borderColor={P.hairSoft} cursor="pointer" onClick={() => navigate(`/invoicing/?invoice=${inv.id}`)} transition={`all ${FAST} ${EASE}`} _hover={{ bg: P.sheet }}>
            <Box w="6px" h="6px" borderRadius="full" bg={color} flexShrink={0} />
            <Box flex={1} minW={0}>
              <HStack spacing={2}>
                <Text color={P.ink} fontSize={TYPE.body} fontWeight="700" fontFamily="mono">{inv.invoice_number}</Text>
                <Text fontSize={TYPE.kicker} fontWeight="500" color={color} textTransform="uppercase" letterSpacing="0.1em" fontFamily="mono">{inv.status}</Text>
              </HStack>
              <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono" mt={0.5}>
                {inv.invoice_items?.length || 0} sprints · sent {inv.sent_at ? timeAgo(inv.sent_at) : 'never'}
              </Text>
            </Box>
            <VStack align="end" spacing={0}>
              <Text color={P.ink} fontSize={TYPE.body} fontWeight="700" fontFamily="mono">{currency(inv.total)}</Text>
              {outstanding > 0 && <Text color={P.gold} fontSize={TYPE.label} fontFamily="mono">{currency(outstanding)} due</Text>}
            </VStack>
          </HStack>
        );
      })}
    </VStack>
  );
};

// ============================================================
// PROJECTS TAB
// ============================================================
const ProjectsTab = ({ clientId, toast }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { fetchProjects(); }, [clientId]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from('projects').insert({ client_id: clientId, name: newName.trim(), status: 'active' }).select().single();
    if (error) { toast({ title: 'Failed to add', description: error.message, status: 'error' }); return; }
    setProjects([data, ...projects]);
    setNewName('');
    setShowAdd(false);
    toast({ title: 'Project added', status: 'success', duration: 1500 });
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { toast({ title: 'Failed to delete', description: error.message, status: 'error' }); return; }
    setProjects(projects.filter((p) => p.id !== id));
    toast({ title: 'Project removed', status: 'success', duration: 1500 });
  };

  if (loading) return <Loading label="loading projects" />;

  return (
    <VStack spacing={0} align="stretch">
      {projects.length === 0 && !showAdd && (
        <Empty>No projects yet.</Empty>
      )}

      {projects.map((p) => (
        <HStack key={p.id} py={3.5} spacing={3} borderBottom="1px solid" borderColor={P.hairSoft} role="group">
          <Icon as={TbFolder} boxSize={3.5} color={P.inkMuted} />
          <Box flex={1}>
            <Text color={P.ink} fontSize={TYPE.body} fontWeight="600">{p.name}</Text>
            {p.project_number && <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{p.project_number}</Text>}
          </Box>
          <Text fontSize={TYPE.kicker} color={p.status === 'active' ? P.limeDeep : P.inkFaint} fontFamily="mono" fontWeight="500" textTransform="uppercase" letterSpacing="0.1em">{p.status}</Text>
          <Box as="button" type="button" onClick={() => handleDelete(p.id)} opacity={0} transition="opacity 0.15s" _groupHover={{ opacity: 0.5 }} _hover={{ opacity: '1 !important', color: P.coral }} color={P.inkFaint}>
            <Icon as={TbTrash} boxSize={3.5} />
          </Box>
        </HStack>
      ))}

      {showAdd ? (
        <HStack spacing={2} py={3}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowAdd(false); setNewName(''); } }} />
          <Button size="md" onClick={handleAdd}>Add</Button>
          <Box as="button" type="button" onClick={() => { setShowAdd(false); setNewName(''); }} color={P.inkMuted} _hover={{ color: P.ink }}><Icon as={TbX} boxSize={4} /></Box>
        </HStack>
      ) : (
        <HStack py={4} spacing={1.5} as="button" type="button" onClick={() => setShowAdd(true)} color={P.limeDeep} _hover={{ color: P.ink }}>
          <Icon as={TbPlus} boxSize={3} />
          <Kicker color="inherit">Add project</Kicker>
        </HStack>
      )}
    </VStack>
  );
};

// ============================================================
// MESSAGES TAB
// ============================================================
const MessagesTab = ({ clientId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => { fetchMessages(); }, [clientId]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase.from('client_messages').select('*').eq('client_id', clientId).order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
    await supabase.from('client_messages').update({ read_by_team: true }).eq('client_id', clientId).eq('sender_type', 'client').eq('read_by_team', false);
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
      const { data, error } = await supabase.from('client_messages').insert({
        client_id: clientId, sender_id: user.id, sender_type: 'team',
        sender_name: profile?.display_name || 'NeonBurro', message: reply.trim(),
        read_by_team: true, read_by_client: false,
      }).select().single();
      if (error) throw error;
      setMessages([...messages, data]);
      setReply('');
    } catch (err) {
      toast({ title: 'Failed to send', description: err.message, status: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading label="loading messages" />;

  return (
    <VStack spacing={5} align="stretch">
      {messages.length === 0 ? (
        <Empty>No messages yet.</Empty>
      ) : (
        <VStack spacing={4} align="stretch" maxH="500px" overflowY="auto">
          {messages.map((m) => {
            const isTeam = m.sender_type === 'team';
            return (
              <HStack key={m.id} align="start" spacing={3} justify={isTeam ? 'flex-end' : 'flex-start'}>
                <VStack align={isTeam ? 'end' : 'start'} spacing={1} maxW="75%">
                  <Box bg={isTeam ? P.lime : P.sheet} color={isTeam ? P.limeInk : P.ink} border={isTeam ? 'none' : '1px solid'} borderColor={P.hair}
                    borderRadius="2xl" borderTopRightRadius={isTeam ? 'sm' : '2xl'} borderTopLeftRadius={isTeam ? '2xl' : 'sm'} px={INSET} py={2.5}>
                    <Text fontSize={TYPE.body} lineHeight="1.5" whiteSpace="pre-wrap" color={isTeam ? P.limeInk : P.ink}>{m.message}</Text>
                  </Box>
                  <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{m.sender_name} · {timeAgo(m.created_at)}</Text>
                </VStack>
              </HStack>
            );
          })}
        </VStack>
      )}

      <Box pt={4} borderTop="1px solid" borderColor={P.hair}>
        <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the client"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); } }} />
        <HStack justify="space-between" pt={2}>
          <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{'⌘'} + Enter to send</Text>
          <Button size="sm" onClick={handleSend} isLoading={sending} isDisabled={!reply.trim()}>Send reply</Button>
        </HStack>
      </Box>
    </VStack>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const ClientDetail = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();

  const [client, setClient] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchData(); }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    const [clientRes, invoicesRes, activityRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('invoices').select('*, invoice_items(*)').eq('client_id', clientId).is('cancelled_at', null).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
    ]);

    if (!clientRes.data) {
      toast({ title: 'Client not found', status: 'error', duration: 2000 });
      navigate('/clients/');
      return;
    }

    setClient(clientRes.data);
    const invs = invoicesRes.data || [];
    setInvoices(invs);
    setActivity(activityRes.data || []);
    setSprints(invs.flatMap((inv) => (inv.invoice_items || []).map((item) => ({ ...item, invoice_number: inv.invoice_number, invoice_status: inv.status }))));
    setLoading(false);
  };

  const refetchClient = async () => {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
    if (data) setClient(data);
  };

  const handleAvatarChange = (newUrl) => setClient((prev) => ({ ...prev, avatar_url: newUrl }));
  const handleEditSave = async () => { await refetchClient(); };

  if (loading) {
    return <Page><Loading label="loading the client" /></Page>;
  }

  if (!client) return null;

  const stats = {
    totalSprints: sprints.length,
    totalFunded: invoices.reduce((sum, inv) => sum + parseFloat(inv.total_paid || 0), 0),
    outstanding: invoices.filter((inv) => ['sent', 'viewed', 'overdue', 'partial'].includes(inv.status)).reduce((sum, inv) => sum + (parseFloat(inv.total || 0) - parseFloat(inv.total_paid || 0)), 0),
    totalInvoices: invoices.length,
  };

  const isActivated = !!client.portal_account_created_at;

  const actions = (
    <>
      <Button size="sm" variant="outline" leftIcon={<TbEdit size={13} />} onClick={onEditOpen}>Edit</Button>
      {!isActivated && <ActivateClientButton client={client} onActivated={refetchClient} />}
      <ImpersonateButton client={client} />
      <Button size="sm" onClick={() => navigate(`/invoicing/?client=${clientId}&new=true`)}>New invoice</Button>
    </>
  );

  return (
    <Page spacing={6}>
      <VStack align="stretch" spacing={4}>
        <HStack spacing={5} align="center">
          <ClientAvatarUpload clientId={client.id} clientName={client.name} avatarUrl={client.avatar_url} size={72} onChange={handleAvatarChange} />

          <Box flex={1} minW={0}>
            <Kicker>Client</Kicker>
            <HStack spacing={3} align="center" mt={1.5}>
              <Text fontSize={TYPE.title} fontWeight="600" color={P.ink} letterSpacing="-0.03em" lineHeight="1.1" noOfLines={2}>{client.name}</Text>
              <Box w="8px" h="8px" borderRadius="full" bg={client.status === 'active' ? P.green : P.inkFaint} flexShrink={0} />
            </HStack>
            <HStack spacing={3} flexWrap="wrap" rowGap={1} mt={1.5}>
              {client.company && <Text color={P.inkMuted} fontSize={TYPE.lede}>{client.company}</Text>}
              {client.tags?.map((tag) => (
                <Text key={tag} fontSize={TYPE.kicker} color={P.inkFaint} fontFamily="mono" textTransform="uppercase" letterSpacing="0.12em">{tag}</Text>
              ))}
            </HStack>
          </Box>
        </HStack>

        <HStack spacing={2} flexWrap="wrap" rowGap={2}>
          {actions}
        </HStack>
      </VStack>

      <Tabs items={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />

      <Box>
        {activeTab === 'overview' && <OverviewTab client={client} stats={stats} activity={activity} onClientUpdate={refetchClient} />}
        {activeTab === 'sprints' && <SprintsTab sprints={sprints} loading={false} />}
        {activeTab === 'invoices' && <InvoicesTab invoices={invoices} loading={false} navigate={navigate} />}
        {activeTab === 'subscriptions' && <SubscriptionsTab clientId={clientId} clientName={client.name} />}
        {activeTab === 'projects' && <ProjectsTab clientId={clientId} toast={toast} />}
        {activeTab === 'sites' && <SitesTab clientId={clientId} clientName={client.name} />}
        {activeTab === 'messages' && <MessagesTab clientId={clientId} />}
      </Box>

      <ClientModal isOpen={isEditOpen} onClose={onEditClose} client={client} onSave={handleEditSave} />
    </Page>
  );
};

export default ClientDetail;
