// src/pages/Releases/components/ReleaseDrawer.jsx
// SENTINEL: NB_PULSE_RELEASES_DRAWER_V1
//
// One release, the whole of it. Title, channel, voice, the date and the
// hour, the body with its count, the picture, notes, link and the approve
// switch. Save writes the row through the client. The status pip in the
// header is the same pip as the shelves, advancing it goes through the page
// so the rules live in one place.
//
// ── THE FORM FOLLOWS THE ID, NOT THE ROW ────────────────────────────────────
// The page reloads rows after every write and the function flips rows in
// the background, so the release prop changes often. The form resets only
// when the id changes. Status and error are read straight off the prop so
// the header is always live and everything typed survives a reload.
//
// ── APPROVAL ────────────────────────────────────────────────────────────────
// The switch is the hue•man thumb. Switching on runs the word rail on the
// body and the body length against the channel limit, refuses with the word
// or the count if either fails and otherwise saves the whole form with
// approved true and approved_at now in one write, so what was approved is
// exactly what is in the database. Switching off saves approved false.
// Editing the title, channel, voice or body of an approved row drops the
// approval in the form and says so, the words changed so the read is owed
// again. That is deliberate, the function trusts approved.
//
// ── POSTING CHANNELS ────────────────────────────────────────────────────────
// telegram, x, instagram and reddit are posted by
// netlify/functions/release-social.js when the row is staged, approved and
// due. The hint under the switch says so. For every other channel the
// switch is a note to the team and the pip still walks to released by hand.
//
// No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import {
  Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, DrawerCloseButton,
  Box, VStack, HStack, Text, Input, Textarea, Select, Switch,
} from '@chakra-ui/react';
import { supabase } from '../../../lib/supabase';
import {
  P, CHANNELS, VOICES, LIMITS, STATUS_TINT, Field, inputProps, VoiceDisc,
  isPosting, bucketFor, wordRail, toLocalDate, toLocalTime, fromLocal,
} from './shared';
import AssetPicker from './AssetPicker';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const WORD_FIELDS = ['title', 'channel', 'voice', 'body'];

const fromRow = (r) => ({
  title: r.title || '',
  channel: r.channel || 'site',
  voice: r.voice || '',
  date: toLocalDate(r.release_at),
  time: toLocalTime(r.release_at),
  body: r.body || '',
  notes: r.notes || '',
  link: r.link || '',
  asset_bucket: r.asset_bucket || null,
  asset_path: r.asset_path || null,
  approved: Boolean(r.approved),
  approved_at: r.approved_at || null,
});

const toPatch = (f) => ({
  title: f.title.trim(),
  channel: (f.channel || 'site').trim().toLowerCase(),
  voice: f.voice ? f.voice.trim().toLowerCase().replace(/\.$/, '') : null,
  release_at: fromLocal(f.date, f.time),
  body: f.body || null,
  notes: f.notes || null,
  link: f.link || null,
  asset_bucket: f.asset_bucket || null,
  asset_path: f.asset_path || null,
  approved: Boolean(f.approved),
  approved_at: f.approved ? f.approved_at : null,
  updated_at: new Date().toISOString(),
});

const ReleaseDrawer = ({ release, isOpen, onClose, onSaved, onAdvance }) => {
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [noteTone, setNoteTone] = useState('lime');

  const id = release ? release.id : null;

  useEffect(() => {
    if (!release) { setForm(null); return; }
    setForm(fromRow(release));
    setDirty(false);
    setNote('');
    setNoteTone('lime');
    // the form follows the id, see the header
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const say = (text, tone = 'lime') => { setNote(text); setNoteTone(tone); };

  const set = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (f.approved && WORD_FIELDS.some((k) => k in patch && patch[k] !== f[k])) {
        next.approved = false;
        next.approved_at = null;
        say('the words changed, approval dropped. read it again and switch it back on.', 'gold');
      }
      return next;
    });
    setDirty(true);
  };

  const write = async (f) => {
    if (!f.title.trim()) { say('a release needs a title.', 'coral'); return false; }
    if (busy) return false;
    setBusy(true);
    const { error } = await supabase.from('releases').update(toPatch(f)).eq('id', id);
    setBusy(false);
    if (error) { say(`could not save. ${error.message}`, 'coral'); return false; }
    setDirty(false);
    onSaved && onSaved();
    return true;
  };

  const save = async () => {
    const ok = await write(form);
    if (ok) say('saved.');
  };

  const limit = form ? LIMITS[form.channel] : null;
  const count = form ? form.body.length : 0;
  const over = Boolean(limit && count > limit);

  const approve = async (on) => {
    if (!on) {
      const next = { ...form, approved: false, approved_at: null };
      setForm(next);
      const ok = await write(next);
      if (ok) say('approval off.');
      return;
    }
    const bad = wordRail(form.body);
    if (bad) {
      say(`refused. the body reads as price talk, the word is "${bad}". the studio does not talk about the coin's price.`, 'coral');
      return;
    }
    if (over) {
      say(`refused. ${count} characters, ${form.channel} takes ${limit}.`, 'coral');
      return;
    }
    const next = { ...form, approved: true, approved_at: new Date().toISOString() };
    setForm(next);
    const ok = await write(next);
    if (ok) say(isPosting(next.channel)
      ? `approved. the function posts it on ${next.channel} once it is staged and the hour arrives.`
      : 'approved. this channel ships by hand, walk the pip to released when it does.');
  };

  const status = release ? release.status : 'idea';
  const posting = form ? isPosting(form.channel) : false;
  const bodyHint = !form ? '' : form.channel === 'reddit'
    ? 'reddit carries the title only, the body is not posted'
    : limit ? `${count} / ${limit}` : `${count} characters`;

  const toneColor = { lime: P.limeDeep, gold: P.gold, coral: P.coral }[noteTone];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay bg="rgba(23,17,12,0.55)" backdropFilter="blur(4px)" />
      <DrawerContent bg={P.mat} borderLeft="1px solid" borderColor={P.hair}>
        <DrawerCloseButton color={P.inkMuted} borderRadius="full" top={4} right={4} _hover={{ color: P.ink, bg: P.sunken }} />
        {form && release && (
          <>
            <DrawerHeader pb={3} pr={14}>
              <HStack spacing={2.5} mb={2}>
                <VoiceDisc voice={form.voice} size="20px" />
                <Text fontFamily="mono" fontSize="9px" fontWeight="500" letterSpacing="0.2em" textTransform="uppercase" color={P.limeDeep}>
                  release
                </Text>
                <HStack as="button" type="button" spacing={1.5} onClick={() => onAdvance(release)}
                  title="advance status" cursor="pointer" _hover={{ opacity: 0.75 }} transition={`opacity ${FAST} ${EASE}`}>
                  <Box boxSize="7px" borderRadius="full" bg={STATUS_TINT[status] || P.inkFaint} />
                  <Text fontFamily="mono" fontSize={TYPE.label} color={STATUS_TINT[status] || P.inkFaint}>{status}</Text>
                </HStack>
              </HStack>
              <Text fontSize={TYPE.section} fontWeight="600" letterSpacing="-0.02em" color={P.ink} noOfLines={2} lineHeight="1.3">
                {form.title || 'untitled'}
              </Text>
              {status === 'failed' && release.error && (
                <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral} mt={1.5} lineHeight="1.5">
                  {release.error}
                </Text>
              )}
              {release.external_id && status === 'released' && (
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint} mt={1.5}>
                  posted, id {release.external_id}
                </Text>
              )}
            </DrawerHeader>

            <DrawerBody pt={2} pb={6}>
              <VStack align="stretch" spacing={5}>
                {note && (
                  <Text fontFamily="mono" fontSize={TYPE.small} color={toneColor} lineHeight="1.55">{note}</Text>
                )}

                <Field label="Title">
                  <Input {...inputProps} value={form.title} placeholder="what ships"
                    onChange={(e) => set({ title: e.target.value })} />
                </Field>

                <HStack align="start" spacing={3} flexWrap="wrap">
                  <Box flex={1} minW="150px">
                    <Field label="Channel" hint="free text">
                      <Input {...inputProps} fontFamily="mono" fontSize={TYPE.small} list="release-channel-list"
                        value={form.channel} onChange={(e) => set({ channel: e.target.value })} />
                      <datalist id="release-channel-list">
                        {CHANNELS.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </Field>
                  </Box>
                  <Box flex={1} minW="150px">
                    <Field label="Voice">
                      <Select {...inputProps} fontFamily="mono" fontSize={TYPE.small}
                        value={form.voice} onChange={(e) => set({ voice: e.target.value })}>
                        <option value="">no voice</option>
                        {form.voice && !VOICES.includes(form.voice) && (
                          <option value={form.voice}>{form.voice} (not on the list)</option>
                        )}
                        {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </Select>
                    </Field>
                  </Box>
                </HStack>

                <HStack align="start" spacing={3} flexWrap="wrap">
                  <Box flex={1} minW="150px">
                    <Field label="Date">
                      <Input {...inputProps} type="date" fontFamily="mono" fontSize={TYPE.small}
                        value={form.date} onChange={(e) => set({ date: e.target.value })} />
                    </Field>
                  </Box>
                  <Box flex={1} minW="120px">
                    <Field label="Time" hint="local">
                      <Input {...inputProps} type="time" fontFamily="mono" fontSize={TYPE.small}
                        value={form.time} onChange={(e) => set({ time: e.target.value })} />
                    </Field>
                  </Box>
                </HStack>

                <Field label="Body" hint={bodyHint} hintColor={over ? P.coral : undefined}>
                  <Textarea {...inputProps} h="auto" minH="160px" py={3} lineHeight="1.6"
                    borderColor={over ? P.coral : P.hair}
                    value={form.body} placeholder="the words that go out"
                    onChange={(e) => set({ body: e.target.value })} />
                </Field>

                <AssetPicker bucket={bucketFor(form.channel)}
                  selectedBucket={form.asset_bucket} selectedPath={form.asset_path}
                  onPick={(bucket, path) => set({ asset_bucket: bucket, asset_path: path })} />

                <Field label="Link">
                  <Input {...inputProps} fontFamily="mono" fontSize={TYPE.small} value={form.link}
                    placeholder="https://" onChange={(e) => set({ link: e.target.value })} />
                </Field>

                <Field label="Notes" hint="nobody outside sees this">
                  <Textarea {...inputProps} h="auto" minH="70px" py={2.5} value={form.notes}
                    onChange={(e) => set({ notes: e.target.value })} />
                </Field>

                <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={4}>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0.5}>
                      <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>Approved</Text>
                      <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.5">
                        {posting
                          ? `the function posts it on ${form.channel} once it is staged, approved and the hour arrives.`
                          : 'this channel ships by hand. the switch is a note to the team.'}
                      </Text>
                    </VStack>
                    <Switch colorScheme="brand" size="md" isChecked={form.approved}
                      isDisabled={busy || status === 'released'}
                      onChange={(e) => approve(e.target.checked)} />
                  </HStack>
                  {form.approved && form.approved_at && (
                    <Text fontFamily="mono" fontSize={TYPE.micro} color={P.limeDeep} mt={2}>
                      approved {new Date(form.approved_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  )}
                </Box>
              </VStack>
            </DrawerBody>

            <DrawerFooter borderTop="1px solid" borderColor={P.hair} justifyContent="space-between">
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                {dirty ? 'unsaved' : 'saved'}
              </Text>
              <HStack spacing={2.5}>
                <HStack as="button" type="button" onClick={onClose} spacing={1.5}
                  bg={P.sheet} border="1px solid" borderColor={P.hair} color={P.inkSec} borderRadius="full" px={4} h="38px"
                  fontWeight="600" fontSize="sm" _hover={{ borderColor: P.inkFaint }} transition={`border-color ${FAST} ${EASE}`}>
                  <Text>close</Text>
                </HStack>
                <HStack as="button" type="button" onClick={save} spacing={1.5}
                  bg={P.lime} color={P.limeInk} borderRadius="full" px={5} h="38px" fontWeight="700" fontSize="sm"
                  opacity={busy ? 0.6 : 1} pointerEvents={busy ? 'none' : 'auto'}
                  _hover={{ bg: '#D2E26B' }} transition={`all ${FAST} ${EASE}`}>
                  <Text>{busy ? 'saving' : 'save'}</Text>
                </HStack>
              </HStack>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default ReleaseDrawer;
