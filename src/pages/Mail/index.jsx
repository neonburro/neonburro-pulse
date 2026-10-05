// src/pages/Mail/index.jsx
// SENTINEL: NB_PULSE_MAIL_ROOM_V1
//
// The Mail room. Every letter composed in Pulse, drafts and sent, with the
// New that starts one. Tyler, 2026-10-05, "I wonder if we could send this
// from Pulse and really style it nicely ... It's like a proposal or
// invoice, but it's more for these reports and emails." Route /mail/, the
// editor is /mail/:mailId/ in MailEditor.jsx.
//
// ── WHY MAIL AND NOT LETTERS ────────────────────────────────────────────────
// The studio already has letters, the /n/ client pages with a code. Two
// tables on this project hold them, letter_opens and letter_answers. This
// room composes the email that carries a link to one of those, so it is
// Mail, and its tables are mail_documents and mail_sends.
//
// ── WAITING ON YOU, THE ADMIN QUEUE ─────────────────────────────────────────
// Tyler, 2026-10-05, "I don't mind sending notifications ... Just don't do a
// bunch of them. Just add them to Pulse." Everything waiting on him lives at
// the top of this room with a count, updates the system proposed and
// answers that came back through an answer link and nobody has seen. Email
// is at most one quiet digest a day and only when something new is
// waiting, netlify/functions/mail-digest.js. Never one email per event.
//
// ── NEW STARTS ON THE HOUSE COLOURS ─────────────────────────────────────────
// New writes a blank document from src/lib/mailDocument.js straight away and
// opens it, so there is never an editor holding a letter that exists only
// in a tab. Picking a client in the editor puts the letter in that client's
// colours when a preset matches them.
//
// ── BEFORE THE MIGRATION ────────────────────────────────────────────────────
// If supabase/migrations/20261005113806_mail_composer.sql is not on the
// database the select fails, and this page says which file is missing
// rather than showing an empty room that looks finished. It was applied on
// 2026-10-05, so this branch should never show, and if it does that is
// news.
//
// Composed from src/components/common/Page.jsx. No width, gutter, inset or
// font size typed here.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, HStack, VStack, Text, Icon, Button } from '@chakra-ui/react';
import { TbPlus, TbCircleCheck, TbPencil, TbHourglass, TbMessageCheck } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { blankMail, normalizeMail, resolvePalette, themeLabel, kindLabel } from '../../lib/mailDocument';
import { loadQueue, markSeen, kindOf } from './client/mailData';
import colors from '../../theme/colors';
import { TYPE, FAST, EASE } from '../../theme/layout';
import { Page, PageHead, Plate, Section, Empty, Loading, Stats, SearchBox, Tabs } from '../../components/common/Page';
import { formatSmart, formatDateTime } from '../../lib/time';

const P = colors.paper;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'proposed', label: 'Proposed' },
  { key: 'sent', label: 'Sent' },
];

// The queue. One row per thing waiting on Tyler, oldest first.
const Queue = ({ proposed, answers, onOpenDoc, onOpenClient, onSeen }) => (
  <Plate py={1}>
    {proposed.map((row) => {
      const doc = normalizeMail(row.doc);
      return (
        <HStack key={`d-${row.id}`} spacing={3} py={3} borderTop="1px solid" borderColor={P.hairSoft} _first={{ borderTop: 'none' }} align="center" flexWrap="wrap" rowGap={2}>
          <Icon as={TbHourglass} boxSize={3.5} color={P.gold} flexShrink={0} />
          <VStack align="start" spacing={0} flex="1 1 240px" minW={0}>
            <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{doc.subject || 'Untitled update'}</Text>
            <Text fontSize={TYPE.label} color={P.inkMuted}>
              {kindLabel(kindOf(row))} proposed for {row.clients?.company || row.clients?.name || 'no client'} {'·'} {formatSmart(row.created_at)}
            </Text>
          </VStack>
          <Button size="xs" variant="outline" onClick={() => onOpenDoc(row.id)}>Read and approve</Button>
        </HStack>
      );
    })}
    {answers.map((item) => (
      <HStack key={`i-${item.id}`} spacing={3} py={3} borderTop="1px solid" borderColor={P.hairSoft} _first={{ borderTop: 'none' }} align="center" flexWrap="wrap" rowGap={2}>
        <Icon as={TbMessageCheck} boxSize={3.5} color={item.status === 'denied' ? P.coral : P.green} flexShrink={0} />
        <VStack align="start" spacing={0} flex="1 1 240px" minW={0}>
          <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{item.title}</Text>
          <Text fontSize={TYPE.label} color={P.inkMuted}>
            {item.answer_choice || item.status} by {item.answered_by || (item.clients?.company || item.clients?.name || 'the client')} {'·'} {formatSmart(item.answered_at)}{item.answer_device ? ` ${'·'} ${item.answer_device}` : ''}
          </Text>
          {item.answer_note && <Text fontSize={TYPE.small} color={P.inkSec}>{item.answer_note}</Text>}
        </VStack>
        <HStack spacing={1.5}>
          <Button size="xs" variant="ghost" onClick={() => onOpenClient(item.client_id)}>Client</Button>
          <Button size="xs" variant="outline" onClick={() => onSeen(item.id)}>Seen</Button>
        </HStack>
      </HStack>
    ))}
  </Plate>
);

const Swatch = ({ theme }) => {
  const c = resolvePalette(theme);
  return (
    <Box w="40px" h="40px" borderRadius="12px" bg={c.ground} border="1px solid" borderColor={P.hair} p="6px" flexShrink={0}>
      <Box w="100%" h="100%" borderRadius="7px" bg={c.card} position="relative">
        <Box position="absolute" left="5px" bottom="5px" w="12px" h="3px" bg={c.accent} borderRadius="1px" />
      </Box>
    </Box>
  );
};

const Row = ({ row, onOpen }) => {
  const doc = normalizeMail(row.doc);
  const count = doc.to.length + doc.cc.filter((e) => !doc.to.includes(e)).length;
  const sent = row.status === 'sent';
  return (
    <HStack
      as="button"
      type="button"
      onClick={onOpen}
      w="100%"
      textAlign="left"
      spacing={4}
      px={{ base: 3, md: 4 }}
      py={3.5}
      borderTop="1px solid"
      borderColor={P.hairSoft}
      _first={{ borderTop: 'none' }}
      transition={`background ${FAST} ${EASE}`}
      _hover={{ bg: P.sunken }}
      align="center"
    >
      <Swatch theme={doc.theme} />
      <VStack align="start" spacing={0.5} flex={1} minW={0}>
        <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>
          {doc.subject.trim() || 'Untitled letter'}
        </Text>
        <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>
          {kindLabel(kindOf(row))}
          {row.clients?.company || row.clients?.name ? ` · ${row.clients.company || row.clients.name}` : ' · no client yet'}
          {` · ${count ? `${doc.to[0] || doc.cc[0]}${count > 1 ? ` and ${count - 1} more` : ''}` : 'nobody yet'}`}
          {` · ${themeLabel(doc.theme)}`}
        </Text>
      </VStack>
      <VStack align="end" spacing={0.5} flexShrink={0}>
        <HStack spacing={1}>
          <Icon as={sent ? TbCircleCheck : row.status === 'proposed' ? TbHourglass : TbPencil} boxSize={3} color={sent ? P.green : row.status === 'proposed' ? P.gold : P.inkFaint} />
          <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={sent ? P.green : row.status === 'proposed' ? P.gold : P.inkMuted}>
            {row.status || 'draft'}
          </Text>
        </HStack>
        <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} display={{ base: 'none', sm: 'block' }}>
          {sent && row.sent_at ? formatDateTime(row.sent_at) : formatSmart(row.updated_at)}
        </Text>
      </VStack>
    </HStack>
  );
};

// fixtureRows comes only from src/pages/Mail/MailFixture.jsx, the
// development door. With it the room reads nothing and New writes nothing.
const MailRoom = ({ fixtureRows = null }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState(fixtureRows || []);
  const [loading, setLoading] = useState(!fixtureRows);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [making, setMaking] = useState(false);
  const [queue, setQueue] = useState({ proposed: [], answers: [], missing: false });

  const readQueue = async () => {
    if (fixtureRows) {
      setQueue({ proposed: fixtureRows.filter((r) => r.status === 'proposed'), answers: [], missing: false });
      return;
    }
    setQueue(await loadQueue());
  };

  useEffect(() => { readQueue(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fixtureRows) return undefined;
    let live = true;
    (async () => {
      const { data, error: err } = await supabase
        .from('mail_documents')
        .select('id, status, doc, client_id, updated_at, sent_at, created_at, clients(id, name, company)')
        .order('updated_at', { ascending: false });
      if (!live) return;
      if (err) setError(err.message);
      setRows(data || []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [fixtureRows]);

  const make = async () => {
    if (fixtureRows) { navigate('/__review/mail/'); return; }
    setMaking(true);
    const { data, error: err } = await supabase
      .from('mail_documents')
      .insert({ doc: blankMail('neonburro'), status: 'draft', created_by: user?.id || null, updated_by: user?.id || null })
      .select('id')
      .maybeSingle();
    setMaking(false);
    if (err || !data) { setError(err?.message || 'the new letter did not write'); return; }
    navigate(`/mail/${data.id}/`);
  };

  const live = rows.filter((r) => r.status !== 'dismissed');
  const counts = useMemo(() => ({
    all: live.length,
    draft: live.filter((r) => ['draft', 'approved'].includes(r.status)).length,
    proposed: live.filter((r) => r.status === 'proposed').length,
    sent: live.filter((r) => r.status === 'sent').length,
  }), [live]);
  const waiting = queue.proposed.length + queue.answers.length;

  const shown = live.filter((r) => {
    if (tab === 'draft' && !['draft', 'approved'].includes(r.status)) return false;
    if (tab === 'proposed' && r.status !== 'proposed') return false;
    if (tab === 'sent' && r.status !== 'sent') return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const d = r.doc || {};
    return [d.subject, ...(d.to || []), ...(d.cc || []), r.clients?.company, r.clients?.name]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const missingTables = error && /mail_documents|schema cache|does not exist/i.test(error);

  return (
    <Page>
      <PageHead
        kicker="mail"
        title="Letters, composed here and sent from the studio."
        lede="Write it in fields, see it exactly as it lands, test it to yourself, then send it. Each letter wears its client's colours and every send is written down."
        actions={(
          <Button size="sm" leftIcon={<Icon as={TbPlus} boxSize={4} />} onClick={make} isLoading={making} loadingText="Starting">
            New letter
          </Button>
        )}
      >
        <Stats items={[
          waiting > 0 && { key: 'waiting', n: waiting, label: 'waiting on you', tone: P.gold },
          { key: 'all', n: counts.all, label: counts.all === 1 ? 'letter' : 'letters' },
          counts.draft > 0 && { key: 'draft', n: counts.draft, label: counts.draft === 1 ? 'draft' : 'drafts', tone: P.inkSec },
          counts.sent > 0 && { key: 'sent', n: counts.sent, label: 'sent', tone: P.green },
        ]} />
        {missingTables && (
          <Text fontSize={TYPE.small} color={P.coral} mt={2}>
            The mail tables are not in the database. supabase/migrations/20261005113806_mail_composer.sql has not
            been applied here, so nothing can be saved or sent yet.
          </Text>
        )}
        {error && !missingTables && <Text fontSize={TYPE.small} color={P.coral} mt={2}>{error}</Text>}
      </PageHead>

      {waiting > 0 && (
        <Section kicker="waiting on you" count={waiting}>
          <Queue
            proposed={queue.proposed}
            answers={queue.answers}
            onOpenDoc={(id) => navigate(fixtureRows ? '/__review/mail/' : `/mail/${id}/`)}
            onOpenClient={(id) => navigate(`/mail/clients/${id}/`)}
            onSeen={async (id) => { await markSeen([id]); readQueue(); }}
          />
        </Section>
      )}

      <VStack align="stretch" spacing={5}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by subject, address or client" />
        <Tabs items={TABS.map((t) => ({ ...t, count: counts[t.key] }))} value={tab} onChange={setTab} />
        {loading && <Loading label="reading the mail" />}
        {!loading && !shown.length && (
          <Empty hint={rows.length ? 'Nothing matches that.' : 'New letter starts one on the house colours.'}>
            {rows.length ? 'No letters here.' : 'No letters yet.'}
          </Empty>
        )}
        {!loading && shown.length > 0 && (
          <Plate pad={false}>
            {shown.map((row) => (
              <Row key={row.id} row={row} onOpen={() => navigate(fixtureRows ? '/__review/mail/' : `/mail/${row.id}/`)} />
            ))}
          </Plate>
        )}
      </VStack>
    </Page>
  );
};

export default MailRoom;
