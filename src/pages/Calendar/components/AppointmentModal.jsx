// src/pages/Calendar/components/AppointmentModal.jsx
// SENTINEL: NB_APPT_MODAL_V2
//
// Create, edit, remind and cancel one appointment, on Paper. This is where the
// operator "clicks and sets" a meeting. It owns the write AND the notify call so
// the calendar page stays a view:
//   - writes the appointments row (client-side, RLS)
//   - then hits /.netlify/functions/send-appointment for everything that leaves
//     the building (client invite + .ics, team heads-up, portal note)
//
// SIGNING, matched to Messages: the client-facing invite and the portal note go
// out signed as that client's stable burro (personaForClient), so their email
// and their thread show the same face. The internal team email names the real
// operator via bookedBy. Internal appointments (no client) skip the persona and
// the portal note.
//
// TIME: the operator's date + time are read as THEIR local wall time
// (combineLocal), stored as an absolute instant, and stamped with the operator's
// resolved zone. The invite and the .ics convert automatically for the client,
// so there is nothing to reconcile and no off-by-one.
//
// V2, 2026-09-25. The fields are the house fields from the theme, the labels
// are the house field label. No local field style. No oxford commas, no
// dashes.

import { useState, useEffect, useMemo } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, VStack, HStack, Text, Input, Button, Textarea,
  Box, SimpleGrid, Icon, useToast,
} from '@chakra-ui/react';
import DotSelect from '../../../components/common/DotSelect';
import { Field, FieldLabel, Kicker } from '../../../components/common/Page';
import {
  TbPhone, TbVideo, TbMapPin, TbRefresh, TbBell, TbTrash, TbCalendarPlus, TbCopy, TbCheck,
} from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import { personaForClient } from '../../../lib/personas';
import {
  MEETING_TYPES, typeOf, DURATIONS, ymd, combineLocal, buildVideoRoom, endFrom, fmtTime,
} from '../calendarConstants';

const P = colors.paper;
const BROWSER_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'America/Denver'; } })();
const TZ_SHORT = (() => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || BROWSER_TZ;
  } catch (e) { return BROWSER_TZ; }
})();

const TYPE_ICON = { call: TbPhone, video: TbVideo, in_person: TbMapPin };
const PICKER = { '&::-webkit-calendar-picker-indicator': { filter: 'invert(0.3)' } };

const NotifyToggle = ({ on, disabled, onClick, icon, children }) => (
  <Box
    as="button" type="button" onClick={disabled ? undefined : onClick}
    px={3} py={2} borderRadius="lg" border="1px solid" flex={1}
    borderColor={on && !disabled ? 'transparent' : P.hair}
    bg={on && !disabled ? P.lime : 'transparent'}
    opacity={disabled ? 0.4 : 1} cursor={disabled ? 'not-allowed' : 'pointer'}
    transition={`all ${FAST} ${EASE}`} _hover={{ borderColor: disabled ? P.hair : (on ? 'transparent' : P.inkFaint) }}
  >
    <HStack spacing={1.5}>
      <Icon as={icon} boxSize={3.5} color={on && !disabled ? P.limeInk : P.inkMuted} />
      <Text fontSize={TYPE.kicker} fontWeight="500" fontFamily="mono" letterSpacing="0.1em" textTransform="uppercase" color={on && !disabled ? P.limeInk : P.inkMuted}>
        {children}
      </Text>
    </HStack>
  </Box>
);

const AppointmentModal = ({ isOpen, onClose, clients = [], appointment = null, initialDate = null, user, onSaved }) => {
  const toast = useToast();
  const isEdit = Boolean(appointment?.id);

  const [type, setType] = useState('call');
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [description, setDescription] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [notifyTeam, setNotifyTeam] = useState(true);
  const [postPortal, setPostPortal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const client = useMemo(() => clients.find((c) => c.id === clientId) || null, [clients, clientId]);
  const clientHasEmail = Boolean(client?.email);

  // Seed state whenever the modal opens or its subject changes.
  useEffect(() => {
    if (!isOpen) return;
    if (appointment?.id) {
      const s = new Date(appointment.starts_at);
      const e = new Date(appointment.ends_at);
      setType(appointment.meeting_type || 'call');
      setTitle(appointment.title || '');
      setClientId(appointment.client_id || '');
      setDate(ymd(s));
      setTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`);
      setDuration(Math.max(15, Math.round((e - s) / 60000)) || 30);
      setLocation(appointment.location || '');
      setMeetingUrl(appointment.meeting_url || '');
      setDescription(appointment.description || '');
      setNotifyClient(false); setNotifyTeam(false); setPostPortal(false);
    } else {
      setType('call');
      setTitle('');
      setClientId('');
      setDate(initialDate || ymd(new Date()));
      setTime('09:00');
      setDuration(30);
      setLocation('');
      setMeetingUrl('');
      setDescription('');
      setNotifyClient(true); setNotifyTeam(true); setPostPortal(true);
    }
  }, [isOpen, appointment, initialDate]);

  // A video appointment always has a room. Generate one lazily.
  useEffect(() => {
    if (type === 'video' && !meetingUrl) setMeetingUrl(buildVideoRoom(client?.name));
  }, [type, meetingUrl, client]);

  const tCfg = typeOf(type);
  const startPreview = date && time ? combineLocal(date, time).toISOString() : null;
  const endPreview = startPreview ? endFrom(startPreview, duration) : null;

  const copyRoom = async () => {
    try { await navigator.clipboard.writeText(meetingUrl); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch (e) { /* noop */ }
  };

  const persist = async () => {
    const starts = combineLocal(date, time).toISOString();
    const ends = endFrom(starts, duration);
    const row = {
      client_id: clientId || null,
      title: title.trim(),
      description: description.trim() || null,
      meeting_type: type,
      starts_at: starts,
      ends_at: ends,
      location: type === 'in_person' ? (location.trim() || null) : null,
      meeting_url: type === 'video' ? meetingUrl : null,
      timezone: BROWSER_TZ,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    };
    if (isEdit) {
      const { data, error } = await supabase.from('appointments').update(row).eq('id', appointment.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from('appointments').insert({ ...row, created_by: user?.id || null }).select().single();
    if (error) throw error;
    return data;
  };

  const notify = async (appointmentId, mode) => {
    const persona = clientId ? personaForClient(clientId) : null;
    let bookedBy = 'the team';
    try {
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', user?.id).single();
      if (prof?.display_name) bookedBy = prof.display_name;
    } catch (e) { /* noop */ }
    const res = await fetch('/.netlify/functions/send-appointment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId, mode,
        sendClient: mode === 'reminder' ? true : (notifyClient && clientHasEmail),
        notifyTeam: mode === 'reminder' ? false : notifyTeam,
        postPortal: mode === 'reminder' ? Boolean(clientId) : (postPortal && Boolean(clientId)),
        senderId: user?.id || null,
        senderName: persona ? persona.name : 'Neon Burro',
        bookedBy,
        personaId: persona ? persona.id : null,
      }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Notify failed'); }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: 'Give it a title', status: 'warning', duration: 2000 }); return; }
    if (!date || !time) { toast({ title: 'Pick a date and time', status: 'warning', duration: 2000 }); return; }
    setSaving(true);
    try {
      const saved = await persist();
      const willNotify = !isEdit && (notifyClient || notifyTeam || postPortal);
      if (willNotify) {
        try { await notify(saved.id, 'invite'); }
        catch (e) { toast({ title: 'Saved, but the invite did not send', description: e.message, status: 'warning', duration: 5000 }); }
      }
      toast({
        title: isEdit ? 'Appointment updated' : (willNotify ? 'Scheduled and sent' : 'Scheduled'),
        status: 'success', duration: 2500,
      });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, status: 'error', duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleReminder = async () => {
    setSaving(true);
    try {
      await notify(appointment.id, 'reminder');
      toast({ title: 'Reminder sent', status: 'success', duration: 2500 });
      onSaved?.(appointment);
      onClose();
    } catch (e) {
      toast({ title: 'Could not send reminder', description: e.message, status: 'error', duration: 5000 });
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this appointment? It stays on record but drops off the calendar.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('appointments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', appointment.id);
      if (error) throw error;
      toast({ title: 'Appointment cancelled', status: 'info', duration: 2500 });
      onSaved?.({ ...appointment, status: 'cancelled' });
      onClose();
    } catch (e) {
      toast({ title: 'Could not cancel', description: e.message, status: 'error', duration: 4000 });
    } finally { setSaving(false); }
  };

  const primaryLabel = isEdit
    ? 'Save changes'
    : (notifyClient || notifyTeam || postPortal) ? 'Schedule and send' : 'Schedule';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }} isCentered scrollBehavior="inside">
      <ModalOverlay bg="rgba(36,26,22,0.55)" backdropFilter="blur(3px)" />
      <ModalContent bg={P.mat} borderRadius={{ base: 0, md: '2xl' }} border="1px solid" borderColor={P.hair} overflow="hidden" mx={{ base: 0, md: 4 }} my={{ base: 0, md: 'auto' }}>
        <ModalHeader pb={2}>
          <Kicker color={tCfg.accent}>
            {isEdit ? 'Edit appointment' : 'New appointment'}
          </Kicker>
          <Text fontSize={TYPE.section} fontWeight="700" color={P.ink} letterSpacing="-0.01em" mt={1}>
            {isEdit ? (title || 'Appointment') : 'Set a meeting'}
          </Text>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={4} />

        <ModalBody>
          <VStack spacing={4} align="stretch" pb={2}>

            <HStack spacing={2}>
              {MEETING_TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <Box
                    key={t.id} as="button" type="button" onClick={() => setType(t.id)}
                    flex={1} py={3} px={3} textAlign="left" borderRadius="xl" border="1px solid"
                    borderColor={on ? t.accent : P.hair} bg={on ? t.tint : 'transparent'}
                    transition={`all ${FAST} ${EASE}`} _hover={{ borderColor: on ? t.accent : P.inkFaint }}
                  >
                    <HStack spacing={2}>
                      <Icon as={TYPE_ICON[t.id]} boxSize={4} color={on ? t.accent : P.inkMuted} />
                      <Text fontSize={TYPE.small} fontWeight="700" color={on ? t.accent : P.inkMuted}>{t.label}</Text>
                    </HStack>
                  </Box>
                );
              })}
            </HStack>
            <Text fontSize={TYPE.small} color={P.inkFaint} mt={-2}>{tCfg.hint}</Text>

            <Field label="What is it">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kickoff call, design review, site walkthrough" autoFocus />
            </Field>

            <Field label="Client">
              <DotSelect
                value={clientId}
                onChange={setClientId}
                placeholder="Internal, no client"
                options={[
                  { value: '', label: 'Internal, no client' },
                  ...clients.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ` · ${c.company}` : ''}` })),
                ]}
              />
            </Field>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} sx={PICKER} />
              </Field>
              <Field label="Start">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} sx={PICKER} />
              </Field>
              <Field label="Length">
                <DotSelect
                  value={duration}
                  onChange={(v) => setDuration(Number(v))}
                  options={DURATIONS.map((d) => ({ value: d.min, label: d.label }))}
                />
              </Field>
            </SimpleGrid>

            {startPreview && (
              <Text fontSize={TYPE.small} color={P.inkMuted} mt={-2}>
                {fmtTime(startPreview)} to {fmtTime(endPreview)} · read in your time, {TZ_SHORT}. The invite and calendar file convert for the client.
              </Text>
            )}

            {type === 'in_person' && (
              <Field label="Where">
                <Textarea minH="72px" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address or place. The Ridgway shop, a coffee spot, their office" />
              </Field>
            )}
            {type === 'video' && (
              <Box bg={tCfg.tint} border="1px solid" borderColor={`${tCfg.accent}55`} borderRadius="xl" p={3.5}>
                <HStack justify="space-between" mb={2}>
                  <FieldLabel mb={0} color={tCfg.accent}>Video room</FieldLabel>
                  <HStack spacing={1}>
                    <Box as="button" type="button" onClick={copyRoom} px={2} py={1} borderRadius="md" _hover={{ bg: `${tCfg.accent}22` }}>
                      <HStack spacing={1}><Icon as={copied ? TbCheck : TbCopy} boxSize={3} color={tCfg.accent} /><Text fontSize={TYPE.label} fontFamily="mono" color={tCfg.accent}>{copied ? 'Copied' : 'Copy'}</Text></HStack>
                    </Box>
                    <Box as="button" type="button" onClick={() => setMeetingUrl(buildVideoRoom(client?.name))} px={2} py={1} borderRadius="md" _hover={{ bg: `${tCfg.accent}22` }}>
                      <HStack spacing={1}><Icon as={TbRefresh} boxSize={3} color={tCfg.accent} /><Text fontSize={TYPE.label} fontFamily="mono" color={tCfg.accent}>New link</Text></HStack>
                    </Box>
                  </HStack>
                </HStack>
                <Text fontSize={TYPE.small} fontFamily="mono" color={P.inkSec} wordBreak="break-all">{meetingUrl}</Text>
                <Text fontSize={TYPE.label} color={P.inkFaint} mt={1.5}>Jitsi Meet. No account, opens in any browser, nothing to install. Sent with the invite.</Text>
              </Box>
            )}
            {type === 'call' && (
              <Text fontSize={TYPE.small} color={P.inkMuted}>
                {client?.phone ? `We ring ${client.name?.split(' ')[0] || 'them'} at ${client.phone}.` : 'We call the number on the client file. Add a phone on the client to include it in the invite.'}
              </Text>
            )}

            <Field label="What it is about">
              <Textarea minH="80px" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line or two the client sees in the invite. Agenda, what to bring, what we will cover." />
            </Field>

            {!isEdit && (
              <Field label="When I schedule this">
                <HStack spacing={2} align="stretch">
                  <NotifyToggle on={notifyClient} disabled={!clientHasEmail} onClick={() => setNotifyClient((v) => !v)} icon={TbCalendarPlus}>Email client</NotifyToggle>
                  <NotifyToggle on={notifyTeam} onClick={() => setNotifyTeam((v) => !v)} icon={TbBell}>Notify me</NotifyToggle>
                  <NotifyToggle on={postPortal} disabled={!clientId} onClick={() => setPostPortal((v) => !v)} icon={TbCheck}>Post to portal</NotifyToggle>
                </HStack>
                {!clientHasEmail && clientId && (
                  <Text fontSize={TYPE.label} color={P.gold}>This client has no email on file, so no invite goes out.</Text>
                )}
              </Field>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} flexWrap="wrap" gap={2}>
          {isEdit && (
            <HStack spacing={2} mr="auto">
              <Button variant="ghost" size="sm" leftIcon={<TbBell size={15} />} onClick={handleReminder} isDisabled={saving || !clientHasEmail}>
                Send reminder
              </Button>
              <Button variant="ghost" size="sm" color={P.coral} leftIcon={<TbTrash size={15} />} onClick={handleCancel} isDisabled={saving} _hover={{ bg: `${P.coral}14`, color: P.coral }}>
                Cancel it
              </Button>
            </HStack>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} isDisabled={saving}>
            Close
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} loadingText={isEdit ? 'Saving' : 'Scheduling'}>
            {primaryLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AppointmentModal;
