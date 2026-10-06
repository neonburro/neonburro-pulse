// src/pages/Daylight/index.jsx
// SENTINEL: NB_DAYLIGHT_PAGE_V2
//
// THE BOARD. Three weeks from today, filled in by the studio, shared by a link.
//
// Tyler, 2026-10-05, in the order he said it, because the shape of this file is
// the shape of that conversation:
//
//   "it always shows up to 3 weeks ahead ... stuff starts to fill in"
//   "I do love that format way better" ................. bars, not a grid
//   "desktop could feature the day on the left with details, because I want to
//    be able to fill in what's going on for each time. I'll set times where I'm
//    busy between 12 and 4 pm due to this or whatever"
//   "we don't need to say tight and open ... just subtly have some colors and
//    greens ... I don't think we need to use white at all"
//
// WHAT THAT ADDS UP TO. A day has no state. A day is open, and you put hours
// into it. The colour of a day is derived from how much of it is gone and the
// little rail says where. There are no status words on this page at all and
// there is no white: the ground is paper, the days are greens. See the GREEN
// block in src/lib/daylight.js, which is the only place those values live.
//
// THE SPLIT. The day being edited sits on the left and the three weeks on the
// right, so filling in Tuesday never scrolls Tuesday off the screen. Under
// 1024, which is this theme's md and not Chakra's, the two stack and the detail
// opens directly under the tapped bar instead. One dataset, two arrangements,
// same as the calendar page one door down.
//
// WHAT THIS PAGE IS NOT. It is not the calendar. The calendar is appointments.
// This is the shape of the time around them, and an offer becomes an
// appointment through the calendar's own modal and never through here. The
// whole argument is in the header of src/lib/daylight.js.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, HStack, VStack, Button, Icon, Input, Select, IconButton } from '@chakra-ui/react';
import { TbLink, TbCopy, TbCheck, TbCalendarPlus, TbTrash, TbPlus, TbChevronDown } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import colors from '../../theme/colors';
import { EASE, FAST, FIELD_H_SM } from '../../theme/layout';
import { Page, PageHead, Section, Empty, Loading, Kicker, Plate } from '../../components/common/Page';
import {
  buildBoard, HORIZON_DAYS, longDay, fmtMinutes, typeOf,
  DAY_START, DAY_END, DAY_SPAN, GREEN, dayGreen, onGreen, isFull,
  mergeBlocks, freeRanges, fullness, DAY_SHORT, MONTH_SHORT,
} from '../../lib/daylight';

const P = colors.paper;

// Every half hour from eight to six, which is what the two dropdowns offer.
const EDGES = [];
for (let m = DAY_START; m <= DAY_END; m += 30) EDGES.push(m);

// The little timeline. Same idea as the client page's and deliberately a second
// copy: this one is editable and that one is not, and sharing it would mean a
// prop that means "is the studio looking", which is how a studio only note ends
// up rendered to a client by accident.
const Rail = ({ blocks, tone }) => (
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

const DayBar = ({ cell, blocks, picked, offers, onPick }) => {
  const ground = dayGreen(blocks);
  const ink = onGreen(blocks);
  const full = isFull(blocks);
  const freeH = freeRanges(blocks).reduce((n, [a, z]) => n + (z - a), 0) / 60;
  return (
    <Box
      as="button" type="button" onClick={() => onPick(cell.iso)}
      aria-label={`${longDay(cell.date)}, ${full ? 'nothing free' : `${freeH} hours free`}`}
      aria-pressed={picked}
      w="100%" display="flex" alignItems="center" gap={4}
      minH="56px" pl="16px" pr={4} textAlign="left"
      borderRadius="14px" position="relative" overflow="hidden"
      bg={ground} border="2px solid" borderColor={picked ? GREEN.ink : 'transparent'}
      transition={`border-color ${FAST} ${EASE}, transform ${FAST} ${EASE}`}
      _hover={{ transform: 'translateX(2px)' }}
      _focusVisible={{ outline: '2px solid', outlineColor: GREEN.ink, outlineOffset: '2px' }}
    >
      <Box minW="58px" flex="none">
        <Text fontSize="10.5px" fontWeight={600} letterSpacing="0.1em"
          textTransform="uppercase" color={ink} opacity={0.72}>
          {DAY_SHORT[cell.date.getDay()]}
        </Text>
        <Text fontSize="17px" fontWeight={cell.isToday ? 800 : 600} lineHeight="1.05" color={ink}>
          {cell.date.getDate()}
          <Text as="span" fontSize="11px" fontWeight={500} ml={1} opacity={0.72}>
            {MONTH_SHORT[cell.date.getMonth()]}
          </Text>
        </Text>
      </Box>

      <Box flex="1" minW={0}>
        <Rail blocks={blocks} tone={ink === GREEN.ink ? 'dark' : 'light'} />
      </Box>

      <Box flex="none" textAlign="right" minW="76px">
        <Text fontSize="12.5px" fontWeight={600} color={ink}>
          {full ? 'nothing free' : `${freeH % 1 === 0 ? freeH : freeH.toFixed(1)}h free`}
        </Text>
        <HStack spacing={2} justify="flex-end" mt="1px">
          {cell.isToday && (
            <Text fontSize="9.5px" fontWeight={700} letterSpacing="0.1em" color={ink} opacity={0.75}>
              TODAY
            </Text>
          )}
          {offers > 0 && (
            <Text fontSize="9.5px" fontWeight={700} letterSpacing="0.06em" color={ink}>
              {offers} OFFERED
            </Text>
          )}
        </HStack>
      </Box>
    </Box>
  );
};

// The left hand panel. What is happening that day, hour by hour.
const DayDetail = ({ iso, blocks, onAdd, onRemove }) => {
  const [from, setFrom] = useState(12 * 60);
  const [to, setTo] = useState(16 * 60);
  const [note, setNote] = useState('');
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min);
  const pct = Math.round(fullness(blocks) * 100);

  if (!iso) {
    return (
      <Plate>
        <Text fontSize="14.5px" color={P.inkFaint}>
          Pick a day on the right and fill in what is happening in it.
        </Text>
      </Plate>
    );
  }

  const d = new Date(`${iso}T12:00`);
  return (
    <Plate>
      <Kicker>{pct === 0 ? 'wide open' : `${pct}% spoken for`}</Kicker>
      <Text mt={1} fontSize="21px" fontWeight={600} color={P.ink} letterSpacing="-0.02em">
        {longDay(d)}
      </Text>

      <Box mt={4}>
        <Rail blocks={blocks} tone="dark" />
        <HStack justify="space-between" mt={1.5}>
          <Text fontSize="10px" color={P.inkFaint}>{fmtMinutes(DAY_START)}</Text>
          <Text fontSize="10px" color={P.inkFaint}>{fmtMinutes(DAY_END)}</Text>
        </HStack>
      </Box>

      <VStack spacing={1.5} align="stretch" mt={5}>
        {sorted.length === 0 && (
          <Text fontSize="13.5px" color={P.inkFaint}>Nothing in it yet.</Text>
        )}
        {sorted.map((b) => (
          <HStack key={b.id} spacing={3} p={2.5} borderRadius="10px" bg={GREEN.free} align="start">
            <Box w="3px" alignSelf="stretch" minH="30px" borderRadius="2px" bg={GREEN.edge} flex="none" />
            <Box flex="1" minW={0}>
              <Text fontSize="13px" fontWeight={700} color={GREEN.ink}>
                {fmtMinutes(b.start_min)} to {fmtMinutes(b.end_min)}
              </Text>
              {b.note && <Text fontSize="13px" color={GREEN.ink} opacity={0.8}>{b.note}</Text>}
            </Box>
            <IconButton
              aria-label="Take it out" size="xs" variant="ghost" color={GREEN.ink}
              icon={<Icon as={TbTrash} boxSize="14px" />} onClick={() => onRemove(b.id)}
            />
          </HStack>
        ))}
      </VStack>

      <Box mt={5} pt={4} borderTop="1px solid" borderColor={P.hairSoft}>
        <Kicker>Put something in</Kicker>
        <HStack spacing={2} mt={2}>
          <Select size="sm" h={FIELD_H_SM} value={from} borderColor={P.hair} fontSize="13.5px"
            onChange={(e) => { const v = Number(e.target.value); setFrom(v); if (to <= v) setTo(Math.min(v + 60, DAY_END)); }}>
            {EDGES.slice(0, -1).map((m) => <option key={m} value={m}>{fmtMinutes(m)}</option>)}
          </Select>
          <Text fontSize="13px" color={P.inkFaint} flex="none">to</Text>
          <Select size="sm" h={FIELD_H_SM} value={to} borderColor={P.hair} fontSize="13.5px"
            onChange={(e) => setTo(Number(e.target.value))}>
            {EDGES.filter((m) => m > from).map((m) => <option key={m} value={m}>{fmtMinutes(m)}</option>)}
          </Select>
        </HStack>
        <HStack spacing={2} mt={2}>
          <Input size="sm" h={FIELD_H_SM} value={note} placeholder="What is it. Only the studio sees this."
            borderColor={P.hair} fontSize="13.5px" bg={P.sheet}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(iso, from, to, note); setNote(''); } }} />
          <Button size="sm" h={FIELD_H_SM} flex="none"
            leftIcon={<Icon as={TbPlus} boxSize="14px" />}
            onClick={() => { onAdd(iso, from, to, note); setNote(''); }}>
            Add
          </Button>
        </HStack>
      </Box>
    </Plate>
  );
};

export default function Daylight() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState({});
  const [offers, setOffers] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);
  const [copied, setCopied] = useState(null);
  const [newLabel, setNewLabel] = useState('');

  const board = useMemo(() => buildBoard(new Date()), []);
  const from = board[0][0].iso;
  const to = board[board.length - 1][6].iso;

  const load = useCallback(async () => {
    const [b, o, l] = await Promise.all([
      supabase.from('daylight_blocks').select('id, day, start_min, end_min, note')
        .gte('day', from).lte('day', to).order('start_min', { ascending: true }),
      supabase.from('daylight_offers')
        .select('id, day, start_min, minutes, meeting_type, note, status, link_id')
        .eq('status', 'new').gte('day', from).order('day', { ascending: true }),
      supabase.from('daylight_links').select('id, token, label, created_at')
        .is('revoked_at', null).order('created_at', { ascending: false }),
    ]);
    const map = {};
    for (const row of b.data || []) (map[row.day] ||= []).push(row);
    setBlocks(map);
    setOffers(o.data || []);
    setLinks(l.data || []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const addBlock = useCallback(async (day, startMin, endMin, note) => {
    if (!(endMin > startMin)) return;
    const { data } = await supabase.from('daylight_blocks')
      .insert({ day, start_min: startMin, end_min: endMin, note: (note || '').trim() || null, created_by: user?.id || null })
      .select().single();
    if (data) setBlocks((p) => ({ ...p, [day]: [...(p[day] || []), data].sort((a, b) => a.start_min - b.start_min) }));
  }, [user]);

  const removeBlock = useCallback(async (id) => {
    await supabase.from('daylight_blocks').delete().eq('id', id);
    setBlocks((p) => {
      const copy = {};
      for (const [k, v] of Object.entries(p)) copy[k] = v.filter((b) => b.id !== id);
      return copy;
    });
  }, []);

  const makeLink = useCallback(async () => {
    const label = newLabel.trim();
    if (!label) return;
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);     // never Math.random, this is the whole credential
    const token = Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
    const { data } = await supabase.from('daylight_links')
      .insert({ token, label, created_by: user?.id || null }).select().single();
    if (data) { setLinks((p) => [data, ...p]); setNewLabel(''); }
  }, [newLabel, user]);

  const revoke = useCallback(async (id) => {
    await supabase.from('daylight_links').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    setLinks((p) => p.filter((l) => l.id !== id));
  }, []);

  const copy = useCallback(async (token, id) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/daylight/${token}/`);
      setCopied(id); setTimeout(() => setCopied(null), 1600);
    } catch (e) { /* no clipboard, the row prints the path */ }
  }, []);

  const offersByDay = useMemo(() => {
    const m = {};
    for (const o of offers) m[o.day] = (m[o.day] || 0) + 1;
    return m;
  }, [offers]);

  const labelFor = useCallback((id) => links.find((l) => l.id === id)?.label || 'Someone', [links]);

  if (loading) return <Page><Loading label="reading the weeks" /></Page>;

  const spokenFor = board.flat().filter((c) => (blocks[c.iso] || []).length > 0).length;

  return (
    <Page>
      <PageHead
        kicker="Daylight"
        title="The next three weeks"
        lede={spokenFor
          ? `${spokenFor} of the next ${HORIZON_DAYS} days have something in them. Pick a day and fill in its hours.`
          : `Every day is open. Pick one and put something in it.`}
      />

      <Section rule={false}>
        <Box display="grid" gap={{ base: 4, md: 6 }}
          gridTemplateColumns={{ base: '1fr', md: '360px 1fr' }} alignItems="start">
          <Box position={{ md: 'sticky' }} top={{ md: '16px' }}>
            <DayDetail
              iso={picked}
              blocks={picked ? (blocks[picked] || []) : []}
              onAdd={addBlock}
              onRemove={removeBlock}
            />
          </Box>

          <VStack spacing="6px" align="stretch">
            {board.flat().map((c) => (
              <DayBar
                key={c.iso}
                cell={c}
                blocks={blocks[c.iso] || []}
                picked={picked === c.iso}
                offers={offersByDay[c.iso] || 0}
                onPick={(iso) => setPicked(iso === picked ? null : iso)}
              />
            ))}
          </VStack>
        </Box>
      </Section>

      <Section kicker="Offered back" count={offers.length}>
        {offers.length === 0 ? (
          <Empty hint="When somebody with a link picks a time, it lands here.">Nothing offered yet</Empty>
        ) : (
          <VStack spacing={2} align="stretch">
            {offers.map((o) => {
              const t = typeOf(o.meeting_type);
              return (
                <Plate key={o.id}>
                  <HStack justify="space-between" align="start" spacing={4} flexWrap="wrap">
                    <HStack spacing={3} align="start">
                      <Box w="3px" alignSelf="stretch" minH="34px" borderRadius="2px" bg={t.accent} flex="none" />
                      <Box>
                        <Text fontSize="14.5px" fontWeight={600} color={P.ink}>{labelFor(o.link_id)}</Text>
                        <Text fontSize="13px" color={P.inkMuted}>
                          {longDay(new Date(`${o.day}T12:00`))} at {fmtMinutes(o.start_min)} · {t.verb} · {o.minutes} min
                        </Text>
                        {o.note && <Text mt={1} fontSize="13px" color={P.inkFaint}>{o.note}</Text>}
                      </Box>
                    </HStack>
                    <HStack spacing={2}>
                      <Button size="sm" h={FIELD_H_SM} variant="outline"
                        leftIcon={<Icon as={TbCalendarPlus} boxSize="15px" />}
                        onClick={() => {
                          // The calendar owns what an appointment is. Hand it the day
                          // and the time and let its own modal write the row, so this
                          // page never invents a second kind of meeting.
                          const q = new URLSearchParams({
                            day: o.day,
                            time: `${String(Math.floor(o.start_min / 60)).padStart(2, '0')}:${String(o.start_min % 60).padStart(2, '0')}`,
                            type: o.meeting_type, minutes: String(o.minutes), from_offer: o.id,
                          });
                          window.location.href = `/calendar/?${q.toString()}`;
                        }}>
                        Put it on the calendar
                      </Button>
                      <Button size="sm" h={FIELD_H_SM} variant="ghost" color={P.inkFaint}
                        onClick={async () => {
                          await supabase.from('daylight_offers').update({ status: 'passed' }).eq('id', o.id);
                          setOffers((p) => p.filter((x) => x.id !== o.id));
                        }}>
                        Pass
                      </Button>
                    </HStack>
                  </HStack>
                </Plate>
              );
            })}
          </VStack>
        )}
      </Section>

      <Section kicker="Links you have shared" count={links.length}>
        <HStack spacing={2} mb={3}>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') makeLink(); }}
            placeholder="Who is it for, for example Jazz Janda"
            h={FIELD_H_SM} bg={P.sheet} borderColor={P.hair} fontSize="14px" maxW="340px" />
          <Button size="sm" h={FIELD_H_SM} onClick={makeLink} isDisabled={!newLabel.trim()}
            leftIcon={<Icon as={TbLink} boxSize="15px" />}>
            Make a link
          </Button>
        </HStack>

        {links.length === 0 ? (
          <Empty hint="A link shows these three weeks and lets them offer a time back. It never shows your notes.">
            No links yet
          </Empty>
        ) : (
          <VStack spacing={2} align="stretch">
            {links.map((l) => (
              <Plate key={l.id}>
                <HStack justify="space-between" spacing={4} flexWrap="wrap">
                  <Box minW={0}>
                    <Text fontSize="14.5px" fontWeight={600} color={P.ink}>{l.label}</Text>
                    <Text fontSize="12.5px" color={P.inkFaint} fontFamily="mono" wordBreak="break-all">
                      /daylight/{l.token}/
                    </Text>
                  </Box>
                  <HStack spacing={2}>
                    <Button size="sm" h={FIELD_H_SM} variant="outline"
                      leftIcon={<Icon as={copied === l.id ? TbCheck : TbCopy} boxSize="15px" />}
                      onClick={() => copy(l.token, l.id)}>
                      {copied === l.id ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button size="sm" h={FIELD_H_SM} variant="ghost" color={P.inkFaint}
                      leftIcon={<Icon as={TbTrash} boxSize="15px" />} onClick={() => revoke(l.id)}>
                      Revoke
                    </Button>
                  </HStack>
                </HStack>
              </Plate>
            ))}
          </VStack>
        )}
      </Section>
    </Page>
  );
}
