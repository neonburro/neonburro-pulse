// src/pages/Neonburro/index.jsx
// SENTINEL: NB_PULSE_NEONBURRO_V1
//
// The private NEONBURRO operating room begins as an observation surface. It
// reads the existing token_wallets book through staff RLS and asks the existing
// registry-balances function for public chain balances. It does not build a
// transaction, hold a key or imply that a council wallet is independent demand.
//
// The seven lanes are named now so the room grows in one stable shape. Only the
// overview and wallet book have live data in V1. Empty operating states say
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
  const [message, setMessage] = useState('');
  const [asOf, setAsOf] = useState(null);

  const readChain = useCallback(async (rows) => {
    if (!rows.length) return;
    setReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/.netlify/functions/registry-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ addresses: rows.map((row) => row.address) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'the chain read failed');
      setBalances(payload.balances || {});
      setAsOf(new Date());
      setMessage(payload.note || '');
    } catch (error) {
      setMessage(error.message || 'the chain read failed');
    } finally {
      setReading(false);
    }
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
    await readChain(rows);
  }, [readChain]);

  useEffect(() => { refresh(); }, [refresh]);

  const totals = useMemo(() => wallets.reduce((sum, wallet) => {
    const balance = balances[wallet.address] || {};
    const hasNeonburro = Number.isFinite(balance.nb);
    const hasSol = Number.isFinite(balance.sol);
    return {
      neonburro: sum.neonburro + (hasNeonburro ? balance.nb : 0),
      sol: sum.sol + (hasSol ? balance.sol : 0),
      neonburroReads: sum.neonburroReads + (hasNeonburro ? 1 : 0),
      solReads: sum.solReads + (hasSol ? 1 : 0),
    };
  }, {
    neonburro: 0,
    sol: 0,
    neonburroReads: 0,
    solReads: 0,
  }), [wallets, balances]);

  const share = totals.neonburroReads
    ? `${((totals.neonburro / SUPPLY) * 100).toFixed(2)}% of supply`
    : 'waiting for a chain read';

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
                <Box w="5px" h="5px" borderRadius="full" bg={P.green} />
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>mainnet observation</Text>
              </HStack>
              <Text fontSize={TYPE.title} fontWeight="650" letterSpacing="-0.035em" lineHeight="1.08" color={P.ink}>
                The token room.
              </Text>
              <Text fontSize={TYPE.body} color={P.inkMuted} lineHeight="1.7">
                Services earn. Receipts prove. The studio observes here and Tyler signs every movement in his own wallet.
              </Text>
            </VStack>

            <HStack spacing={3}>
              {asOf && (
                <Text display={{ base: 'none', md: 'block' }} fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                  read {asOf.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              )}
              <HStack as="button" onClick={refresh} disabled={reading || loading} spacing={2} px={4} h="38px" borderRadius="full" bg={P.lime} color={P.limeInk} fontSize={TYPE.small} fontWeight="700" transition={`all ${FAST} ${EASE}`} _hover={{ bg: '#D2E26B', transform: 'translateY(-1px)' }} _disabled={{ opacity: 0.6, cursor: 'wait' }}>
                <Icon as={TbRefresh} boxSize={4} sx={reading ? { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } } : undefined} />
                <Text>read the chain</Text>
              </HStack>
            </HStack>
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

          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap={3}>
            <Metric label="NEONBURRO in the book" value={loading ? 'reading' : totals.neonburroReads ? compact(totals.neonburro, 2) : 'not read'} note={share} icon={TbWallet} />
            <Metric label="SOL in the book" value={loading ? 'reading' : totals.solReads ? sol(totals.sol) : 'not read'} note="held across named studio wallets" icon={TbArrowUpRight} />
            <Metric label="wallets observed" value={loading ? 'reading' : String(wallets.length)} note="public addresses only" icon={TbLock} />
          </Grid>

          <Grid templateColumns={{ base: '1fr', xl: '1.35fr 0.65fr' }} gap={4} alignItems="start">
            <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" overflow="hidden">
              <HStack justify="space-between" px={{ base: 4, md: 5 }} py={4} borderBottom="1px solid" borderColor={P.hair}>
                <VStack align="start" spacing={0.5}>
                  <Text fontSize={TYPE.section} fontWeight="650" color={P.ink}>The wallet field</Text>
                  <Text fontSize={TYPE.small} color={P.inkMuted}>Named studio addresses with live public balances.</Text>
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
                    const balance = balances[wallet.address] || {};
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
                            <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="650" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{compact(balance.nb, 2)}</Text>
                            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>NEONBURRO</Text>
                          </VStack>
                          <VStack align="end" spacing={0} minW="64px">
                            <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec} sx={{ fontVariantNumeric: 'tabular-nums' }}>{sol(balance.sol)}</Text>
                            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>SOL</Text>
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
                <StatusRow icon={TbCheck} title="Wallet observation" copy="Existing Registry and chain feed." state="live" live />
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
