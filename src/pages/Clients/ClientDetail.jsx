// src/pages/Clients/ClientDetail.jsx
// path: /clients/:clientId/
//
// The client profile, on Paper. ONE OPEN PAGE, NO TABS.
//
// ── WHY THERE ARE NO TABS ───────────────────────────────────────────────────
// Until 2026-10-05 this page was a head and seven tabs, Overview, Sprints,
// Invoices, Recurring, Projects, Sites and Messages. Every question Tyler
// opened a client to answer sat one tap away from the first view, and the
// contacts entered for a client were not shown anywhere on this page, only
// inside the edit modal. His words that day: "When I click on a client or
// invoicing, I don't want to have to tap on details. I want things to be
// easily read, already opened."
//
// So everything renders at once, in two columns from lg up and one below.
//
//   the head     avatar, name, status, company, tags, the actions
//   the money    one strip across both columns, so on a phone it sits right
//                under the name and not below the whole card
//   main         invoices with their lines already listed, messages,
//                websites, projects, recurring, recent activity
//   the card     reach, bill to, people, portal access, notes. On one column
//                the card comes FIRST, because who they are and how to reach
//                them is the first thing anybody opens a client for.
//
// The Sprints tab is gone on purpose. A sprint is an invoice line, and every
// invoice row below lists its lines, so a second list of the same lines was
// the same facts twice. The sprint count still rides in the money strip.
//
// ── THE BILL TO CARD MIRRORS THE DOCUMENT ───────────────────────────────────
// billToLines() is the same rule as the Billed to block in
// src/lib/invoiceEmailTemplate.js. A business leads with the company and
// lists the contact as Attn, an individual leads with the name, then the
// address, then the email. If that block changes, change this one in the
// same commit, otherwise the card stops telling the truth about what the
// client receives. The template carries the same note pointing here.
//
// ── MESSAGES ARE MARKED READ ON OPEN ────────────────────────────────────────
// They used to be marked read only when the Messages tab was pressed. Now the
// thread is on the page, so opening the client marks them read, and the ones
// that were unread at that moment wear a gold dot and the word new for as
// long as the page is open, so nothing is marked read that was never shown.
//
// ── TRAPS ───────────────────────────────────────────────────────────────────
// invoices.due_date is a date with no time. new Date('2026-10-01') is UTC
// midnight, which in Ridgway is the evening of 30 September. parseDay()
// reads the three numbers as a local day instead. Do not swap it for a bare
// new Date on a due date.
//
// The deploy feed inside SitesTab once drew up to 200 rows. It shows the
// latest eight now, see that file.
//
// Every colour resolves from colors.paper. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Button, SimpleGrid, Grid, Input, useToast, useDisclosure,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TbMail, TbPhone, TbWorld, TbMapPin, TbPlus, TbFolder, TbTrash, TbX, TbEdit,
  TbAlertTriangle, TbChevronRight,
} from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST, INSET } from '../../theme/layout';
import { formatPhoneDisplay, timeAgo } from '../../utils/phone';
import { Page, Section, Plate, Empty, Loading, Kicker } from '../../components/common/Page';
import SitesTab from './components/SitesTab';
import SubscriptionsTab from './components/SubscriptionsTab';
import ClientModal from './components/ClientModal';
import ClientAvatarUpload from '../../components/common/ClientAvatarUpload';
import PortalAccessCard from '../../components/common/PortalAccessCard';
import ImpersonateButton from '../../components/common/ImpersonateButton';
import ActivateClientButton from '../../components/common/ActivateClientButton';

const P = colors.paper;

const STATUS_COLORS = {
  draft:   P.inkMuted,
  sent:    '#6C6F97',
  viewed:  P.gold,
  partial: P.gold,
  overdue: P.coral,
  paid:    P.green,
};

const OPEN_STATUSES = ['sent', 'viewed', 'overdue', 'partial'];

// Whole dollars when the figure is whole, cents when it is not. $87 reads as
// $87 and $17.40 does not round itself to $17.
const money = (val) => {
  const num = parseFloat(val || 0);
  const whole = Math.round(num * 100) % 100 === 0;
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
};

// A date only column read as a local day. See TRAPS in the header.
const parseDay = (val) => {
  if (!val) return null;
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

const shortDay = (val) => {
  const d = parseDay(val);
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
};

const isPast = (val) => {
  const d = parseDay(val);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const hrefFor = (site) => (site.startsWith('http') ? site : `https://${site}`);

// Same rule as the Billed to block in invoiceEmailTemplate.js. See the header.
const billToLines = (client) => {
  const primary = client.company || client.name || 'Client';
  const attn = client.company ? client.name : null;
  const lines = [];
  if (client.address_line1) lines.push(client.address_line1);
  if (client.address_line2) lines.push(client.address_line2);
  const cityRegion = [client.city, client.region].filter(Boolean).join(', ');
  const cityLine = [cityRegion, client.postal_code].filter(Boolean).join(' ').trim();
  if (cityLine) lines.push(cityLine);
  if (client.country && client.country.toUpperCase() !== 'US') lines.push(client.country);
  return { primary, attn, lines, email: client.email };
};

// One labelled line inside a card. Label on the left at a fixed width so a
// column of them reads down one edge.
const Fact = ({ label, children }) => (
  <HStack align="baseline" spacing={4} py={2.5} borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 'none' }}>
    <Kicker minW="76px" flexShrink={0}>{label}</Kicker>
    <Box flex={1} minW={0} fontSize={TYPE.body} color={P.ink} lineHeight="1.55">{children}</Box>
  </HStack>
);

const CardHead = ({ children, action }) => (
  <HStack justify="space-between" align="center" mb={2}>
    <Kicker>{children}</Kicker>
    {action}
  </HStack>
);

// ============================================================
// THE CARD, who they are and how to reach and bill them
// ============================================================
const ReachCard = ({ client, onEdit }) => {
  const hasAny = client.email || client.phone || client.website || client.address_line1 || client.city;
  return (
    <Plate>
      <CardHead action={<EditLink onClick={onEdit} />}>Reach</CardHead>
      {!hasAny ? (
        <Empty py={2}>Nothing on file yet. Edit the client to add a way to reach them.</Empty>
      ) : (
        <VStack align="stretch" spacing={0}>
          {client.email && (
            <Fact label="Email">
              <HStack spacing={2} as="a" href={`mailto:${client.email}`} color={P.ink} _hover={{ color: P.limeDeep }} minW={0}>
                <Icon as={TbMail} boxSize={3.5} color={P.inkFaint} flexShrink={0} />
                <Text noOfLines={1} wordBreak="break-all">{client.email}</Text>
              </HStack>
            </Fact>
          )}
          {client.phone && (
            <Fact label="Phone">
              <HStack spacing={2} as="a" href={`tel:${client.phone}`} color={P.ink} _hover={{ color: P.limeDeep }}>
                <Icon as={TbPhone} boxSize={3.5} color={P.inkFaint} flexShrink={0} />
                <Text fontFamily="mono">{formatPhoneDisplay(client.phone)}</Text>
              </HStack>
            </Fact>
          )}
          {client.website && (
            <Fact label="Website">
              <HStack spacing={2} as="a" href={hrefFor(client.website)} target="_blank" rel="noopener noreferrer" color={P.ink} _hover={{ color: P.limeDeep }} minW={0}>
                <Icon as={TbWorld} boxSize={3.5} color={P.inkFaint} flexShrink={0} />
                <Text noOfLines={1}>{client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
              </HStack>
            </Fact>
          )}
          {(client.address_line1 || client.city) && (
            <Fact label="Address">
              <HStack spacing={2} align="start">
                <Icon as={TbMapPin} boxSize={3.5} color={P.inkFaint} flexShrink={0} mt="3px" />
                <Text color={P.inkSec}>
                  {[client.address_line1, client.address_line2].filter(Boolean).join(', ')}
                  {(client.address_line1 || client.address_line2) && <br />}
                  {[[client.city, client.region].filter(Boolean).join(', '), client.postal_code].filter(Boolean).join(' ')}
                </Text>
              </HStack>
            </Fact>
          )}
          {client.timezone && (
            <Fact label="Timezone">
              <Text color={P.inkSec} fontFamily="mono" fontSize={TYPE.small}>{client.timezone.replace('_', ' ')}</Text>
            </Fact>
          )}
        </VStack>
      )}
    </Plate>
  );
};

const BillToCard = ({ client, contacts, onEdit }) => {
  const bill = billToLines(client);
  const ccs = contacts.filter((c) => c.is_billing && c.email && c.email !== client.email);
  const missingAddress = !client.address_line1 && !client.city;
  return (
    <Plate>
      <CardHead action={<EditLink onClick={onEdit} />}>Bill to, as the invoice prints it</CardHead>
      <VStack align="stretch" spacing={0.5} pt={1}>
        <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{bill.primary}</Text>
        {bill.attn && <Text fontSize={TYPE.small} color={P.inkSec}>Attn {bill.attn}</Text>}
        {bill.lines.map((line) => <Text key={line} fontSize={TYPE.small} color={P.inkSec}>{line}</Text>)}
        {bill.email && <Text fontSize={TYPE.small} color={P.inkSec}>{bill.email}</Text>}
      </VStack>
      {(ccs.length > 0 || client.tax_id || missingAddress) && (
        <VStack align="stretch" spacing={0} mt={3} pt={1} borderTop="1px solid" borderColor={P.hairSoft}>
          {ccs.length > 0 && (
            <Fact label="Copied">
              <Text color={P.inkSec} fontSize={TYPE.small}>{ccs.map((c) => c.email).join(', ')}</Text>
            </Fact>
          )}
          {client.tax_id && (
            <Fact label="EIN">
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec}>{client.tax_id}</Text>
            </Fact>
          )}
          {missingAddress && (
            <HStack spacing={2} pt={2.5}>
              <Icon as={TbAlertTriangle} boxSize={3.5} color={P.gold} />
              <Text fontSize={TYPE.small} color={P.inkMuted}>No billing address yet, the invoice will print the name and email only.</Text>
            </HStack>
          )}
        </VStack>
      )}
    </Plate>
  );
};

const PeopleCard = ({ contacts, onEdit }) => (
  <Plate>
    <CardHead action={<EditLink onClick={onEdit} label={contacts.length ? 'Edit' : 'Add'} />}>People</CardHead>
    {contacts.length === 0 ? (
      <Empty py={2}>Only the main contact so far. Add anyone else who works on this account or gets copied on invoices.</Empty>
    ) : (
      <VStack align="stretch" spacing={0}>
        {contacts.map((c) => (
          <Box key={c.id} py={3} borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 'none' }}>
            <HStack spacing={2} flexWrap="wrap" rowGap={1}>
              <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{c.name || c.email || 'Unnamed'}</Text>
              {c.is_primary && <Kicker color={P.limeDeep}>Primary</Kicker>}
              {c.is_billing && <Kicker color={P.inkMuted}>Bill to CC</Kicker>}
            </HStack>
            {c.role && <Text fontSize={TYPE.small} color={P.inkMuted}>{c.role}</Text>}
            <HStack spacing={3} mt={1} flexWrap="wrap" rowGap={0.5}>
              {c.email && (
                <Text as="a" href={`mailto:${c.email}`} fontSize={TYPE.small} color={P.inkSec} _hover={{ color: P.limeDeep }}>{c.email}</Text>
              )}
              {c.phone && (
                <Text as="a" href={`tel:${c.phone}`} fontSize={TYPE.small} fontFamily="mono" color={P.inkSec} _hover={{ color: P.limeDeep }}>{formatPhoneDisplay(c.phone)}</Text>
              )}
            </HStack>
          </Box>
        ))}
      </VStack>
    )}
  </Plate>
);

const EditLink = ({ onClick, label = 'Edit' }) => (
  <HStack as="button" type="button" spacing={1} onClick={onClick} color={P.inkFaint} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}>
    <Icon as={TbEdit} boxSize={3} />
    <Kicker color="inherit">{label}</Kicker>
  </HStack>
);

// ============================================================
// MAIN COLUMN
// ============================================================
const MoneyStrip = ({ stats }) => (
  <Plate>
    <SimpleGrid columns={{ base: 2, md: 4 }} spacingX={6} spacingY={5}>
      {[
        { label: 'Paid to date', value: money(stats.totalFunded), color: P.green },
        { label: 'Outstanding', value: money(stats.outstanding), color: stats.outstanding > 0 ? P.gold : P.inkFaint },
        { label: 'Invoices', value: stats.totalInvoices, color: P.inkSec },
        { label: 'Lines billed', value: stats.totalSprints, color: P.limeDeep },
      ].map((stat) => (
        <Box key={stat.label}>
          <HStack spacing={2}>
            <Box w="6px" h="6px" borderRadius="full" bg={stat.color} />
            <Kicker>{stat.label}</Kicker>
          </HStack>
          <Text fontFamily="mono" fontSize={TYPE.figure} fontWeight="600" color={P.ink} lineHeight="1" mt={2.5} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {stat.value}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  </Plate>
);

// What the row says under the number. Paid says when, open says when it is
// due and turns coral once that day has passed, a draft says it has not gone.
const invoiceWhen = (inv) => {
  if (inv.status === 'paid') return { text: inv.paid_at ? `paid ${shortDay(inv.paid_at)}` : 'paid', color: P.green };
  if (inv.status === 'draft') return { text: inv.due_date ? `draft, due ${shortDay(inv.due_date)}` : 'draft, not sent', color: P.inkMuted };
  if (inv.due_date) {
    const late = isPast(inv.due_date);
    return { text: `${late ? 'was due' : 'due'} ${shortDay(inv.due_date)}`, color: late ? P.coral : P.inkMuted };
  }
  return { text: inv.sent_at ? `sent ${shortDay(inv.sent_at)}` : 'sent', color: P.inkMuted };
};

const InvoicesSection = ({ invoices, navigate, clientId }) => (
  <Section
    kicker="Invoices"
    count={invoices.length || undefined}
    action={(
      <HStack as="button" type="button" spacing={1.5} onClick={() => navigate(`/invoicing/?client=${clientId}&new=true`)} color={P.limeDeep} _hover={{ color: P.ink }}>
        <Icon as={TbPlus} boxSize={3} />
        <Kicker color="inherit">New</Kicker>
      </HStack>
    )}
  >
    {invoices.length === 0 ? (
      <Empty>No invoices yet.</Empty>
    ) : (
      <Box borderTop="1px solid" borderColor={P.hair} mx={-INSET}>
        {invoices.map((inv) => {
          const color = STATUS_COLORS[inv.status] || P.inkMuted;
          const outstanding = parseFloat(inv.total || 0) - parseFloat(inv.total_paid || 0);
          const lines = (inv.invoice_items || []).filter((i) => i.is_billable !== false);
          const when = invoiceWhen(inv);
          return (
            <HStack
              key={inv.id}
              align="start"
              py={4}
              px={INSET}
              spacing={4}
              borderBottom="1px solid"
              borderColor={P.hairSoft}
              cursor="pointer"
              role="group"
              onClick={() => navigate(`/invoicing/?invoice=${inv.id}`)}
              transition={`all ${FAST} ${EASE}`}
              _hover={{ bg: P.sheet }}
            >
              <Box w="6px" h="6px" borderRadius="full" bg={color} flexShrink={0} mt="7px" />
              <Box flex={1} minW={0}>
                <HStack spacing={2.5} flexWrap="wrap" rowGap={0.5}>
                  <Text color={P.ink} fontSize={TYPE.body} fontWeight="700" fontFamily="mono">{inv.invoice_number || 'Draft'}</Text>
                  <Text fontSize={TYPE.kicker} fontWeight="500" color={color} textTransform="uppercase" letterSpacing="0.1em" fontFamily="mono">{inv.status}</Text>
                  <Text fontSize={TYPE.label} fontFamily="mono" color={when.color}>{when.text}</Text>
                </HStack>
                {lines.length > 0 ? (
                  <VStack align="stretch" spacing={0.5} mt={1.5}>
                    {lines.slice(0, 4).map((line) => (
                      <HStack key={line.id} spacing={3} justify="space-between" align="baseline">
                        <Text fontSize={TYPE.small} color={line.title ? P.inkSec : P.inkFaint} noOfLines={1}>
                          {line.title || 'Untitled line'}
                        </Text>
                        <Text fontSize={TYPE.small} fontFamily="mono" color={P.inkMuted} flexShrink={0} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {money(line.amount)}
                        </Text>
                      </HStack>
                    ))}
                    {lines.length > 4 && (
                      <Text fontSize={TYPE.label} fontFamily="mono" color={P.inkFaint}>and {lines.length - 4} more</Text>
                    )}
                  </VStack>
                ) : (
                  <Text fontSize={TYPE.small} color={P.inkFaint} mt={1}>No lines yet</Text>
                )}
              </Box>
              <VStack align="end" spacing={0} flexShrink={0} minW="84px">
                <Text color={P.ink} fontSize={TYPE.body} fontWeight="700" fontFamily="mono" sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(inv.total)}</Text>
                {outstanding > 0 && OPEN_STATUSES.includes(inv.status) && (
                  <Text color={P.gold} fontSize={TYPE.label} fontFamily="mono">{money(outstanding)} open</Text>
                )}
              </VStack>
              <Icon as={TbChevronRight} boxSize={4} color={P.inkFaint} flexShrink={0} mt="3px" opacity={0.5} _groupHover={{ opacity: 1, color: P.ink }} />
            </HStack>
          );
        })}
      </Box>
    )}
  </Section>
);

const ProjectsSection = ({ clientId, toast }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmId, setConfirmId] = useState(null);

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

  // Two presses. A project removed by a stray tap takes its name off every
  // invoice that pointed at it, the foreign key is set null.
  const handleDelete = async (id) => {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { toast({ title: 'Failed to delete', description: error.message, status: 'error' }); return; }
    setProjects(projects.filter((p) => p.id !== id));
    setConfirmId(null);
    toast({ title: 'Project removed', status: 'success', duration: 1500 });
  };

  const addAction = !showAdd && (
    <HStack as="button" type="button" spacing={1.5} onClick={() => setShowAdd(true)} color={P.limeDeep} _hover={{ color: P.ink }}>
      <Icon as={TbPlus} boxSize={3} />
      <Kicker color="inherit">Add</Kicker>
    </HStack>
  );

  return (
    <Section kicker="Projects" count={projects.length || undefined} action={addAction}>
      {loading ? (
        <Loading label="loading projects" py={2} />
      ) : (
        <VStack spacing={0} align="stretch">
          {projects.length === 0 && !showAdd && (
            <Empty py={2}>No projects yet. A project groups invoices under one piece of work.</Empty>
          )}

          {projects.map((p) => (
            <HStack key={p.id} py={3} spacing={3} borderBottom="1px solid" borderColor={P.hairSoft}>
              <Icon as={TbFolder} boxSize={3.5} color={P.inkMuted} />
              <Box flex={1} minW={0}>
                <Text color={P.ink} fontSize={TYPE.body} fontWeight="600" noOfLines={1}>{p.name}</Text>
                {p.project_number && <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{p.project_number}</Text>}
              </Box>
              <Text fontSize={TYPE.kicker} color={p.status === 'active' ? P.limeDeep : P.inkFaint} fontFamily="mono" fontWeight="500" textTransform="uppercase" letterSpacing="0.1em">{p.status}</Text>
              <HStack
                as="button"
                type="button"
                spacing={1}
                onClick={() => handleDelete(p.id)}
                color={confirmId === p.id ? P.coral : P.inkFaint}
                opacity={confirmId === p.id ? 1 : 0.55}
                _hover={{ opacity: 1, color: P.coral }}
                transition={`all ${FAST} ${EASE}`}
                aria-label="Remove project"
              >
                <Icon as={confirmId === p.id ? TbAlertTriangle : TbTrash} boxSize={3.5} />
                {confirmId === p.id && <Kicker color="inherit">Again</Kicker>}
              </HStack>
            </HStack>
          ))}

          {showAdd && (
            <HStack spacing={2} py={3}>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowAdd(false); setNewName(''); } }} />
              <Button size="md" onClick={handleAdd} isDisabled={!newName.trim()}>Add</Button>
              <Box as="button" type="button" onClick={() => { setShowAdd(false); setNewName(''); }} color={P.inkMuted} _hover={{ color: P.ink }} aria-label="Cancel"><Icon as={TbX} boxSize={4} /></Box>
            </HStack>
          )}
        </VStack>
      )}
    </Section>
  );
};

const MessagesSection = ({ clientId }) => {
  const [messages, setMessages] = useState([]);
  const [freshIds, setFreshIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => { fetchMessages(); }, [clientId]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase.from('client_messages').select('*').eq('client_id', clientId).order('created_at', { ascending: true });
    const rows = data || [];
    setMessages(rows);
    setFreshIds(rows.filter((m) => m.sender_type === 'client' && m.read_by_team === false).map((m) => m.id));
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
        sender_name: profile?.display_name || 'neonburro', message: reply.trim(),
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

  return (
    <Section kicker="Messages" count={freshIds.length ? `${freshIds.length} new` : (messages.length || undefined)}>
      {loading ? (
        <Loading label="loading messages" py={2} />
      ) : (
        <VStack spacing={4} align="stretch">
          {messages.length === 0 ? (
            <Empty py={2}>No messages yet. Anything written here shows in their portal.</Empty>
          ) : (
            <VStack spacing={4} align="stretch" maxH="420px" overflowY="auto" pr={1}>
              {messages.map((m) => {
                const isTeam = m.sender_type === 'team';
                const fresh = freshIds.includes(m.id);
                return (
                  <HStack key={m.id} align="start" spacing={3} justify={isTeam ? 'flex-end' : 'flex-start'}>
                    <VStack align={isTeam ? 'end' : 'start'} spacing={1} maxW="78%">
                      <Box bg={isTeam ? P.lime : P.sheet} border={isTeam ? 'none' : '1px solid'} borderColor={fresh ? P.gold : P.hair}
                        borderRadius="2xl" borderTopRightRadius={isTeam ? 'sm' : '2xl'} borderTopLeftRadius={isTeam ? '2xl' : 'sm'} px={INSET} py={2.5}>
                        <Text fontSize={TYPE.body} lineHeight="1.55" whiteSpace="pre-wrap" color={isTeam ? P.limeInk : P.ink}>{m.message}</Text>
                      </Box>
                      <HStack spacing={2}>
                        {fresh && <Box w="5px" h="5px" borderRadius="full" bg={P.gold} />}
                        <Text color={fresh ? P.gold : P.inkFaint} fontSize={TYPE.label} fontFamily="mono">
                          {fresh ? 'new · ' : ''}{m.sender_name} · {timeAgo(m.created_at)}
                        </Text>
                      </HStack>
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          )}

          <Box>
            <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write to the client, it lands in their portal"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); } }} />
            <HStack justify="space-between" pt={2}>
              <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{'⌘'} + Enter to send</Text>
              <Button size="sm" variant="outline" onClick={handleSend} isLoading={sending} isDisabled={!reply.trim()}>Send</Button>
            </HStack>
          </Box>
        </VStack>
      )}
    </Section>
  );
};

const ActivitySection = ({ activity }) => (
  activity.length === 0 ? null : (
    <Section kicker="Recent activity">
      <VStack spacing={0} align="stretch">
        {activity.slice(0, 10).map((a) => (
          <HStack key={a.id} spacing={3} py={2} borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 'none' }}>
            <Box w="5px" h="5px" borderRadius="full" bg={P.inkFaint} flexShrink={0} />
            <Text color={P.inkSec} fontSize={TYPE.small} flex={1} noOfLines={1}>
              {a.action?.replace(/_/g, ' ')}
              {a.metadata?.note && `, ${a.metadata.note}`}
            </Text>
            <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" flexShrink={0}>{timeAgo(a.created_at)}</Text>
          </HStack>
        ))}
      </VStack>
    </Section>
  )
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const ClientDetail = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();

  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    const [clientRes, invoicesRes, activityRes, contactsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('invoices').select('*, invoice_items(*)').eq('client_id', clientId).is('cancelled_at', null).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      supabase.from('client_contacts').select('*').eq('client_id', clientId).order('sort_order'),
    ]);

    if (!clientRes.data) {
      toast({ title: 'Client not found', status: 'error', duration: 2000 });
      navigate('/clients/');
      return;
    }

    setClient(clientRes.data);
    setInvoices(invoicesRes.data || []);
    setActivity(activityRes.data || []);
    setContacts(contactsRes.data || []);
    setLoading(false);
  };

  const refetchClient = async () => {
    const [{ data }, contactsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('client_contacts').select('*').eq('client_id', clientId).order('sort_order'),
    ]);
    if (data) setClient(data);
    setContacts(contactsRes.data || []);
  };

  const handleAvatarChange = (newUrl) => setClient((prev) => ({ ...prev, avatar_url: newUrl }));

  if (loading) {
    return <Page><Loading label="loading the client" /></Page>;
  }

  if (!client) return null;

  const lineCount = invoices.reduce((n, inv) => n + (inv.invoice_items || []).length, 0);
  const stats = {
    totalSprints: lineCount,
    totalFunded: invoices.reduce((sum, inv) => sum + parseFloat(inv.total_paid || 0), 0),
    outstanding: invoices.filter((inv) => OPEN_STATUSES.includes(inv.status)).reduce((sum, inv) => sum + (parseFloat(inv.total || 0) - parseFloat(inv.total_paid || 0)), 0),
    totalInvoices: invoices.length,
  };

  const isActivated = !!client.portal_account_created_at;
  const statusTone = client.status === 'active' ? P.green : client.status === 'lead' ? P.gold : P.inkFaint;

  return (
    <Page spacing={8}>
      {/* the head */}
      <VStack align="stretch" spacing={4}>
        <HStack spacing={5} align="center">
          <ClientAvatarUpload clientId={client.id} clientName={client.name} avatarUrl={client.avatar_url} size={72} onChange={handleAvatarChange} />
          <Box flex={1} minW={0}>
            <Kicker>{client.client_type === 'business' ? 'Business client' : 'Client'}</Kicker>
            <Text fontSize={TYPE.title} fontWeight="600" color={P.ink} letterSpacing="-0.03em" lineHeight="1.1" noOfLines={2} mt={1.5}>
              {client.name}
            </Text>
            <HStack spacing={3} flexWrap="wrap" rowGap={1} mt={2}>
              {client.company && <Text color={P.inkSec} fontSize={TYPE.lede} fontWeight="500">{client.company}</Text>}
              <HStack spacing={1.5}>
                <Box w="6px" h="6px" borderRadius="full" bg={statusTone} />
                <Text fontSize={TYPE.kicker} color={P.inkMuted} fontFamily="mono" textTransform="uppercase" letterSpacing="0.12em">{client.status || 'active'}</Text>
              </HStack>
              {client.tags?.map((tag) => (
                <Text key={tag} fontSize={TYPE.kicker} color={P.inkFaint} fontFamily="mono" textTransform="uppercase" letterSpacing="0.12em">{tag}</Text>
              ))}
            </HStack>
          </Box>
        </HStack>

        <HStack spacing={2} flexWrap="wrap" rowGap={2}>
          <Button size="sm" onClick={() => navigate(`/invoicing/?client=${clientId}&new=true`)}>New invoice</Button>
          <Button size="sm" variant="outline" leftIcon={<TbEdit size={13} />} onClick={onEditOpen}>Edit client</Button>
          {!isActivated && <ActivateClientButton client={client} onActivated={refetchClient} />}
          <ImpersonateButton client={client} />
        </HStack>
      </VStack>

      <MoneyStrip stats={stats} />

      <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1fr) 360px' }} gap={{ base: 8, lg: 10 }} alignItems="start">
        {/* main */}
        <VStack align="stretch" spacing={10} minW={0}>
          <InvoicesSection invoices={invoices} navigate={navigate} clientId={clientId} />
          <MessagesSection clientId={clientId} />
          <SitesTab clientId={clientId} clientName={client.name} />
          <ProjectsSection clientId={clientId} toast={toast} />
          <SubscriptionsTab clientId={clientId} clientName={client.name} />
          <ActivitySection activity={activity} />
        </VStack>

        {/* the card. first on one column, see the header */}
        <VStack align="stretch" spacing={4} order={{ base: -1, lg: 0 }} minW={0}>
          <ReachCard client={client} onEdit={onEditOpen} />
          <BillToCard client={client} contacts={contacts} onEdit={onEditOpen} />
          <PeopleCard contacts={contacts} onEdit={onEditOpen} />
          {client.notes && (
            <Plate sunken>
              <CardHead action={<EditLink onClick={onEditOpen} />}>Notes, team only</CardHead>
              <Text color={P.inkSec} fontSize={TYPE.body} lineHeight="1.7" whiteSpace="pre-wrap">{client.notes}</Text>
            </Plate>
          )}
          <Box pt={2}>
            <PortalAccessCard client={client} onUpdate={refetchClient} />
          </Box>
        </VStack>
      </Grid>

      <ClientModal isOpen={isEditOpen} onClose={onEditClose} client={client} onSave={refetchClient} />
    </Page>
  );
};

export default ClientDetail;
