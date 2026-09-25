// src/pages/Dashboard/components/VoltAsks.jsx
// SENTINEL: NB_PULSE_VOLT_ASKS_V1
//
// The last five asks of volt, on Today. When a thing is outside what Volt
// can draft he writes an ask for a person through his write_ask tool in
// netlify/functions/volt-chat.js, the row lands in desk_asks and the studio
// inbox gets a mail. This is where a hand sees it and marks it done. Rows
// only, newest first, the words, who said them, where and when, and a done
// button for staff. A done row stays in the five with its mark so the
// person who asked can see it was picked up.
//
// Reads desk_asks through the client under staff RLS, the 2026-09-25 desk
// migration. Until the table exists the list says so in one line rather
// than pretending it is empty. Done writes status, done_by and done_at from
// the browser, which the manager update policy allows. The done button
// shows for super_admin, admin and manager, the same STAFF list the
// functions gate on, read off profiles once.
//
// Listens for the nb:desk-ask event VoltDesk.jsx fires after an ask is
// written so the list refreshes when the desk and Today are both on
// screen. The name is spelled in both files. A burro is never named
// without a face, the kicker carries volt's.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { Box, VStack, HStack, Text, Button, Image } from '@chakra-ui/react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { formatRelative } from '../../../lib/time';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import colors from '../../../theme/colors';

const P = colors.paper;
const VOLT_AVATAR = 'https://neonburro.com/burros/volt/volt-avatar.webp';
const VOLT_NAME = 'volt';
const EVENT = 'nb:desk-ask';
const STAFF = ['super_admin', 'admin', 'manager'];
const LIMIT = 5;

const Face = ({ size = 18 }) => (
  <Image src={VOLT_AVATAR} alt="Volt" w={`${size}px`} h={`${size}px`} borderRadius="full" objectFit="cover" bg={P.sunken} flexShrink={0} draggable={false} />
);

const Row = ({ ask, who, canDo, onDone, doing }) => {
  const done = ask.status === 'done';
  return (
    <HStack align="flex-start" spacing={{ base: 3.5, md: 5 }} py={{ base: 3.5, md: 4 }} px={{ base: 3, md: 4 }} borderRadius="14px" transition={`background ${FAST} ${EASE}`} _hover={{ bg: P.sheet }}>
      <Box w="8px" h="8px" mt="7px" borderRadius="full" bg={done ? P.hair : P.gold} flexShrink={0} />
      <VStack align="stretch" spacing={1} flex={1} minW={0}>
        <Text fontSize={TYPE.body} color={done ? P.inkMuted : P.ink} lineHeight="1.55" whiteSpace="pre-wrap" textDecoration={done ? 'line-through' : 'none'} sx={{ textDecorationColor: P.hair }}>
          {ask.transcript}
        </Text>
        <Text fontFamily="mono" fontSize={TYPE.label} letterSpacing="0.04em" color={P.inkFaint} noOfLines={1}>
          {who} · {ask.page || 'pulse'} · {formatRelative(ask.created_at)}{done ? ` · done ${formatRelative(ask.done_at)}` : ''}{ask.mailed === false ? ' · the mail did not go' : ''}
        </Text>
      </VStack>
      {canDo && !done && (
        <Button size="xs" variant="outline" borderColor={P.hair} color={P.inkSec} borderRadius="full" px={3} flexShrink={0} isLoading={doing} _hover={{ borderColor: P.ink, color: P.ink, bg: P.sheet }} onClick={() => onDone(ask.id)}>
          done
        </Button>
      )}
    </HStack>
  );
};

const VoltAsks = () => {
  const { user } = useAuth();
  const [asks, setAsks] = useState([]);
  const [names, setNames] = useState({});
  const [canDo, setCanDo] = useState(false);
  const [missing, setMissing] = useState(false);
  const [doing, setDoing] = useState(null);

  const fetchAsks = useCallback(async () => {
    const { data, error } = await supabase
      .from('desk_asks')
      .select('id, user_id, page, transcript, status, mailed, done_at, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error) {
      setMissing(true);
      setAsks([]);
      return;
    }
    setMissing(false);
    const rows = data || [];
    setAsks(rows);
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, username').in('id', ids);
      const map = {};
      (profiles || []).forEach((p) => { map[p.id] = p.display_name || p.username || 'somebody'; });
      setNames(map);
    }
  }, []);

  useEffect(() => { fetchAsks(); }, [fetchAsks]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data }) => setCanDo(STAFF.includes(data?.role)));
  }, [user?.id]);

  useEffect(() => {
    const onAsk = () => fetchAsks();
    window.addEventListener(EVENT, onAsk);
    return () => window.removeEventListener(EVENT, onAsk);
  }, [fetchAsks]);

  const markDone = async (id) => {
    setDoing(id);
    const { error } = await supabase
      .from('desk_asks')
      .update({ status: 'done', done_by: user?.id || null, done_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('mark done failed:', error.message);
    await fetchAsks();
    setDoing(null);
  };

  const open = asks.filter((a) => a.status !== 'done').length;

  return (
    <VStack align="stretch" spacing={4}>
      <HStack spacing={3} px={{ base: 3, md: 4 }}>
        <HStack spacing={2}>
          <Face size={18} />
          <Text fontFamily="mono" fontSize={TYPE.micro} fontWeight="500" letterSpacing="0.22em" textTransform="uppercase" color={P.inkMuted}>asked of {VOLT_NAME}</Text>
        </HStack>
        <Box flex={1} h="1px" bg={P.hair} />
        <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>{open}</Text>
      </HStack>

      {missing ? (
        <Text px={{ base: 3, md: 4 }} fontSize={TYPE.small} color={P.inkMuted}>the desk_asks table is not on the project yet. the 2026-09-25 desk migration puts it there.</Text>
      ) : !asks.length ? (
        <Text px={{ base: 3, md: 4 }} fontSize={TYPE.small} color={P.inkMuted}>nothing has been asked of {VOLT_NAME} for a person yet.</Text>
      ) : (
        <VStack align="stretch" spacing={0.5}>
          {asks.map((ask) => (
            <Row key={ask.id} ask={ask} who={names[ask.user_id] || 'somebody'} canDo={canDo} onDone={markDone} doing={doing === ask.id} />
          ))}
        </VStack>
      )}
    </VStack>
  );
};

export default VoltAsks;
