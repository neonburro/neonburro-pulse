// src/pages/Trademarks/ListView.jsx
// SENTINEL: NB_PULSE_TRADEMARKS_LIST_V2
//
// One watch list. The words, what holds each one on the register, how often
// the night reads it and the verdict. Minimal at first, Tyler's word, so a row
// is the word and its status and everything else is one click in. Every row
// goes to the word, every date in coming up goes to the word or the mark.
//
// ── GETTING BACK ────────────────────────────────────────────────────────────
// The tab and the search live in the address, ?tab=taken&q=ridge, so the back
// crumb on a word returns to exactly this view and a reload keeps it. The
// scroll position is kept per list in sessionStorage when a row is opened and
// put back when the rows arrive, so a long list does not jump to the top.
//
// ── THE STUDIO AND ITS CLIENTS ──────────────────────────────────────────────
// The studio sees a row of lists above the tools, its own and each client's
// it has opened, and can open one for any client. A client never sees this
// page, their list lives in the portal on neonburro.com, see the access note
// in netlify/functions/trademark-watch.js for why.
//
// No oxford commas, no em dashes.

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Box, VStack, HStack, Text, Icon, Input, Button, Select, Link } from '@chakra-ui/react';
import { TbPlus, TbRefresh } from 'react-icons/tb';
import { Link as RouterLink } from 'react-router-dom';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST } from '../../theme/layout';
import { Page, PageHead, Tabs, SearchBox, Empty, Loading, Section } from '../../components/common/Page';
import { cleanWord, VERDICT, cadenceShort, shortDay, todayIso, pause, TONE_WORD, sessionUsed } from '../../lib/trademarkWatch';
import { Head, PulseLine, LiveDot, TONE, VERDICT_TONE, RowLink, FEES_READ } from './parts';

const P = colors.paper;
const GRID = { base: 'minmax(0,1fr) auto', sm: 'minmax(0,1fr) minmax(0,1.4fr) 150px 120px' };
const scrollKey = (base) => `nb-tm-scroll-${base}`;

const comingUp = (entries, today) => {
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 180 * 86400000).toISOString().slice(0, 10);
  const items = [];
  for (const e of entries) {
    for (const x of e.moments || []) {
      if (x.tone === 'free' || x.tone === 'look' || (x.tone === 'watch' && x.date && x.date <= soon)) items.push({ word: e.word, x });
    }
  }
  const rank = { free: 0, look: 1, watch: 2 };
  return items
    .sort((a, b) => (rank[a.x.tone] - rank[b.x.tone]) || String(a.x.date || '9').localeCompare(String(b.x.date || '9')))
    .slice(0, 5);
};

const watchLine = (e) => {
  if (e.lookAgain) return `look ${shortDay(e.lookAgain)}`;
  if (e.cadence === 'off') return 'not watched';
  return `${cadenceShort(e.cadence)}${e.nextRead ? ` · next ${shortDay(e.nextRead)}` : ''}`;
};

const Lists = ({ lists, owner, root, onOpen }) => {
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState('');
  const [opening, setOpening] = useState(false);
  if (!lists) return null;
  const go = async () => {
    if (!choice) return;
    setOpening(true);
    try { await onOpen(choice); } finally { setOpening(false); setPicking(false); setChoice(''); }
  };
  return (
    <HStack spacing={5} flexWrap="wrap" rowGap={2} align="center">
      <Head>Lists</Head>
      {lists.lists.map((l) => {
        const on = l.owner === owner;
        return (
          <Link
            key={l.owner}
            as={RouterLink}
            to={l.owner === 'studio' ? root : `${root}c/${l.owner}/`}
            fontSize={TYPE.small}
            fontWeight={on ? '700' : '500'}
            color={on ? P.ink : P.inkMuted}
            _hover={{ color: P.ink, textDecoration: 'none' }}
          >
            {l.name}
            <Text as="span" fontFamily="mono" fontSize={TYPE.label} color={on ? P.ink : P.inkFaint} ml={1.5}>{l.words}</Text>
            {l.free > 0 && <Text as="span" fontFamily="mono" fontSize={TYPE.label} color={P.green} ml={1}>· {l.free} free</Text>}
          </Link>
        );
      })}
      {lists.clients.length > 0 && (picking ? (
        <HStack spacing={2}>
          <Select size="sm" value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="a client" maxW="220px" h="36px" borderRadius="12px">
            {lists.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button size="sm" variant="outline" isDisabled={!choice} isLoading={opening} onClick={go}>Open their list</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancel</Button>
        </HStack>
      ) : (
        <Button size="sm" variant="ghost" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={() => setPicking(true)} color={P.inkMuted}>
          A list for a client
        </Button>
      ))}
    </HStack>
  );
};

const ListView = ({ watch, owner, base, root }) => {
  const { list, lists, error, busy } = watch;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'all';
  const query = params.get('q') || '';
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [walking, setWalking] = useState(null);
  const [closing, setClosing] = useState(false);
  const restored = useRef(false);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || (key === 'tab' && value === 'all')) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  const entries = list?.entries || [];
  const studioViewer = list?.viewer === 'studio';
  const isStudioList = owner === 'studio';
  const today = list?.today || todayIso();

  useEffect(() => {
    if (restored.current || !list?.entries) return;
    restored.current = true;
    try {
      const y = Number(sessionStorage.getItem(scrollKey(base)));
      if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch { /* nothing to restore */ }
  }, [list, base]);

  const remember = () => {
    try { sessionStorage.setItem(scrollKey(base), String(window.scrollY)); } catch { /* fine */ }
  };

  const counts = useMemo(() => ({
    all: entries.length,
    clear: entries.filter((e) => e.verdict === 'clear').length,
    dead: entries.filter((e) => e.verdict === 'dead').length,
    taken: entries.filter((e) => e.verdict === 'taken').length,
    free: entries.filter((e) => e.chance === 'free').length,
  }), [entries]);

  const shown = useMemo(() => entries
    .filter((e) => tab === 'all' || (tab === 'free' ? e.chance === 'free' : e.verdict === tab))
    .filter((e) => !query || e.word.includes(cleanWord(query)) || (e.note || '').toLowerCase().includes(query.toLowerCase())),
  [entries, tab, query]);

  const upcoming = useMemo(() => comingUp(entries, today), [entries, today]);
  const typed = cleanWord(draft);
  const exists = entries.some((e) => e.word === typed);
  // The add button stays quiet paper until there is a word worth adding, then
  // it takes the screen's one lime.
  const ready = typed.length >= 2 && !exists;
  const reading = adding || !!walking || Object.values(busy).some((b) => b === 'reading');

  const add = async (event) => {
    event.preventDefault();
    if (!typed) return;
    if (exists) { navigate(`${base}${typed}/`); return; }
    setAdding(true);
    try {
      await watch.add(typed);
      setDraft('');
      remember();
      navigate(`${base}${typed}/`, { state: { back: location.search } });
    } catch { /* the hook shows it */ } finally { setAdding(false); }
  };

  const walk = async () => {
    const words = entries.map((e) => e.word);
    for (let i = 0; i < words.length; i += 1) {
      setWalking({ done: i, of: words.length });
      try { await watch.check(words[i]); } catch { break; }
      if (i < words.length - 1) await pause(1200);
    }
    setWalking(null);
  };

  const openFor = async (clientId) => {
    await watch.openList(clientId);
    navigate(`${root}c/${clientId}/`);
  };

  const closeList = async () => {
    await watch.closeList(owner);
    navigate(root);
  };

  if (list && list.open === false) {
    return (
      <Page>
        <PageHead kicker="Trademarks" title="No list here" lede={error || 'This list is not open.'} />
        <Empty action={<Button size="sm" variant="outline" onClick={() => navigate(root)}>Back to the studio list</Button>}>
          Nothing to show.
        </Empty>
      </Page>
    );
  }

  const name = list?.name || (isStudioList ? 'The studio' : 'A client');
  const left = list?.limits ? Math.max(0, (list.limits.day || 0) - (list.reads?.day === today ? list.reads.count : 0)) : null;

  return (
    <Page>
      <PageHead
        kicker={isStudioList ? 'Studio · The Burroship LLC' : `Client · ${name}`}
        title="Trademarks"
        lede={isStudioList
          ? 'Every word the studio might file, one lowercase word each, read against the USPTO register and watched on the schedule you set. Open a word for its dates, its marks and what changed.'
          : `${name}'s watch list. They see it in their account on neonburro.com, and so does the studio. Nobody else can.`}
        actions={(
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Icon as={TbRefresh} boxSize={4} />}
            isDisabled={!entries.length || !!walking}
            onClick={walk}
          >
            {walking ? `${walking.done + 1} of ${walking.of}` : 'Read all now'}
          </Button>
        )}
      />

      {studioViewer && <Lists lists={lists} owner={owner} root={root} onOpen={openFor} />}

      {upcoming.length > 0 && (
        <Section kicker="Coming up" count={upcoming.length}>
          <Box>
            {upcoming.map(({ word, x }, i) => (
              <RowLink
                key={`${word}-${x.kind}-${x.serial || ''}-${i}`}
                to={x.serial ? `${base}${word}/mark/${x.serial}/` : `${base}${word}/`}
                state={{ back: location.search }}
                onClick={remember}
                py={2.5}
              >
                <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '96px 150px minmax(0,1fr)' }} gap={{ base: 0.5, sm: 4 }} alignItems="baseline">
                  <Text fontFamily="mono" fontSize={TYPE.label} color={TONE[x.tone]} fontWeight="600">
                    {x.date ? shortDay(x.date) : 'open it'}{x.date ? ` ${x.date.slice(0, 4)}` : ''}
                  </Text>
                  <HStack spacing={2} minW={0}>
                    <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="600" color={P.ink} noOfLines={1}>{word}</Text>
                    <Text fontSize={TYPE.label} color={TONE[x.tone]} whiteSpace="nowrap">{TONE_WORD[x.tone]}</Text>
                  </HStack>
                  <Text fontSize={TYPE.small} color={P.inkSec} noOfLines={{ base: 2, sm: 1 }}>{x.say}</Text>
                </Box>
              </RowLink>
            ))}
            <Box borderTop="1px solid" borderColor={P.hairSoft} />
          </Box>
        </Section>
      )}

      <VStack align="stretch" spacing={2}>
        <HStack as="form" onSubmit={add} spacing={2} align="stretch" flexWrap={{ base: 'wrap', sm: 'nowrap' }}>
          <SearchBox value={query} onChange={(v) => setParam('q', v)} placeholder="search the list" flex="1 1 220px" />
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
            transition={`border-color ${FAST} ${EASE}`}
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
              px={0}
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
              leftIcon={exists ? undefined : <Icon as={TbPlus} boxSize={3.5} />}
              isLoading={adding}
              loadingText="Reading"
              isDisabled={!ready && !exists}
              bg={ready ? P.lime : P.sunken}
              color={ready ? P.limeInk : exists ? P.ink : P.inkFaint}
              _hover={{ bg: ready ? '#D2E26B' : P.sunken }}
              _active={{ bg: ready ? '#B9CC4C' : P.sunken }}
              _disabled={{ opacity: 1, cursor: 'default' }}
              transition={`background ${FAST} ${EASE}, color ${FAST} ${EASE}`}
            >
              {exists ? 'Open' : 'Add'}
            </Button>
          </HStack>
        </HStack>
        {draft && typed !== draft.trim() && (
          <Text fontSize={TYPE.small} color={P.inkMuted}>
            Kept as <Text as="span" fontFamily="mono" color={P.ink}>{typed || 'nothing yet'}</Text>, one word, lowercase.
          </Text>
        )}
        <PulseLine on={reading} mt={1} />
      </VStack>

      <Tabs
        value={tab}
        onChange={(v) => setParam('tab', v)}
        items={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'clear', label: 'Clear', count: counts.clear, color: P.green },
          { key: 'dead', label: 'Dead marks only', count: counts.dead, color: P.gold },
          { key: 'taken', label: 'Taken', count: counts.taken, color: P.coral },
          { key: 'free', label: 'Could come free', count: counts.free, color: P.green },
        ]}
      />

      {error && <Text fontSize={TYPE.small} color={P.coral}>{error}</Text>}

      {list === null ? (
        <Loading label="reading the list" />
      ) : shown.length === 0 ? (
        <Empty hint={query ? 'Nothing on the list matches that.' : tab === 'all' ? 'Add the first word above.' : null}>
          {tab === 'all' && !query ? 'The list is empty.' : 'Nothing in this group.'}
        </Empty>
      ) : (
        <Box>
          <Box display={{ base: 'none', sm: 'grid' }} gridTemplateColumns={GRID} gap={5} px={1} pb={2} pr={8}>
            <Head>Word</Head>
            <Head>On the register</Head>
            <Head>Night read</Head>
            <Head textAlign="right">Status</Head>
          </Box>
          {shown.map((e) => {
            const v = e.verdict ? VERDICT[e.verdict] : null;
            const b = busy[e.word];
            return (
              <RowLink key={e.word} to={`${base}${e.word}/`} state={{ back: location.search }} onClick={remember} py={3.5}>
                <Box display="grid" gridTemplateColumns={GRID} gap={{ base: 3, sm: 5 }} alignItems="center">
                  <VStack align="start" spacing={0.5} minW={0}>
                    <HStack spacing={2} minW={0}>
                      <Text fontFamily="mono" fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{e.word}</Text>
                      {e.cadence !== 'off' && <LiveDot />}
                    </HStack>
                    <Text display={{ base: 'block', sm: 'none' }} fontSize={TYPE.label} color={P.inkMuted} noOfLines={1}>
                      {e.chance === 'free' ? 'could come free · ' : ''}{e.register}
                    </Text>
                  </VStack>
                  <VStack display={{ base: 'none', sm: 'flex' }} align="start" spacing={0} minW={0}>
                    <Text fontSize={TYPE.small} color={P.inkSec} noOfLines={1}>{e.register}</Text>
                    {e.chance === 'free' && <Text fontSize={TYPE.label} color={P.green} fontWeight="600">could come free</Text>}
                  </VStack>
                  <Text display={{ base: 'none', sm: 'block' }} fontSize={TYPE.small} color={e.cadence === 'off' && !e.lookAgain ? P.inkFaint : P.inkSec} noOfLines={1}>
                    {watchLine(e)}
                  </Text>
                  <Text fontSize={TYPE.small} fontWeight="600" textAlign="right" color={b ? P.inkMuted : v ? VERDICT_TONE[e.verdict] : P.inkFaint} whiteSpace="nowrap">
                    {b === 'reading' ? 'reading' : v ? v.label : 'not read'}
                  </Text>
                </Box>
              </RowLink>
            );
          })}
          <Box borderTop="1px solid" borderColor={P.hairSoft} />
        </Box>
      )}

      <VStack align="start" spacing={2} maxW="70ch">
        <Text fontSize={TYPE.small} color={P.inkFaint} lineHeight="1.6">
          Clear means the federal register only. It does not cover state marks or a name already in use without a filing, and a lapsed filing does not end rights somebody holds by using the name.
          {isStudioList ? ' Filings are by The Burroship LLC, directly with the USPTO,' : ' A client files as their own business, directly with the USPTO,'} $350 a class on {FEES_READ}. A lawyer reads before anything is filed.
        </Text>
        {left !== null && (
          <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>
            {left} reads of the register left today on this list · {Math.max(0, (list.limits.session || 0) - sessionUsed(owner))} this sitting · the night reads run apart from both
          </Text>
        )}
        {studioViewer && !isStudioList && (closing ? (
          <HStack spacing={2} pt={2}>
            <Text fontSize={TYPE.small} color={P.inkMuted}>Close {name}&apos;s list and delete every word on it?</Text>
            <Button size="sm" variant="ghost" color={P.coral} onClick={closeList}>Close it</Button>
            <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>Keep</Button>
          </HStack>
        ) : (
          <Button size="sm" variant="ghost" color={P.inkMuted} px={0} onClick={() => setClosing(true)}>Close this list</Button>
        ))}
      </VStack>
    </Page>
  );
};

export default ListView;
