// src/pages/Trademarks/index.jsx
// SENTINEL: NB_PULSE_TRADEMARKS_V1
//
// The studio's trademark watch. Every word the studio might file for The
// Burroship LLC, one lowercase word each, checked against the USPTO register
// and kept, so the page is an evolving record Tyler and the burros add to.
// Tyler, 2026-10-05: "We could make a list of words that we're trying. We'll
// keep adding to the report. It's an evolving link ... they're all one word."
//
// ── THE SHAPE, AND WHY IT LOOKS LIKE THIS ───────────────────────────────────
// Tyler showed the Claude settings panels the same evening and asked for
// Pulse to "subtly start getting better and better and looking like that".
// So this page is the first one built to that pattern: a plain title and one
// line under it, the tools on one row (search on the left, add on the
// right), then a table of quiet rows with hairline rules, column heads in
// small muted type and the status in words at the right. No cards inside
// cards. A row opens in place to show what the register holds.
//
// ── WHERE THE WORDS LIVE ────────────────────────────────────────────────────
// Not here. This repo is public. The list is in Netlify Blobs behind
// netlify/functions/trademark-watch.js, which lets only studio roles in. The
// three seed words live in that function, never in this file.
//
// ── CHECKING ────────────────────────────────────────────────────────────────
// A new word is checked the moment it is added. Words that have never been
// checked are checked on open, one at a time with a pause between, so a long
// list is gentle on the office. Check all walks the whole list the same way.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Input, Textarea, Button, Link,
} from '@chakra-ui/react';
import {
  TbPlus, TbRefresh, TbExternalLink, TbTrash, TbChevronDown,
} from 'react-icons/tb';
import colors from '../../theme/colors';
import { TYPE, KICKER } from '../../theme/layout';
import { Page, PageHead, Tabs, SearchBox, Empty, Loading } from '../../components/common/Page';
import { callWatch, cleanWord, VERDICT, when, pause } from '../../lib/trademarkWatch';

const P = colors.paper;
const TONE = { clear: P.green, dead: P.gold, taken: P.coral };
// Pulse breaks md at 1024, so the table opens at sm, 640, where four columns
// already fit. Below that a row is the word and its status, the rest opens in
// place.
const GRID = { base: '1fr auto', sm: 'minmax(0,1fr) minmax(0,1.6fr) 110px 120px' };

const Head = ({ children, ...rest }) => (
  <Text {...KICKER} color={P.inkFaint} {...rest}>{children}</Text>
);

const MarkLine = ({ m }) => (
  <HStack align="start" spacing={3} py={2} borderTop="1px solid" borderColor={P.hairSoft}>
    <Box w="8px" h="8px" mt="7px" borderRadius="full" flexShrink={0} bg={m.alive ? P.coral : P.hair} />
    <VStack align="start" spacing={0.5} minW={0} flex={1}>
      <HStack spacing={2} flexWrap="wrap">
        <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{m.mark}</Text>
        <Text fontSize={TYPE.small} color={m.alive ? P.coral : P.inkMuted}>{m.status}</Text>
        {m.classes.length > 0 && (
          <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>class {m.classes.join(', ')}</Text>
        )}
      </HStack>
      <Text fontSize={TYPE.small} color={P.inkSec} noOfLines={2}>{m.owner || 'owner not listed'}</Text>
      <HStack spacing={3} flexWrap="wrap">
        {m.filed && <Text fontSize={TYPE.label} color={P.inkFaint}>filed {m.filed}</Text>}
        {m.registered && <Text fontSize={TYPE.label} color={P.inkFaint}>registered {m.registered}</Text>}
        <Link href={m.link} isExternal fontSize={TYPE.label} color={P.inkMuted} _hover={{ color: P.ink }}>
          serial {m.serial} <Icon as={TbExternalLink} boxSize={3} verticalAlign="-1px" />
        </Link>
      </HStack>
    </VStack>
  </HStack>
);

// FILING IT DIRECTLY, shown on a word that is clear or holds only dead marks.
// Tyler, 2026-10-05: "explain the pricing and the process, and provide links
// ... The best, most manual way. No services. We do it directly." So this is
// the USPTO's own door and nobody in between. Fees read off the USPTO fee
// schedule the same day, electronic filing in Trademark Center. If the office
// moves a fee, move it here and in the footnote at the foot of the page.
const STEPS = [
  {
    title: 'Pick the classes',
    say: 'Every class is its own fee. Take the wording straight from the ID Manual, it is what keeps the $200 free-form charge off.',
    link: { href: 'https://idm-tmng.uspto.gov/id-master-list-public.html', label: 'ID Manual' },
  },
  {
    title: 'File in Trademark Center',
    say: 'Signed in to a USPTO.gov account with its identity check done once. Owner The Burroship LLC, mark in standard characters, which covers the word in lowercase and every other case.',
    link: { href: 'https://www.uspto.gov/trademarks/apply/trademark-center', label: 'Trademark Center' },
  },
  {
    title: 'Choose the basis',
    say: 'In use now, with a specimen showing it on the real thing, or intent to use. Intent to use asks for a statement of use later, $150 a class, or a six month extension at $125 a class.',
    link: { href: 'https://www.uspto.gov/trademarks/basics', label: 'Trademark basics' },
  },
  {
    title: 'Pay',
    say: '$350 a class. $100 more a class if information is missing, $200 more a class for free-form wording, $200 for each extra 1,000 characters. Two classes in use with ID Manual wording is $700.',
    link: { href: 'https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule', label: 'Fee schedule' },
  },
  {
    title: 'Then watch it here',
    say: 'An examining attorney reads it, it publishes for opposition, then it registers, or an intent to use filing gets a notice of allowance first. Check again on this page to see it move.',
  },
];

const FilingGuide = () => (
  <VStack align="stretch" spacing={0} borderLeft="2px solid" borderColor={P.lime} pl={4}>
    <Head mb={2}>Filing it directly with the USPTO</Head>
    {STEPS.map((step, i) => (
      <HStack key={step.title} align="start" spacing={3} py={2}>
        <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} w="14px" pt="2px" flexShrink={0}>{i + 1}</Text>
        <VStack align="start" spacing={0.5} minW={0}>
          <Text fontSize={TYPE.small} fontWeight="600" color={P.ink}>{step.title}</Text>
          <Text fontSize={TYPE.small} color={P.inkSec} lineHeight="1.55">{step.say}</Text>
          {step.link && (
            <Link href={step.link.href} isExternal fontSize={TYPE.label} color={P.inkMuted} _hover={{ color: P.ink }}>
              {step.link.label} <Icon as={TbExternalLink} boxSize={3} verticalAlign="-1px" />
            </Link>
          )}
        </VStack>
      </HStack>
    ))}
  </VStack>
);

const Row = ({ entry, busy, open, onToggle, onCheck, onRemove, onNote }) => {
  const v = entry.verdict ? VERDICT[entry.verdict] : null;
  const liveExact = entry.exact.filter((m) => m.alive);
  const [note, setNote] = useState(entry.note || '');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setNote(entry.note || ''); }, [entry.note]);

  const register = !entry.checkedAt
    ? (busy ? 'checking the register' : 'not checked yet')
    : liveExact.length
      ? `${liveExact[0].owner.split(' (')[0]}${liveExact.length > 1 ? ` and ${liveExact.length - 1} more` : ''}`
      : entry.exact.length
        ? `${entry.exact.length} lapsed ${entry.exact.length === 1 ? 'filing' : 'filings'}`
        : 'nothing with this word';

  return (
    <Box borderTop="1px solid" borderColor={P.hair}>
      <Box
        as="button"
        type="button"
        onClick={onToggle}
        w="100%"
        textAlign="left"
        display="grid"
        gridTemplateColumns={GRID}
        gap={{ base: 2, sm: 5 }}
        alignItems="center"
        py={3.5}
        px={1}
        _hover={{ bg: P.sunken }}
        borderRadius="8px"
      >
        <HStack spacing={2} minW={0}>
          <Icon as={TbChevronDown} boxSize={4} color={P.inkFaint} transform={open ? 'rotate(0deg)' : 'rotate(-90deg)'} transition="transform .2s" flexShrink={0} />
          <Text fontFamily="mono" fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{entry.word}</Text>
        </HStack>
        <Box display={{ base: 'none', sm: 'block' }} minW={0}>
          <Text fontSize={TYPE.small} color={P.inkSec} noOfLines={1}>{register}</Text>
        </Box>
        <Text display={{ base: 'none', sm: 'block' }} fontSize={TYPE.small} color={P.inkFaint}>{when(entry.checkedAt)}</Text>
        <Text fontSize={TYPE.small} fontWeight="600" textAlign="right" color={v ? TONE[entry.verdict] : P.inkFaint}>
          {busy ? 'checking' : v ? v.label : 'waiting'}
        </Text>
      </Box>

      {open && (
        <VStack align="stretch" spacing={4} pl={{ base: 1, sm: 7 }} pr={1} pb={5}>
          <Text display={{ base: 'block', sm: 'none' }} fontSize={TYPE.small} color={P.inkSec}>{register} · {when(entry.checkedAt)}</Text>
          {v && <Text fontSize={TYPE.small} color={P.inkMuted}>{v.say}.</Text>}
          {entry.error && <Text fontSize={TYPE.small} color={P.coral}>{entry.error}</Text>}

          {entry.exact.length > 0 && (
            <VStack align="stretch" spacing={0}>
              <Head mb={1}>This exact word</Head>
              {entry.exact.map((m) => <MarkLine key={m.serial} m={m} />)}
            </VStack>
          )}

          {entry.close.length > 0 && (
            <VStack align="stretch" spacing={0}>
              <Head mb={1}>Live and close, what an examiner would weigh</Head>
              {entry.close.map((m) => <MarkLine key={m.serial} m={m} />)}
              {entry.closeTotal > entry.close.length && (
                <Text fontSize={TYPE.label} color={P.inkFaint} pt={2}>
                  and {entry.closeTotal - entry.close.length} more live close spellings on the register
                </Text>
              )}
            </VStack>
          )}

          {(entry.verdict === 'clear' || entry.verdict === 'dead') && <FilingGuide />}

          <VStack align="stretch" spacing={2}>
            <Head>Note</Head>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why this word, what it would name" fontSize={TYPE.small} />
            <HStack spacing={2} flexWrap="wrap">
              <Button size="sm" variant="outline" isDisabled={note === (entry.note || '')} onClick={() => onNote(note)}>Keep note</Button>
              <Button size="sm" variant="ghost" leftIcon={<Icon as={TbRefresh} boxSize={4} />} isLoading={busy} loadingText="Checking" onClick={onCheck}>Check again</Button>
              <Box flex={1} />
              {confirm ? (
                <HStack spacing={2}>
                  <Text fontSize={TYPE.small} color={P.inkMuted}>Take it off the list?</Text>
                  <Button size="sm" variant="ghost" color={P.coral} onClick={onRemove}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
                </HStack>
              ) : (
                <Button size="sm" variant="ghost" color={P.inkMuted} leftIcon={<Icon as={TbTrash} boxSize={4} />} onClick={() => setConfirm(true)}>Remove</Button>
              )}
            </HStack>
          </VStack>
        </VStack>
      )}
    </Box>
  );
};

// call is the watch function. A local review fixture passes its own so the
// page can be looked at without a studio session. Everything else uses the
// real one.
const Trademarks = ({ call = callWatch }) => {
  const [words, setWords] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState({});
  const [open, setOpen] = useState(null);
  const [walking, setWalking] = useState(null);
  const walked = useRef(false);

  const put = useCallback((entry) => {
    setWords((list) => {
      const rest = (list || []).filter((e) => e.word !== entry.word);
      const at = (list || []).findIndex((e) => e.word === entry.word);
      if (at === -1) return [entry, ...rest];
      const next = [...(list || [])];
      next[at] = entry;
      return next;
    });
  }, []);

  const check = useCallback(async (word) => {
    setBusy((b) => ({ ...b, [word]: true }));
    try {
      const { entry } = await call('check', { word });
      put(entry);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [word]: false }));
    }
  }, [put, call]);

  const walk = useCallback(async (list) => {
    for (let i = 0; i < list.length; i += 1) {
      setWalking({ done: i, of: list.length });
      await check(list[i]);
      if (i < list.length - 1) await pause(700);
    }
    setWalking(null);
  }, [check]);

  useEffect(() => {
    call('list')
      .then(({ words: list }) => {
        setWords(list);
        if (!walked.current) {
          walked.current = true;
          const unchecked = list.filter((e) => !e.checkedAt).map((e) => e.word);
          if (unchecked.length) walk(unchecked);
        }
      })
      .catch((err) => { setError(err.message); setWords([]); });
  }, [walk]);

  const add = async (event) => {
    event.preventDefault();
    const word = cleanWord(draft);
    if (!word) return;
    if ((words || []).some((e) => e.word === word)) { setOpen(word); setDraft(''); return; }
    setAdding(true);
    setError('');
    setBusy((b) => ({ ...b, [word]: true }));
    try {
      const { entry } = await call('add', { word });
      put(entry);
      setOpen(word);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
      setBusy((b) => ({ ...b, [word]: false }));
    }
  };

  const remove = async (word) => {
    try {
      const { words: list } = await call('remove', { word });
      setWords(list);
      setOpen(null);
    } catch (err) { setError(err.message); }
  };

  const keepNote = async (word, note) => {
    try {
      const { entry } = await call('note', { word, note });
      put(entry);
    } catch (err) { setError(err.message); }
  };

  const counts = useMemo(() => {
    const list = words || [];
    return {
      all: list.length,
      clear: list.filter((e) => e.verdict === 'clear').length,
      dead: list.filter((e) => e.verdict === 'dead').length,
      taken: list.filter((e) => e.verdict === 'taken').length,
    };
  }, [words]);

  const shown = useMemo(() => (words || [])
    .filter((e) => tab === 'all' || e.verdict === tab)
    .filter((e) => !query || e.word.includes(cleanWord(query)) || (e.note || '').toLowerCase().includes(query.toLowerCase())),
  [words, tab, query]);

  const typed = cleanWord(draft);
  // The add button stays quiet paper until there is a word worth adding, then
  // it takes the screen's one lime. Lime is spent once per screen.
  const ready = typed.length >= 2 && !(words || []).some((e) => e.word === typed);

  return (
    <Page>
      <PageHead
        kicker="Studio · The Burroship LLC"
        title="Trademarks"
        lede="Every word the studio might file, one lowercase word each, read against the USPTO register and kept here as it grows. Add a word and it is searched the moment it lands."
        actions={(
          <Button size="sm" variant="ghost" leftIcon={<Icon as={TbRefresh} boxSize={4} />} isDisabled={!words?.length || !!walking} onClick={() => walk((words || []).map((e) => e.word))}>
            {walking ? `${walking.done + 1} of ${walking.of}` : 'Check all'}
          </Button>
        )}
      />

      <HStack as="form" onSubmit={add} spacing={2} align="stretch" flexWrap={{ base: 'wrap', sm: 'nowrap' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="search the list" flex="1 1 220px" />
        <HStack
          spacing={0}
          flex={{ base: '1 1 100%', sm: '0 1 380px' }}
          h="44px"
          pl={4}
          pr="5px"
          bg={P.sheet}
          border="1px solid"
          borderColor={ready ? P.inkMuted : P.hair}
          borderRadius="full"
          transition="border-color .2s"
          _focusWithin={{ borderColor: P.ink, boxShadow: `0 0 0 3px ${P.sunken}` }}
        >
          <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkFaint} pr={2} flexShrink={0} aria-hidden="true">tm</Text>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="a word to watch"
            aria-label="Add a word"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            variant="unstyled"
            h="100%"
            fontFamily="mono"
            fontSize={TYPE.body}
            color={P.ink}
            _placeholder={{ color: P.inkFaint, fontFamily: 'body' }}
          />
          <Button
            type="submit"
            h="34px"
            px={4}
            flexShrink={0}
            borderRadius="full"
            fontSize={TYPE.small}
            fontWeight="600"
            leftIcon={<Icon as={TbPlus} boxSize={3.5} />}
            isLoading={adding}
            loadingText="Searching"
            isDisabled={!ready}
            bg={ready ? P.lime : P.sunken}
            color={ready ? P.limeInk : P.inkFaint}
            _hover={{ bg: ready ? '#D2E26B' : P.sunken }}
            _active={{ bg: ready ? '#B9CC4C' : P.sunken }}
            _disabled={{ opacity: 1, cursor: 'default' }}
            transition="background .2s, color .2s"
          >
            Add
          </Button>
        </HStack>
      </HStack>
      {draft && typed !== draft.trim() && (
        <Text fontSize={TYPE.small} color={P.inkMuted} mt={-2}>
          Kept as <Text as="span" fontFamily="mono" color={P.ink}>{typed || 'nothing yet'}</Text>, one word, lowercase.
        </Text>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'clear', label: 'Clear', count: counts.clear, color: P.green },
          { key: 'dead', label: 'Dead marks only', count: counts.dead, color: P.gold },
          { key: 'taken', label: 'Taken', count: counts.taken, color: P.coral },
        ]}
      />

      {error && <Text fontSize={TYPE.small} color={P.coral}>{error}</Text>}

      {words === null ? (
        <Loading label="reading the list" />
      ) : shown.length === 0 ? (
        <Empty hint={query ? 'Nothing on the list matches that.' : 'Add the first word above.'}>
          {tab === 'all' ? 'The list is empty.' : 'Nothing in this group yet.'}
        </Empty>
      ) : (
        <Box>
          <Box display={{ base: 'none', sm: 'grid' }} gridTemplateColumns={GRID} gap={5} px={1} pb={2}>
            <Head pl={6}>Word</Head>
            <Head>On the register</Head>
            <Head>Checked</Head>
            <Head textAlign="right">Status</Head>
          </Box>
          {shown.map((entry) => (
            <Row
              key={entry.word}
              entry={entry}
              busy={!!busy[entry.word]}
              open={open === entry.word}
              onToggle={() => setOpen((o) => (o === entry.word ? null : entry.word))}
              onCheck={() => check(entry.word)}
              onRemove={() => remove(entry.word)}
              onNote={(note) => keepNote(entry.word, note)}
            />
          ))}
          <Box borderTop="1px solid" borderColor={P.hair} />
        </Box>
      )}

      <Text fontSize={TYPE.small} color={P.inkFaint} maxW="70ch" lineHeight="1.6">
        Clear means the federal register only. It does not cover state marks or a name already in use without a filing.
        Filings are by The Burroship LLC, directly with the USPTO, $350 a class on the current fee schedule. A lawyer reads before anything is filed.
      </Text>
    </Page>
  );
};

export default Trademarks;
