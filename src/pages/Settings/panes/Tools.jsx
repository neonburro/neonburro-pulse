// src/pages/Settings/panes/Tools.jsx
// SENTINEL: NB_PULSE_SETTINGS_TOOLS_V1
//
// Tools, studio only. The services the studio runs on, in the pattern of
// the Claude desktop connectors and skills panes: a Yours and Discover tab
// pair, a search, quiet column heads and rows that open in place. Tyler,
// 2026-10-05: "Add some shit in there for tools that we could use for all
// kinds of stuff." The list itself is src/lib/studioTools.js, this file only
// draws it.
//
// ── WHAT A STATUS MEANS HERE ────────────────────────────────────────────────
// Every word in the status column is something Pulse checked. Nothing else.
//   answering, send only, refused and the rest   a Check just ran one free
//                 read through netlify/functions/studio-tools.js
//   key set, no key   the function read whether the names are set, true or
//                 false, it never sees a value leave
//   serving abc1234   the commit this build came from, stamped at build
//   3 words           the trademark watch answered with its list
//   studio site, studio Mac, dashboard   not a status. Where the thing lives,
//                 because Pulse cannot see it, said in faint ink
//   reading           the first answer is on its way
//   not read          the function could not be reached, under yarn dev
//                 for one, or did not answer for this row
// No row ever turns green on a guess. Supabase is answering only because the
// function's own role check read profiles with the service key. If the
// function cannot be reached the row says not read, even though the page
// itself just read from Supabase, so a sample profile in the review route
// can never paint it green.
//
// ── CHECKING ────────────────────────────────────────────────────────────────
// Nothing is probed on open. The pane reads the names once, and Check, on a
// row or Check all in the head, walks the probe tools one at a time with a
// pause between, the same manners as Check all on /trademarks/. Each read is
// free at the vendor and changes nothing there.
//
// ── NEVER ───────────────────────────────────────────────────────────────────
// Names only. This pane never asks for, shows or stores a key. A key is set
// on Netlify by Tyler, Project configuration, Environment variables, and
// the row tells you which name.
//
// deps.callTools and deps.callWatch let the dev review route hand in sample
// answers. Without them the pane calls the real functions.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, VStack, HStack, Text, Icon, Button, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import {
  TbChevronDown, TbRefresh, TbExternalLink, TbArrowUpRight, TbArrowRight,
  TbTrademark, TbCpu, TbWaveSine, TbPhoto,
} from 'react-icons/tb';
import {
  SiSupabase, SiNetlify, SiStripe, SiResend, SiClaude, SiDeepgram, SiMeta, SiSolana,
  SiElevenlabs, SiTwilio, SiTelegram, SiGoogle, SiCloudflare, SiGithub, SiX, SiBluesky,
} from 'react-icons/si';
import { supabase } from '../../../lib/supabase';
import { callWatch } from '../../../lib/trademarkWatch';
import { commitUrl } from '../../../lib/build';
import { TOOLS, DISCOVER, HOME, STATE, presenceOf } from '../../../lib/studioTools';
import colors from '../../../theme/colors';
import { TYPE, KICKER, HEAD_GAP, EASE, FAST } from '../../../theme/layout';
import { PageHead, Tabs, SearchBox } from '../../../components/common/Page';

const P = colors.paper;
const TONE = { green: P.green, gold: P.gold, coral: P.coral, inkSec: P.inkSec, ink: P.ink, faint: P.inkFaint };
const GRID = { base: 'minmax(0,1fr) auto', sm: 'minmax(0,1fr) 132px 32px' };
const NEED = { required: 'needed', either: 'one of two', optional: 'optional' };

const ICON = {
  supabase: SiSupabase, netlify: SiNetlify, stripe: SiStripe, resend: SiResend, anthropic: SiClaude,
  deepgram: SiDeepgram, meta: SiMeta, solana: SiSolana, trademarks: TbTrademark, elevenlabs: SiElevenlabs,
  twilio: SiTwilio, telegram: SiTelegram, google: SiGoogle, cloudflare: SiCloudflare, github: SiGithub,
  local: TbCpu, cartesia: TbWaveSine, fal: TbPhoto, x: SiX, bluesky: SiBluesky,
};

const callTools = async (action, payload = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/studio-tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The tools function answered ${res.status}.`);
  return data;
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clock = (iso) => (iso
  ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  : '');

const Head = ({ children, ...rest }) => (
  <Text {...KICKER} color={P.inkFaint} {...rest}>{children}</Text>
);

const Tile = ({ icon }) => (
  <Box
    w="32px"
    h="32px"
    flexShrink={0}
    borderRadius="10px"
    bg={P.sheet}
    border="1px solid"
    borderColor={P.hair}
    display="grid"
    placeItems="center"
  >
    <Icon as={icon || TbCpu} boxSize={4} color={P.ink} />
  </Box>
);

const OutLink = ({ href, children }) => (
  <Link href={href} isExternal fontSize={TYPE.small} fontWeight="600" color={P.inkMuted} _hover={{ color: P.ink }}>
    {children} <Icon as={TbExternalLink} boxSize={3.5} verticalAlign="-2px" />
  </Link>
);

const EnvLine = ({ env, envMap }) => {
  const known = envMap && Object.prototype.hasOwnProperty.call(envMap, env.name);
  const set = known && envMap[env.name];
  const word = !known ? 'not read' : set ? 'set' : 'not set';
  const tone = !known ? P.inkFaint : set ? P.green : env.need === 'optional' ? P.inkFaint : P.coral;
  return (
    <HStack align="start" spacing={3} py={1.5} borderTop="1px solid" borderColor={P.hairSoft}>
      <VStack align="start" spacing={0} flex={1} minW={0}>
        <Text fontFamily="mono" fontSize={TYPE.small} color={P.ink} wordBreak="break-all">{env.name}</Text>
        {env.note && <Text fontSize={TYPE.label} color={P.inkFaint} lineHeight="1.5">{env.note}</Text>}
      </VStack>
      <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} whiteSpace="nowrap" pt="2px">{NEED[env.need]}</Text>
      <Text fontSize={TYPE.small} fontWeight="600" color={tone} w="64px" textAlign="right" flexShrink={0}>{word}</Text>
    </HStack>
  );
};

const Status = ({ status, quiet }) => {
  if (!status) return <Text fontSize={TYPE.small} color={P.inkFaint} textAlign="right">{quiet}</Text>;
  return (
    <Text
      fontSize={TYPE.small}
      fontWeight={status.where ? '500' : '600'}
      color={TONE[status.tone] || P.ink}
      textAlign="right"
      noOfLines={1}
    >
      {status.label}
    </Text>
  );
};

const ToolRow = ({ tool, status, quiet, open, onToggle, envMap, check, busy, onCheck, build, discover }) => {
  const first = tool.links?.[0];
  const result = check?.state ? STATE[check.state] : null;
  return (
    <Box borderTop="1px solid" borderColor={P.hair}>
      <Box
        as="button"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        w="100%"
        textAlign="left"
        display="grid"
        gridTemplateColumns={GRID}
        gap={{ base: 3, sm: 5 }}
        alignItems="center"
        py={3}
        px={1}
        borderRadius="8px"
        transition={`background ${FAST} ${EASE}`}
        _hover={{ bg: P.sunken }}
        _focusVisible={{ outline: `2px solid ${P.limeDeep}`, outlineOffset: '-2px' }}
      >
        <HStack spacing={3} minW={0}>
          <Icon
            as={TbChevronDown}
            boxSize={4}
            color={P.inkFaint}
            flexShrink={0}
            transform={open ? 'rotate(0deg)' : 'rotate(-90deg)'}
            transition={`transform ${FAST} ${EASE}`}
          />
          <Tile icon={ICON[tool.key]} />
          <VStack align="start" spacing={0} minW={0}>
            <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{tool.name}</Text>
            <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={{ base: 2, sm: 1 }} lineHeight="1.45">{tool.line}</Text>
          </VStack>
        </HStack>
        <Status status={status} quiet={quiet} />
        <Box display={{ base: 'none', sm: 'block' }}>
          {first && (
            <Box
              as="a"
              href={first.href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={first.label}
              title={first.label}
              display="grid"
              placeItems="center"
              w="32px"
              h="32px"
              borderRadius="full"
              color={P.inkMuted}
              transition={`all ${FAST} ${EASE}`}
              _hover={{ bg: P.sheet, color: P.ink, boxShadow: `inset 0 0 0 1px ${P.hair}` }}
            >
              <Icon as={TbArrowUpRight} boxSize={4} />
            </Box>
          )}
        </Box>
      </Box>

      {open && (
        <VStack align="stretch" spacing={4} pl={{ base: 1, sm: '76px' }} pr={1} pb={5} pt={1}>
          <Text fontSize={TYPE.small} color={P.inkSec} lineHeight="1.6" maxW="62ch">{tool.more}</Text>

          {result && (
            <Text fontSize={TYPE.small} color={TONE[result.tone] || P.inkSec}>
              {result.say}.{' '}
              <Text as="span" fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>
                {[check.code, check.mode, clock(check.at)].filter(Boolean).join(' · ')}
              </Text>
            </Text>
          )}

          {tool.key === 'netlify' && build?.commit && (
            <Text fontSize={TYPE.small} color={P.inkSec}>
              This page was built from{' '}
              <Link href={commitUrl(build.commit)} isExternal fontFamily="mono" color={P.ink} fontWeight="600">{build.short}</Link>
              {build.context ? `, a ${build.context.replace(/-/g, ' ')} build.` : '.'}
            </Text>
          )}

          {tool.home === 'pulse' && tool.env?.length > 0 && (
            <VStack align="stretch" spacing={0}>
              <Head mb={1}>On the Pulse site</Head>
              {tool.env.map((env) => <EnvLine key={env.name} env={env} envMap={envMap} />)}
            </VStack>
          )}

          {tool.siteEnv?.length > 0 && (
            <VStack align="stretch" spacing={1}>
              <Head>On the studio site, out of Pulse's sight</Head>
              <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec} wordBreak="break-word">{tool.siteEnv.join('  ')}</Text>
            </VStack>
          )}

          {discover && (
            <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>{tool.state}</Text>
          )}

          <HStack spacing={4} flexWrap="wrap" rowGap={2}>
            {tool.probe && (
              <Button size="sm" variant="outline" leftIcon={<Icon as={TbRefresh} boxSize={4} />} isLoading={busy} loadingText="Checking" onClick={onCheck}>
                Check
              </Button>
            )}
            {tool.internal && (
              <Button as={RouterLink} to={tool.internal.path} size="sm" variant="outline" rightIcon={<Icon as={TbArrowRight} boxSize={4} />}>
                {tool.internal.label}
              </Button>
            )}
            {(tool.links || []).map((l) => <OutLink key={l.href} href={l.href}>{l.label}</OutLink>)}
          </HStack>
        </VStack>
      )}
    </Box>
  );
};

const Table = ({ title, count, statusHead = 'Status', children }) => (
  <Box>
    <Box display="grid" gridTemplateColumns={GRID} gap={5} px={1} pb={2} alignItems="baseline">
      <HStack spacing={2}>
        <Head>{title}</Head>
        {count !== undefined && <Text fontFamily="mono" fontSize={TYPE.kicker} color={P.inkFaint}>{count}</Text>}
      </HStack>
      <Head display={{ base: 'none', sm: 'block' }} textAlign="right">{statusHead}</Head>
    </Box>
    {children}
    <Box borderTop="1px solid" borderColor={P.hair} />
  </Box>
);

const Tools = ({ deps = {}, build }) => {
  const tools = deps.callTools || callTools;
  const watchCall = deps.callWatch || callWatch;
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [watch, setWatch] = useState(null);
  const [checks, setChecks] = useState({});
  const [busy, setBusy] = useState({});
  const [walking, setWalking] = useState(null);
  const [tab, setTab] = useState('yours');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const alive = useRef(true);

  // Set true on every mount, not only the first. StrictMode mounts, unmounts
  // and mounts again in dev, and a guard that only ever goes false drops
  // every answer after that.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const read = useCallback(async () => {
    try {
      const data = await tools('list');
      if (alive.current) { setReport(data); setReportError(''); }
    } catch (err) {
      if (alive.current) { setReport(null); setReportError(err.message); }
    }
  }, [tools]);

  useEffect(() => {
    read();
    watchCall('list')
      .then(({ words }) => {
        if (!alive.current || !Array.isArray(words)) return;
        const last = words.map((w) => w.checkedAt).filter(Boolean).sort().pop() || null;
        setWatch({ count: words.length, last });
      })
      .catch(() => {});
  }, [read, watchCall]);

  const check = useCallback(async (key) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const out = await tools('check', { key });
      if (alive.current) setChecks((c) => ({ ...c, [key]: out }));
    } catch (err) {
      if (alive.current) setReportError(err.message);
    } finally {
      if (alive.current) setBusy((b) => ({ ...b, [key]: false }));
    }
  }, [tools]);

  const probeKeys = useMemo(() => TOOLS.filter((t) => t.probe).map((t) => t.key), []);

  const checkAll = async () => {
    await read();
    for (let i = 0; i < probeKeys.length; i += 1) {
      if (!alive.current) return;
      setWalking({ done: i, of: probeKeys.length });
      await check(probeKeys[i]);
      if (i < probeKeys.length - 1) await pause(500);
    }
    if (alive.current) setWalking(null);
  };

  const statusOf = (tool) => {
    if (tool.home !== 'pulse') return { label: HOME[tool.home], tone: 'faint', where: true };
    const envMap = report?.env;
    const presence = presenceOf(tool, envMap);
    const result = checks[tool.key]?.state ? STATE[checks[tool.key].state] : null;
    if (tool.status === 'supabase') return report?.supabase === 'answering' ? STATE.answering : null;
    if (tool.status === 'build') return build?.short ? { label: `serving ${build.short}`, tone: 'ink' } : null;
    if (tool.status === 'watch') return watch ? { label: `${watch.count} ${watch.count === 1 ? 'word' : 'words'}`, tone: 'ink' } : null;
    if (presence === 'no-key') return STATE['no-key'];
    if (result) return result;
    if (tool.status === 'rpc') {
      if (!envMap) return null;
      return { label: envMap.SOLANA_RPC_URL ? 'keyed' : 'public endpoint', tone: 'inkSec' };
    }
    return presence ? STATE[presence] : null;
  };

  const match = (t) => {
    const q = query.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.line.toLowerCase().includes(q);
  };

  const held = TOOLS.filter((t) => t.home === 'pulse').filter(match);
  const elsewhere = TOOLS.filter((t) => t.home !== 'pulse').filter(match);
  const discover = DISCOVER.filter(match);

  const row = (tool, isDiscover = false) => (
    <ToolRow
      key={tool.key}
      tool={tool}
      status={isDiscover ? { label: tool.state, tone: 'faint', where: true } : statusOf(tool)}
      quiet={report === null && !reportError ? 'reading' : 'not read'}
      open={open === tool.key}
      onToggle={() => setOpen((o) => (o === tool.key ? null : tool.key))}
      envMap={report?.env}
      check={checks[tool.key]}
      busy={!!busy[tool.key]}
      onCheck={() => check(tool.key)}
      build={build}
      discover={isDiscover}
    />
  );

  return (
    <VStack align="stretch" spacing={HEAD_GAP}>
      <PageHead
        kicker="Studio"
        title="Tools"
        lede="The services the studio runs on, what each does for us and whether Pulse can see it working. Names only, never a key."
        actions={(
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Icon as={TbRefresh} boxSize={4} />}
            isDisabled={!!walking}
            onClick={checkAll}
          >
            {walking ? `${walking.done + 1} of ${walking.of}` : 'Check all'}
          </Button>
        )}
      />

      <VStack align="stretch" spacing={5}>
        <SearchBox value={query} onChange={setQuery} placeholder="search the tools" />

        <Tabs
          value={tab}
          onChange={(key) => { setTab(key); setOpen(null); }}
          items={[
            { key: 'yours', label: 'Yours', count: TOOLS.length },
            { key: 'discover', label: 'Discover', count: DISCOVER.length },
          ]}
        />

        {reportError && tab === 'yours' && (
          <Text fontSize={TYPE.small} color={P.inkMuted}>
            Pulse could not read the site just now, so the rows it holds stay quiet. {reportError}
          </Text>
        )}

        {tab === 'yours' ? (
          <VStack align="stretch" spacing={8}>
            {held.length > 0 && <Table title="Pulse holds the key" count={held.length}>{held.map((t) => row(t))}</Table>}
            {elsewhere.length > 0 && <Table title="Held elsewhere" count={elsewhere.length}>{elsewhere.map((t) => row(t))}</Table>}
            {!held.length && !elsewhere.length && (
              <Text fontSize={TYPE.body} color={P.inkMuted} py={6}>Nothing matches that.</Text>
            )}
          </VStack>
        ) : (
          <VStack align="stretch" spacing={4}>
            <Text fontSize={TYPE.small} color={P.inkMuted} maxW="62ch" lineHeight="1.6">
              Tools the studio has picked or is weighing. No code in either repo uses them yet, each says when it was decided.
            </Text>
            {discover.length > 0
              ? <Table title="Not wired" statusHead="Where it stands" count={discover.length}>{discover.map((t) => row(t, true))}</Table>
              : <Text fontSize={TYPE.body} color={P.inkMuted} py={6}>Nothing matches that.</Text>}
          </VStack>
        )}

        <Text fontSize={TYPE.small} color={P.inkFaint} lineHeight="1.6" maxW="62ch">
          A status here is only what Pulse checked from where it stands. A key on the studio site or a machine on the desk says where it lives instead. Every check is one free read that changes nothing, and Pulse keeps the word, never the key.
        </Text>
      </VStack>
    </VStack>
  );
};

export default Tools;
