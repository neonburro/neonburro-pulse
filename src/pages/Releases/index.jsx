// src/pages/Releases/index.jsx
// SENTINEL: NB_PULSE_SOCIALS_V5
//
// Socials is the shared room for every public release. The calendar, council
// voice, publishing account, Lyra brief, asset and human approval all live on
// one row. The folder keeps its historic Releases name so old imports and git
// history stay legible. App.jsx makes /socials/ canonical and redirects the old
// /releases/ route.
//
// ── TWO CALENDARS, ONE RECORD ───────────────────────────────────────────────
// The month grid (MonthCalendar.jsx) is the desk since 2026-09-25, releases
// as pips tinted by channel with the status as the dot. The two week
// Timeline stays one tap away under the same toggle, it is the closer view
// for a busy fortnight. Both read the same rows. Click a day on the month
// and the add bar takes that date, if a title is already typed the release
// is added and its drawer opens, if not the title field takes focus and the
// bar says which day it will land on. That is deliberate. There is no
// delete on this page, a cancelled idea stays in the record, so a stray
// click on a day must never create a row by itself.
//
// The status pip remains the workflow. Telegram, facebook and instagram stop
// at staged and a posting hand carries an approved row when its hour arrives,
// telegram from the studio site and the Meta pair from release-meta.js here.
// X and reddit remain on the calendar but release by hand. Failed rows return
// to staged with one tap.
//
// V5, 2026-09-25. The house column, the house head (V4 read TYPE.h1, which
// did not exist, so the title fell to the browser default), the house tabs
// for the two calendars, house fields on the add bar and house empty lines.
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Select,
  Icon,
  Button,
  useToast,
} from '@chakra-ui/react';
import { TbPlus, TbSparkles } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { TYPE, EASE, FAST } from '../../theme/layout';
import { Page, PageHead, Section, Tabs, Plate, Empty, Loading } from '../../components/common/Page';
import {
  P,
  STATUSES,
  CHANNELS,
  STATUS_TINT,
  VoiceDisc,
  isAutomatic,
  assetStatusLabel,
  when,
} from './components/shared';
import Timeline from './components/Timeline';
import MonthCalendar from './components/MonthCalendar';
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
  const titleRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('telegram');
  const [date, setDate] = useState('');
  const [dayHint, setDayHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState('month');

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

  const add = async (dateOverride) => {
    const onDay = dateOverride || date;
    if (!title.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('releases')
      .insert({
        title: title.trim(),
        channel,
        release_at: onDay ? new Date(`${onDay}T12:00:00`).toISOString() : null,
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
    setDayHint('');
    await load();
    if (data?.id) setEditingId(data.id);
  };

  // A day click on the month. With a title typed the release lands on that
  // day and opens. Without one the bar takes the date and asks for a title,
  // because nothing on this page is ever deleted and a bare click must not
  // write a row.
  const onDay = (iso) => {
    setDate(iso);
    if (title.trim()) {
      add(iso);
      return;
    }
    setDayHint(`dated ${when(`${iso}T12:00:00`)}. give it a title and add.`);
    if (titleRef.current) titleRef.current.focus();
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
    <Page>
      <PageHead
        kicker="Socials"
        title="Every voice, account and release."
        lede="One calendar for the studio voice, every council voice and the account that carries each release. Nothing leaves without a person saying yes."
      />

      <VStack align="stretch" spacing={1.5}>
        <HStack spacing={2.5} flexWrap={{ base: 'wrap', md: 'nowrap' }} rowGap={2.5}>
          <Input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            placeholder="what should go out"
            borderColor={dayHint ? P.limeDeep : P.hair}
            flex="1"
            minW={{ base: '100%', md: '260px' }}
          />
          <Select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            fontSize={TYPE.small}
            fontFamily="mono"
            w={{ base: '46%', md: '150px' }}
            flexShrink={0}
          >
            {CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(event) => { setDate(event.target.value); setDayHint(''); }}
            fontSize={TYPE.small}
            fontFamily="mono"
            w={{ base: '46%', md: '160px' }}
            flexShrink={0}
          />
          <Button size="md" leftIcon={<TbPlus size={15} />} onClick={() => add()} isDisabled={saving} flexShrink={0}>
            add
          </Button>
        </HStack>
        {dayHint && (
          <Text fontFamily="mono" fontSize={TYPE.label} color={P.limeDeep}>{dayHint}</Text>
        )}
      </VStack>

      {rows === null && <Loading label="opening the record" />}

      {loadError && (
        <Plate sunken>
          <Text fontSize={TYPE.body} color={P.inkSec}>
            The Socials record could not open. Apply the prepared Socials migration, confirm this login has a staff role and reload.
          </Text>
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint} mt={2}>{loadError}</Text>
        </Plate>
      )}

      {rows !== null && !loadError && (
        <>
          <VStack align="stretch" spacing={4}>
            <Tabs
              items={[{ key: 'month', label: 'month' }, { key: 'fortnight', label: 'fortnight' }]}
              value={view}
              onChange={setView}
            />
            {view === 'month'
              ? <MonthCalendar rows={rows} onOpen={open} onDay={onDay} />
              : <Timeline rows={rows} onOpen={open} />}
          </VStack>

          {lyraQueue.length > 0 && (
            <Section
              kicker={(
                <HStack spacing={2}>
                  <TbSparkles size={14} color={P.gold} />
                  <Text fontFamily="mono" fontSize={TYPE.kicker} fontWeight="500" letterSpacing="0.2em" textTransform="uppercase" color={P.inkMuted}>Lyra queue</Text>
                </HStack>
              )}
              count={lyraQueue.length}
            >
              <Plate sunken>
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
                      _first={{ borderTop: 0 }}
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
              </Plate>
            </Section>
          )}

          <Section kicker="on the ramp" count={ramp.length}>
            <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
              {ramp.map((release) => (
                <Row key={release.id} release={release} onAdvance={advance} onOpen={open} />
              ))}
              {ramp.length === 0 && (
                <Empty>Nothing staged. The room is suspiciously quiet.</Empty>
              )}
            </VStack>
          </Section>

          <Section kicker="out in the world" count={shipped.length}>
            <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
              {shipped.map((release) => (
                <Row key={release.id} release={release} onAdvance={advance} onOpen={open} />
              ))}
              {shipped.length === 0 && (
                <Empty>Nothing has left this room yet.</Empty>
              )}
            </VStack>
          </Section>

          <Accounts />
        </>
      )}

      <ReleaseDrawer
        release={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditingId(null)}
        onSaved={load}
        onAdvance={advance}
      />
    </Page>
  );
};

export default Releases;
