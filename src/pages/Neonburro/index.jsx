// src/pages/Neonburro/index.jsx
// SENTINEL: NB_PULSE_NEONBURRO_V2
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
// No oxford commas, no em dashes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Container, Grid, HStack, Icon, Spinner, Text, VStack,
} from '@chakra-ui/react';
import {
  TbArrowUpRight, TbCheck, TbClock, TbExternalLink, TbFlame,
  TbLock, TbRefresh, TbWallet,
} from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { readRegistryBalances, readTime, sourceLine } from '../../lib/registryBalances';
import colors from '../../theme/colors';
import { EASE, FAST, TYPE } from '../../theme/layout';

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
  <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" p={{ base: 4, md: 5 }} minH="142px">
    <HStack justify="space-between" align="start" spacing={4}>
      <VStack align="start" spacing={2}>
        <Text fontFamily="mono" fontSize={TYPE.micro} fontWeight="600" letterSpacing="0.18em" textTransform="uppercase" color={P.inkMuted}>
          {label}
        </Text>
        <Text fontFamily="mono" fontSize={{ base: '25px', md: '30px' }} fontWeight="650" letterSpacing="-0.04em" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Text>
        <Text fontSize={TYPE.small} color={P.inkMuted}>{note}</Text>
      </VStack>
      <Box w="36px" h="36px" borderRadius="12px" bg={P.sunken} display="grid" placeItems="center" color={P.inkMuted} flexShrink={0}>
        <Icon as={icon} boxSize={4.5} />
      </Box>
    </HStack>
  </Box>
);

const StatusRow = ({ icon, title, copy, state, live = false }) => (
  <HStack py={3.5} spacing={3.5} align="start" borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 0 }}>
    <Box w="32px" h="32px" borderRadius="10px" bg={P.sunken} display="grid" placeItems="center" color={live ? P.green : P.inkMuted} flexShrink={0}>
      <Icon as={icon} boxSize={4} />
    </Box>
    <VStack align="start" spacing={0.5} flex={1} minW={0}>
      <Text fontSize={TYPE.body} fontWeight="650" color={P.ink}>{title}</Text>
      <Text fontSize={TYPE.small} color={P.inkMuted}>{copy}</Text>
    </VStack>
    <Text fontFamily="mono" fontSize={TYPE.micro} color={live ? P.green : P.inkFaint} textTransform="uppercase" letterSpacing="0.12em" pt={1}>
      {state}
    </Text>
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
    <Box position="relative" minH="100vh" bg={P.mat}>
      <Box position="absolute" inset="0 0 auto" h="360px" bg={`radial-gradient(ellipse at 24% 0%, ${P.lime}18, transparent 64%)`} pointerEvents="none" />

      <Container maxW="1380px" mx={0} px={{ base: 5, md: 8 }} py={{ base: 6, md: 10 }} position="relative">
        <VStack spacing={{ base: 7, md: 9 }} align="stretch">
          <HStack justify="space-between" align="end" gap={5} flexWrap="wrap">
            <VStack align="start" spacing={2} maxW="700px">
              <HStack spacing={2.5}>
                <Text fontFamily="mono" fontSize={TYPE.micro} fontWeight="650" letterSpacing="0.22em" textTransform="uppercase" color={P.inkMuted}>
                  NEONBURRO operations
                </Text>
                <Box w="5px" h="5px" borderRadius="full" bg={summary.live ? P.green : P.gold} />
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{nodeLine}</Text>
              </HStack>
              <Text fontSize={TYPE.title} fontWeight="650" letterSpacing="-0.035em" lineHeight="1.08" color={P.ink}>
                The token room.
              </Text>
              <Text fontSize={TYPE.body} color={P.inkMuted} lineHeight="1.7">
                Services earn. Receipts prove. The studio observes here and Tyler signs every movement in his own wallet.
              </Text>
            </VStack>

            <VStack align={{ base: 'start', md: 'end' }} spacing={2}>
              <HStack as="button" onClick={refresh} disabled={reading || loading} spacing={2} px={4} h="38px" borderRadius="full" bg={P.lime} color={P.limeInk} fontSize={TYPE.small} fontWeight="700" transition={`all ${FAST} ${EASE}`} _hover={{ bg: '#D2E26B', transform: 'translateY(-1px)' }} _disabled={{ opacity: 0.6, cursor: 'wait' }}>
                <Icon as={TbRefresh} boxSize={4} sx={reading ? { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } } : undefined} />
                <Text>{reading && progress.of ? `reading ${progress.done} of ${progress.of}` : 'read the chain'}</Text>
              </HStack>
              {anyRead && !reading && (
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                  {summary.latestLive ? `read ${readTime(summary.latestLive)}` : 'nothing read live'}
                  {`, ${summary.live} live`}
                  {summary.cached ? `, ${summary.cached} cached` : ''}
                  {summary.none ? `, ${summary.none} not read` : ''}
                </Text>
              )}
            </VStack>
          </HStack>

          <HStack spacing={2} overflowX="auto" pb={1} sx={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            {LANES.map((lane, index) => (
              <Box key={lane} px={3.5} py={2} borderRadius="full" bg={index === 0 ? P.ink : 'transparent'} color={index === 0 ? P.sheet : P.inkMuted} border="1px solid" borderColor={index === 0 ? P.ink : P.hair} flexShrink={0}>
                <Text fontFamily="mono" fontSize={TYPE.micro} textTransform="uppercase" letterSpacing="0.12em">{lane}</Text>
              </Box>
            ))}
          </HStack>

          {message && (
            <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="12px" px={4} py={3}>
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>{message}</Text>
            </Box>
          )}

          {needsAWord && (
            <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="12px" px={4} py={3}>
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
            </Box>
          )}

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
            <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" overflow="hidden">
              <HStack justify="space-between" px={{ base: 4, md: 5 }} py={4} borderBottom="1px solid" borderColor={P.hair}>
                <VStack align="start" spacing={0.5}>
                  <Text fontSize={TYPE.section} fontWeight="650" color={P.ink}>The wallet field</Text>
                  <Text fontSize={TYPE.small} color={P.inkMuted}>Named studio addresses with public balances. Studio held, none of it is outside demand.</Text>
                </VStack>
                <HStack as="button" onClick={() => navigate('/registry/')} spacing={1.5} color={P.inkMuted} _hover={{ color: P.ink }}>
                  <Text fontFamily="mono" fontSize={TYPE.micro}>open registry</Text>
                  <Icon as={TbArrowUpRight} boxSize={3.5} />
                </HStack>
              </HStack>

              {loading ? (
                <HStack justify="center" py={14}><Spinner size="sm" color={P.limeDeep} /></HStack>
              ) : wallets.length === 0 ? (
                <Text px={5} py={10} fontSize={TYPE.small} color={P.inkMuted}>No wallet rows are visible to this staff session.</Text>
              ) : (
                <VStack align="stretch" spacing={0}>
                  {wallets.map((wallet) => {
                    const balance = balances[wallet.address];
                    const pending = reading && !balance;
                    return (
                      <HStack key={wallet.id} px={{ base: 4, md: 5 }} py={3.5} spacing={4} borderBottom="1px solid" borderColor={P.hairSoft} _last={{ borderBottom: 0 }} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                        <VStack align="start" spacing={0.5} flex="1 1 180px" minW={0}>
                          <HStack spacing={2}>
                            <Text fontSize={TYPE.body} fontWeight="650" color={P.ink}>{wallet.label}</Text>
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
                            <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="650" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{pending ? 'reading' : compact(balance?.nb, 2)}</Text>
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
            </Box>

            <VStack align="stretch" spacing={4}>
              <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" px={{ base: 4, md: 5 }} py={2}>
                <StatusRow icon={TbCheck} title="Wallet observation" copy="Existing Registry and chain feed, cached when the chain refuses." state="live" live />
                <StatusRow icon={TbClock} title="Service ledger" copy="Shared tables and holder policies." state="next" />
                <StatusRow icon={TbFlame} title="Furnace close" copy="Ten percent after confirmed service receipts." state="migration" />
              </Box>

              <Box bg={P.ink} color={P.sheet} borderRadius="18px" p={{ base: 4, md: 5 }}>
                <HStack spacing={2} mb={4}>
                  <Icon as={TbLock} boxSize={4} color={P.lime} />
                  <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.16em" textTransform="uppercase" color={P.lime}>the human line</Text>
                </HStack>
                <Text fontSize={TYPE.section} fontWeight="650" lineHeight="1.35">Pulse can observe and draft. Tyler signs.</Text>
                <Text mt={3} fontSize={TYPE.small} lineHeight="1.65" color={colors.chrome.textMuted}>
                  Every transfer, burn, liquidity change and signer change stops outside this app for human approval.
                </Text>
              </Box>
            </VStack>
          </Grid>
        </VStack>
      </Container>
    </Box>
  );
};

export default Neonburro;
