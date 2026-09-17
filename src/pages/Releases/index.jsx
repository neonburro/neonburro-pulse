// src/pages/Releases/index.jsx
// SENTINEL: NB_PULSE_SOCIALS_V3
//
// Socials is the shared room for every public release. The calendar, council
// voice, publishing account, Lyra brief, asset and human approval all live on
// one row. The folder keeps its historic Releases name so old imports and git
// history stay legible. App.jsx makes /socials/ canonical and redirects the old
// /releases/ route.
//
// The status pip remains the workflow. Telegram stops at staged and the studio
// posting hand carries an approved row when its hour arrives. Instagram, X and
// Reddit remain on the calendar but release by hand until their adapters are
// real. Failed Telegram rows return to staged with one tap.
//
// There is deliberately no delete. A cancelled idea stays in the record with
// its notes updated. The page is a ledger as much as it is a queue.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Container,
  Spinner,
  Input,
  Select,
  useToast,
} from '@chakra-ui/react';
import { TbPlus, TbBroadcast, TbSparkles } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { TYPE, EASE, FAST } from '../../theme/layout';
import {
  P,
  STATUSES,
  CHANNELS,
  STATUS_TINT,
  VoiceDisc,
  Kicker,
  isAutomatic,
  assetStatusLabel,
  when,
} from './components/shared';
import Timeline from './components/Timeline';
import ReleaseDrawer from './components/ReleaseDrawer';
import Accounts from './components/Accounts';

const StatusPip = ({ status, onAdvance }) => (
  <HStack
    as="button"
    type="button"
    spacing={1.5}
    onClick={onAdvance}
    title="advance status"
    cursor="pointer"
    flexShrink={0}
    _hover={{ opacity: 0.75 }}
    transition={`opacity ${FAST} ${EASE}`}
  >
    <Box boxSize="7px" borderRadius="full" bg={STATUS_TINT[status] || P.inkFaint} />
    <Text
      fontFamily="mono"
      fontSize={TYPE.label}
      color={STATUS_TINT[status] || P.inkFaint}
      minW="58px"
      textAlign="left"
    >
      {status}
    </Text>
  </HStack>
);

const Row = ({ release, onAdvance, onOpen }) => {
  const waitingOnArt = ['needs_lyra', 'generating'].includes(release.asset_status);

  return (
    <HStack
      align="baseline"
      spacing={{ base: 3, md: 4 }}
      py={3}
      borderBottom="1px solid"
      borderColor={P.hairSoft}
      w="100%"
    >
      <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} minW="52px" flexShrink={0}>
        {when(release.status === 'released' ? release.released_at || release.release_at : release.release_at)}
      </Text>

      <Box flex="1" minW={0}>
        <HStack spacing={2} align="baseline">
          <Text
            as="button"
            type="button"
            onClick={() => onOpen(release)}
            textAlign="left"
            fontSize={TYPE.body}
            color={P.ink}
            noOfLines={1}
            minW={0}
            _hover={{ color: P.limeDeep }}
            transition={`color ${FAST} ${EASE}`}
          >
            {release.title}
          </Text>
          {release.approved && release.status !== 'released' && (
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.limeDeep} flexShrink={0}>
              approved
            </Text>
          )}
          {waitingOnArt && (
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold} flexShrink={0}>
              {assetStatusLabel(release.asset_status)}
            </Text>
          )}
        </HStack>

        {release.status === 'failed' && release.error && (
          <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral} noOfLines={2} mt={0.5} lineHeight="1.5">
            {release.error}
          </Text>
        )}

        {(release.content_pillar || release.notes) && (
          <Text fontSize={TYPE.label} color={P.inkMuted} noOfLines={1} mt={0.5}>
            {release.content_pillar || release.notes}
          </Text>
        )}
      </Box>

      {release.voice && (
        <HStack spacing={1.5} display={{ base: 'none', md: 'flex' }} flexShrink={0}>
          <VoiceDisc voice={release.voice} size="16px" />
          <Text fontFamily="mono" fontSize={TYPE.label} color={P.limeDeep}>{release.voice}.</Text>
        </HStack>
      )}

      <Text
        fontFamily="mono"
        fontSize={TYPE.label}
        color={P.inkMuted}
        border="1px solid"
        borderColor={P.hair}
        borderRadius="full"
        px={2.5}
        py={0.5}
        display={{ base: 'none', sm: 'block' }}
        flexShrink={0}
      >
        {release.channel}
      </Text>

      <StatusPip status={release.status} onAdvance={() => onAdvance(release)} />
    </HStack>
  );
};

const Releases = () => {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('telegram');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('releases')
      .select('*')
      .order('release_at', { ascending: true, nullsFirst: false });

    if (error) {
      setLoadError(error.message || 'The Socials record is not available.');
      setRows([]);
      return;
    }

    setLoadError('');
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('releases')
      .insert({
        title: title.trim(),
        channel,
        release_at: date ? new Date(`${date}T12:00:00`).toISOString() : null,
      })
      .select('*')
      .single();
    setSaving(false);

    if (error) {
      toast({ title: 'Could not add the release', description: error.message, status: 'error', duration: 4500 });
      return;
    }

    setTitle('');
    setDate('');
    await load();
    if (data?.id) setEditingId(data.id);
  };

  const advance = async (release) => {
    let next;
    if (release.status === 'failed') {
      next = 'staged';
    } else if (release.status === 'staged' && isAutomatic(release.channel)) {
      toast({
        title: `${release.channel} carries itself`,
        description: release.approved
          ? 'It is approved. The selected account carries it when the hour arrives.'
          : 'Open it, finish the publishing account and switch approval on.',
        status: 'info',
        duration: 5000,
      });
      return;
    } else {
      next = STATUSES[(STATUSES.indexOf(release.status) + 1) % STATUSES.length];
    }

    const now = new Date().toISOString();
    const patch = { status: next, updated_at: now };
    if (next === 'released') patch.released_at = now;
    if (release.status === 'failed' && next === 'staged') {
      patch.claimed_at = null;
      patch.error = null;
    }

    setRows((current) => current.map((row) => (
      row.id === release.id ? { ...row, ...patch } : row
    )));

    const { data, error } = await supabase
      .from('releases')
      .update(patch)
      .eq('id', release.id)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      toast({
        title: 'Could not change the release',
        description: error?.message || 'Your account cannot change this release.',
        status: 'error',
        duration: 4500,
      });
      load();
    }
  };

  const open = (release) => setEditingId(release.id);
  const editing = editingId
    ? (rows || []).find((release) => release.id === editingId) || null
    : null;

  const ramp = (rows || []).filter((release) => release.status !== 'released');
  const shipped = (rows || [])
    .filter((release) => release.status === 'released')
    .sort((a, b) => (
      new Date(b.released_at || b.release_at || 0) - new Date(a.released_at || a.release_at || 0)
    ));
  const lyraQueue = (rows || []).filter((release) => (
    ['needs_lyra', 'generating'].includes(release.asset_status)
  ));

  return (
    <Container maxW="1040px" px={{ base: 4, md: 8 }} py={{ base: 6, md: 10 }}>
      <VStack align="stretch" spacing={{ base: 8, md: 10 }}>
        <Box>
          <Text fontSize={TYPE.h1} fontWeight="600" letterSpacing="-0.02em" color={P.ink}>
            Socials
          </Text>
          <Text fontSize={TYPE.body} color={P.inkSec} mt={1} maxW="720px">
            One calendar for the studio voice, every council voice and the account that carries each release. Nothing leaves without a person saying yes.
          </Text>
        </Box>

        <HStack spacing={2.5} flexWrap={{ base: 'wrap', md: 'nowrap' }} rowGap={2.5}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            placeholder="what should go out"
            bg={P.sheet}
            borderColor={P.hair}
            color={P.ink}
            fontSize={TYPE.body}
            _placeholder={{ color: P.inkFaint }}
            _hover={{ borderColor: P.inkFaint }}
            _focus={{ borderColor: P.inkMuted, boxShadow: 'none' }}
            flex="1"
            minW={{ base: '100%', md: '260px' }}
          />
          <Select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            bg={P.sheet}
            borderColor={P.hair}
            color={P.inkSec}
            fontSize={TYPE.label}
            fontFamily="mono"
            w={{ base: '46%', md: '150px' }}
            flexShrink={0}
          >
            {CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            bg={P.sheet}
            borderColor={P.hair}
            color={P.inkSec}
            fontSize={TYPE.label}
            fontFamily="mono"
            w={{ base: '46%', md: '160px' }}
            flexShrink={0}
          />
          <HStack
            as="button"
            type="button"
            onClick={add}
            spacing={1.5}
            bg={P.lime}
            color={P.limeInk}
            borderRadius="10px"
            px={4}
            py={2}
            fontSize={TYPE.label}
            fontWeight="600"
            cursor="pointer"
            flexShrink={0}
            opacity={saving ? 0.6 : 1}
            _hover={{ opacity: 0.85 }}
            transition={`opacity ${FAST} ${EASE}`}
          >
            <TbPlus size={15} />
            <Text>add</Text>
          </HStack>
        </HStack>

        {rows === null && (
          <HStack justify="center" py={16}>
            <Spinner size="sm" color={P.inkMuted} />
          </HStack>
        )}

        {loadError && (
          <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={5}>
            <Text fontSize={TYPE.body} color={P.inkSec}>
              The Socials record could not open. Apply the prepared Socials migration, confirm this login has a staff role and reload.
            </Text>
            <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint} mt={2}>{loadError}</Text>
          </Box>
        )}

        {rows !== null && !loadError && (
          <>
            <Timeline rows={rows} onOpen={open} />

            {lyraQueue.length > 0 && (
              <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={4}>
                <HStack spacing={2} mb={2}>
                  <TbSparkles size={14} color={P.gold} />
                  <Kicker>Lyra queue · {lyraQueue.length}</Kicker>
                </HStack>
                <VStack align="stretch" spacing={0}>
                  {lyraQueue.map((release) => (
                    <HStack
                      key={release.id}
                      as="button"
                      type="button"
                      onClick={() => open(release)}
                      py={2}
                      borderTop="1px solid"
                      borderColor={P.hairSoft}
                      textAlign="left"
                    >
                      <VoiceDisc voice={release.voice} size="16px" />
                      <Text flex="1" minW={0} fontSize={TYPE.small} color={P.ink} noOfLines={1}>
                        {release.title}
                      </Text>
                      <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold}>
                        {assetStatusLabel(release.asset_status)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}

            <Box>
              <HStack spacing={2} mb={2}>
                <TbBroadcast size={14} color={P.inkMuted} />
                <Kicker>on the ramp · {ramp.length}</Kicker>
              </HStack>
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
                {ramp.map((release) => (
                  <Row key={release.id} release={release} onAdvance={advance} onOpen={open} />
                ))}
                {ramp.length === 0 && (
                  <Text fontSize={TYPE.body} color={P.inkFaint} py={6}>
                    Nothing staged. The room is suspiciously quiet.
                  </Text>
                )}
              </VStack>
            </Box>

            <Box>
              <Kicker mb={2}>out in the world · {shipped.length}</Kicker>
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
                {shipped.map((release) => (
                  <Row key={release.id} release={release} onAdvance={advance} onOpen={open} />
                ))}
                {shipped.length === 0 && (
                  <Text fontSize={TYPE.body} color={P.inkFaint} py={6}>
                    Nothing has left this room yet.
                  </Text>
                )}
              </VStack>
            </Box>

            <Accounts />
          </>
        )}
      </VStack>

      <ReleaseDrawer
        release={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditingId(null)}
        onSaved={load}
        onAdvance={advance}
      />
    </Container>
  );
};

export default Releases;
