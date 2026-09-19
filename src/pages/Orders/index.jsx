// src/pages/Orders/index.jsx
// SENTINEL: NB_PULSE_ORDERS_V1
//
// THE QUEUE. WHAT SOMEBODY PAID FOR AND NOBODY HAS MADE YET.
//
// Tyler, 2026-09-19. Every service the studio sells without a conversation
// lands in the same place, because they all work the same way underneath. A
// form takes the brief, Stripe takes the money, a row lands on the order book,
// and somebody here has to make the thing. This is the somebody here part.
//
// ── WHY THIS IS NOT THE FORMS INBOX ─────────────────────────────────────────
// Forms is inbound interest. This is money already taken, which is a different
// emotional state entirely. A form you can leave until Thursday. An order you
// cannot, because the confirmation email told them a person is on it. So this
// page sorts by oldest paid first rather than newest, which is the opposite of
// every other list in Pulse and is deliberate. The thing at the top is the
// thing somebody has been waiting longest for.
//
// ── WHERE THE ROWS COME FROM ────────────────────────────────────────────────
// public.reads on the shared project, the studio's order book, written by
// neonburro/netlify/functions/read-order.js. Three kinds today, the Sounding,
// the Reply Desk and email signatures. Two of them run themselves and land
// here already ready, which is fine, they still belong in the record. The
// manual kinds are the ones that need a person and they are the default filter.
//
// A kind is manual when nothing automated can finish it. That flag lives in
// neonburro/netlify/functions/_reads.js and is mirrored in KINDS below because
// Pulse cannot import from the studio repo. If a kind is added there, add it
// here in the same sitting.
//
// ── STATUS, AND WHAT EACH ONE MEANS FOR A PERSON ────────────────────────────
//   ordered   checkout opened, money never arrived. Not work, not a lead
//             either. Shown last and quietly, because a pile of abandoned
//             checkouts is worth knowing about and worth never mistaking for
//             the queue.
//   paid      money in, nothing delivered. THIS IS THE QUEUE.
//   running   an automated kind is working. Nothing to do.
//   ready     delivered. Done.
//   failed    an automated kind broke. A person has to look.
//
// Marking an order ready is the only write this page makes, and it is a status
// change, never a send. Nothing on this page emails anybody, which is the same
// rule the whole of Pulse follows.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Center, Spinner, Input, useToast, Tooltip,
} from '@chakra-ui/react';
import {
  TbCoin, TbSearch, TbCircleCheck, TbClock, TbAlertTriangle, TbExternalLink,
  TbArrowLeft, TbRefresh, TbMailForward, TbUserCircle,
} from 'react-icons/tb';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, EASE } from '../../theme/layout';

const P = colors.paper;

// Mirror of KINDS in neonburro/netlify/functions/_reads.js. Change both.
const KINDS = {
  signatures: { label: 'Email signatures', manual: true, hint: 'Five directions, a page they copy from. Deliver at /signatures/{slug}/.' },
  sounding: { label: 'The Sounding', manual: false, hint: 'Runs itself. If it is sitting on paid, the run did not fire.' },
  replies: { label: 'The Reply Desk', manual: false, hint: 'Runs itself. If it is sitting on paid, the run did not fire.' },
};
const kindOf = (row) => KINDS[row?.inputs?.service || row?.kind] || { label: row?.kind || 'unknown', manual: true, hint: '' };

const STATUS = {
  paid: { label: 'needs you', color: P.gold, icon: TbClock },
  running: { label: 'running', color: P.inkMuted, icon: TbRefresh },
  ready: { label: 'delivered', color: P.green, icon: TbCircleCheck },
  failed: { label: 'failed', color: P.coral, icon: TbAlertTriangle },
  refunded: { label: 'refunded', color: P.inkFaint, icon: TbArrowLeft },
  ordered: { label: 'never paid', color: P.inkFaint, icon: TbClock },
};
const statusOf = (row) => STATUS[row.status] || { label: row.status, color: P.inkFaint, icon: TbClock };

const money = (cents) => `$${((cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const FILTERS = [
  { key: 'queue', label: 'Needs you', match: (r) => r.status === 'paid' },
  { key: 'open', label: 'Everything paid', match: (r) => r.status !== 'ordered' },
  { key: 'done', label: 'Delivered', match: (r) => r.status === 'ready' },
  { key: 'abandoned', label: 'Never paid', match: (r) => r.status === 'ordered' },
];

const Pill = ({ active, children, ...rest }) => (
  <Box
    as="button" type="button" px={3.5} h="32px" borderRadius="full"
    border="1px solid" borderColor={active ? P.ink : P.hair}
    bg={active ? P.ink : 'transparent'} color={active ? P.sheet : P.inkMuted}
    fontSize={TYPE.label} fontWeight="600" whiteSpace="nowrap"
    transition={`all 160ms ${EASE}`} _hover={active ? {} : { borderColor: P.inkMuted, color: P.ink }}
    {...rest}
  >
    {children}
  </Box>
);

const Row = ({ row, selected, onSelect }) => {
  const kind = kindOf(row);
  const s = statusOf(row);
  const waited = row.paid_at || row.created_at;
  return (
    <Box
      as="button" type="button" onClick={() => onSelect(row.id)} textAlign="left" w="100%"
      px={4} py={3.5} borderBottom="1px solid" borderColor={P.hairSoft}
      borderLeft="3px solid" borderLeftColor={selected ? P.lime : 'transparent'}
      bg={selected ? P.sheet : 'transparent'}
      transition={`all 140ms ${EASE}`} _hover={{ bg: P.sheet }}
    >
      <HStack spacing={3} align="start">
        <VStack align="start" spacing={0} flex={1} minW={0}>
          <HStack spacing={2} flexWrap="wrap" rowGap={1}>
            <Text fontSize={TYPE.body} fontWeight="700" color={P.ink} noOfLines={1}>{row.business || 'No business'}</Text>
            <Text fontSize={TYPE.micro} fontFamily="mono" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={s.color}>{s.label}</Text>
          </HStack>
          <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>
            {kind.label}{row.first_name ? ` · ${row.first_name}` : ''}
          </Text>
        </VStack>
        <VStack align="end" spacing={0} flexShrink={0}>
          {/* The dollar is the point of this page. Lime when the money is real. */}
          <Text fontSize={TYPE.body} fontFamily="mono" fontWeight="700" color={row.status === 'ordered' ? P.inkFaint : P.limeDeep}>
            {money(row.amount_cents)}
          </Text>
          <Text fontSize={TYPE.micro} fontFamily="mono" color={P.inkFaint} whiteSpace="nowrap">
            {waited ? formatDistanceToNow(new Date(waited), { addSuffix: true }) : ''}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
};

const Field = ({ label, children }) => (
  <Box py={3} borderBottom="1px solid" borderColor={P.hairSoft}>
    <Text fontSize={TYPE.micro} fontFamily="mono" fontWeight="600" letterSpacing="0.16em" textTransform="uppercase" color={P.inkMuted}>{label}</Text>
    <Box mt={1.5} fontSize={TYPE.body} color={P.ink} lineHeight="1.6" wordBreak="break-word">{children || <Text color={P.inkFaint}>none</Text>}</Box>
  </Box>
);

const Detail = ({ row, onMarkReady, working }) => {
  const kind = kindOf(row);
  const s = statusOf(row);
  return (
    <Box p={{ base: 5, md: 7 }}>
      <HStack justify="space-between" align="start" spacing={4} flexWrap="wrap" rowGap={3}>
        <Box minW={0}>
          <Text fontSize={TYPE.micro} fontFamily="mono" fontWeight="600" letterSpacing="0.16em" textTransform="uppercase" color={s.color}>
            {kind.label} · {s.label}
          </Text>
          <Text mt={2} fontSize={TYPE.title} fontWeight="700" color={P.ink} letterSpacing="-0.02em" lineHeight="1.15">
            {row.business || 'No business'}
          </Text>
        </Box>
        <VStack align="end" spacing={0}>
          <Text fontSize={TYPE.hero} fontFamily="mono" fontWeight="700" color={row.status === 'ordered' ? P.inkFaint : P.limeDeep} lineHeight="1">
            {money(row.amount_cents)}
          </Text>
          <Text fontSize={TYPE.micro} fontFamily="mono" color={P.inkFaint}>
            {row.paid_at ? `paid ${format(new Date(row.paid_at), 'MMM d, h:mm a')}` : 'not paid'}
          </Text>
        </VStack>
      </HStack>

      {kind.hint && (
        <Box mt={5} p={3.5} borderRadius="10px" bg={P.sunken} borderLeft="3px solid" borderColor={P.lime}>
          <Text fontSize={TYPE.small} color={P.inkSec} lineHeight="1.6">{kind.hint}</Text>
        </Box>
      )}

      <Box mt={5}>
        <Field label="who">
          <HStack spacing={2} align="center" flexWrap="wrap" rowGap={1}>
            <Icon as={TbUserCircle} boxSize={4} color={P.inkMuted} />
            <Text>{row.first_name || 'no name given'}</Text>
            {row.email && (
              <Box as="a" href={`mailto:${row.email}`} color={P.limeDeep} fontWeight="600" textDecoration="none" _hover={{ textDecoration: 'underline' }}>
                {row.email}
              </Box>
            )}
          </HStack>
        </Field>
        <Field label="title or town">{row.town}</Field>
        <Field label="website">
          {row.url ? (
            <HStack as="a" href={row.url} target="_blank" rel="noreferrer" spacing={1.5} color={P.limeDeep} _hover={{ textDecoration: 'underline' }}>
              <Text fontWeight="600">{row.url}</Text>
              <Icon as={TbExternalLink} boxSize={3.5} />
            </HStack>
          ) : null}
        </Field>
        <Field label="the brief">
          {row.note ? <Text whiteSpace="pre-wrap">{row.note}</Text> : null}
        </Field>
        <Field label="ordered">
          {row.created_at ? format(new Date(row.created_at), 'EEEE, MMMM d, yyyy, h:mm a') : null}
        </Field>
        <Field label="row">
          <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>{row.id}</Text>
        </Field>
      </Box>

      {row.status === 'paid' && (
        <HStack mt={6} spacing={3} flexWrap="wrap" rowGap={3}>
          <Box
            as="button" type="button" onClick={() => onMarkReady(row)} disabled={working}
            h="44px" px={6} borderRadius="10px" bg={P.ink} color={P.sheet}
            fontSize={TYPE.body} fontWeight="700" opacity={working ? 0.5 : 1}
            cursor={working ? 'wait' : 'pointer'}
            transition={`all 160ms ${EASE}`} _hover={working ? {} : { bg: P.limeDeep }}
          >
            {working ? 'Marking' : 'Mark delivered'}
          </Box>
          <Tooltip label="Nothing on this page emails anybody. Send from your own mail, the way the two live clients were sent." placement="top">
            <HStack spacing={1.5} color={P.inkFaint}>
              <Icon as={TbMailForward} boxSize={4} />
              <Text fontSize={TYPE.small}>sending is still by hand</Text>
            </HStack>
          </Tooltip>
        </HStack>
      )}
    </Box>
  );
};

const Orders = () => {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('queue');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reads')
      .select('id, kind, inputs, status, email, first_name, business, town, category, url, note, amount_cents, created_at, paid_at, ready_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) console.error('[orders]', error.message);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => f.match(r) && (!q
      || (r.business || '').toLowerCase().includes(q)
      || (r.email || '').toLowerCase().includes(q)
      || (r.first_name || '').toLowerCase().includes(q)));
    // Oldest first in the queue, newest first everywhere else. See the header.
    return filter === 'queue'
      ? [...list].sort((a, b) => new Date(a.paid_at || a.created_at) - new Date(b.paid_at || b.created_at))
      : list;
  }, [rows, filter, search]);

  const selected = shown.find((r) => r.id === selectedId) || rows.find((r) => r.id === selectedId) || null;

  const counts = useMemo(() => ({
    queue: rows.filter((r) => r.status === 'paid').length,
    owed: rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + (r.amount_cents || 0), 0),
  }), [rows]);

  const markReady = async (row) => {
    setWorking(true);
    const { error } = await supabase
      .from('reads')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'Could not mark it', description: error.message, status: 'error', duration: 5000 });
    } else {
      toast({ title: 'Marked delivered', description: `${row.business} is off the queue.`, status: 'success', duration: 3000 });
      await load();
    }
    setWorking(false);
  };

  return (
    <Box minH="100vh" bg={P.mat}>
      <Box px={{ base: 4, md: 8 }} pt={{ base: 5, md: 8 }} pb={4}>
        <HStack justify="space-between" align="end" flexWrap="wrap" rowGap={3}>
          <Box>
            <HStack spacing={2.5}>
              <Icon as={TbCoin} boxSize={5} color={P.limeDeep} />
              <Text fontSize={TYPE.title} fontWeight="700" color={P.ink} letterSpacing="-0.02em">Orders</Text>
            </HStack>
            <Text mt={1} fontSize={TYPE.small} color={P.inkMuted}>
              {counts.queue > 0
                ? `${counts.queue} paid and waiting on somebody here, ${money(counts.owed)} taken.`
                : 'Nothing is waiting. Everything paid has been delivered.'}
            </Text>
          </Box>
          <HStack spacing={2}>
            <Icon as={TbSearch} boxSize={4} color={P.inkFaint} />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Business, name or email" aria-label="Search orders"
              size="sm" w={{ base: '160px', md: '240px' }} bg={P.sheet}
              border="1px solid" borderColor={P.hair} borderRadius="10px" color={P.ink}
              _placeholder={{ color: P.inkFaint }} _focus={{ borderColor: P.lime, boxShadow: 'none' }}
            />
          </HStack>
        </HStack>
        <HStack mt={4} spacing={2} flexWrap="wrap" rowGap={2}>
          {FILTERS.map((f) => (
            <Pill key={f.key} active={filter === f.key} onClick={() => { setFilter(f.key); setSelectedId(null); }}>
              {f.label}
              {f.key === 'queue' && counts.queue > 0 ? ` ${counts.queue}` : ''}
            </Pill>
          ))}
        </HStack>
      </Box>

      <Box
        px={{ base: 0, md: 8 }} pb={{ base: 24, md: 10 }}
        display={{ base: 'block', lg: 'grid' }}
        gridTemplateColumns={{ lg: 'minmax(320px, 420px) minmax(0, 1fr)' }}
        gap={{ lg: 6 }}
      >
        <Box bg={P.sheet} borderRadius={{ base: 0, md: '14px' }} border="1px solid" borderColor={P.hair} overflow="hidden" alignSelf="start">
          {loading ? (
            <Center py={16}><Spinner size="md" color={P.limeDeep} thickness="2px" /></Center>
          ) : shown.length === 0 ? (
            <Center py={16} px={6}>
              <Text fontSize={TYPE.small} color={P.inkMuted} textAlign="center">
                Nothing here. Try another filter.
              </Text>
            </Center>
          ) : (
            shown.map((r) => (
              <Row key={r.id} row={r} selected={r.id === selectedId} onSelect={setSelectedId} />
            ))
          )}
        </Box>

        <Box
          display={{ base: selected ? 'block' : 'none', lg: 'block' }}
          mt={{ base: 4, lg: 0 }} mx={{ base: 4, md: 0 }}
          bg={P.sheet} borderRadius="14px" border="1px solid" borderColor={P.hair} alignSelf="start"
        >
          {selected ? (
            <Detail row={selected} onMarkReady={markReady} working={working} />
          ) : (
            <Center py={20} px={8}>
              <Text fontSize={TYPE.small} color={P.inkMuted} textAlign="center" maxW="34ch" lineHeight="1.7">
                Pick an order to see the brief, what they paid and everything they told us.
              </Text>
            </Center>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Orders;
