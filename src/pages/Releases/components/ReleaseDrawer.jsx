// src/pages/Releases/components/ReleaseDrawer.jsx
// SENTINEL: NB_PULSE_SOCIALS_DRAWER_V4
//
// One release, one shared record. The voice is the council member speaking.
// The publishing account is a separate row in social_accounts. The creative
// brief and asset status keep Lyra, the writer and the final reviewer in the
// same room instead of hiding image work in a chat.
//
// The form follows the release id rather than every background refresh. Any
// change to public words, the link, the picture, its alt line, the creative
// brief or the publishing identity drops approval. That is intentional. What
// was approved must be exactly what leaves the yard.
//
// ── THE PICTURE HAS TWO SHELVES ─────────────────────────────────────────────
// The studio shelf (StudioShelf.jsx) sets asset_path to a public url on
// neonburro.com with no bucket and asset_alt to the alt line. The bucket
// picker (AssetPicker.jsx) sets a bucket and a path for a dropped file. A
// telegram release only sees the bucket picker, the telegram hand on the
// studio site reads the bucket and path pair and does not know a url yet.
// asset_alt is written only once the row shows the column, so the page can
// ship before the 2026-09-25 migration lands without breaking a save.
//
// ── THE RAILS ───────────────────────────────────────────────────────────────
// Telegram, facebook and instagram post automatically when the row is
// staged, approved and due, telegram through the studio hand and the Meta
// pair through release-meta.js here. A release on an automatic channel
// cannot be approved without an enabled publishing account, and a Meta
// release cannot be approved while its connector is dark, the page asks the
// door by env name. Facebook under 120 words and no hashtags, instagram no
// more than three hashtags and a jpeg picture, the same numbers as
// draft-release.js. A Telegram post with a picture holds its caption to
// 1024 characters.
//
// ── POST NOW ────────────────────────────────────────────────────────────────
// A Meta release that is staged, approved and saved shows a post now button
// beside save. It is the five minute runner on a person's click, the same
// gate, and it asks once before it goes. Nothing leaves on its own.
//
// V4, the house fields through shared.jsx, the house buttons and kicker.
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Textarea,
  Select,
  Switch,
  Button,
} from '@chakra-ui/react';
import { supabase } from '../../../lib/supabase';
import {
  P,
  CHANNELS,
  VOICES,
  ASSET_STATUSES,
  LIMITS,
  WORD_LIMITS,
  HASHTAG_LIMITS,
  STATUS_TINT,
  Field,
  Kicker,
  VoiceDisc,
  isAutomatic,
  isSocial,
  isMeta,
  isPublicUrl,
  bucketFor,
  wordRail,
  hashtags,
  countWords,
  formatVerdict,
  toLocalDate,
  toLocalTime,
  fromLocal,
} from './shared';
import AssetPicker from './AssetPicker';
import StudioShelf from './StudioShelf';
import VoltDraft from './VoltDraft';
import { useConnectors, connectorLine, postNow } from './connectors';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import { Plate } from '../../../components/common/Page';

const APPROVAL_FIELDS = [
  'title',
  'channel',
  'voice',
  'body',
  'link',
  'asset_bucket',
  'asset_path',
  'asset_alt',
  'social_account_id',
  'content_pillar',
  'creative_brief',
  'asset_status',
  'date',
  'time',
];

const fromRow = (release) => ({
  title: release.title || '',
  channel: release.channel || 'telegram',
  voice: release.voice || '',
  social_account_id: release.social_account_id || '',
  content_pillar: release.content_pillar || '',
  creative_brief: release.creative_brief || '',
  asset_status: release.asset_status || 'not_needed',
  date: toLocalDate(release.release_at),
  time: toLocalTime(release.release_at),
  body: release.body || '',
  notes: release.notes || '',
  link: release.link || '',
  asset_bucket: release.asset_bucket || null,
  asset_path: release.asset_path || null,
  asset_alt: release.asset_alt || '',
  approved: Boolean(release.approved),
  approved_at: release.approved_at || null,
});

const toPatch = (form, hasAlt) => ({
  title: form.title.trim(),
  channel: (form.channel || 'telegram').trim().toLowerCase(),
  voice: form.voice ? form.voice.trim().toLowerCase().replace(/\.$/, '') : null,
  social_account_id: form.social_account_id || null,
  content_pillar: form.content_pillar.trim() || null,
  creative_brief: form.creative_brief.trim() || null,
  asset_status: form.asset_status || 'not_needed',
  release_at: fromLocal(form.date, form.time),
  body: form.body || null,
  notes: form.notes || null,
  link: form.link || null,
  asset_bucket: form.asset_bucket || null,
  asset_path: form.asset_path || null,
  ...(hasAlt ? { asset_alt: form.asset_alt?.trim() || null } : {}),
  approved: Boolean(form.approved),
  approved_at: form.approved ? form.approved_at : null,
  updated_at: new Date().toISOString(),
});

const ReleaseDrawer = ({ release, isOpen, onClose, onSaved, onAdvance }) => {
  const [form, setForm] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [note, setNote] = useState('');
  const [noteTone, setNoteTone] = useState('lime');
  const probes = useConnectors();

  const id = release ? release.id : null;
  const hasAlt = release ? Object.prototype.hasOwnProperty.call(release, 'asset_alt') : false;

  useEffect(() => {
    if (!release) {
      setForm(null);
      return;
    }
    setForm(fromRow(release));
    setDirty(false);
    setNote('');
    setNoteTone('lime');
  }, [id]);

  const loadAccounts = useCallback(async (channel) => {
    if (!channel || !isSocial(channel)) {
      setAccounts([]);
      return;
    }
    const { data } = await supabase
      .from('social_accounts')
      .select('id, burro, channel, handle, enabled, note')
      .eq('channel', channel)
      .order('burro', { ascending: true });
    setAccounts(data || []);
  }, []);

  useEffect(() => {
    if (isOpen && form?.channel) loadAccounts(form.channel);
  }, [isOpen, form?.channel, loadAccounts]);

  const say = (text, tone = 'lime') => {
    setNote(text);
    setNoteTone(tone);
  };

  const set = (patch) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      const approvalChanged = APPROVAL_FIELDS.some((key) => (
        key in patch && patch[key] !== current[key]
      ));
      if (current.approved && approvalChanged) {
        next.approved = false;
        next.approved_at = null;
        say('the release changed. approval dropped so it can be read again.', 'gold');
      }
      return next;
    });
    setDirty(true);
  };

  const write = async (nextForm) => {
    if (!nextForm.title.trim()) {
      say('a release needs a title.', 'coral');
      return false;
    }
    if (busy) return false;
    setBusy(true);
    const { data, error } = await supabase
      .from('releases')
      .update(toPatch(nextForm, hasAlt))
      .eq('id', id)
      .select('id')
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      say(`could not save. ${error?.message || 'your account cannot change this release.'}`, 'coral');
      return false;
    }
    setDirty(false);
    if (onSaved) onSaved();
    return true;
  };

  const save = async () => {
    const ok = await write(form);
    if (ok) say('saved.');
  };

  const hasPicture = Boolean(form?.asset_path);
  const pictureUrl = !form?.asset_path
    ? null
    : isPublicUrl(form.asset_path)
      ? form.asset_path
      : form.asset_bucket
        ? supabase.storage.from(form.asset_bucket).getPublicUrl(form.asset_path).data.publicUrl
        : null;
  const baseLimit = form ? LIMITS[form.channel] : null;
  const limit = form?.channel === 'telegram' && hasPicture ? 1024 : baseLimit;
  const trimmedLink = form?.link?.trim() || '';
  const linkSuffix = form && trimmedLink && !form.body.includes(trimmedLink) && form.channel !== 'instagram'
    ? `\n\n${trimmedLink}`
    : '';
  const count = form ? form.body.length + linkSuffix.length : 0;
  const words = form ? countWords(form.body) : 0;
  const tags = form ? hashtags(form.body).length : 0;
  const wordLimit = form ? WORD_LIMITS[form.channel] : null;
  const tagLimit = form ? HASHTAG_LIMITS[form.channel] : null;
  const over = Boolean(limit && count > limit)
    || Boolean(wordLimit && words > wordLimit)
    || (tagLimit !== null && tagLimit !== undefined && tags > tagLimit);
  const selectedAccount = accounts.find((account) => account.id === form?.social_account_id) || null;
  const probe = form && isMeta(form.channel) ? probes[form.channel] : null;

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
      say(`refused. the body reads as price talk because it contains ${bad}.`, 'coral');
      return;
    }
    if (limit && count > limit) {
      say(`refused. ${count} characters do not fit the ${limit} character rail.`, 'coral');
      return;
    }
    if (wordLimit && words > wordLimit) {
      say(`refused. ${words} words, the ${form.channel} rail is ${wordLimit}.`, 'coral');
      return;
    }
    if (tagLimit !== null && tagLimit !== undefined && tags > tagLimit) {
      say(tagLimit === 0
        ? `refused. ${form.channel} posts carry no hashtags.`
        : `refused. ${tags} hashtags, the ${form.channel} rail is ${tagLimit}.`, 'coral');
      return;
    }
    if (['needs_lyra', 'generating'].includes(form.asset_status)) {
      say('refused. the creative queue still has work open.', 'coral');
      return;
    }
    if (form.channel === 'instagram' && !hasPicture) {
      say('refused. instagram needs a picture, there is no text only post.', 'coral');
      return;
    }
    const formatNote = isMeta(form.channel) && pictureUrl ? formatVerdict(form.channel, pictureUrl) : null;
    if (form.channel === 'instagram' && formatNote) {
      say(`refused. ${formatNote}.`, 'coral');
      return;
    }
    if (isAutomatic(form.channel) && !selectedAccount) {
      say('refused. choose the account that will publish this post.', 'coral');
      return;
    }
    if (isAutomatic(form.channel) && !selectedAccount.enabled) {
      say('refused. the selected publishing account is switched off.', 'coral');
      return;
    }
    if (probe && !probe.unknown && !probe.ready) {
      say(`refused. the ${form.channel} connector is dark, ${probe.missing.join(' and ')} not set on the Pulse site.`, 'coral');
      return;
    }

    const next = { ...form, approved: true, approved_at: new Date().toISOString() };
    setForm(next);
    const ok = await write(next);
    if (ok) {
      say(
        isAutomatic(next.channel)
          ? `approved. ${selectedAccount.burro} carries it when the hour arrives.`
          : 'approved. this channel releases by hand.',
      );
    }
  };

  const carryNow = async () => {
    if (posting || !form || !release) return;
    const sure = window.confirm(`Post this to ${form.channel} now through ${selectedAccount?.burro || 'the account'}?`);
    if (!sure) return;
    setPosting(true);
    say(`carrying it to ${form.channel}.`);
    const result = await postNow(form.channel, release.id);
    setPosting(false);
    if (!result.ok) {
      say(`${result.error}${result.data?.error && result.data.error !== result.error ? ` ${result.data.error}` : ''}`, 'coral');
      if (onSaved) onSaved();
      return;
    }
    say(`posted. id ${result.data.externalId || 'unknown'}.`);
    if (onSaved) onSaved();
  };

  const status = release ? release.status : 'idea';
  const automatic = form ? isAutomatic(form.channel) : false;
  const social = form ? isSocial(form.channel) : false;
  const meta = form ? isMeta(form.channel) : false;
  const canPostNow = meta && status === 'staged' && form?.approved && !dirty && probe?.ready;
  const bodyHint = !form
    ? ''
    : form.channel === 'reddit'
      ? 'the body stays in the record'
      : form.channel === 'facebook'
        ? `${words} / ${wordLimit} words · ${tags} hashtags, none allowed`
        : form.channel === 'instagram'
          ? `${count} / ${limit} · ${tags} / ${tagLimit} hashtags · first 125 carry it`
          : limit ? `${count} / ${limit}` : `${count} characters`;
  const toneColor = { lime: P.limeDeep, gold: P.gold, coral: P.coral }[noteTone];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay bg="rgba(23,17,12,0.55)" backdropFilter="blur(4px)" />
      <DrawerContent bg={P.mat} borderLeft="1px solid" borderColor={P.hair}>
        <DrawerCloseButton
          color={P.inkMuted}
          borderRadius="full"
          top={4}
          right={4}
          _hover={{ color: P.ink, bg: P.sunken }}
        />

        {form && release && (
          <>
            <DrawerHeader pb={3} pr={14}>
              <HStack spacing={2.5} mb={2}>
                <VoiceDisc voice={form.voice} size="20px" />
                <Kicker color={P.limeDeep}>social release</Kicker>
                <HStack
                  as="button"
                  type="button"
                  spacing={1.5}
                  onClick={() => onAdvance(release)}
                  title="advance status"
                  cursor="pointer"
                  _hover={{ opacity: 0.75 }}
                  transition={`opacity ${FAST} ${EASE}`}
                >
                  <Box boxSize="7px" borderRadius="full" bg={STATUS_TINT[status] || P.inkFaint} />
                  <Text fontFamily="mono" fontSize={TYPE.label} color={STATUS_TINT[status] || P.inkFaint}>
                    {status}
                  </Text>
                </HStack>
              </HStack>

              <Text
                fontSize={TYPE.section}
                fontWeight="600"
                letterSpacing="-0.02em"
                color={P.ink}
                noOfLines={2}
                lineHeight="1.3"
              >
                {form.title || 'untitled'}
              </Text>

              {status === 'failed' && release.error && (
                <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral} mt={1.5} lineHeight="1.5">
                  {release.error}
                </Text>
              )}

              {release.external_id && status === 'released' && (
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint} mt={1.5}>
                  posted · id {release.external_id}
                </Text>
              )}
            </DrawerHeader>

            <DrawerBody pt={2} pb={6}>
              <VStack align="stretch" spacing={5}>
                {note && (
                  <Text fontFamily="mono" fontSize={TYPE.small} color={toneColor} lineHeight="1.55">
                    {note}
                  </Text>
                )}

                <Field label="Title">
                  <Input
                    value={form.title}
                    placeholder="what ships"
                    onChange={(event) => set({ title: event.target.value })}
                  />
                </Field>

                <HStack align="start" spacing={3} flexWrap="wrap">
                  <Box flex={1} minW="150px">
                    <Field label="Channel" hint="free text">
                      <Input
                        fontFamily="mono"
                        fontSize={TYPE.small}
                        list="social-channel-list"
                        value={form.channel}
                        onChange={(event) => set({
                          channel: event.target.value,
                          social_account_id: '',
                        })}
                      />
                      <datalist id="social-channel-list">
                        {CHANNELS.map((channel) => <option key={channel} value={channel} />)}
                      </datalist>
                    </Field>
                  </Box>

                  <Box flex={1} minW="150px">
                    <Field label="Voice" hint="who is speaking">
                      <Select
                        fontFamily="mono"
                        fontSize={TYPE.small}
                        value={form.voice}
                        onChange={(event) => set({ voice: event.target.value })}
                      >
                        <option value="">no voice</option>
                        {form.voice && !VOICES.includes(form.voice) && (
                          <option value={form.voice}>{form.voice} not on the list</option>
                        )}
                        {VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
                      </Select>
                    </Field>
                  </Box>
                </HStack>

                {social && (
                  <Field
                    label="Publishes through"
                    hint={meta ? connectorLine(probe) : automatic ? 'automatic' : 'manual'}
                    hintColor={meta ? (probe?.ready ? P.limeDeep : probe?.unknown ? P.inkFaint : P.gold) : undefined}
                  >
                    <Select
                      fontFamily="mono"
                      fontSize={TYPE.small}
                      value={form.social_account_id}
                      onChange={(event) => set({ social_account_id: event.target.value })}
                    >
                      <option value="">choose an account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.burro} · {account.handle || 'no handle'} · {account.enabled ? 'live' : 'off'}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <HStack align="start" spacing={3} flexWrap="wrap">
                  <Box flex={1} minW="150px">
                    <Field label="Date">
                      <Input
                        type="date"
                        fontFamily="mono"
                        fontSize={TYPE.small}
                        value={form.date}
                        onChange={(event) => set({ date: event.target.value })}
                      />
                    </Field>
                  </Box>
                  <Box flex={1} minW="120px">
                    <Field label="Time" hint="local">
                      <Input
                        type="time"
                        fontFamily="mono"
                        fontSize={TYPE.small}
                        value={form.time}
                        onChange={(event) => set({ time: event.target.value })}
                      />
                    </Field>
                  </Box>
                </HStack>

                <Field label="Content lane" hint="one useful thread">
                  <Input
                    value={form.content_pillar}
                    placeholder="craft, place, research, token record"
                    onChange={(event) => set({ content_pillar: event.target.value })}
                  />
                </Field>

                {social && status !== 'released' && (
                  <VoltDraft
                    releaseId={release.id}
                    channel={form.channel}
                    voice={form.voice}
                    pictureUrl={pictureUrl}
                    alt={form.asset_alt}
                    disabled={busy}
                    onBeforeDraft={() => write(form)}
                    onDrafted={(data) => {
                      setForm((current) => ({
                        ...current,
                        body: data.body || current.body,
                        approved: false,
                        approved_at: null,
                      }));
                      setDirty(false);
                      if (onSaved) onSaved();
                    }}
                  />
                )}

                <Field label="Body" hint={bodyHint} hintColor={over ? P.coral : undefined}>
                  <Textarea
                    minH="160px"
                    borderColor={over ? P.coral : P.hair}
                    value={form.body}
                    placeholder="the words that go out"
                    onChange={(event) => set({ body: event.target.value })}
                  />
                </Field>

                <Plate sunken>
                  <VStack align="stretch" spacing={4}>
                    <HStack justify="space-between" align="baseline">
                      <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>
                        Lyra queue
                      </Text>
                      <Select
                        size="sm"
                        w="160px"
                        fontFamily="mono"
                        value={form.asset_status}
                        onChange={(event) => set({ asset_status: event.target.value })}
                      >
                        {ASSET_STATUSES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </Select>
                    </HStack>

                    <Field label="Creative brief" hint="image, motion or both">
                      <Textarea
                        minH="100px"
                        value={form.creative_brief}
                        placeholder="what the asset should make someone feel and what must stay true"
                        onChange={(event) => set({ creative_brief: event.target.value })}
                      />
                    </Field>

                    {form.channel !== 'telegram' ? (
                      <StudioShelf
                        channel={form.channel}
                        selectedPath={isPublicUrl(form.asset_path) ? form.asset_path : null}
                        onPick={({ url, alt }) => set({
                          asset_bucket: null,
                          asset_path: url,
                          asset_alt: alt || '',
                          asset_status: 'ready',
                        })}
                        onClear={() => set({ asset_bucket: null, asset_path: null, asset_alt: '' })}
                      />
                    ) : (
                      <Text fontSize={TYPE.label} color={P.inkMuted} lineHeight="1.5">
                        telegram reads the bucket shelf below. the studio hand carries a bucket and a path, not a url.
                      </Text>
                    )}

                    {hasPicture && (
                      <Field label="Alt line" hint={hasAlt ? 'carried to facebook' : 'saved after the migration'}>
                        <Input
                          fontSize={TYPE.small}
                          value={form.asset_alt}
                          placeholder="what the picture shows, one line"
                          onChange={(event) => set({ asset_alt: event.target.value })}
                        />
                      </Field>
                    )}

                    <AssetPicker
                      bucket={bucketFor(form.channel)}
                      selectedBucket={form.asset_bucket}
                      selectedPath={isPublicUrl(form.asset_path) ? null : form.asset_path}
                      onPick={(bucket, path) => set({
                        asset_bucket: bucket,
                        asset_path: path,
                        asset_status: path ? 'ready' : form.asset_status,
                      })}
                    />
                  </VStack>
                </Plate>

                <Field label="Link" hint={form.channel === 'instagram' ? 'instagram does not link captions' : undefined}>
                  <Input
                    fontFamily="mono"
                    fontSize={TYPE.small}
                    value={form.link}
                    placeholder="https://"
                    onChange={(event) => set({ link: event.target.value })}
                  />
                </Field>

                <Field label="Notes" hint="private to the studio">
                  <Textarea
                    minH="70px"
                    value={form.notes}
                    onChange={(event) => set({ notes: event.target.value })}
                  />
                </Field>

                <Plate sunken>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0.5}>
                      <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>Approved</Text>
                      <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.5">
                        {automatic
                          ? 'the selected account posts when the row is staged and due.'
                          : 'this channel releases by hand.'}
                      </Text>
                    </VStack>
                    <Switch
                      colorScheme="brand"
                      size="md"
                      isChecked={form.approved}
                      isDisabled={busy || status === 'released'}
                      onChange={(event) => approve(event.target.checked)}
                    />
                  </HStack>

                  {form.approved && form.approved_at && (
                    <Text fontFamily="mono" fontSize={TYPE.micro} color={P.limeDeep} mt={2}>
                      approved {new Date(form.approved_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </Plate>
              </VStack>
            </DrawerBody>

            <DrawerFooter borderTop="1px solid" borderColor={P.hair} justifyContent="space-between">
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
                {dirty ? 'unsaved' : 'saved'}
              </Text>
              <HStack spacing={2}>
                <Button size="sm" variant="outline" onClick={onClose}>
                  close
                </Button>
                {canPostNow && (
                  <Button size="sm" variant="outline" color={P.limeDeep} borderColor={P.limeDeep} onClick={carryNow} isLoading={posting} loadingText="posting">
                    post now
                  </Button>
                )}
                <Button size="sm" onClick={save} isLoading={busy} loadingText="saving">
                  save
                </Button>
              </HStack>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default ReleaseDrawer;
