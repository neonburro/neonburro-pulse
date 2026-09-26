// src/pages/Yard/index.jsx
// SENTINEL: NB_PULSE_YARD_V2
//
// The yard, managed from the back office. Every send a burro entry across
// every status, the two live dials and the size of the private wallet book.
// The public page's hidden owner mode still exists for moderating from a
// phone, this is the same power behind the Pulse login, with room to read
// each entry properly before deciding.
//
// Everything goes through netlify/functions/yard-decide.js because the base
// table denies reads to everyone but the service role, an operator's browser
// session cannot see it directly and that is correct, the table holds
// wallets. The function truncates them before they travel.
//
// The X sends an entry to the pasture with a random canon verdict and frees
// its spot, the sender can try again, that loop is the fun of it. Remove is
// for entries that break the serious rules, no verdict, gone. Approve pulls
// a pen or pastured entry onto the ramp at the lowest open spot.
//
// V2 sits on the house column with the house head, stats and tabs. No
// oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Image, Button,
} from '@chakra-ui/react';
import { TbX, TbTrash, TbArrowUp, TbRefresh, TbCheck } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST, PLATE_RADIUS } from '../../theme/layout';
import { Page, PageHead, Stats, Tabs, Empty, Loading } from '../../components/common/Page';

const P = colors.paper;

const IMG_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/send-a-burro/`;

const FILTERS = [
  { key: 'ramp', label: 'the ramp' },
  { key: 'pen', label: 'the pen' },
  { key: 'pasture', label: 'the pasture' },
  { key: 'removed', label: 'removed' },
  { key: 'all', label: 'all' },
];

const STATUS_TONE = { ramp: 'limeDeep', pen: 'gold', pasture: 'inkMuted', removed: 'coral' };

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

const call = async (payload) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/yard-decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'The yard did not answer.');
  return data;
};

const Dial = ({ label, on, onFlip }) => (
  <HStack as="button" type="button" onClick={onFlip} spacing={2.5}>
    <Box w="34px" h="20px" borderRadius="full" bg={on ? P.lime : P.hair} position="relative" transition={`background ${FAST} ${EASE}`}>
      <Box boxSize="16px" borderRadius="full" bg={P.sheet} position="absolute" top="2px" left={on ? '16px' : '2px'} transition={`left ${FAST} ${EASE}`} boxShadow="0 1px 3px rgba(36,26,22,0.3)" />
    </Box>
    <Text fontSize={TYPE.small} color={P.inkSec}>{label}</Text>
  </HStack>
);

const ActionChip = ({ icon, label, tone, onClick, disabled }) => (
  <Button size="xs" variant="outline" leftIcon={<Icon as={icon} boxSize={3.5} />} onClick={onClick} isDisabled={disabled} _hover={{ borderColor: tone, color: tone }}>
    {label}
  </Button>
);

const Yard = () => {
  const [entries, setEntries] = useState([]);
  const [dials, setDials] = useState({});
  const [walletBook, setWalletBook] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ramp');
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await call({ action: 'list' });
      setEntries(data.entries || []);
      setDials(data.dials || {});
      setWalletBook(data.walletBook || 0);
      setNote('');
    } catch (e) {
      setNote(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const act = async (entry, action) => {
    if (action === 'remove' && !window.confirm(`Remove ${entry.username} for good? No verdict, no pasture, gone.`)) return;
    setBusyId(entry.id);
    try {
      const res = await call({ action, id: entry.id });
      if (action === 'pasture') setNote(`${entry.username} to the pasture. ${res.verdict_burro}. said "${res.verdict_line}"`);
      if (action === 'approve') setNote(`${entry.username} takes spot ${String(res.spot).padStart(3, '0')}.`);
      if (action === 'remove') setNote(`${entry.username} removed.`);
      if (action === 'vouch') setNote(`${entry.username} vouched, the address is proven.`);
      await refresh();
    } catch (e) {
      setNote(e.message);
    }
    setBusyId('');
  };

  const flipDial = async (key) => {
    const next = dials[key] === 'true' ? 'false' : 'true';
    setDials((d) => ({ ...d, [key]: next }));
    try { await call({ action: 'dial', key, value: next }); } catch (e) { setNote(e.message); refresh(); }
  };

  const counts = {
    ramp: entries.filter((e) => e.status === 'ramp').length,
    pen: entries.filter((e) => e.status === 'pen').length,
    pasture: entries.filter((e) => e.status === 'pasture').length,
    removed: entries.filter((e) => e.status === 'removed').length,
    all: entries.length,
  };
  const spotsTotal = Number(dials.spots_total) || 100;
  const filtered = entries.filter((e) => filter === 'all' || e.status === filter);

  return (
    <Page>
      <PageHead
        kicker="The Yard"
        title="Who came down the ramp."
        actions={(
          <>
            <Dial label="gate open" on={dials.gate_open === 'true'} onFlip={() => flipDial('gate_open')} />
            <Dial label="auto ramp" on={dials.auto_ramp === 'true'} onFlip={() => flipDial('auto_ramp')} />
            <Button size="sm" variant="ghost" px={2} onClick={() => { setLoading(true); refresh(); }} aria-label="Refresh">
              <Icon as={TbRefresh} boxSize={4} />
            </Button>
          </>
        )}
      >
        <Stats items={[
          { key: 'ramp', n: `${counts.ramp} of ${spotsTotal}`, label: 'on the ramp' },
          { key: 'pen', n: counts.pen, label: 'in the pen', tone: counts.pen > 0 ? P.gold : P.ink },
          { key: 'pasture', n: counts.pasture, label: 'out to pasture', tone: P.inkMuted },
          { key: 'book', n: walletBook, label: 'wallets in the book', tone: P.inkMuted },
        ]} />
      </PageHead>

      {note && <Text fontFamily="mono" fontSize={TYPE.small} color={P.limeDeep}>{note}</Text>}

      <VStack align="stretch" spacing={5}>
        <Tabs items={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} />

        {loading ? (
          <Loading label="reading the yard" />
        ) : filtered.length === 0 ? (
          <Empty>{filter === 'ramp' ? 'The ramp is empty. The believers are on their way.' : 'Nothing here.'}</Empty>
        ) : (
          <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }} gap={4}>
            {filtered.map((e) => (
              <VStack key={e.id} align="stretch" spacing={0} bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius={PLATE_RADIUS} overflow="hidden" opacity={busyId === e.id ? 0.5 : 1} transition={`opacity ${FAST} ${EASE}`}>
                <Box bg={P.sunken} position="relative" pt="72%">
                  <Image
                    src={`${IMG_BASE}${e.image_path}`}
                    alt={e.username}
                    position="absolute"
                    inset={0}
                    w="100%"
                    h="100%"
                    objectFit="contain"
                    p={3}
                    loading="lazy"
                  />
                  {e.spot && (
                    <Text position="absolute" top={2.5} left={3} fontFamily="mono" fontSize={TYPE.label} fontWeight="700" color={P.limeDeep}>
                      {String(e.spot).padStart(3, '0')}
                    </Text>
                  )}
                </Box>

                <VStack align="stretch" spacing={2.5} p={4}>
                  <HStack justify="space-between" align="baseline">
                    <Text fontSize={TYPE.body} fontWeight="700" color={P.ink} noOfLines={1}>{e.username}</Text>
                    <Text fontFamily="mono" fontSize={TYPE.micro} color={P[STATUS_TONE[e.status]] || P.inkMuted}>{e.status}</Text>
                  </HStack>

                  <HStack spacing={2} flexWrap="wrap">
                    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>{e.wallet}</Text>
                    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>{when(e.created_at)}</Text>
                    {e.attempts > 1 && <Text fontFamily="mono" fontSize={TYPE.label} color={P.gold}>try {e.attempts}</Text>}
                    {e.wallet_source === 'pasted' && (
                      <Text fontFamily="mono" fontSize={TYPE.label} color={P.gold} title="the address was typed, not signed, check the coin page replies for the trail name then vouch it">
                        pasted
                      </Text>
                    )}
                    {e.wallet_source === 'vouched' && (
                      <Text fontFamily="mono" fontSize={TYPE.label} color={P.limeDeep} title="the trail name appeared in a reply from the owning account, proven">
                        vouched
                      </Text>
                    )}
                    {e.wallet_source === 'phrase' && (
                      <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted} title="no wallet yet, the seed phrase below is the key, a claim attaches one later">
                        open door
                      </Text>
                    )}
                  </HStack>

                  {e.seed_phrase && (
                    <Text fontFamily="mono" fontSize={TYPE.label} color={P.limeDeep} title="the house seed phrase, shown here so a lost one can be rescued">
                      {e.seed_phrase}
                    </Text>
                  )}

                  {e.status === 'pasture' && e.verdict_line && (
                    <Text fontSize={TYPE.small} color={P.inkMuted} fontStyle="italic">
                      {e.verdict_burro}. said "{e.verdict_line}"
                    </Text>
                  )}

                  <HStack spacing={2} pt={1} flexWrap="wrap" rowGap={2}>
                    {e.wallet_source === 'pasted' && (
                      <ActionChip icon={TbCheck} label="vouch" tone={P.limeDeep} onClick={() => act(e, 'vouch')} disabled={!!busyId} />
                    )}
                    {e.status !== 'ramp' && (
                      <ActionChip icon={TbArrowUp} label="to the ramp" tone={P.limeDeep} onClick={() => act(e, 'approve')} disabled={!!busyId} />
                    )}
                    {e.status !== 'pasture' && e.status !== 'removed' && (
                      <ActionChip icon={TbX} label="pasture" tone={P.gold} onClick={() => act(e, 'pasture')} disabled={!!busyId} />
                    )}
                    {e.status !== 'removed' && (
                      <ActionChip icon={TbTrash} label="remove" tone={P.coral} onClick={() => act(e, 'remove')} disabled={!!busyId} />
                    )}
                  </HStack>
                </VStack>
              </VStack>
            ))}
          </Box>
        )}
      </VStack>
    </Page>
  );
};

export default Yard;
