// src/pages/Answer/index.jsx
// SENTINEL: NB_PULSE_ANSWER_PAGE_V1
//
// Where a client lands from the approve, deny or choice link beside an open
// item in a letter. Route /answer/:token/, public, above the ProtectedRoute
// block in App.jsx beside the other doors that answer somebody who is not
// signed in. It talks only to netlify/functions/item-answer.js.
//
// ── ONE PRESS, NEVER ON ARRIVAL ─────────────────────────────────────────────
// The link from the letter carries ?a=approve, ?a=deny or ?c=<n>, and this
// page opens with that answer already picked. It records nothing until the
// button is pressed. A mail scanner that opens every link in a message must
// never be able to answer for the client, Outlook safe links does exactly
// that, so arriving is reading and pressing is answering.
//
// ── CALM, WHITE AND SHORT ───────────────────────────────────────────────────
// Tyler's rule for anything a person fills in, clean and white with light
// colours and subtle accents, never a dark panel. No Pulse chrome, no nav.
// The confirmation says what was recorded and that nothing else is needed,
// and that is the end of it. Nobody is emailed by this page, the studio sees
// the answer in Pulse.
//
// fixtureItem comes only from src/pages/Mail/MailFixture.jsx in development.
// With it the page reads nothing and the press records nothing.
//
// No oxford commas, no em dashes.

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, VStack, HStack, Text, Button, Input, Textarea, Spinner } from '@chakra-ui/react';
import { shortDate, ageLabel, todayInRidgway, ITEM_KINDS } from '../../lib/mailDocument';

const W = {
  ground: '#F7F7F5',
  sheet: '#FFFFFF',
  edge: '#E6E5E1',
  ink: '#1C1B19',
  muted: '#6A6862',
  faint: '#9C9A94',
  good: '#2F6B3A',
  warn: '#9A6A00',
};

const Choice = ({ active, onClick, children }) => (
  <Button
    onClick={onClick}
    size="md"
    variant="unstyled"
    h="44px"
    px={5}
    display="inline-flex"
    alignItems="center"
    borderRadius="full"
    border="1px solid"
    borderColor={active ? W.ink : W.edge}
    bg={active ? W.ink : W.sheet}
    color={active ? W.sheet : W.ink}
    fontWeight="600"
    fontSize="14px"
    _hover={{ borderColor: W.ink }}
  >
    {children}
  </Button>
);

const answerWords = (item) => {
  if (item.answer_choice) return item.answer_choice;
  if (item.status === 'approved') return 'Approved';
  if (item.status === 'denied') return 'Denied';
  return '';
};

const Answer = ({ fixtureItem = null }) => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [item, setItem] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState(params.get('a') === 'deny' ? 'deny' : params.get('a') === 'approve' ? 'approve' : null);
  const [choice, setChoice] = useState(params.get('c') !== null && params.get('c') !== '' ? Number(params.get('c')) : null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (fixtureItem) { setItem(fixtureItem); setState('ready'); return undefined; }
    let live = true;
    fetch(`/.netlify/functions/item-answer?k=${encodeURIComponent(token || '')}`)
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (!live) return;
        if (!data?.ok) { setError(data?.error || 'This link is not valid.'); setState('error'); return; }
        setItem(data.item);
        setState(data.item.status === 'open' ? 'ready' : 'already');
      })
      .catch(() => { if (live) { setError('The page could not reach the studio. Try again in a minute.'); setState('error'); } });
    return () => { live = false; };
  }, [token, fixtureItem]);

  const hasChoices = item?.choices?.length > 0;
  const picked = hasChoices ? Number.isInteger(choice) && choice >= 0 && choice < item.choices.length : !!answer;

  const send = async () => {
    if (fixtureItem) {
      setItem({ ...item, status: answer === 'deny' ? 'denied' : 'approved', answer_choice: hasChoices ? item.choices[choice] : null, answered_at: new Date().toISOString() });
      setState('done');
      return;
    }
    setState('sending');
    const res = await fetch('/.netlify/functions/item-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: token, answer, choice, note, name }),
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) { setError(data?.error || 'The answer did not save. Try again in a minute.'); setState('ready'); return; }
    if (data.item) setItem(data.item);
    setState(data.already ? 'already' : 'done');
  };

  return (
    <Box minH="100dvh" bg={W.ground} px={{ base: 4, md: 8 }} py={{ base: 8, md: 16 }} color={W.ink}>
      <Box maxW="560px">
        <Text fontSize="20px" fontWeight="600" letterSpacing="-0.035em" color={W.ink} mb={8}>
          neonburro<Box as="span" color="#7C8C1C">.</Box>
        </Text>

        {state === 'loading' && (
          <HStack spacing={3}><Spinner size="sm" color={W.muted} /><Text fontSize="14px" color={W.muted}>Opening it</Text></HStack>
        )}

        {state === 'error' && (
          <Text fontSize="16px" color={W.ink} lineHeight="1.6">{error}</Text>
        )}

        {item && state !== 'loading' && state !== 'error' && (
          <Box bg={W.sheet} border="1px solid" borderColor={W.edge} borderRadius="18px" p={{ base: 5, md: 7 }}>
            <VStack align="stretch" spacing={5}>
              <VStack align="stretch" spacing={2}>
                <Text fontSize="10px" fontWeight="600" letterSpacing="0.2em" textTransform="uppercase" color={W.faint}>
                  {item.client ? `${item.client} · ` : ''}{(ITEM_KINDS[item.kind] || ITEM_KINDS.decision).label}
                </Text>
                <Text fontSize={{ base: '22px', md: '26px' }} fontWeight="600" letterSpacing="-0.02em" lineHeight="1.2" color={W.ink}>
                  {item.title}
                </Text>
                {item.detail && <Text fontSize="15px" lineHeight="1.6" color={W.muted}>{item.detail}</Text>}
                <Text fontSize="12px" color={W.faint}>
                  Open since {shortDate(item.opened_at)}, {ageLabel(item.opened_at, todayInRidgway())}
                </Text>
              </VStack>

              {(state === 'ready' || state === 'sending') && (
                <VStack align="stretch" spacing={4}>
                  <HStack spacing={2} flexWrap="wrap" rowGap={2}>
                    {hasChoices
                      ? item.choices.map((c, n) => (
                        <Choice key={c} active={choice === n} onClick={() => setChoice(n)}>{c}</Choice>
                      ))
                      : (
                        <>
                          <Choice active={answer === 'approve'} onClick={() => setAnswer('approve')}>Approve</Choice>
                          <Choice active={answer === 'deny'} onClick={() => setAnswer('deny')}>Deny</Choice>
                        </>
                      )}
                  </HStack>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name, optional"
                    bg={W.sheet}
                    borderColor={W.edge}
                    color={W.ink}
                    borderRadius="12px"
                    _placeholder={{ color: W.faint }}
                  />
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything to add, optional"
                    bg={W.sheet}
                    borderColor={W.edge}
                    color={W.ink}
                    borderRadius="12px"
                    minH="88px"
                    _placeholder={{ color: W.faint }}
                  />
                  {error && <Text fontSize="14px" color={W.warn}>{error}</Text>}
                  <Box>
                    <Button
                      onClick={send}
                      isDisabled={!picked}
                      isLoading={state === 'sending'}
                      loadingText="Sending"
                      h="48px"
                      px={7}
                      borderRadius="full"
                      bg={W.ink}
                      color={W.sheet}
                      fontWeight="600"
                      _hover={{ bg: '#000000' }}
                      _disabled={{ opacity: 0.35, cursor: 'not-allowed' }}
                    >
                      Send my answer
                    </Button>
                  </Box>
                  <Text fontSize="12px" color={W.faint} lineHeight="1.6">
                    Nothing is recorded until you press the button. The answer goes to the studio and nobody is emailed.
                  </Text>
                </VStack>
              )}

              {(state === 'done' || state === 'already') && (
                <VStack align="stretch" spacing={2} pt={1}>
                  <Text fontSize="18px" fontWeight="600" color={item.status === 'denied' ? W.ink : W.good}>
                    {answerWords(item)}.
                  </Text>
                  <Text fontSize="15px" lineHeight="1.6" color={W.muted}>
                    {state === 'already'
                      ? `This was answered ${item.answered_at ? `on ${shortDate(item.answered_at)}` : 'already'}. The first answer is the one on record. To change it, reply to the letter it came in.`
                      : 'Thank you, the studio has it. Nothing else is needed.'}
                  </Text>
                </VStack>
              )}
            </VStack>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Answer;
