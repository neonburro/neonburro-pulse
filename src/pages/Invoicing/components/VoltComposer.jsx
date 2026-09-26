// src/pages/Invoicing/components/VoltComposer.jsx
// SENTINEL: NB_VOLT_COMPOSER_V2
//
// Talk or type an invoice into existence. This is the first place Volt, Pulse's
// own assistant, is wired into the system. You describe the month (or attach a
// receipt), Volt structures a Neon Burro invoice, and it hands the draft to the
// existing editor so you preview and send through the gate you already have.
// Volt drafts, he never sends.
//
// THREE WAYS IN, all landing in the same text: Type (or paste), Talk (the browser
// mic via the Web Speech API, and Wispr Flow dictates straight into the field
// too), and Attach (a receipt PDF or photo, read by the model). The draft calls
// /.netlify/functions/draft-invoice which needs ANTHROPIC_API_KEY on the Pulse
// site, until that is set it returns a clear "not connected yet" note.
//
// V2, house fields and buttons, nothing centred but the mic. No oxford
// commas, no em dashes.

import { useState, useRef } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, VStack, HStack, Text, Textarea, Button, Icon, Image,
  Wrap, WrapItem, Input,
} from '@chakra-ui/react';
import {
  TbKeyboard, TbMicrophone, TbPaperclip, TbSparkles, TbX, TbFileText, TbPhoto, TbArrowRight, TbRefresh,
} from 'react-icons/tb';
import colors from '../../../theme/colors';
import { supabase } from '../../../lib/supabase';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Kicker, Plate } from '../../../components/common/Page';

const P = colors.paper;
const VOLT_AVATAR = 'https://neonburro.com/burros/volt/volt-avatar.webp';

const MODE_META = {
  pay_full:     { label: 'Fund in full', color: P.green },
  deposit_50:   { label: '50% to start', color: P.gold },
  approve_only: { label: 'Confirm scope', color: P.inkMuted },
};

const money = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve({ name: file.name, media_type: file.type, size: file.size, data: String(r.result).split(',')[1] });
  r.onerror = reject;
  r.readAsDataURL(file);
});

const VoltComposer = ({ isOpen, onClose, clients = [], onDraft }) => {
  const [mode, setMode] = useState('type');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [listening, setListening] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const fileRef = useRef(null);

  const reset = () => { setText(''); setAttachments([]); setDraft(null); setError(null); setListening(false); recRef.current?.stop(); };
  const close = () => { reset(); onClose(); };

  const toggleListen = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechUnsupported(true); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText) setText((prev) => (prev ? `${prev} ` : '') + finalText.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recRef.current = r;
    setListening(true);
  };

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    const read = await Promise.all(files.map(readAsBase64));
    setAttachments((prev) => [...prev, ...read].slice(0, 5));
    if (fileRef.current) fileRef.current.value = '';
  };

  const runDraft = async () => {
    setDrafting(true); setError(null); setDraft(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/draft-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          text,
          attachments: attachments.map((a) => ({ media_type: a.media_type, data: a.data })),
          clients: clients.map((c) => ({ id: c.id, name: c.name, company: c.company })),
        }),
      });
      const json = await res.json();
      if (json.notConnected || json.error) { setError(json.error); return; }
      setDraft(json.draft);
    } catch (err) {
      setError(err.message || 'Volt hit an error.');
    } finally {
      setDrafting(false);
    }
  };

  const total = draft?.lines?.reduce((s, l) => s + parseFloat(l.amount || 0), 0) || 0;
  const matchedClient = draft?.client_id ? clients.find((c) => c.id === draft.client_id) : null;
  const canDraft = (text.trim() || attachments.length > 0) && !drafting;

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg" isCentered scrollBehavior="inside">
      <ModalOverlay bg="rgba(36,26,22,0.55)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.mat} color={P.ink} border="1px solid" borderColor={P.hair} borderRadius="2xl" mx={4}>
        <ModalHeader pb={2} pt={5} px={6}>
          <HStack spacing={3}>
            <Image src={VOLT_AVATAR} alt="Volt" w="40px" h="40px" borderRadius="full" border="2px solid" borderColor={P.lime} bg={P.sunken} objectFit="cover" />
            <Box>
              <HStack spacing={1.5}>
                <Text color={P.ink} fontSize={TYPE.section} fontWeight="700">Volt</Text>
                <Box w="6px" h="6px" borderRadius="full" bg={P.lime} sx={{ animation: 'voltP 2.2s ease-in-out infinite', '@keyframes voltP': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />
              </HStack>
              <Kicker>Invoice assistant</Kicker>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <ModalBody px={6} py={3}>
          {!draft ? (
            <VStack align="stretch" spacing={4}>
              <Text color={P.inkSec} fontSize={TYPE.body} lineHeight="1.6">
                Tell me what to invoice. The month, any calls, anything you paid for with a receipt. I will structure it and you preview before it sends.
              </Text>

              <HStack spacing={2}>
                <Button size="sm" variant={mode === 'type' ? 'outline' : 'ghost'} leftIcon={<Icon as={TbKeyboard} boxSize={4} />} onClick={() => setMode('type')}>Type</Button>
                <Button size="sm" variant={mode === 'talk' ? 'outline' : 'ghost'} leftIcon={<Icon as={TbMicrophone} boxSize={4} />} onClick={() => setMode('talk')}>Talk</Button>
              </HStack>

              {mode === 'talk' ? (
                <HStack spacing={4} py={2}>
                  <Box
                    as="button" type="button" onClick={toggleListen} w="72px" h="72px" borderRadius="full"
                    bg={listening ? P.lime : P.sheet} border="2px solid" borderColor={listening ? P.lime : P.hair}
                    display="flex" alignItems="center" justifyContent="center" transition={`all ${FAST} ${EASE}`}
                    boxShadow={listening ? `0 0 0 6px ${P.lime}33` : 'none'}
                    sx={listening ? { animation: 'voltMic 1.4s ease-in-out infinite', '@keyframes voltMic': { '0%,100%': { boxShadow: `0 0 0 4px ${P.lime}33` }, '50%': { boxShadow: `0 0 0 10px ${P.lime}00` } } } : {}}
                    flexShrink={0}
                  >
                    <Icon as={TbMicrophone} boxSize={7} color={listening ? P.limeInk : P.inkSec} />
                  </Box>
                  <VStack align="start" spacing={1}>
                    <Text color={P.inkMuted} fontSize={TYPE.small}>{listening ? 'Listening, tap to stop' : 'Tap to talk'}</Text>
                    {speechUnsupported && <Text color={P.gold} fontSize={TYPE.label}>This browser has no built in mic. Type below, or dictate into it with Wispr Flow.</Text>}
                  </VStack>
                </HStack>
              ) : null}

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digital management for Summit this month, one on site call, and I paid 40 dollars for their domain, receipt attached."
                minH="120px"
              />

              {attachments.length > 0 && (
                <Wrap spacing={2}>
                  {attachments.map((a, i) => (
                    <WrapItem key={i}>
                      <HStack spacing={2} bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="full" pl={INSET} pr={2} h="30px">
                        <Icon as={a.media_type === 'application/pdf' ? TbFileText : TbPhoto} boxSize={3.5} color={P.limeDeep} />
                        <Text fontSize={TYPE.label} color={P.inkSec} maxW="140px" noOfLines={1}>{a.name}</Text>
                        <Box as="button" type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} color={P.inkFaint} _hover={{ color: P.coral }}><Icon as={TbX} boxSize={3} /></Box>
                      </HStack>
                    </WrapItem>
                  ))}
                </Wrap>
              )}

              <Input ref={fileRef} type="file" accept="application/pdf,image/*" multiple display="none" onChange={onFiles} />
              <HStack justify="space-between">
                <Button variant="ghost" size="sm" leftIcon={<TbPaperclip size={15} />} onClick={() => fileRef.current?.click()}>
                  Attach a receipt
                </Button>
                {error && <Text color={P.coral} fontSize={TYPE.label} maxW="60%">{error}</Text>}
              </HStack>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={3}>
              {draft.summary && <Text color={P.inkSec} fontSize={TYPE.body} lineHeight="1.6">{draft.summary}</Text>}
              <HStack spacing={2}>
                <Kicker>Client</Kicker>
                <Text fontSize={TYPE.body} fontWeight="700" color={matchedClient ? P.ink : P.gold}>
                  {matchedClient ? matchedClient.name : (draft.client_name || 'Pick in the editor')}
                </Text>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {draft.lines.map((l, i) => {
                  const m = MODE_META[l.payment_mode] || MODE_META.pay_full;
                  return (
                    <Plate key={i} p={3}>
                      <HStack justify="space-between" align="start" spacing={3}>
                        <Box minW={0}>
                          <Text fontSize={TYPE.body} fontWeight="700" color={P.ink} noOfLines={1}>{l.title}</Text>
                          {l.description && <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={2} mt={0.5}>{l.description}</Text>}
                          <Kicker color={m.color} mt={1}>{m.label}</Kicker>
                        </Box>
                        <Text fontFamily="mono" fontSize={TYPE.section} fontWeight="700" color={P.ink} flexShrink={0} sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(l.amount)}</Text>
                      </HStack>
                    </Plate>
                  );
                })}
              </VStack>
              <HStack justify="space-between" pt={1}>
                <Kicker>Total</Kicker>
                <Text fontFamily="mono" fontSize={TYPE.figure} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</Text>
              </HStack>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} pt={4} pb={5} px={6}>
          {!draft ? (
            <HStack w="100%" justify="flex-end" spacing={2}>
              <Button variant="ghost" size="sm" onClick={close}>Close</Button>
              <Button size="sm" leftIcon={<TbSparkles size={16} />} onClick={runDraft} isLoading={drafting} loadingText="Volt is drafting" isDisabled={!canDraft}>
                Draft the invoice
              </Button>
            </HStack>
          ) : (
            <HStack w="100%" justify="space-between" spacing={2}>
              <Button variant="ghost" size="sm" leftIcon={<TbRefresh size={15} />} onClick={() => setDraft(null)}>Start over</Button>
              <Button size="sm" rightIcon={<TbArrowRight size={16} />} onClick={() => { onDraft(draft); close(); }}>
                Open in editor
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default VoltComposer;
