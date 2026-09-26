// src/components/Layout/VoltDesk.jsx
// SENTINEL: NB_PULSE_VOLT_DESK_V1
//
// Tyler's ask, 2026-09-25, widened the same morning. Whoever the AI is in
// Pulse sits in the bottom right corner all the time. Press it and a chat
// sheet opens. Text at the foot with the mic beside it, the mic records,
// transcribes and drops the words into the input. Volt drafts anything
// within Pulse and hands the rest to a person. He never sends, posts, pays
// or deletes anything.
//
// ── THE BOLT ────────────────────────────────────────────────────────────────
// The disc is Volt as a lightning bolt, Pulse is the bolt and Volt rhymes
// with it. Ink bolt on the one lime on the screen, fixed bottom right on
// every signed in page, mounted once in AppShell.jsx. Volt's face sits
// beside his name in the sheet header and on every line he says, a burro is
// never named without a face. The sheet is ink on paper, the send button is
// ink with cream text, the mic is a ghost that breathes lime while it
// listens. No second colour.
//
// ── WHERE IT SITS ───────────────────────────────────────────────────────────
// On a phone the dark pill in MobileNav.jsx floats 14px off the bottom plus
// the safe area and is TABBAR_H tall, so the disc sits above it by that sum
// plus a gap. On lg and up the pill is gone and the disc drops to the
// corner. zIndex 30 is above the pill's 20 and below every Chakra modal.
//
// ── THE TWO DOORS ───────────────────────────────────────────────────────────
// netlify/functions/volt-chat.js is the chat, netlify/functions/transcribe.js
// is the ear. Both are session gated and staff only and both carry the
// three ceilings. Their closed door lines render here verbatim, this file
// keeps no copy keyed on reason.
//
// ── THE LOOP ────────────────────────────────────────────────────────────────
// The sheet holds the conversation the way the API wants it, history, and a
// second list for the eye, turns. A turn posts history, the answer is text
// or text and one tool. write_ask ran on the server and comes back with its
// result. draft_invoice and draft_release come back unrun and the sheet
// posts run, one model call per request, see the clock note in the
// function. After run the sheet appends the tool_result to history so the
// next turn sees it, and shows a card the person can act on, open the draft
// in Invoicing, open Socials, open Today.
//
// An invoice draft is handed to src/pages/Invoicing/index.jsx through
// router state as voltDraft, the same shape VoltComposer hands it, and that
// page opens its editor on it. The key is spelled in both files.
//
// ── THE RECORDER ────────────────────────────────────────────────────────────
// One chunk, no timeslice. Safari records aac in mp4 and a timesliced mp4
// does not reassemble into a file Deepgram can read, so the recorder runs
// whole and hands over one blob on stop. Chrome and Firefox record opus in
// webm. The mime rides to the function so the Content-Type is right. 32
// kbps keeps three minutes under a megabyte. MAX_SECONDS matches
// MAX_SECONDS in transcribe.js, the mic stops itself here, the function
// refuses past it there. Change them together.
//
// After an ask is written the sheet fires the nb:desk-ask event on window
// so the Today list in src/pages/Dashboard/components/VoltAsks.jsx refetches
// when it is on screen. The name is spelled in both files.
//
// Keyboard. The disc is a real button, Escape closes the sheet, Enter
// sends and Shift Enter breaks a line, the mic and send are real buttons.
//
// 2026-09-25, the layout law. The input carries the house inset and the
// house placeholder colour from src/theme/layout.js, the card kicker is the
// house kicker. The sheet is a fixed object and keeps its own width.
//
// No oxford commas, no em dashes.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Button, HStack, Icon, IconButton, Image, Text, Textarea, VStack, keyframes } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TbBolt, TbMicrophone, TbPlayerStop, TbArrowUp, TbX, TbPlus } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { EASE, FAST, SLOW, TABBAR_H, TYPE, INSET, PLACEHOLDER, KICKER } from '../../theme/layout';

const P = colors.paper;
const VOLT_AVATAR = 'https://neonburro.com/burros/volt/volt-avatar.webp';
const VOLT_NAME = 'volt';
const MAX_SECONDS = 180;
const BITS_PER_SECOND = 32000;
const MIN_BYTES = 1000;
const DISC = 56;
const EVENT = 'nb:desk-ask';
const CHAT_DOOR = '/.netlify/functions/volt-chat';
const EAR_DOOR = '/.netlify/functions/transcribe';
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const OPENER = 'what should i draft. an invoice, a post on a release or an ask for a person.';

const breathe = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(197, 217, 87, 0.6); }
  70% { box-shadow: 0 0 0 14px rgba(197, 217, 87, 0); }
  100% { box-shadow: 0 0 0 0 rgba(197, 217, 87, 0); }
`;

const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : ((r % 4) + 8)).toString(16);
  });
};

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
};

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const call = async (door, payload) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(door, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(payload),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) return { ok: false, error: data?.message || data?.error || `the door answered ${res.status}`, data };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'volt did not answer. check the connection and try again.', data: null };
  }
};

const money = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const Face = ({ size = 22 }) => (
  <Image src={VOLT_AVATAR} alt="Volt" w={`${size}px`} h={`${size}px`} borderRadius="full" objectFit="cover" bg={P.sunken} flexShrink={0} draggable={false} />
);

// One line Volt says, with his face beside it.
const VoltLine = ({ children }) => (
  <HStack align="flex-start" spacing={2.5} alignSelf="flex-start" maxW="88%">
    <Face size={22} />
    <Text fontSize={TYPE.body} lineHeight="1.55" color={P.ink} whiteSpace="pre-wrap" pt="2px">{children}</Text>
  </HStack>
);

const YouLine = ({ children }) => (
  <Box alignSelf="flex-end" maxW="88%" bg={P.ink} color={P.sheet} px={INSET} py={2} borderRadius="16px" borderBottomRightRadius="4px">
    <Text fontSize={TYPE.body} lineHeight="1.55" whiteSpace="pre-wrap">{children}</Text>
  </Box>
);

const PlainLine = ({ tone = P.inkMuted, children }) => (
  <Text alignSelf="flex-start" fontFamily="mono" fontSize={TYPE.label} letterSpacing="0.04em" color={tone} px={1} whiteSpace="pre-wrap">{children}</Text>
);

const Card = ({ kicker, children, action, onAction }) => (
  <VStack align="stretch" spacing={2.5} alignSelf="flex-start" w="88%" ml="32px" p={INSET} bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px">
    <Text {...KICKER}>{kicker}</Text>
    {children}
    {action && (
      <Button size="xs" alignSelf="flex-start" bg={P.ink} color={P.sheet} borderRadius="full" px={3} _hover={{ bg: P.inkSec }} onClick={onAction}>{action}</Button>
    )}
  </VStack>
);

const VoltDesk = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState(() => uuid());
  const [history, setHistory] = useState([]);
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mic, setMic] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAt = useRef(0);
  const tickRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const historyRef = useRef([]);
  historyRef.current = history;

  const say = useCallback((line) => setTurns((prev) => [...prev, { id: uuid(), ...line }]), []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [turns, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const fresh = () => {
    setChatId(uuid());
    setHistory([]);
    setTurns([]);
    setInput('');
  };

  // ── the mic ──────────────────────────────────────────────────────────────
  const stopClock = () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };

  const hear = useCallback(async (mime) => {
    setMic('hearing');
    const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
    chunksRef.current = [];
    if (blob.size < MIN_BYTES) {
      say({ who: 'line', tone: P.coral, text: 'volt heard nothing. tap, speak, tap again.' });
      setMic('idle');
      return;
    }
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    let audio = '';
    try {
      audio = await toBase64(blob);
    } catch {
      say({ who: 'line', tone: P.coral, text: 'the recording could not be read. try again.' });
      setMic('idle');
      return;
    }
    const result = await call(EAR_DOOR, { audio, mime: blob.type, seconds, page: location.pathname, chat_id: chatId });
    setMic('idle');
    if (!result.ok) {
      say({ who: 'line', tone: P.coral, text: result.error });
      return;
    }
    const words = String(result.data.transcript || '').trim();
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${words}` : words));
    inputRef.current?.focus();
  }, [chatId, location.pathname, say]);

  const stopMic = useCallback(() => {
    stopClock();
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recRef.current = null;
  }, []);

  const startMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      say({ who: 'line', tone: P.coral, text: 'this browser cannot record. type it.' });
      return;
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      say({ who: 'line', tone: P.coral, text: 'the microphone was refused. allow it for pulse in the browser and tap again, or type it.' });
      return;
    }
    const mime = pickMime();
    let rec = null;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: BITS_PER_SECOND } : { audioBitsPerSecond: BITS_PER_SECOND });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      say({ who: 'line', tone: P.coral, text: 'the recorder would not start. type it.' });
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); hear(rec.mimeType); };
    rec.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      stopClock();
      setMic('idle');
      say({ who: 'line', tone: P.coral, text: 'the recorder stopped on its own. try again.' });
    };
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start();
    recRef.current = rec;
    setMic('listening');
    tickRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (s >= MAX_SECONDS) stopMic();
    }, 250);
  }, [hear, say, stopMic]);

  const tapMic = () => {
    if (mic === 'listening') stopMic();
    else if (mic === 'idle') startMic();
  };

  useEffect(() => () => {
    stopClock();
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
      rec.stream?.getTracks().forEach((t) => t.stop());
    }
  }, []);

  // ── the loop ─────────────────────────────────────────────────────────────
  const runTool = useCallback(async (tool) => {
    const result = await call(CHAT_DOOR, { action: 'run', chat_id: chatId, tool });
    const data = result.ok ? result.data : { ok: false, name: tool.name, error: result.error };
    let summary = '';
    if (data.name === 'draft_invoice' && data.ok) {
      const draft = data.draft || {};
      const lines = draft.lines || [];
      const total = lines.reduce((s, l) => s + parseFloat(l.amount || 0), 0);
      summary = `drafted an invoice, ${draft.client_name || 'client unmatched'}, ${lines.length} line${lines.length === 1 ? '' : 's'}, ${money(total)}. ${draft.summary || ''}`.trim();
      say({ who: 'card', kicker: 'invoice draft', text: summary, action: 'open in invoicing', go: { to: '/invoicing/', state: { voltDraft: draft } } });
    } else if (data.name === 'draft_release' && data.ok) {
      summary = `drafted onto the release for ${data.channel || 'the channel'} in ${data.voice || 'the row'}'s voice. ${data.note || ''}`.trim();
      say({ who: 'card', kicker: 'release draft', text: summary, body: data.body, action: 'open socials', go: { to: '/socials/' } });
    } else {
      summary = `the draft did not land, ${data.error || 'no reason given'}.${data.issues?.length ? ` ${data.issues.join(', ')}.` : ''}`;
      say({ who: 'line', tone: P.coral, text: summary });
    }
    return summary;
  }, [chatId, say]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    say({ who: 'you', text });
    const next = [...historyRef.current, { role: 'user', content: [{ type: 'text', text }] }];
    setHistory(next);

    const result = await call(CHAT_DOOR, { action: 'turn', chat_id: chatId, page: location.pathname, messages: next });
    if (!result.ok) {
      say({ who: 'line', tone: P.coral, text: result.error });
      setBusy(false);
      return;
    }
    const answer = result.data;
    if (answer.reply) say({ who: 'volt', text: answer.reply });
    (answer.notes || []).forEach((note) => say({ who: 'line', text: note }));

    let after = [...next, { role: 'assistant', content: answer.assistant || [{ type: 'text', text: answer.reply || '' }] }];

    if (answer.tool && answer.done && answer.result) {
      const r = answer.result;
      if (r.ok) {
        say({ who: 'card', kicker: 'ask for a person', text: r.line, action: 'open today', go: { to: '/today/' } });
        try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* an old browser, the ask still landed */ }
      } else {
        say({ who: 'line', tone: P.coral, text: r.line });
      }
      after = [...after, { role: 'user', content: [{ type: 'tool_result', tool_use_id: answer.tool.id, content: r.ok ? r.line : `failed, ${r.error}` }] }];
    } else if (answer.tool && !answer.done) {
      const summary = await runTool(answer.tool);
      after = [...after, { role: 'user', content: [{ type: 'tool_result', tool_use_id: answer.tool.id, content: summary }] }];
    }

    setHistory(after);
    setBusy(false);
    inputRef.current?.focus();
  }, [busy, chatId, input, location.pathname, runTool, say]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const go = (target) => {
    setOpen(false);
    navigate(target.to, target.state ? { state: target.state } : undefined);
  };

  const listening = mic === 'listening';
  const micLabel = listening ? `stop listening, ${clock(elapsed)}` : mic === 'hearing' ? 'volt is listening back' : 'speak instead of typing';

  return (
    <Box
      position="fixed"
      right={{ base: '16px', lg: '24px' }}
      bottom={{ base: `calc(env(safe-area-inset-bottom) + 14px + ${TABBAR_H} + 12px)`, lg: '24px' }}
      zIndex={30}
      display="flex"
      flexDirection="column"
      alignItems="flex-end"
      gap={3}
      pointerEvents="none"
    >
      {open && (
        <VStack
          role="dialog"
          aria-label="Volt's desk"
          align="stretch"
          spacing={0}
          w="min(420px, calc(100vw - 32px))"
          h="min(70vh, 640px)"
          bg={P.sheet}
          border="1px solid"
          borderColor={P.hair}
          borderRadius="20px"
          boxShadow="0 18px 44px rgba(36,26,22,0.18), 0 2px 8px rgba(36,26,22,0.08)"
          pointerEvents="auto"
          overflow="hidden"
        >
          <HStack px={INSET} py={3} borderBottom="1px solid" borderColor={P.hairSoft} spacing={3}>
            <Face size={30} />
            <Box flex={1} minW={0}>
              <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} lineHeight="1.1">{VOLT_NAME}</Text>
              <Text {...KICKER} mt={0.5}>drafts, never sends</Text>
            </Box>
            <IconButton aria-label="New chat" icon={<Icon as={TbPlus} boxSize="16px" />} size="sm" variant="ghost" borderRadius="full" color={P.inkMuted} _hover={{ bg: P.sunken, color: P.ink }} onClick={fresh} />
            <IconButton aria-label="Close" icon={<Icon as={TbX} boxSize="16px" />} size="sm" variant="ghost" borderRadius="full" color={P.inkMuted} _hover={{ bg: P.sunken, color: P.ink }} onClick={() => setOpen(false)} />
          </HStack>

          <VStack flex={1} minH={0} overflowY="auto" align="stretch" spacing={3} px={INSET} py={4}>
            {!turns.length && <VoltLine>{OPENER}</VoltLine>}
            {turns.map((t) => {
              if (t.who === 'you') return <YouLine key={t.id}>{t.text}</YouLine>;
              if (t.who === 'volt') return <VoltLine key={t.id}>{t.text}</VoltLine>;
              if (t.who === 'card') {
                return (
                  <Card key={t.id} kicker={t.kicker} action={t.action} onAction={() => go(t.go)}>
                    <Text fontSize={TYPE.small} lineHeight="1.55" color={P.ink}>{t.text}</Text>
                    {t.body && <Text fontSize={TYPE.small} lineHeight="1.55" color={P.inkSec} whiteSpace="pre-wrap" borderLeft="2px solid" borderColor={P.lime} pl={3}>{t.body}</Text>}
                  </Card>
                );
              }
              return <PlainLine key={t.id} tone={t.tone}>{t.text}</PlainLine>;
            })}
            {busy && <PlainLine>volt is thinking</PlainLine>}
            <Box ref={endRef} />
          </VStack>

          <HStack px={3} py={3} borderTop="1px solid" borderColor={P.hairSoft} spacing={2} align="flex-end">
            <IconButton
              aria-label={micLabel}
              title={micLabel}
              aria-pressed={listening}
              icon={<Icon as={listening ? TbPlayerStop : TbMicrophone} boxSize="18px" />}
              size="md"
              variant="ghost"
              borderRadius="full"
              color={listening ? P.limeInk : P.inkMuted}
              bg={listening ? P.lime : 'transparent'}
              isDisabled={mic === 'hearing' || busy}
              _hover={{ bg: listening ? P.lime : P.sunken, color: listening ? P.limeInk : P.ink }}
              sx={listening ? { animation: `${breathe} 1.6s ${EASE} infinite` } : undefined}
              onClick={tapMic}
            />
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={listening ? `listening ${clock(elapsed)}, tap the mic to stop` : mic === 'hearing' ? 'volt is listening back' : 'tell volt what to draft'}
              rows={1}
              minH="40px"
              maxH="120px"
              resize="none"
              fontSize={TYPE.body}
              color={P.ink}
              bg={P.sunken}
              border="1px solid"
              borderColor={P.hair}
              borderRadius="16px"
              px={INSET}
              py={2}
              _placeholder={{ color: PLACEHOLDER }}
              _focus={{ borderColor: P.ink, boxShadow: 'none' }}
              isDisabled={busy}
            />
            <IconButton
              aria-label="Send to Volt"
              icon={<Icon as={TbArrowUp} boxSize="18px" />}
              size="md"
              borderRadius="full"
              bg={P.ink}
              color={P.sheet}
              isDisabled={!input.trim() || busy}
              _hover={{ bg: P.inkSec }}
              onClick={send}
            />
          </HStack>
        </VStack>
      )}

      <Box
        as="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Volt' : 'Open Volt'}
        aria-expanded={open}
        title={open ? 'Close Volt' : 'Open Volt'}
        w={`${DISC}px`}
        h={`${DISC}px`}
        borderRadius="full"
        bg={P.lime}
        color={P.limeInk}
        display="flex"
        alignItems="center"
        justifyContent="center"
        boxShadow="0 10px 28px rgba(36,26,22,0.22), 0 2px 6px rgba(36,26,22,0.12)"
        cursor="pointer"
        pointerEvents="auto"
        transition={`transform ${FAST} ${EASE}, opacity ${SLOW} ${EASE}`}
        _hover={{ transform: 'translateY(-1px)' }}
        _active={{ transform: 'scale(0.96)' }}
        _focusVisible={{ outline: `3px solid ${P.ink}`, outlineOffset: '3px' }}
      >
        <Icon as={open ? TbX : TbBolt} boxSize="26px" strokeWidth={2.2} />
      </Box>
    </Box>
  );
};

export default VoltDesk;
