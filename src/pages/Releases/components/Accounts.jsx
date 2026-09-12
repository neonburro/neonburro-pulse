// src/pages/Releases/components/Accounts.jsx
// SENTINEL: NB_PULSE_RELEASES_ACCOUNTS_V1
//
// The accounts panel. One row per (burro, channel) in social_accounts, the
// handle the burro posts as, the chat id for telegram, the NAME of the
// Netlify env var that holds the token and the enabled switch, which is
// the per account kill switch the function honours.
//
// ── THE TOKEN NEVER COMES HERE ──────────────────────────────────────────────
// token_env is a name, TELEGRAM_BOT_TOKEN_WARBLEUR, not a value. The value
// lives in Netlify env on the pulse site and the function reads it by that
// name at post time. This panel has no field for the value and never will.
// If a token needs rotating the hue•man does it in Netlify and redeploys,
// nothing on this page changes.
//
// ── SAVES ON BLUR ───────────────────────────────────────────────────────────
// Text fields keep a local draft and write when the field loses focus and
// the value changed, so a row is not rewritten on every keystroke. The
// switch writes at once. Adding a row takes a burro and a channel and
// guesses the env var name in the seed's shape, editable after.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { Box, VStack, HStack, Text, Input, Select, Switch, Spinner, Icon } from '@chakra-ui/react';
import { TbPlus, TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { P, VOICES, POSTING, VoiceDisc, Kicker, inputProps } from './shared';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const PULSE_SITE = '1554d7eb-08ea-4e53-ac72-c035681eb384';

const small = {
  ...inputProps,
  h: '34px',
  px: 2.5,
  fontFamily: 'mono',
  fontSize: TYPE.small,
  borderRadius: '9px',
};

const guessEnv = (burro, channel) => (channel === 'telegram'
  ? `TELEGRAM_BOT_TOKEN_${burro.toUpperCase()}`
  : `${channel.toUpperCase()}_TOKEN_${burro.toUpperCase()}`);

const Draft = ({ value, onCommit, placeholder, mono = true, w }) => {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  return (
    <Input {...small} fontFamily={mono ? 'mono' : undefined} value={v} placeholder={placeholder} w={w}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const t = v.trim(); if (t !== (value || '')) onCommit(t || null); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
  );
};

const AccountRow = ({ a, onPatch }) => (
  <VStack align="stretch" spacing={2} py={3} borderBottom="1px solid" borderColor={P.hairSoft}>
    <HStack spacing={3}>
      <VoiceDisc voice={a.burro} />
      <Text fontSize={TYPE.body} color={P.ink} fontWeight="600" minW="72px">{a.burro}</Text>
      <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}
        border="1px solid" borderColor={P.hair} borderRadius="full" px={2.5} py={0.5}>
        {a.channel}
      </Text>
      <Box flex="1" />
      <Switch colorScheme="brand" size="sm" isChecked={Boolean(a.enabled)}
        onChange={(e) => onPatch(a.id, { enabled: e.target.checked })} />
    </HStack>
    <HStack spacing={2} flexWrap="wrap" rowGap={2}>
      <Draft value={a.handle} placeholder="@handle" w={{ base: '100%', sm: '160px' }}
        onCommit={(v) => onPatch(a.id, { handle: v })} />
      <Draft value={a.chat_id} placeholder={a.channel === 'telegram' ? 'chat id' : 'chat id, unused'} w={{ base: '100%', sm: '150px' }}
        onCommit={(v) => onPatch(a.id, { chat_id: v })} />
      <Draft value={a.token_env} placeholder="ENV_VAR_NAME" w={{ base: '100%', sm: '260px' }}
        onCommit={(v) => onPatch(a.id, { token_env: v })} />
    </HStack>
    {a.note && <Text fontSize={TYPE.label} color={P.inkFaint}>{a.note}</Text>}
  </VStack>
);

const Accounts = () => {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [burro, setBurro] = useState('warbleur');
  const [channel, setChannel] = useState('telegram');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .order('channel', { ascending: true })
      .order('burro', { ascending: true });
    if (error) { setMissing(true); setRows([]); return; }
    setRows(data || []);
  }, []);

  useEffect(() => { if (open && rows === null) load(); }, [open, rows, load]);

  const patch = async (id, fields) => {
    setRows((rs) => rs.map((a) => (a.id === id ? { ...a, ...fields } : a)));
    const { error } = await supabase.from('social_accounts').update(fields).eq('id', id);
    if (error) { setNote(`could not save. ${error.message}`); load(); } else setNote('');
  };

  const add = async () => {
    const { error } = await supabase.from('social_accounts').insert({
      burro, channel, token_env: guessEnv(burro, channel), enabled: false,
    });
    if (error) { setNote(error.code === '23505' ? `${burro} already has a ${channel} account.` : `could not add. ${error.message}`); return; }
    setNote('');
    load();
  };

  const enabled = (rows || []).filter((a) => a.enabled).length;

  return (
    <Box>
      <HStack as="button" type="button" onClick={() => setOpen((o) => !o)} spacing={2} mb={open ? 2 : 0}
        _hover={{ opacity: 0.75 }} transition={`opacity ${FAST} ${EASE}`}>
        <Icon as={open ? TbChevronDown : TbChevronRight} boxSize={3.5} color={P.inkMuted} />
        <Kicker>accounts{rows ? ` · ${enabled} of ${rows.length} on` : ''}</Kicker>
      </HStack>

      {open && (
        <VStack align="stretch" spacing={3}>
          {rows === null && !missing && (
            <HStack justify="center" py={8}><Spinner size="sm" color={P.inkMuted} /></HStack>
          )}

          {missing && (
            <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={5}>
              <Text fontSize={TYPE.body} color={P.inkSec}>
                The social_accounts table is not in the database yet. Paste
                supabase/migrations/2026091202_social_timeline.sql into the dashboard SQL editor
                and reload, the twelve telegram rows come with it.
              </Text>
            </Box>
          )}

          {rows !== null && !missing && (
            <>
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
                {rows.map((a) => <AccountRow key={a.id} a={a} onPatch={patch} />)}
                {rows.length === 0 && (
                  <Text fontSize={TYPE.body} color={P.inkFaint} py={6}>No accounts on the record yet.</Text>
                )}
              </VStack>

              <HStack spacing={2} flexWrap="wrap" rowGap={2}>
                <Select {...small} w={{ base: '46%', sm: '150px' }} value={burro} onChange={(e) => setBurro(e.target.value)}>
                  {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
                <Select {...small} w={{ base: '46%', sm: '140px' }} value={channel} onChange={(e) => setChannel(e.target.value)}>
                  {POSTING.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <HStack as="button" type="button" onClick={add} spacing={1.5}
                  bg={P.sheet} border="1px solid" borderColor={P.hair} color={P.ink} borderRadius="full" px={3.5} h="34px"
                  fontSize={TYPE.small} fontWeight="600" _hover={{ borderColor: P.limeDeep }} transition={`border-color ${FAST} ${EASE}`}>
                  <Icon as={TbPlus} boxSize={3.5} />
                  <Text>add account</Text>
                </HStack>
              </HStack>

              {note && <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral}>{note}</Text>}
            </>
          )}

          <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
            The third field is the name of the env var, never the token. Tokens go in Netlify env on the
            pulse site ({PULSE_SITE}) under Site configuration then Environment variables. A function only
            sees a value after a build that ran with it present. This panel has no place for a token and
            never asks for one.
          </Text>
        </VStack>
      )}
    </Box>
  );
};

export default Accounts;
