// src/pages/Mail/client/OpenItemsSection.jsx
// SENTINEL: NB_PULSE_OPEN_ITEMS_SECTION_V1
//
// Everything waiting on one client, at a glance. Tyler, 2026-10-05, by way
// of the coordinator. Each open item stays open until the client answers it
// and carries into every later report with its age, so an unanswered list
// visibly stacks up week after week, the studio stops doing work nobody
// asked for and the record keeps going.
//
// Built to drop into Volt's one page ClientDetail.jsx as a single line right
// after InvoicesSection, <OpenItemsSection clientId={clientId} client={client} />,
// imported from src/pages/Mail/client/index.js. It loads its own rows and
// needs nothing else from the page. Until Volt's rewrite lands it is mounted
// on /mail/clients/:clientId/, src/pages/Mail/MailClient.jsx.
//
// ── WHAT IT SHOWS ───────────────────────────────────────────────────────────
//   the count open, the oldest age and how many answers nobody has seen
//   every open item oldest first, its kind, open since and the age, which
//   turns amber at two weeks, the same rule the letter uses
//   the answers, newest first, with who, when, from what device and any
//   note, and a Seen press that takes them out of the admin queue
//
// ── WHAT A PERSON CAN DO HERE ───────────────────────────────────────────────
// Add an item, copy its answer link to text it, record an answer that came
// by phone or reply, or withdraw one the studio no longer needs. Every one
// of those is a row write and nothing else. Nothing here mails the client,
// and approving or denying never does either, wherever it happens.
//
// Ages count to today here, the screen is about now. The letter counts to
// its own asOf so its bytes stay the same between the test and the send.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Button, Input, Textarea, SimpleGrid, Tooltip,
} from '@chakra-ui/react';
import {
  TbPlus, TbCopy, TbCheck, TbX, TbArrowBackUp, TbEye, TbClock,
} from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Section, Plate, Empty, Loading, Field, Kicker } from '../../../components/common/Page';
import DotSelect from '../../../components/common/DotSelect';
import { useAuth } from '../../../hooks/useAuth';
import {
  ITEM_KINDS, ageLabel, ageDays, shortDate, todayInRidgway, answerLink,
} from '../../../lib/mailDocument';
import {
  loadItems, addItem, withdrawItem, answerInPulse, markSeen, MIGRATION_TWO,
} from './mailData';

const P = colors.paper;

const AddForm = ({ onAdd, onCancel, busy }) => {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [kind, setKind] = useState('decision');
  const [openedAt, setOpenedAt] = useState(todayInRidgway());
  const [choices, setChoices] = useState('');
  return (
    <Plate sunken>
      <VStack align="stretch" spacing={4}>
        <Field label="what is waiting on them"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Approve a support login for the studio" /></Field>
        <Field label="one line of detail" hint="optional"><Textarea rows={2} minH="64px" value={detail} onChange={(e) => setDetail(e.target.value)} /></Field>
        <SimpleGrid minChildWidth="180px" spacing={4}>
          <Field label="kind">
            <DotSelect value={kind} onChange={setKind} options={Object.values(ITEM_KINDS).map((k) => ({ value: k.key, label: k.label }))} />
          </Field>
          <Field label="open since"><Input type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} /></Field>
        </SimpleGrid>
        <Field label="choices" hint="optional, comma separated, replaces approve and deny">
          <Input value={choices} onChange={(e) => setChoices(e.target.value)} placeholder="Weekly, Every two weeks, Monthly" />
        </Field>
        <HStack spacing={2}>
          <Button size="sm" onClick={() => onAdd({ title, detail, kind, openedAt, choices })} isDisabled={!title.trim()} isLoading={busy}>Open it</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </HStack>
      </VStack>
    </Plate>
  );
};

const OpenRow = ({ item, today, onCopy, onAnswer, onWithdraw }) => {
  const old = ageDays(item.opened_at, today) >= 14;
  const choices = Array.isArray(item.choices) ? item.choices : [];
  return (
    <HStack align="flex-start" spacing={3} py={3} borderTop="1px solid" borderColor={P.hairSoft} _first={{ borderTop: 'none' }} flexWrap="wrap" rowGap={2}>
      <VStack align="start" spacing={1} flex="1 1 260px" minW={0}>
        <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{item.title}</Text>
        {item.detail && <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={2}>{item.detail}</Text>}
        <HStack spacing={2} flexWrap="wrap">
          <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>{(ITEM_KINDS[item.kind] || ITEM_KINDS.other).label}</Text>
          <HStack spacing={1}>
            <Icon as={TbClock} boxSize={3} color={old ? P.gold : P.inkFaint} />
            <Text fontSize={TYPE.label} color={old ? P.gold : P.inkFaint} fontWeight={old ? '600' : '400'}>
              open since {shortDate(item.opened_at)}, {ageLabel(item.opened_at, today)}
            </Text>
          </HStack>
          {choices.length > 0 && <Text fontSize={TYPE.label} color={P.inkFaint}>{choices.join(' / ')}</Text>}
        </HStack>
      </VStack>
      <HStack spacing={1} flexShrink={0}>
        <Tooltip label="Copy the answer link, to text it"><Button size="xs" variant="ghost" onClick={() => onCopy(item)} aria-label="Copy the answer link"><Icon as={TbCopy} boxSize={3.5} /></Button></Tooltip>
        {choices.length === 0 && (
          <>
            <Tooltip label="They approved, by phone or reply"><Button size="xs" variant="ghost" onClick={() => onAnswer(item, 'approved')} aria-label="Record approved"><Icon as={TbCheck} boxSize={3.5} /></Button></Tooltip>
            <Tooltip label="They denied, by phone or reply"><Button size="xs" variant="ghost" onClick={() => onAnswer(item, 'denied')} aria-label="Record denied"><Icon as={TbX} boxSize={3.5} /></Button></Tooltip>
          </>
        )}
        <Tooltip label="Withdraw, the studio no longer needs it"><Button size="xs" variant="ghost" onClick={() => onWithdraw(item)} aria-label="Withdraw this item"><Icon as={TbArrowBackUp} boxSize={3.5} /></Button></Tooltip>
      </HStack>
    </HStack>
  );
};

const AnsweredRow = ({ item, onSeen }) => {
  const word = item.status === 'withdrawn' ? 'withdrawn' : item.answer_choice || item.status;
  const tone = item.status === 'denied' ? P.coral : item.status === 'withdrawn' ? P.inkFaint : P.green;
  return (
    <HStack align="flex-start" spacing={3} py={2.5} borderTop="1px solid" borderColor={P.hairSoft} flexWrap="wrap" rowGap={1}>
      <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={tone} minW="84px" pt={0.5}>{word}</Text>
      <VStack align="start" spacing={0.5} flex="1 1 220px" minW={0}>
        <Text fontSize={TYPE.small} color={P.ink} noOfLines={1}>{item.title}</Text>
        <Text fontSize={TYPE.label} color={P.inkFaint}>
          {shortDate(item.answered_at)}{item.answered_by ? ` by ${item.answered_by}` : ''}{item.answered_via === 'link' ? ' through the link' : ' in Pulse'}{item.answer_device ? `, ${item.answer_device}` : ''}
        </Text>
        {item.answer_note && <Text fontSize={TYPE.small} color={P.inkSec}>{item.answer_note}</Text>}
      </VStack>
      {!item.seen_at && item.status !== 'withdrawn' && (
        <Button size="xs" variant="outline" leftIcon={<Icon as={TbEye} boxSize={3.5} />} onClick={() => onSeen([item.id])}>Seen</Button>
      )}
    </HStack>
  );
};

// fixtureItems comes only from src/pages/Mail/MailFixture.jsx in development.
const OpenItemsSection = ({ clientId, fixtureItems = null }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const today = todayInRidgway();

  const load = useCallback(async () => {
    if (fixtureItems) { setItems(fixtureItems); setLoading(false); return; }
    const res = await loadItems(clientId);
    setItems(res.items);
    setMissing(res.missing);
    setLoading(false);
  }, [clientId, fixtureItems]);

  useEffect(() => { load(); }, [load]);

  const open = items.filter((i) => i.status === 'open');
  const answered = items.filter((i) => i.status !== 'open').sort((a, b) => String(b.answered_at).localeCompare(String(a.answered_at))).slice(0, 12);
  const unseen = items.filter((i) => i.answered_at && !i.seen_at && i.status !== 'withdrawn');
  const oldest = open[0];

  const run = async (fn, done) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    setNote(err ? { bad: true, text: err } : done ? { text: done } : null);
    if (!err) load();
  };

  const copy = async (item) => {
    try {
      await navigator.clipboard.writeText(answerLink(item.token));
      setNote({ text: 'The answer link is copied. It opens a page with one button.' });
    } catch {
      setNote({ text: answerLink(item.token) });
    }
  };

  return (
    <Section
      kicker="open items"
      count={missing ? null : open.length}
      action={!missing && (
        <Button size="xs" variant="ghost" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={() => setAdding(true)}>Add</Button>
      )}
    >
      {loading && <Loading label="reading what is waiting" />}
      {!loading && missing && (
        <Text fontSize={TYPE.small} color={P.coral} lineHeight="1.6">
          Open items need {MIGRATION_TWO} applied. Until then there is nowhere to keep them.
        </Text>
      )}
      {!loading && !missing && (
        <VStack align="stretch" spacing={4}>
          <HStack spacing={4} flexWrap="wrap" rowGap={1}>
            <Text fontSize={TYPE.small} color={P.ink}><b>{open.length}</b> open</Text>
            {oldest && <Text fontSize={TYPE.small} color={ageDays(oldest.opened_at, today) >= 14 ? P.gold : P.inkMuted}>oldest {ageLabel(oldest.opened_at, today)}</Text>}
            {unseen.length > 0 && <Text fontSize={TYPE.small} color={P.limeDeep}><b>{unseen.length}</b> answered, not yet seen</Text>}
          </HStack>

          {adding && (
            <AddForm
              busy={busy}
              onCancel={() => setAdding(false)}
              onAdd={(f) => run(() => addItem({ clientId, ...f, userId: user?.id }), 'Opened. It is in the next letter that carries open items.').then(() => setAdding(false))}
            />
          )}

          {open.length === 0 && !adding && <Empty hint="Add one when the studio needs an answer before it does anything.">Nothing is waiting on this client.</Empty>}
          {open.length > 0 && (
            <Plate py={1}>
              {open.map((item) => (
                <OpenRow
                  key={item.id}
                  item={item}
                  today={today}
                  onCopy={copy}
                  onAnswer={(it, status) => run(() => answerInPulse(it, { status, userEmail: user?.email }), `Recorded as ${status}.`)}
                  onWithdraw={(it) => run(() => withdrawItem(it.id, user?.email), 'Withdrawn. It leaves the next letter.')}
                />
              ))}
            </Plate>
          )}

          {answered.length > 0 && (
            <Box>
              <HStack justify="space-between" mb={1}>
                <Kicker>answered</Kicker>
                {unseen.length > 1 && <Button size="xs" variant="ghost" onClick={() => run(() => markSeen(unseen.map((i) => i.id)))}>All seen</Button>}
              </HStack>
              {answered.map((item) => <AnsweredRow key={item.id} item={item} onSeen={(ids) => run(() => markSeen(ids))} />)}
            </Box>
          )}

          {note && <Text fontSize={TYPE.small} color={note.bad ? P.coral : P.inkMuted} wordBreak="break-all">{note.text}</Text>}
        </VStack>
      )}
    </Section>
  );
};

export default OpenItemsSection;
