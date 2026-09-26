// src/pages/Neonburro/index.jsx
// SENTINEL: NB_PULSE_NEONBURRO_V3
//
// The private NEONBURRO operating room begins as an observation surface. It
// reads the existing token_wallets book through staff RLS and asks the
// registry-balances function for public chain balances. It does not build a
// transaction, hold a key or imply that a council wallet is independent
// demand. Every wallet in this room is the studio's own, and a number here
// is what the studio holds, never what the market wants.
//
// ── WHAT A FIGURE SAYS ABOUT ITSELF, 2026-09-25 ─────────────────────────────
// The public node refused a batch of twenty wallets and the whole room said
// not read. Now every figure carries the time it was true and where it came
// from, live off the chain or cached from the last good read, and the row
// says which in one word beside the time. The header says how many are
// live and how many are cached. A total only adds the figures it has and
// names how many wallets are in it, so a partial read is a partial total
// and never pretends to be the whole book. The counts drawn in the header
// and the metrics come off the same balances object as the rows, so they
// cannot disagree with what is on the page.
//
// The reader is src/lib/registryBalances.js, shared with the Registry, in
// chunks so one refused chunk does not blank the book.
//
// The seven lanes are named now so the room grows in one stable shape. Only
// the overview and wallet book have live data. Empty operating states say
// what still needs a shared migration instead of manufacturing a number.
//
// V3 sits on the house column with the house head, the lanes are drawn as
// the house tabs. Only the overview is wired, the row is a map of the shape
// to come and does not switch anything yet, the same as the pills it
// replaces. No oxford commas, no em dashes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, HStack, Icon, Text, VStack, Button,
} from '@chakra-ui/react';
import {
  TbArrowUpRight, TbCheck, TbClock, TbExternalLink, TbFlame,
  TbLock, TbRefresh, TbWallet,
} from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { readRegistryBalances, readTime, sourceLine } from '../../lib/registryBalances';
import colors from '../../theme/colors';
import { TYPE, INSET } from '../../theme/layout';
import { Page, PageHead, Plate, Tabs, Empty, Loading, Kicker, Section } from '../../components/common/Page';

const P = colors.paper;
const SUPPLY = 1_000_000_000;

const LANES = ['overview', 'services', 'runs', 'wallets', 'treasury', 'liquidity', 'receipts'];

const compact = (value, digits = 1) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'not read';
  return Number(value).toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits,
  });
};

const sol = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'not read';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  });
};

const short = (address) => (address ? `${address.slice(0, 5)}...${address.slice(-5)}` : '');

const sourceColor = (balance) => {
  if (!balance || !balance.source || balance.source === 'none') return P.inkFaint;
  return balance.source === 'cache' ? P.gold : P.green;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const Metric = ({ label, value, note, icon }) => (
  <Plate minH="142px">
    <HStack justify="space-between" align="start" spacing={4}>
      <VStack align="start" spacing={2}>
        <Kicker>{label}</Kicker>
        <Text fontFamily="mono" fontSize={TYPE.figure} fontWeight="600" letterSpacing="-0.03em" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Text>
        <Text fontSize={TYPE.small} color={P.inkMuted}>{note}</Text>
      </VStack>
      <Box w="36px" h="36px" borderRadius="12px" bg={P.sunken} display="grid" placeItems="center" color={P.inkMuted} flexShrink={0}>
        <Icon as={icon} boxSize={4.5} />
      </Box>
    </HStack>
  </Plate>
);

const StatusRow = ({ icon, title, copy, state, live = false }) => (
  <HStack py={3.5} spacing={3.5} align="start" borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 0 }}>
    <Box w="32px" h="32px" borderRadius="10px" bg={P.sunken} display="grid" placeItems="center" color={live ? P.green : P.inkMuted} flexShrink={0}>
      <Icon as={icon} boxSize={4} />
    </Box>
    <VStack align="start" spacing={0.5} flex={1} minW={0}>
      <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{title}</Text>
      <Text fontSize={TYPE.small} color={P.inkMuted}>{copy}</Text>
    </VStack>
    <Kicker color={live ? P.green : P.inkFaint} pt={1}>{state}</Kicker>
  </HStack>
);

const Neonburro = () => {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, of: 0 });
  const [chainNotes, setChainNotes] = useState([]);
  const [rpc, setRpc] = useState('');
  const [message, setMessage] = useState('');

  const readChain = useCallback(async (rows) => {
    if (!rows.length) return;
    setReading(true);
    setProgress({ done: 0, of: rows.length });
    const answer = await readRegistryBalances(rows.map((row) => row.address), (partial) => {
      setBalances((prev) => ({ ...prev, ...partial.balances }));
      setProgress({ done: partial.done, of: partial.of });
    });
    setBalances(answer.balances);
    setChainNotes(answer.notes);
    if (answer.rpc) setRpc(answer.rpc);
    setReading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('token_wallets')
      .select('id, label, address, app, note, sort')
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      setMessage('the wallet book is unavailable');
      setLoading(false);
      return;
    }

    const rows = data || [];
    setWallets(rows);
    setLoading(false);
    setMessage('');
    await readChain(rows);
  }, [readChain]);

  useEffect(() => { refresh(); }, [refresh]);

  // Everything the header and the metrics say comes off the same balances
  // the rows draw. A figure is whole or absent, both numbers or neither,
  // so one count serves NEONBURRO and SOL alike.
  const summary = useMemo(() => wallets.reduce((sum, wallet) => {
    const balance = balances[wallet.address];
    const has = balance && Number.isFinite(balance.nb) && Number.isFinite(balance.sol);
    if (!has) return { ...sum, none: sum.none + 1 };
    const cached = balance.source === 'cache';
    const latestLive = !cached && (!sum.latestLive || balance.at > sum.latestLive) ? balance.at : sum.latestLive;
    return {
      neonburro: sum.neonburro + balance.nb,
      sol: sum.sol + balance.sol,
      counted: sum.counted + 1,
      live: sum.live + (cached ? 0 : 1),
      cached: sum.cached + (cached ? 1 : 0),
      none: sum.none,
      latestLive,
    };
  }, {
    neonburro: 0,
    sol: 0,
    counted: 0,
    live: 0,
    cached: 0,
    none: 0,
    latestLive: null,
  }), [wallets, balances]);

  const share = summary.counted
    ? `${((summary.neonburro / SUPPLY) * 100).toFixed(2)}% of supply`
    : 'waiting for a chain read';
  const inTotal = summary.counted
    ? `across ${summary.counted} of ${plural(wallets.length, 'wallet')}${summary.cached ? `, ${summary.cached} cached` : ''}`
    : '';
  const nodeLine = rpc ? `mainnet, ${rpc} node` : 'mainnet observation';
  const anyRead = summary.counted > 0 || summary.none > 0;
  const needsAWord = !loading && anyRead && (summary.cached > 0 || summary.none > 0 || chainNotes.length > 0);

  return (
    <Page>
      <PageHead
        kicker={(
          <HStack spacing={2.5}>
            <Text as="span">NEONBURRO operations</Text>
            <Box w="5px" h="5px" borderRadius="full" bg={summary.live ? P.green : P.gold} />
            <Text as="span" color={P.inkFaint} letterSpacing="0.1em">{nodeLine}</Text>
          </HStack>
        )}
        title="The token room."
        lede="Services earn. Receipts prove. The studio observes here and Tyler signs every movement in his own wallet."
        actions={(
          <VStack align="end" spacing={1.5}>
            <Button size="sm" onClick={refresh} isDisabled={reading || loading} leftIcon={<Icon as={TbRefresh} boxSize={4} sx={reading ? { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } } : undefined} />}>
              {reading && progress.of ? `reading ${progress.done} of ${progress.of}` : 'read the chain'}
            </Button>
            {anyRead && !reading && (
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                {summary.latestLive ? `read ${readTime(summary.latestLive)}` : 'nothing read live'}
                {`, ${summary.live} live`}
                {summary.cached ? `, ${summary.cached} cached` : ''}
                {summary.none ? `, ${summary.none} not read` : ''}
              </Text>
            )}
          </VStack>
        )}
      />

      <Tabs items={LANES.map((value) => ({ key: value, label: value }))} value="overview" onChange={() => {}} />

      {message && (
        <Plate sunken py={3}>
          <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>{message}</Text>
        </Plate>
      )}

      {needsAWord && (
        <Plate sunken py={3}>
          <VStack align="start" spacing={1}>
            {summary.cached > 0 && (
              <Text fontSize={TYPE.small} color={P.inkSec}>
                {summary.cached} of {plural(wallets.length, 'figure')} {summary.cached === 1 ? 'is' : 'are'} cached from an earlier read because the chain refused this time. A cached figure carries the time it was true and is not a live balance.
              </Text>
            )}
            {summary.none > 0 && (
              <Text fontSize={TYPE.small} color={P.inkSec}>
                {summary.none} {summary.none === 1 ? 'wallet was' : 'wallets were'} never read and nothing is cached for {summary.none === 1 ? 'it' : 'them'} yet. {summary.none === 1 ? 'It is' : 'They are'} left out of the totals.
              </Text>
            )}
            {chainNotes.map((line) => (
              <Text key={line} fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{line}</Text>
            ))}
          </VStack>
        </Plate>
      )}

      <>
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap={3}>
            <Metric
              label="NEONBURRO in the book"
              value={loading ? 'reading' : summary.counted ? compact(summary.neonburro, 2) : 'not read'}
              note={summary.counted ? `${share}, ${inTotal}` : share}
              icon={TbWallet}
            />
            <Metric
              label="SOL in the book"
              value={loading ? 'reading' : summary.counted ? sol(summary.sol) : 'not read'}
              note={summary.counted ? `studio held, ${inTotal}` : 'held across named studio wallets'}
              icon={TbArrowUpRight}
            />
            <Metric
              label="wallets observed"
              value={loading ? 'reading' : String(wallets.length)}
              note={anyRead ? `${summary.live} live, ${summary.cached} cached, ${summary.none} not read` : 'public addresses only'}
              icon={TbLock}
            />
          </Grid>

          <Grid templateColumns={{ base: '1fr', xl: '1.35fr 0.65fr' }} gap={4} alignItems="start">
            <Section
              kicker="The wallet field"
              action={(
                <HStack as="button" type="button" onClick={() => navigate('/registry/')} spacing={1.5} color={P.inkMuted} _hover={{ color: P.ink }}>
                  <Kicker color="inherit">open registry</Kicker>
                  <Icon as={TbArrowUpRight} boxSize={3.5} />
                </HStack>
              )}
            >
              <Plate pad={false}>
                <Box px={INSET} py={3.5} borderBottom="1px solid" borderColor={P.hair}>
                  <Text fontSize={TYPE.small} color={P.inkMuted}>Named studio addresses with public balances. Studio held, none of it is outside demand.</Text>
                </Box>

                {loading ? (
                  <Loading label="reading the book" px={INSET} />
                ) : wallets.length === 0 ? (
                  <Empty px={INSET}>No wallet rows are visible to this staff session.</Empty>
                ) : (
                  <VStack align="stretch" spacing={0}>
                    {wallets.map((wallet) => {
                      const balance = balances[wallet.address];
                      const pending = reading && !balance;
                      return (
                        <HStack key={wallet.id} px={INSET} py={3.5} spacing={4} borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 0 }} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                          <VStack align="start" spacing={0.5} flex="1 1 180px" minW={0}>
                            <HStack spacing={2}>
                              <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{wallet.label}</Text>
                              {wallet.app && <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{wallet.app}</Text>}
                            </HStack>
                            <HStack spacing={1.5}>
                              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{short(wallet.address)}</Text>
                              <Box as="a" href={`https://solscan.io/account/${wallet.address}`} target="_blank" rel="noopener noreferrer" color={P.inkFaint} _hover={{ color: P.limeDeep }}>
                                <Icon as={TbExternalLink} boxSize={3} display="block" />
                              </Box>
                            </HStack>
                          </VStack>
                          <HStack spacing={{ base: 4, md: 7 }} flexShrink={0}>
                            <VStack align="end" spacing={0} minW="92px">
                              <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="600" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{pending ? 'reading' : compact(balance?.nb, 2)}</Text>
                              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>NEONBURRO</Text>
                            </VStack>
                            <VStack align="end" spacing={0} minW="64px">
                              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec} sx={{ fontVariantNumeric: 'tabular-nums' }}>{pending ? 'reading' : sol(balance?.sol)}</Text>
                              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>SOL</Text>
                            </VStack>
                            <VStack align="end" spacing={0} minW="104px">
                              <Text fontFamily="mono" fontSize={TYPE.micro} color={pending ? P.inkFaint : sourceColor(balance)} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {pending ? 'on the wire' : sourceLine(balance)}
                              </Text>
                              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>as of</Text>
                            </VStack>
                          </HStack>
                        </HStack>
                      );
                    })}
                  </VStack>
                )}
              </Plate>
            </Section>

            <VStack align="stretch" spacing={4}>
              <Section kicker="Where the room stands">
                <Plate py={1}>
                  <StatusRow icon={TbCheck} title="Wallet observation" copy="Existing Registry and chain feed, cached when the chain refuses." state="live" live />
                  <StatusRow icon={TbClock} title="Service ledger" copy="Shared tables and holder policies." state="next" />
                  <StatusRow icon={TbFlame} title="Furnace close" copy="Ten percent after confirmed service receipts." state="migration" />
                </Plate>
              </Section>

              <Plate bg={P.ink} color={P.sheet} borderColor={P.ink}>
                <HStack spacing={2} mb={4}>
                  <Icon as={TbLock} boxSize={4} color={P.lime} />
                  <Kicker color={P.lime}>the human line</Kicker>
                </HStack>
                <Text fontSize={TYPE.section} fontWeight="600" lineHeight="1.35">Pulse can observe and draft. Tyler signs.</Text>
                <Text mt={3} fontSize={TYPE.small} lineHeight="1.65" color={colors.chrome.textMuted}>
                  Every transfer, burn, liquidity change and signer change stops outside this app for human approval.
                </Text>
              </Plate>
            </VStack>
          </Grid>
      </>
    </Page>
  );
};

export default Neonburro;
