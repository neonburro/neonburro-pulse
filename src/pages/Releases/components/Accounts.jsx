// src/pages/Releases/components/Accounts.jsx
// SENTINEL: NB_PULSE_SOCIALS_ACCOUNTS_V3
//
// This is the account map, not the voice map. Neonburro and every council
// member may own a publishing account while any council voice may write through
// it. A release stores that choice in social_account_id. The burro column is
// therefore the account owner and never implies who wrote the post.
//
// Tokens never enter Pulse. token_env is a read only label for the name of
// the environment variable that holds the token. Telegram tokens live on the
// main neonburro Netlify site because the Telegram hand runs there. The Meta
// token lives on the Pulse site, META_PAGE_ACCESS_TOKEN, with META_PAGE_ID
// and META_IG_USER_ID beside it, because the Meta hand runs here. The third
// field on a facebook or instagram row holds the public object id, the page
// id or the ig user id, as a fallback when the env name is not set.
//
// A Meta row says what the connector actually is, by asking the door for
// the env names it can see, never a value. Off means the admin switch is
// off. Dark means the switch is on and the env is missing, so nothing can
// leave yet and the page says so. Live means both.
//
// Handles and object ids save on blur. The live switch writes at once. Bot
// creation, permissions and token rotation still happen in Telegram, in
// Meta and in Netlify because Pulse must never ask for a secret.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Select,
  Switch,
  Spinner,
  Icon,
} from '@chakra-ui/react';
import { TbPlus, TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import {
  P,
  ACCOUNT_OWNERS,
  SOCIAL_CHANNELS,
  isAutomatic,
  isMeta,
  VoiceDisc,
  Kicker,
  inputProps,
} from './shared';
import { useConnectors, connectorLine } from './connectors';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const STUDIO_SITE = '15e4962d-1edc-4a86-8386-008c2d3e03f1';
const PULSE_SITE = '1554d7eb-08ea-4e53-ac72-c035681eb384';

const small = {
  ...inputProps,
  h: '34px',
  px: 2.5,
  fontFamily: 'mono',
  fontSize: TYPE.small,
  borderRadius: '9px',
};

const guessEnv = (owner, channel) => {
  if (channel === 'telegram') return `TELEGRAM_BOT_TOKEN_${owner.toUpperCase()}`;
  if (isMeta(channel)) return 'META_PAGE_ACCESS_TOKEN';
  return `${channel.toUpperCase()}_TOKEN_${owner.toUpperCase()}`;
};

const idPlaceholder = (channel) => {
  if (channel === 'telegram') return 'chat id';
  if (channel === 'facebook') return 'page id';
  if (channel === 'instagram') return 'ig user id';
  return 'chat id unused';
};

const Draft = ({ value, onCommit, placeholder, w, isReadOnly = false }) => {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => { setDraft(value || ''); }, [value]);

  return (
    <Input
      {...small}
      value={draft}
      placeholder={placeholder}
      w={w}
      isReadOnly={isReadOnly}
      cursor={isReadOnly ? 'default' : 'text'}
      color={isReadOnly ? P.inkMuted : P.ink}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (isReadOnly) return;
        const trimmed = draft.trim();
        if (trimmed !== (value || '')) onCommit(trimmed || null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.target.blur();
      }}
    />
  );
};

const AccountRow = ({ account, onPatch, canManage, probe }) => {
  const automatic = isAutomatic(account.channel);
  const meta = isMeta(account.channel);
  const dark = meta && account.enabled && probe && !probe.unknown && !probe.ready;
  const status = automatic
    ? account.enabled ? (dark ? 'dark' : 'live') : 'off'
    : account.handle ? 'manual' : 'planned';
  const statusColor = status === 'live'
    ? P.green
    : status === 'off' ? P.coral : status === 'dark' ? P.gold : P.inkMuted;

  return (
    <VStack align="stretch" spacing={2} py={3} borderBottom="1px solid" borderColor={P.hairSoft}>
      <HStack spacing={3}>
        <VoiceDisc voice={account.burro} />
        <Text fontSize={TYPE.body} color={P.ink} fontWeight="600" minW="82px">
          {account.burro}
        </Text>
        <Text
          fontFamily="mono"
          fontSize={TYPE.label}
          color={P.inkMuted}
          border="1px solid"
          borderColor={P.hair}
          borderRadius="full"
          px={2.5}
          py={0.5}
        >
          {account.channel}
        </Text>
        <Box flex="1" />
        <Text fontFamily="mono" fontSize={TYPE.micro} color={statusColor}>
          {status}
        </Text>
        <Switch
          colorScheme="brand"
          size="sm"
          isChecked={Boolean(account.enabled)}
          isDisabled={!automatic || !canManage}
          title={automatic ? 'automatic posting switch' : 'manual channel'}
          onChange={(event) => onPatch(account.id, { enabled: event.target.checked })}
        />
      </HStack>

      <HStack spacing={2} flexWrap="wrap" rowGap={2}>
        <Draft
          value={account.handle}
          placeholder="@handle"
          w={{ base: '100%', sm: '170px' }}
          isReadOnly={!canManage}
          onCommit={(value) => onPatch(account.id, { handle: value })}
        />
        <Draft
          value={account.chat_id}
          placeholder={idPlaceholder(account.channel)}
          w={{ base: '100%', sm: '160px' }}
          isReadOnly={!canManage}
          onCommit={(value) => onPatch(account.id, { chat_id: value })}
        />
        <Input
          {...small}
          value={account.token_env || ''}
          placeholder="environment variable"
          w={{ base: '100%', sm: '280px' }}
          isReadOnly
          cursor="default"
          color={P.inkFaint}
          title="The variable name is fixed here. Its value stays in Netlify."
        />
      </HStack>

      {meta && (
        <Text fontFamily="mono" fontSize={TYPE.micro} color={probe?.ready ? P.limeDeep : probe?.unknown ? P.inkFaint : P.gold}>
          {connectorLine(probe)}
        </Text>
      )}

      {account.note && (
        <Text fontSize={TYPE.label} color={P.inkFaint}>{account.note}</Text>
      )}
    </VStack>
  );
};

const Accounts = () => {
  const { user } = useAuth();
  const probes = useConnectors();
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(true);
  const [owner, setOwner] = useState('neonburro');
  const [channel, setChannel] = useState('telegram');
  const [note, setNote] = useState('');
  const [role, setRole] = useState('');

  const canManage = ['super_admin', 'admin'].includes(role);

  useEffect(() => {
    if (!user?.id) {
      setRole('');
      return;
    }

    let cancelled = false;
    const loadRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) setRole(data?.role || '');
    };

    loadRole();
    return () => { cancelled = true; };
  }, [user?.id]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .order('channel', { ascending: true })
      .order('burro', { ascending: true });

    if (error) {
      setMissing(true);
      setRows([]);
      return;
    }

    setMissing(false);
    setRows(data || []);
  }, []);

  useEffect(() => {
    if (open && rows === null) load();
  }, [open, rows, load]);

  const patch = async (id, fields) => {
    if (!canManage) {
      setNote('Only an admin can change publishing accounts.');
      return;
    }
    setRows((current) => current.map((account) => (
      account.id === id ? { ...account, ...fields } : account
    )));
    const { data, error } = await supabase
      .from('social_accounts')
      .update(fields)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      setNote(`could not save. ${error?.message || 'your account cannot change publishing accounts.'}`);
      load();
      return;
    }
    setNote('');
  };

  const add = async () => {
    if (!canManage) {
      setNote('Only an admin can add publishing accounts.');
      return;
    }
    const { data, error } = await supabase
      .from('social_accounts')
      .insert({
        burro: owner,
        channel,
        token_env: guessEnv(owner, channel),
        enabled: false,
      })
      .select('id')
      .maybeSingle();

    if (error || !data) {
      setNote(
        error?.code === '23505'
          ? `${owner} already has a ${channel} account.`
          : `could not add. ${error?.message || 'your account cannot add publishing accounts.'}`,
      );
      return;
    }

    setNote('');
    load();
  };

  const live = (rows || []).filter((account) => (
    isAutomatic(account.channel) && account.enabled
  )).length;
  const automatic = (rows || []).filter((account) => isAutomatic(account.channel)).length;

  return (
    <Box>
      <HStack
        as="button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        spacing={2}
        mb={open ? 2 : 0}
        _hover={{ opacity: 0.75 }}
        transition={`opacity ${FAST} ${EASE}`}
      >
        <Icon as={open ? TbChevronDown : TbChevronRight} boxSize={3.5} color={P.inkMuted} />
        <Kicker>account map{rows ? ` · ${live} of ${automatic} live` : ''}</Kicker>
      </HStack>

      {open && (
        <VStack align="stretch" spacing={3}>
          {rows === null && !missing && (
            <HStack justify="center" py={8}>
              <Spinner size="sm" color={P.inkMuted} />
            </HStack>
          )}

          {missing && (
            <Box bg={P.sunken} border="1px solid" borderColor={P.hair} borderRadius="14px" p={5}>
              <Text fontSize={TYPE.body} color={P.inkSec}>
                The social account map is not available yet. Apply the Socials migrations and reload.
              </Text>
            </Box>
          )}

          {rows !== null && !missing && (
            <>
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={P.hair}>
                {rows.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onPatch={patch}
                    canManage={canManage}
                    probe={isMeta(account.channel) ? probes[account.channel] : null}
                  />
                ))}
                {rows.length === 0 && (
                  <Text fontSize={TYPE.body} color={P.inkFaint} py={6}>
                    No accounts on the record yet.
                  </Text>
                )}
              </VStack>

              {canManage ? (
                <HStack spacing={2} flexWrap="wrap" rowGap={2}>
                  <Select
                    {...small}
                    w={{ base: '46%', sm: '160px' }}
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                  >
                    {ACCOUNT_OWNERS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </Select>
                  <Select
                    {...small}
                    w={{ base: '46%', sm: '150px' }}
                    value={channel}
                    onChange={(event) => setChannel(event.target.value)}
                  >
                    {SOCIAL_CHANNELS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </Select>
                  <HStack
                    as="button"
                    type="button"
                    onClick={add}
                    spacing={1.5}
                    bg={P.sheet}
                    border="1px solid"
                    borderColor={P.hair}
                    color={P.ink}
                    borderRadius="full"
                    px={3.5}
                    h="34px"
                    fontSize={TYPE.small}
                    fontWeight="600"
                    _hover={{ borderColor: P.limeDeep }}
                    transition={`border-color ${FAST} ${EASE}`}
                  >
                    <Icon as={TbPlus} boxSize={3.5} />
                    <Text>add account</Text>
                  </HStack>
                </HStack>
              ) : (
                <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>
                  account settings are view only. an admin manages publishing access.
                </Text>
              )}

              {note && (
                <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral}>{note}</Text>
              )}
            </>
          )}

          <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
            The final field names an environment variable. It never contains the token. Telegram bot tokens live on the main neonburro Netlify site {STUDIO_SITE} and its hand posts from there. The Meta token, META_PAGE_ACCESS_TOKEN with META_PAGE_ID and META_IG_USER_ID, lives on the Pulse site {PULSE_SITE} and release-meta posts from here. Telegram, facebook and instagram post automatically once their account is live and their connector is not dark. X and reddit stay manual.
          </Text>
        </VStack>
      )}
    </Box>
  );
};

export default Accounts;
