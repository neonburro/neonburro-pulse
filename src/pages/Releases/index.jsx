// src/pages/Releases/index.jsx
// SENTINEL: NB_PULSE_RELEASES_V2
//
// The release timeline, now the social posting timeline. One row is one
// thing the studio intends to put into the world, a page, a post, a door
// opening. Three views of the same rows: the next fourteen days as columns
// at the top, then the two shelves. On the ramp holds everything that has
// not shipped, ordered by intended date, out the door holds what shipped,
// newest first. Clicking a card or a title opens the editor drawer, which is
// where the words, the picture and the approval live.
//
// ── THE PIP IS STILL THE WORKFLOW ───────────────────────────────────────────
// Click it and the release advances idea to drafted to staged to released,
// landing on released stamps released_at, released wraps to idea so a
// mistaken tap is recoverable. Two new rules since V1:
//   posting channels (telegram, x, instagram, reddit) stop at staged. The
//   pip will not hand-release them, netlify/functions/release-social.js
//   does that when the row is staged, approved and due, then stamps released
//   or failed with an error. A tap on a staged posting row says so.
//   failed goes back to staged with one tap, the error stays on the row
//   until the function clears it on success, so the reason is not lost.
// There is deliberately no delete on this page, a release that dies gets its
// notes updated and stays on the record, the timeline is a ledger not a
// todo list.
//
// ── THE MIGRATIONS ──────────────────────────────────────────────────────────
// 2026082901_releases.sql made the table, 2026091202_social_timeline.sql
// added body, the asset pointer, approved, external_id, error, the failed
// status, the social_accounts table and the five social buckets. The
// missing table panel stays in the code, it is what a fresh branch shows
// before its migrations run.
//
// Paper system page, same idioms as Blog and Clients. Lime is spent once on
// the page, on the add button. The drawer is its own surface and spends its
// own once on save. No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { Box, VStack, HStack, Text, Container, Spinner, Input, Select, useToast } from '@chakra-ui/react';
import { TbPlus, TbRocket } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { TYPE, EASE, FAST } from '../../theme/layout';
import { P, STATUSES, CHANNELS, STATUS_TINT, VoiceDisc, Kicker, isPosting, when } from './components/shared';
import Timeline from './components/Timeline';
import ReleaseDrawer from './components/ReleaseDrawer';
import Accounts from './components/Accounts';

// the pip. click advances, the page decides what advancing means.
const StatusPip = ({ status, onAdvance }) => (
  <HStack as="button" type="button" spacing={1.5} onClick={onAdvance}
    title="advance status" cursor="pointer" flexShrink={0}
    _hover={{ opacity: 0.75 }} transition={`opacity ${FAST} ${EASE}`}>
    <Box boxSize="7px" borderRadius="full" bg={STATUS_TINT[status] || P.inkFaint} />
    <Text fontFamily="mono" fontSize={TYPE.label} color={STATUS_TINT[status] || P.inkFaint} minW="58px" textAlign="left">
      {status}
    </Text>
  </HStack>
);

const Row = ({ r, onAdvance, onOpen }) => (
  <HStack align="baseline" spacing={{ base: 3, md: 4 }} py={3}
    borderBottom="1px solid" borderColor={P.hairSoft} w="100%">
    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} minW="52px" flexShrink={0}>
      {when(r.status === 'released' ? r.released_at || r.release_at : r.release_at)}
    </Text>
    <Box flex="1" minW={0}>
      <HStack spacing={2} align="baseline">
        <Text as="button" type="button" onClick={() => onOpen(r)} textAlign="left"
          fontSize={TYPE.body} color={P.ink} noOfLines={1} minW={0}
          _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}>
          {r.title}
        </Text>
        {r.approved && r.status !== 'released' && (
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.limeDeep} flexShrink={0}>approved</Text>
        )}
      </HStack>
      {r.status === 'failed' && r.error && (
        <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral} noOfLines={2} mt={0.5} lineHeight="1.5">{r.error}</Text>
      )}
      {r.notes && (
        <Text fontSize={TYPE.label} color={P.inkMuted} noOfLines={1} mt={0.5}>{r.notes}</Text>
      )}
    </Box>
    {r.voice && (
      <HStack spacing={1.5} display={{ base: 'none', md: 'flex' }} flexShrink={0}>
        <VoiceDisc voice={r.voice} size="16px" />
        <Text fontFamily="mono" fontSize={TYPE.label} color={P.limeDeep}>{r.voice}.</Text>
      </HStack>
    )}
    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}
      border="1px solid" borderColor={P.hair} borderRadius="full" px={2.5} py={0.5}
      display={{ base: 'none', sm: 'block' }} flexShrink={0}>
      {r.channel}
    </Text>
    <StatusPip status={r.status} onAdvance={() => onAdvance(r)} />
  </HStack>
);

const Releases = () => {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('site');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('releases')
      .select('*')
      .order('release_at', { ascending: true, nullsFirst: false });
    if (error) {
      setTableMissing(true);
      setRows([]);
      return;
    }
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from('releases').insert({
      title: title.trim(),
      channel,
      release_at: date ? new Date(`${date}T12:00:00`).toISOString() : null,
    });
    setSaving(false);
    if (!error) {
      setTitle('');
      setDate('');
      load();
    }
  };

  const advance = async (r) => {
    let next;
    if (r.status === 'failed') {
      next = 'staged';
    } else if (r.status === 'staged' && isPosting(r.channel)) {
      toast({
        title: `${r.channel} posts itself`,
        description: r.approved
          ? 'It is approved. The function carries it when the hour arrives.'
          : 'Open it and switch approve on. The function carries it when the hour arrives.',
        status: 'info', duration: 5000,
      });
      return;
    } else {
      next = STATUSES[(STATUSES.indexOf(r.status) + 1) % STATUSES.length];
    }
    const now = new Date().toISOString();
    const patch = { status: next, updated_at: now };
    if (next === 'released') patch.released_at = now;
    // optimistic, the pip flips before the network answers
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('releases').update(patch).eq('id', r.id);
    if (error) load();
  };

  const open = (r) => setEditingId(r.id);
  const editing = editingId ? (rows || []).find((r) => r.id === editingId) || null : null;

  const ramp = (rows || []).filter((r) => r.status !== 'released');
  const shipped = (rows || [])
    .filter((r) => r.status === 'released')
    .sort((a, b) => new Date(b.released_at || b.release_at || 0) - new Date(a.released_at || a.release_at || 0));

  return (
    <Container maxW="880px" px={{ base: 4, md: 8 }} py={{ base: 6, md: 10 }}>
      <VStack align="stretch" spacing={{ base: 8, md: 10 }}>
        <Box>
          <Text fontSize={TYPE.h1} fontWeight="600" letterSpacing="-0.02em" color={P.ink}>
            Releases
          </Text>
          <Text fontSize={TYPE.body} color={P.inkSec} mt={1}>
            What leaves the yard, and when. Click a title to write it, click a status to advance it.
          </Text>
        </Box>

        {/* the quick add. title, channel, date, one lime button */}
        <HStack spacing={2.5} flexWrap={{ base: 'wrap', md: 'nowrap' }} rowGap={2.5}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="what ships next"
            bg={P.sheet} borderColor={P.hair} color={P.ink} fontSize={TYPE.body}
            _placeholder={{ color: P.inkFaint }}
            _hover={{ borderColor: P.inkFaint }}
            _focus={{ borderColor: P.inkMuted, boxShadow: 'none' }}
            flex="1" minW={{ base: '100%', md: '240px' }} />
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}
            bg={P.sheet} borderColor={P.hair} color={P.inkSec} fontSize={TYPE.label}
            fontFamily="mono" w={{ base: '46%', md: '140px' }} flexShrink={0}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            bg={P.sheet} borderColor={P.hair} color={P.inkSec} fontSize={TYPE.label}
            fontFamily="mono" w={{ base: '46%', md: '150px' }} flexShrink={0} />
          <HStack as="button" type="button" onClick={add} spacing={1.5}
            bg={P.lime} color={P.limeInk} borderRadius="10px" px={4} py={2}
            fontSize={TYPE.label} fontWeight="600" cursor="pointer" flexShrink={0}
            opacity={saving ? 0.6 : 1}
            _hover={{ opacity: 0.85 }} transition={`opacity ${FAST} ${EASE}`}>
            <TbPlus size={15} />
            <Text>add</Text>
          </HStack>
        </HStack>

        {rows === null && (
          <HStack justify="center" py={16}><Spinner size="sm" color={P.inkMuted} /></HStack>
        )}

        {tableMissing && (
          <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={5}>
            <Text fontSize={TYPE.body} color={P.inkSec}>
              The releases table is not in the database yet. Paste
              supabase/migrations/2026082901_releases.sql and then
              supabase/migrations/2026091202_social_timeline.sql into the dashboard SQL editor
              and reload, the seed slate comes with them.
            </Text>
          </Box>
        )}

        {rows !== null && !tableMissing && (
          <>
            <Timeline rows={rows} onOpen={open} />

            <Box>
              <HStack spacing={2} mb={2}>
                <TbRocket size={14} color={P.inkMuted} />
                <Kicker>on the ramp · {ramp.length}</Kicker>
              </HStack>
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
                {ramp.map((r) => <Row key={r.id} r={r} onAdvance={advance} onOpen={open} />)}
                {ramp.length === 0 && (
                  <Text fontSize={TYPE.body} color={P.inkFaint} py={6}>
                    Nothing staged. The yard is suspiciously quiet.
                  </Text>
                )}
              </VStack>
            </Box>

            <Box>
              <Kicker mb={2}>out the door · {shipped.length}</Kicker>
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
                {shipped.map((r) => <Row key={r.id} r={r} onAdvance={advance} onOpen={open} />)}
                {shipped.length === 0 && (
                  <Text fontSize={TYPE.body} color={P.inkFaint} py={6}>
                    Nothing shipped from this board yet. It will not stay that way.
                  </Text>
                )}
              </VStack>
            </Box>

            <Accounts />
          </>
        )}
      </VStack>

      <ReleaseDrawer release={editing} isOpen={Boolean(editing)} onClose={() => setEditingId(null)}
        onSaved={load} onAdvance={advance} />
    </Container>
  );
};

export default Releases;
