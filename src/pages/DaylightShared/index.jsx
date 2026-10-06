// src/pages/DaylightShared/index.jsx
// SENTINEL: NB_DAYLIGHT_SHARED_V1
//
// WHAT A CLIENT SEES WHEN THEY OPEN THE LINK.
//
// Tyler, 2026-10-05: "Jazz can also share with me whatever he wants ... really,
// he can just mark his availability outside of my times ... they choose an icon,
// like a phone call, a video chat, an in-person meet ... when you hover over
// those icons, there are little helpers, and it's really easy to select a time
// and submit it back to us."
//
// THIS PAGE MAKES NO SUPABASE CALL. Everything it reads and everything it
// writes goes through netlify/functions/daylight-public.js, which holds the
// service key and answers only what the token is entitled to. Do not import
// src/lib/supabase here, not for a read, not for anything.
//
// BE PRECISE ABOUT WHAT THAT DOES AND DOES NOT BUY. It does NOT mean the anon
// key is absent. This route mounts inside the same App.jsx and the same
// AuthProvider as every other page, so the Supabase client is constructed at
// module load here exactly as it is everywhere else, and the anon key ships in
// the bundle as it does in any Vite app. An earlier draft of this comment
// claimed otherwise and was wrong, which was only caught by opening the page
// and reading the console.
//
// So the protection is NOT that the key is missing. It is that the three
// daylight tables grant the anon role nothing: RLS is on and there is no anon
// policy, verified against the live database rather than inferred from the
// migration. That is the stronger arrangement anyway, because it holds whether
// or not a key leaks.
//
// AVAILABILITY GOES ONE WAY. They tell us when they are free, they never see
// another client's offers and they never see Tyler's notes, only his states.
// "Gone" is all they need. "Gone, Telluride with the kids" is not theirs.
//
// THE ICONS AND THEIR HELPERS come from the calendar's MEETING_TYPES by way of
// src/lib/daylight. The helper text is the `hint` field that already existed on
// each type. Nothing about a meeting type is written down twice.
//
// THIS PAGE IS READ ON A PHONE, usually standing up, usually once. One column,
// nothing boxed in, the submit always reachable. That is the whole brief.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Text, HStack, VStack, Button, Icon, Textarea, Spinner } from '@chakra-ui/react';
import { TbPhone, TbVideo, TbMapPin, TbCheck, TbChevronDown } from 'react-icons/tb';
import colors from '../../theme/colors';
import { EASE, FAST } from '../../theme/layout';
import {
  buildBoard, MEETING_TYPES, SLOT_MINUTES, fmtMinutes, dayLabel, longDay,
  DAY_SHORT, MONTH_SHORT, DAY_START, DAY_END, DAY_SPAN,
  GREEN, dayGreen, onGreen, isFull, isFree, mergeBlocks, freeRanges,
} from '../../lib/daylight';

const P = colors.paper;

// The icon per type id. The types, their words, their hues and their hover
// helpers all live in calendarConstants. Only the glyph is chosen here, because
// an icon set is a property of this page and not of what a meeting is.
const GLYPH = { call: TbPhone, video: TbVideo, in_person: TbMapPin };

// ── THE LITTLE TIMELINE ─────────────────────────────────────────────────────
// Eight in the morning to six at night as one track, with the taken hours drawn
// on it. This is the whole reason the words went away: you do not read that a
// day is "tight", you see that the middle of it is gone. It is nine pixels tall
// and carries more than a sentence would, which is what Tyler meant by more
// without more height.
const Rail = ({ blocks, tone = 'dark' }) => (
  <Box position="relative" h="9px" borderRadius="999px" overflow="hidden"
    bg={tone === 'dark' ? 'rgba(36,57,28,0.16)' : 'rgba(244,247,239,0.26)'}>
    {mergeBlocks(blocks).map(([a, z], i) => (
      <Box key={i} position="absolute" top={0} bottom={0} borderRadius="999px"
        left={`${((a - DAY_START) / DAY_SPAN) * 100}%`}
        width={`${((z - a) / DAY_SPAN) * 100}%`}
        bg={tone === 'dark' ? GREEN.edge : 'rgba(244,247,239,0.85)'} />
    ))}
  </Box>
);

const ask = async (payload) => {
  const r = await fetch('/.netlify/functions/daylight-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
};

export default function DaylightShared() {
  const { token } = useParams();
  const [state, setState] = useState({ phase: 'loading' });
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [type, setType] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const board = useMemo(() => buildBoard(new Date()), []);

  useEffect(() => {
    let alive = true;
    ask({ token, action: 'board' })
      .then((b) => { if (alive) setState({ phase: 'ready', ...b }); })
      .catch((e) => { if (alive) setState({ phase: 'closed', error: e.message }); });
    return () => { alive = false; };
  }, [token]);

  const submit = useCallback(async () => {
    if (!day || slot == null || !type) return;
    setSending(true); setErr('');
    try {
      await ask({
        token, action: 'offer', day, startMin: slot, minutes: 30,
        meetingType: type, note: note.trim(),
      });
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }, [token, day, slot, type, note]);

  if (state.phase === 'loading') {
    return (
      <Box minH="100svh" bg={P.mat} display="grid" placeItems="center">
        <Spinner size="sm" color={P.inkFaint} />
      </Box>
    );
  }

  if (state.phase === 'closed') {
    return (
      <Box minH="100svh" bg={P.mat} display="grid" placeItems="center" p={6}>
        <Box textAlign="center" maxW="380px">
          <Text fontSize="20px" fontWeight={600} color={P.ink} letterSpacing="-0.02em">
            This link is not open.
          </Text>
          <Text mt={2} fontSize="14.5px" color={P.inkMuted} lineHeight="1.5">
            It may have been replaced with a newer one. Reply to the message it came in
            and we will send another.
          </Text>
        </Box>
      </Box>
    );
  }

  if (sent) {
    return (
      <Box minH="100svh" bg={P.mat} display="grid" placeItems="center" p={6}>
        <Box textAlign="center" maxW="400px">
          <Box
            w="44px" h="44px" mx="auto" mb={4} borderRadius="full"
            bg={P.limeDeep} display="grid" placeItems="center"
          >
            <Icon as={TbCheck} boxSize="22px" color={P.mat} />
          </Box>
          <Text fontSize="22px" fontWeight={600} color={P.ink} letterSpacing="-0.025em">
            Got it. Thank you.
          </Text>
          <Text mt={2} fontSize="14.5px" color={P.inkMuted} lineHeight="1.55">
            {longDay(new Date(`${day}T12:00`))} at {fmtMinutes(slot)}. We will come back to you
            to confirm, and nothing is booked until we do.
          </Text>
          <Button
            mt={5} size="sm" variant="outline"
            onClick={() => { setSent(false); setDay(null); setSlot(null); setType(null); setNote(''); }}
          >
            Offer another time
          </Button>
        </Box>
      </Box>
    );
  }

  const chosen = day ? (state.days?.[day] || null) : null;

  return (
    <Box minH="100svh" bg={P.mat} pb="140px">
      <Box maxW="760px" mx="auto" px={{ base: 5, md: 8 }} pt={{ base: 8, md: 12 }}>

        <Text
          fontSize="10px" fontWeight={500} letterSpacing="0.2em"
          textTransform="uppercase" color={P.inkFaint} fontFamily="mono"
        >
          Daylight
        </Text>
        <Text mt={2} fontSize={{ base: '26px', md: '32px' }} fontWeight={600} color={P.ink} letterSpacing="-0.03em" lineHeight="1.05">
          The next three weeks
        </Text>
        <Text mt={2.5} fontSize="15px" color={P.inkMuted} lineHeight="1.55" maxW="46ch">
          Here is how our weeks look, {state.label}. Pick a day that works for you, tell us
          when and how, and we will come back to confirm. Nothing here books anything.
        </Text>

        {/* ── THE WEEKS, AS BARS ──────────────────────────────────────────
             Tyler, 2026-10-05, on seeing the phone version: "I do love that
             format way better. That format's way better."

             So the bars are not the phone fallback any more, they are the
             format. A seven column grid gives every day the same forty pixels
             whether anything is in it or not. A bar gives a day a line, and a
             line has room for the one thing worth seeing, which is WHICH HOURS
             ARE GONE. The grid was removed rather than kept behind a breakpoint,
             because two layouts of the same thing drift and only one of them
             was good.

             NO STATE WORDS AND NO WHITE. Both ruled out the same day. The
             ground is the day's own green, deeper as it fills, and the rail
             underneath says where. ── */}
        <Box mt={7}>
          <VStack spacing="6px" align="stretch">
            {board.flat().map((c) => {
              const blocks = state.days?.[c.iso] || [];
              const full = isFull(blocks);
              const isPicked = day === c.iso;
              const ground = dayGreen(blocks);
              const ink = onGreen(blocks);
              const free = freeRanges(blocks);
              const hoursFree = free.reduce((n, [a, z]) => n + (z - a), 0) / 60;

              return (
                <Box key={c.iso}>
                  <Box
                    as="button"
                    type="button"
                    disabled={full}
                    onClick={() => { setDay(isPicked ? null : c.iso); setSlot(null); setErr(''); }}
                    aria-label={`${longDay(c.date)}, ${full ? 'nothing free' : `${hoursFree} hours free`}`}
                    aria-expanded={isPicked}
                    w="100%" display="flex" alignItems="center" gap={{ base: 3, sm: 5 }}
                    minH={{ base: '58px', sm: '62px' }}
                    pl={{ base: '14px', sm: '18px' }} pr={{ base: 3, sm: 5 }}
                    textAlign="left" borderRadius="14px" position="relative" overflow="hidden"
                    bg={ground}
                    border="2px solid"
                    borderColor={isPicked ? GREEN.ink : 'transparent'}
                    opacity={full ? 0.62 : 1}
                    cursor={full ? 'not-allowed' : 'pointer'}
                    transition={`border-color ${FAST} ${EASE}, transform ${FAST} ${EASE}`}
                    _hover={full ? {} : { transform: 'translateX(2px)' }}
                    _focusVisible={{ outline: '2px solid', outlineColor: GREEN.ink, outlineOffset: '2px' }}
                  >
                    <Box minW={{ base: '54px', sm: '64px' }} flex="none">
                      <Text fontSize="10.5px" fontWeight={600} letterSpacing="0.1em"
                        textTransform="uppercase" color={ink} opacity={0.72}>
                        {DAY_SHORT[c.date.getDay()]}
                      </Text>
                      <Text fontSize={{ base: '17px', sm: '18px' }} fontWeight={c.isToday ? 800 : 600}
                        lineHeight="1.05" color={ink}>
                        {c.date.getDate()}
                        <Text as="span" fontSize="11px" fontWeight={500} ml={1} opacity={0.72}>
                          {MONTH_SHORT[c.date.getMonth()]}
                        </Text>
                      </Text>
                    </Box>

                    <Box flex="1" minW={0}>
                      <Rail blocks={blocks} tone={onGreen(blocks) === GREEN.ink ? 'dark' : 'light'} />
                    </Box>

                    <Box flex="none" textAlign="right" minW={{ base: '62px', sm: '86px' }}>
                      <Text fontSize={{ base: '12px', sm: '12.5px' }} fontWeight={600} color={ink}>
                        {full ? 'nothing free' : `${hoursFree % 1 === 0 ? hoursFree : hoursFree.toFixed(1)}h free`}
                      </Text>
                      {c.isToday && (
                        <Text fontSize="9.5px" fontWeight={700} letterSpacing="0.1em" color={ink} opacity={0.75}>
                          TODAY
                        </Text>
                      )}
                    </Box>

                    {!full && (
                      <Icon as={TbChevronDown} boxSize="17px" flex="none" color={ink} opacity={0.65}
                        transform={isPicked ? 'rotate(180deg)' : 'none'}
                        transition={`transform ${FAST} ${EASE}`} />
                    )}
                  </Box>

                  {/* only the hours that are actually free, opened under the day
                      somebody tapped so nothing scrolls away */}
                  {isPicked && (
                    <Box mt="6px" p={{ base: 3, sm: 4 }} borderRadius="14px" bg="rgba(36,57,28,0.06)">
                      <Box display="grid" gap={2}
                        gridTemplateColumns={{ base: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)' }}>
                        {SLOT_MINUTES.filter((m) => isFree(blocks, m, 30)).map((m) => (
                          <Button key={m} size="sm" h="40px"
                            variant={slot === m ? 'solid' : 'outline'}
                            bg={slot === m ? GREEN.full : 'transparent'}
                            color={slot === m ? '#F4F7EF' : GREEN.ink}
                            borderColor={slot === m ? GREEN.full : 'rgba(36,57,28,0.25)'}
                            fontWeight={slot === m ? 700 : 500} fontSize="13.5px"
                            _hover={{ borderColor: GREEN.full }}
                            onClick={() => { setSlot(m); setErr(''); }}
                          >
                            {fmtMinutes(m)}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </VStack>
        </Box>

        {/* ── how ────────────────────────────────────────────────────────── */}
        {day && slot != null && (
          <Box mt={8}>
            <Text fontSize="10px" fontWeight={500} letterSpacing="0.2em" textTransform="uppercase" color={P.inkFaint} fontFamily="mono">
              How would you like to meet
            </Text>
            <HStack mt={3} spacing={2.5} align="stretch" flexWrap="wrap">
              {MEETING_TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <Box
                    key={t.id}
                    as="button"
                    type="button"
                    title={t.hint}
                    onClick={() => { setType(t.id); setErr(''); }}
                    flex="1 1 150px"
                    p={3.5}
                    borderRadius="12px"
                    textAlign="left"
                    bg={on ? t.tint : P.sheet}
                    border="1px solid"
                    borderColor={on ? t.accent : P.hair}
                    transition={`all ${FAST} ${EASE}`}
                    _hover={{ borderColor: t.accent }}
                    _focusVisible={{ outline: '2px solid', outlineColor: P.limeDeep, outlineOffset: '2px' }}
                  >
                    <Icon as={GLYPH[t.id]} boxSize="19px" color={t.accent} />
                    <Text mt={2} fontSize="14.5px" fontWeight={600} color={P.ink}>{t.label}</Text>
                    <Text mt={0.5} fontSize="12px" color={P.inkFaint} lineHeight="1.35">{t.hint}</Text>
                  </Box>
                );
              })}
            </HStack>

            <Textarea
              mt={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know. Optional."
              rows={2}
              bg={P.sheet}
              borderColor={P.hair}
              fontSize="14.5px"
              maxLength={400}
              _focusVisible={{ borderColor: P.limeDeep, boxShadow: 'none' }}
            />
          </Box>
        )}
      </Box>

      {/* ── the send, always reachable on a phone ─────────────────────────── */}
      {day && slot != null && type && (
        <Box
          position="fixed" left={0} right={0} bottom={0}
          bg={P.sheet} borderTop="1px solid" borderColor={P.hair}
          px={{ base: 5, md: 8 }} pt={3.5}
          pb="calc(14px + env(safe-area-inset-bottom, 0px))"
        >
          <Box maxW="760px" mx="auto">
            {err && <Text mb={2} fontSize="13px" color={P.coral}>{err}</Text>}
            <HStack justify="space-between" spacing={4}>
              <Text fontSize="13.5px" color={P.inkMuted} noOfLines={1}>
                {dayLabel(new Date(`${day}T12:00`))} at {fmtMinutes(slot)}
              </Text>
              <Button
                onClick={submit}
                isLoading={sending}
                loadingText="Sending"
                bg={P.lime}
                color={P.limeInk}
                fontWeight={600}
                _hover={{ bg: P.lime, filter: 'brightness(0.96)' }}
              >
                Send it over
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
