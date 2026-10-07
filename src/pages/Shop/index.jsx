// src/pages/Shop/index.jsx
// SENTINEL: NB_PULSE_SHOP_V1
//
// THE SHOP'S SALES, IN PULSE.
//
// Tyler, 2026-10-07: "we got to make this interactive with Pulse because our
// shop will get our sales and stuff in Pulse." shop.neonburro.com and Pulse
// sit on the one shared Supabase project, so this room reads the shop's own
// ledger directly. There is no copy and no sync job, so nothing can drift.
//
// ── WHERE THE ROWS COME FROM ────────────────────────────────────────────────
// public.shop_orders, written by the shop repo (neonburro-shop):
//   create-payment-intent.js   a card, wallet, Link or stablecoin order, rail
//                              stripe, written pending before Stripe answers
//   stripe-payment-webhook.js  moves it to processing, paid, failed, refunded
//   solana-pay-request.js      a direct USDC or SOL order, rail solana_direct
//   _solana.js settleRow       moves that one to paid when the chain shows it
// The lines in items are the server's own priced lines, never the browser's,
// see _shop-catalog.js in the shop. A paid order has already taken its stock
// and written a shop_order_paid line to activity_log, which is how a sale
// reaches the Today page.
//
// public.shop_inventory is the stock. Checkout refuses a piece that ships if
// its row is older than seven days (INVENTORY_FRESH_MS in the shop's
// _shop-catalog.js). STALE_DAYS below must match it. A count here writes
// on_hand and updated_at together, which is what makes a row fresh.
//
// ── WHAT THIS ROOM MAY CHANGE, AND WHAT IT NEVER DOES ───────────────────────
// Read mostly, Warbleur's line on 2026-10-07. Staff move a paid order to
// fulfilled and back, and set a stock count. That is all. pending,
// processing, failed, expired and refunded belong to Stripe and the chain,
// and this page shows them and never argues with them. The database holds the
// same line on its own: the policies in the shop repo's
// supabase/migrations/20261007150000_shop_orders_into_pulse.sql let is_staff()
// update only status and fulfilled_at, and only between paid and fulfilled.
// Every write here asks for the row back, because row level security refuses
// by returning nothing rather than by raising, and a silent nothing must never
// read as saved.
//
// ── IF THE LEDGER IS NOT THERE ──────────────────────────────────────────────
// Until both shop migrations are applied the select errors. The page says so
// in one plain line rather than showing an error to staff. Warbleur holds
// this room until the migrations exist anyway.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Button, Input, useToast,
} from '@chakra-ui/react';
import { TbExternalLink, TbUserCircle, TbTruckDelivery } from 'react-icons/tb';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, INSET, EASE, FAST, PLATE_PAD } from '../../theme/layout';
import {
  Page, PageHead, SearchBox, Tabs, Plate, Empty, Loading, Kicker, Stats,
} from '../../components/common/Page';

const P = colors.paper;

// Must match INVENTORY_FRESH_MS in neonburro-shop netlify/functions/_shop-catalog.js.
const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS = {
  paid: { label: 'paid, to send', color: P.gold },
  fulfilled: { label: 'sent', color: P.green },
  pending: { label: 'never paid', color: P.inkFaint },
  processing: { label: 'clearing', color: P.inkMuted },
  failed: { label: 'failed', color: P.coral },
  expired: { label: 'expired', color: P.inkFaint },
  refunded: { label: 'refunded', color: P.inkFaint },
};
const statusOf = (row) => STATUS[row.status] || { label: row.status, color: P.inkFaint };
const isPaid = (row) => row.status === 'paid' || row.status === 'fulfilled';

const usd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const lines = (row) => (Array.isArray(row.items) ? row.items : []);
const ships = (row) => lines(row).some((line) => line.delivery !== 'digital');
const pieces = (row) => lines(row).reduce((n, line) => n + Number(line.quantity || 0), 0);
const railLabel = (row) => (row.rail === 'solana_direct' ? `${row.currency} direct` : 'Stripe');
const who = (row) => row.customer?.name || row.customer?.email || 'no name given';

const lineText = (line) => [
  line.name,
  line.selectedDesign,
  line.selectedSize,
  line.selectedTier,
].filter(Boolean).join(' · ');

const shipTo = (customer = {}) => {
  if (customer.city) {
    return [customer.name, customer.address, `${customer.city}, ${customer.state || ''} ${customer.zip || ''}`.trim()]
      .filter(Boolean).join('\n');
  }
  return [customer.name, customer.address].filter(Boolean).join('\n');
};

const FILTERS = [
  { key: 'send', label: 'To send', match: (r) => r.status === 'paid' },
  { key: 'paid', label: 'Everything paid', match: isPaid },
  { key: 'sent', label: 'Sent', match: (r) => r.status === 'fulfilled' },
  { key: 'unpaid', label: 'Not paid', match: (r) => !isPaid(r) },
  { key: 'stock', label: 'Stock', match: () => false },
];

// ── one order in the list ───────────────────────────────────────────────────
const Row = ({ row, selected, onSelect }) => {
  const s = statusOf(row);
  const when = row.paid_at || row.created_at;
  return (
    <Box
      as="button" type="button" onClick={() => onSelect(row.id)} textAlign="left" w="100%"
      px={INSET} py={3.5} borderBottom="1px solid" borderColor={P.hairSoft}
      borderLeft="3px solid" borderLeftColor={selected ? P.ink : 'transparent'}
      bg={selected ? P.sunken : 'transparent'}
      transition={`all ${FAST} ${EASE}`} _hover={{ bg: P.sunken }}
    >
      <HStack spacing={3} align="start">
        <VStack align="start" spacing={0} flex={1} minW={0}>
          <HStack spacing={2} flexWrap="wrap" rowGap={1}>
            <Text fontSize={TYPE.body} fontWeight="700" color={P.ink} noOfLines={1}>{who(row)}</Text>
            <Kicker color={s.color}>{s.label}</Kicker>
          </HStack>
          <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>
            {pieces(row)} {pieces(row) === 1 ? 'piece' : 'pieces'} · {lines(row).map((line) => line.name).join(', ')}
          </Text>
        </VStack>
        <VStack align="end" spacing={0} flexShrink={0}>
          <Text fontSize={TYPE.body} fontFamily="mono" fontWeight="700" color={isPaid(row) ? P.green : P.inkFaint}>
            {usd(row.amount_usd)}
          </Text>
          <Text fontSize={TYPE.micro} fontFamily="mono" color={P.inkFaint} whiteSpace="nowrap">
            {railLabel(row)} · {when ? formatDistanceToNow(new Date(when), { addSuffix: true }) : ''}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
};

const Field = ({ label, children }) => (
  <Box py={3} borderBottom="1px solid" borderColor={P.hairSoft}>
    <Kicker>{label}</Kicker>
    <Box mt={1.5} fontSize={TYPE.body} color={P.ink} lineHeight="1.6" wordBreak="break-word">
      {children || <Text color={P.inkFaint}>none</Text>}
    </Box>
  </Box>
);

const Ext = ({ href, children }) => (
  <HStack as="a" href={href} target="_blank" rel="noreferrer" spacing={1.5} color={P.limeDeep} _hover={{ textDecoration: 'underline' }}>
    <Text fontWeight="600">{children}</Text>
    <Icon as={TbExternalLink} boxSize={3.5} />
  </HStack>
);

// ── one order, open ─────────────────────────────────────────────────────────
const Detail = ({ row, onShip, working }) => {
  const s = statusOf(row);
  const shipping = ships(row);
  const email = row.customer?.email;
  return (
    <Box p={PLATE_PAD}>
      <HStack justify="space-between" align="start" spacing={4} flexWrap="wrap" rowGap={3}>
        <Box minW={0}>
          <Kicker color={s.color}>{railLabel(row)} · {s.label}</Kicker>
          <Text mt={2} fontSize={TYPE.title} fontWeight="600" color={P.ink} letterSpacing="-0.02em" lineHeight="1.15">
            {who(row)}
          </Text>
        </Box>
        <VStack align="end" spacing={0}>
          <Text fontSize={TYPE.figure} fontFamily="mono" fontWeight="700" color={isPaid(row) ? P.green : P.inkFaint} lineHeight="1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {usd(row.amount_usd)}
          </Text>
          <Text fontSize={TYPE.micro} fontFamily="mono" color={P.inkFaint}>
            {row.paid_at ? `paid ${format(new Date(row.paid_at), 'MMM d, h:mm a')}` : 'not paid'}
          </Text>
        </VStack>
      </HStack>

      <Box mt={5}>
        <Field label="what">
          <VStack align="stretch" spacing={1}>
            {lines(row).map((line, i) => (
              <HStack key={`${line.id}-${i}`} justify="space-between" align="baseline" spacing={3}>
                <Text minW={0}>
                  <Text as="span" fontFamily="mono" color={P.inkMuted}>{line.quantity} </Text>
                  {lineText(line)}
                  {line.delivery === 'digital' && <Text as="span" color={P.inkFaint}> · by email</Text>}
                  {line.reloadCode && <Text as="span" fontFamily="mono" color={P.inkMuted}> · reload {line.reloadCode}</Text>}
                </Text>
                <Text fontFamily="mono" color={P.inkMuted} flexShrink={0}>{usd(Number(line.price) * Number(line.quantity))}</Text>
              </HStack>
            ))}
          </VStack>
        </Field>
        <Field label="who">
          <HStack spacing={2} align="center" flexWrap="wrap" rowGap={1}>
            <Icon as={TbUserCircle} boxSize={4} color={P.inkMuted} />
            <Text>{row.customer?.name || 'no name given'}</Text>
            {email && (
              <Box as="a" href={`mailto:${email}`} color={P.limeDeep} fontWeight="600" textDecoration="none" _hover={{ textDecoration: 'underline' }}>
                {email}
              </Box>
            )}
          </HStack>
        </Field>
        {shipping && (
          <Field label="ship to">
            {shipTo(row.customer) ? <Text whiteSpace="pre-wrap">{shipTo(row.customer)}</Text> : <Text color={P.coral}>no address, ask before sending</Text>}
          </Field>
        )}
        <Field label="how it was paid">
          {row.rail === 'solana_direct' ? (
            <VStack align="start" spacing={1}>
              <Text>
                {row.amount_token ? `${Number(row.amount_token)} ${row.currency}` : row.currency} straight to the studio wallet
              </Text>
              <Ext href={`https://solscan.io/account/${row.provider_reference}`}>the transfer on Solscan</Ext>
            </VStack>
          ) : (
            <Ext href={`https://dashboard.stripe.com/payments/${row.provider_reference}`}>this payment in Stripe</Ext>
          )}
        </Field>
        <Field label="ordered">
          {row.created_at ? format(new Date(row.created_at), 'EEEE, MMMM d, yyyy, h:mm a') : null}
        </Field>
        {row.fulfilled_at && (
          <Field label="sent">{format(new Date(row.fulfilled_at), 'EEEE, MMMM d, yyyy, h:mm a')}</Field>
        )}
        <Field label="order">
          <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>{row.id}</Text>
        </Field>
      </Box>

      {row.status === 'paid' && (
        <HStack mt={6} spacing={3} flexWrap="wrap" rowGap={3}>
          <Button size="md" leftIcon={<Icon as={TbTruckDelivery} />} onClick={() => onShip(row, true)} isDisabled={working} isLoading={working} loadingText="Marking">
            {shipping ? 'Mark sent' : 'Mark delivered'}
          </Button>
          <Text fontSize={TYPE.small} color={P.inkFaint}>Nothing here emails the customer.</Text>
        </HStack>
      )}
      {row.status === 'fulfilled' && (
        <Box mt={6}>
          <Button size="md" variant="ghost" onClick={() => onShip(row, false)} isDisabled={working} isLoading={working} loadingText="Undoing">
            Not sent after all
          </Button>
        </Box>
      )}
    </Box>
  );
};

// ── stock ───────────────────────────────────────────────────────────────────
const ageOf = (row) => {
  const t = new Date(row.updated_at).getTime();
  return Number.isFinite(t) ? Date.now() - t : Infinity;
};

const StockRow = ({ row, onCount, busy }) => {
  const [value, setValue] = useState(String(row.on_hand ?? 0));
  useEffect(() => { setValue(String(row.on_hand ?? 0)); }, [row.on_hand, row.updated_at]);
  const stale = ageOf(row) > STALE_DAYS * DAY_MS;
  const valid = /^\d{1,5}$/.test(value.trim());
  return (
    <HStack px={INSET} py={3} spacing={3} borderBottom="1px solid" borderColor={P.hairSoft} align="center" flexWrap="wrap" rowGap={2}>
      <VStack align="start" spacing={0} flex="1 1 200px" minW={0}>
        <Text fontSize={TYPE.body} fontWeight="700" color={P.ink} fontFamily="mono" noOfLines={1}>
          {row.variant_id || 'one kind'}
        </Text>
        <Text fontSize={TYPE.micro} fontFamily="mono" color={stale ? P.coral : P.inkFaint}>
          {stale
            ? `count is stale, checkout refuses it${Number.isFinite(ageOf(row)) ? `, last counted ${formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}` : ''}`
            : `counted ${formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}`}
        </Text>
      </VStack>
      <HStack spacing={2} flexShrink={0}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          w="84px"
          textAlign="right"
          fontFamily="mono"
          aria-label={`On hand for ${row.product_id} ${row.variant_id || ''}`}
        />
        <Button size="md" variant="outline" onClick={() => onCount(row, Number(value.trim()))} isDisabled={!valid || busy} isLoading={busy} loadingText="Saving">
          Counted
        </Button>
      </HStack>
    </HStack>
  );
};

const Stock = ({ rows, loading, error, onCount, busyKey }) => {
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.product_id)) map.set(row.product_id, []);
      map.get(row.product_id).push(row);
    });
    return [...map.entries()];
  }, [rows]);

  if (loading) return <Plate pad={false}><Loading label="loading stock" px={INSET} /></Plate>;
  if (error) return <Plate pad={false}><Empty px={INSET}>The stock is not readable yet. It needs the two shop migrations applied.</Empty></Plate>;
  if (!groups.length) return <Plate pad={false}><Empty px={INSET}>No stock rows yet.</Empty></Plate>;

  return (
    <VStack align="stretch" spacing={5}>
      <Text fontSize={TYPE.small} color={P.inkMuted} maxW="620px" lineHeight="1.6">
        A count is good for {STALE_DAYS} days. After that checkout refuses the piece until somebody counts it again, even when the number has not changed. Pressing Counted with the same number is a real count.
      </Text>
      {groups.map(([product, list]) => (
        <Plate key={product} pad={false}>
          <Box px={INSET} pt={3.5} pb={2} borderBottom="1px solid" borderColor={P.hairSoft}>
            <Kicker>{product}</Kicker>
          </Box>
          {list.map((row) => (
            <StockRow key={`${row.product_id}:${row.variant_id || ''}`} row={row} onCount={onCount} busy={busyKey === `${row.product_id}:${row.variant_id || ''}`} />
          ))}
        </Plate>
      ))}
    </VStack>
  );
};

// ── the room ────────────────────────────────────────────────────────────────
const Shop = () => {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [stockError, setStockError] = useState(false);
  const [filter, setFilter] = useState('send');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [working, setWorking] = useState(false);
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([
      supabase
        .from('shop_orders')
        .select('id, rail, provider_reference, status, currency, amount_usd, amount_token, customer, items, created_at, paid_at, fulfilled_at')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('shop_inventory')
        .select('product_id, variant_id, on_hand, updated_at')
        .order('product_id')
        .order('variant_id'),
    ]);
    if (o.error) console.error('[shop] orders', o.error.message);
    if (s.error) console.error('[shop] stock', s.error.message);
    setOrdersError(Boolean(o.error));
    setStockError(Boolean(s.error));
    setOrders(o.data || []);
    setStock(s.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    const q = search.trim().toLowerCase();
    const list = orders.filter((r) => f.match(r) && (!q
      || (r.customer?.name || '').toLowerCase().includes(q)
      || (r.customer?.email || '').toLowerCase().includes(q)
      || lines(r).some((line) => (line.name || '').toLowerCase().includes(q))));
    // Oldest first in the send queue, the one waiting longest is on top, the
    // same rule as the Orders room. Newest first everywhere else.
    return filter === 'send'
      ? [...list].sort((a, b) => new Date(a.paid_at || a.created_at) - new Date(b.paid_at || b.created_at))
      : list;
  }, [orders, filter, search]);

  const selected = orders.find((r) => r.id === selectedId) || null;

  const numbers = useMemo(() => {
    const paid = orders.filter(isPaid);
    const now = new Date();
    const month = paid.filter((r) => {
      const d = new Date(r.paid_at || r.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return {
      toSend: orders.filter((r) => r.status === 'paid').length,
      month: month.reduce((n, r) => n + Number(r.amount_usd || 0), 0),
      monthCount: month.length,
      all: paid.reduce((n, r) => n + Number(r.amount_usd || 0), 0),
      stale: stock.filter((r) => ageOf(r) > STALE_DAYS * DAY_MS).length,
    };
  }, [orders, stock]);

  const ship = async (row, sent) => {
    setWorking(true);
    const { data, error } = await supabase
      .from('shop_orders')
      .update(sent
        ? { status: 'fulfilled', fulfilled_at: new Date().toISOString() }
        : { status: 'paid', fulfilled_at: null })
      .eq('id', row.id)
      .eq('status', sent ? 'paid' : 'fulfilled')
      .select('id');
    if (error || !data?.length) {
      toast({
        title: 'Not saved',
        description: error?.message || 'The order changed or your role cannot mark it. Nothing was changed.',
        status: 'error',
        duration: 5000,
      });
    } else {
      toast({ title: sent ? 'Marked sent' : 'Back on the list', description: who(row), status: 'success', duration: 2500 });
    }
    await load();
    setWorking(false);
  };

  const count = async (row, onHand) => {
    const key = `${row.product_id}:${row.variant_id || ''}`;
    setBusyKey(key);
    let query = supabase
      .from('shop_inventory')
      .update({ on_hand: onHand, updated_at: new Date().toISOString() })
      .eq('product_id', row.product_id);
    query = row.variant_id ? query.eq('variant_id', row.variant_id) : query.is('variant_id', null);
    const { data, error } = await query.select('product_id');
    if (error || !data?.length) {
      toast({
        title: 'Count not saved',
        description: error?.message || 'Your role cannot count stock. Nothing was changed.',
        status: 'error',
        duration: 5000,
      });
    } else {
      toast({ title: 'Counted', description: `${row.product_id} ${row.variant_id || ''}, ${onHand} on hand`, status: 'success', duration: 2000 });
    }
    await load();
    setBusyKey(null);
  };

  const lede = ordersError
    ? 'The shop\'s ledger is not readable yet. It needs the two shop migrations applied.'
    : numbers.toSend > 0
      ? `${numbers.toSend} paid and waiting to be sent.`
      : 'Nothing is waiting to be sent.';

  return (
    <Page>
      <PageHead kicker="Shop" title="What the shop sold, and what still has to go out." lede={lede}>
        {!ordersError && (
          <Stats items={[
            { key: 'month', n: usd(numbers.month), label: `this month, ${numbers.monthCount} ${numbers.monthCount === 1 ? 'order' : 'orders'}`, tone: P.green },
            { key: 'all', n: usd(numbers.all), label: 'all time' },
            numbers.stale > 0 ? { key: 'stale', n: numbers.stale, label: 'stale counts', tone: P.coral, onClick: () => setFilter('stock') } : null,
          ]}
          />
        )}
      </PageHead>

      <VStack align="stretch" spacing={5}>
        {filter !== 'stock' && (
          <SearchBox value={search} onChange={setSearch} placeholder="Name, email or piece" inputProps={{ 'aria-label': 'Search shop orders' }} />
        )}
        <Tabs
          items={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            count: f.key === 'send' && numbers.toSend > 0 ? numbers.toSend : f.key === 'stock' && numbers.stale > 0 ? numbers.stale : undefined,
          }))}
          value={filter}
          onChange={(key) => { setFilter(key); setSelectedId(null); }}
        />
      </VStack>

      {filter === 'stock' ? (
        <Stock rows={stock} loading={loading} error={stockError} onCount={count} busyKey={busyKey} />
      ) : (
        <Box
          display={{ base: 'block', lg: 'grid' }}
          gridTemplateColumns={{ lg: 'minmax(320px, 420px) minmax(0, 1fr)' }}
          gap={{ lg: 6 }}
        >
          <Plate pad={false} alignSelf="start">
            {loading ? (
              <Loading label="loading the shop" px={INSET} />
            ) : ordersError ? (
              <Empty px={INSET}>The shop&apos;s ledger is not readable yet.</Empty>
            ) : shown.length === 0 ? (
              <Empty px={INSET}>{filter === 'send' ? 'Nothing to send.' : 'Nothing here. Try another filter.'}</Empty>
            ) : (
              shown.map((r) => (
                <Row key={r.id} row={r} selected={r.id === selectedId} onSelect={setSelectedId} />
              ))
            )}
          </Plate>

          <Plate
            pad={false}
            display={{ base: selected ? 'block' : 'none', lg: 'block' }}
            mt={{ base: 4, lg: 0 }}
            alignSelf="start"
          >
            {selected ? (
              <Detail row={selected} onShip={ship} working={working} />
            ) : (
              <Empty px={INSET}>Pick an order to see what they bought, where it goes and how it was paid.</Empty>
            )}
          </Plate>
        </Box>
      )}
    </Page>
  );
};

export default Shop;
