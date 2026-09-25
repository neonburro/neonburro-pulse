// src/pages/Releases/components/VoltDraft.jsx
// SENTINEL: NB_PULSE_SOCIALS_VOLT_DRAFT_V2
//
// The draft door in the release drawer. One line from the operator about
// what the post is for and one button. Volt writes a draft onto the row
// through netlify/functions/draft-release.js. The function reads the live
// bio and the burro's lane from social_review_items and holds to the
// channel rails, so what comes back can be read and staged without a
// rewrite. It never stages, the row lands as drafted with approval off.
//
// The drawer saves the row first so the function reads what is on screen,
// the channel, the voice, the picked plate and its alt. That is why the
// button asks for onBeforeDraft, a save that answers true or false.
//
// The intent line is capped at 500 characters here and sliced to the same
// number on the other side, the cap is part of the worst case arithmetic
// in the function header. The door carries the three interaction ceilings
// and when it closes it says so in words. This box renders those words
// verbatim and keeps no copy of the numbers, the copy that drifts is the
// copy a person reads.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import { Box, VStack, HStack, Text, Input, Icon, Spinner } from '@chakra-ui/react';
import { TbSparkles } from 'react-icons/tb';
import { P, inputProps, VoiceDisc } from './shared';
import { draftRelease } from './connectors';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const INTENT_CHARS = 500;
const TONE = { lime: P.limeDeep, gold: P.gold, coral: P.coral };

const VoltDraft = ({ releaseId, channel, voice, pictureUrl, alt, disabled, onBeforeDraft, onDrafted }) => {
  const [intent, setIntent] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [tone, setTone] = useState('lime');

  const say = (text, colour = 'lime') => {
    setNote(text);
    setTone(colour);
  };

  const draft = async () => {
    if (busy || disabled) return;
    if (!intent.trim()) {
      say('one line about what the post is for.', 'gold');
      return;
    }
    setBusy(true);
    say('volt is reading the profile and the lane.');
    const saved = onBeforeDraft ? await onBeforeDraft() : true;
    if (!saved) {
      setBusy(false);
      say('the row did not save, the draft needs it saved first.', 'coral');
      return;
    }
    const result = await draftRelease({
      release_id: releaseId,
      intent: intent.trim().slice(0, INTENT_CHARS),
      channel,
      voice: voice || null,
      picture_url: pictureUrl || null,
      alt: alt || null,
    });
    setBusy(false);
    if (!result.ok) {
      const issues = result.data?.issues ? ` ${result.data.issues.join(', ')}.` : '';
      say(`${result.error}${issues}`, result.status === 429 ? 'gold' : 'coral');
      return;
    }
    onDrafted(result.data);
    const extras = (result.data.notes || []).join(' ');
    say(`drafted. ${result.data.note || ''} ${extras}`.replace(/\s+/g, ' ').trim());
  };

  return (
    <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={4}>
      <VStack align="stretch" spacing={3}>
        <HStack spacing={2} align="baseline">
          <VoiceDisc voice="volt" size="16px" />
          <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>Volt drafts</Text>
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
            {voice ? `in ${voice}'s voice` : 'in the studio voice'} · {channel}
          </Text>
        </HStack>
        <HStack spacing={2}>
          <Input
            {...inputProps}
            h="38px"
            fontSize={TYPE.small}
            value={intent}
            maxLength={INTENT_CHARS}
            placeholder="what is this post for, one line"
            onChange={(event) => setIntent(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && draft()}
          />
          <HStack
            as="button"
            type="button"
            onClick={draft}
            spacing={1.5}
            bg={P.sheet}
            border="1px solid"
            borderColor={P.hair}
            color={P.ink}
            borderRadius="full"
            px={3.5}
            h="38px"
            flexShrink={0}
            fontSize={TYPE.small}
            fontWeight="600"
            opacity={busy || disabled ? 0.6 : 1}
            pointerEvents={busy || disabled ? 'none' : 'auto'}
            _hover={{ borderColor: P.limeDeep }}
            transition={`border-color ${FAST} ${EASE}`}
          >
            {busy ? <Spinner size="xs" color={P.inkMuted} /> : <Icon as={TbSparkles} boxSize={3.5} />}
            <Text>{busy ? 'drafting' : 'draft'}</Text>
          </HStack>
        </HStack>
        {note && (
          <Text fontFamily="mono" fontSize={TYPE.label} color={TONE[tone]} lineHeight="1.55">{note}</Text>
        )}
        <Text fontSize={TYPE.label} color={P.inkMuted} lineHeight="1.5">
          {pictureUrl ? 'the picked plate and its alt line ride along.' : 'no plate is picked yet, the draft speaks without one.'} the draft lands below with approval off. it never stages and the door counts.
        </Text>
      </VStack>
    </Box>
  );
};

export default VoltDraft;
