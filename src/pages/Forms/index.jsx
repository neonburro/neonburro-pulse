// src/pages/Forms/index.jsx
// Forms inbox, on Paper. Every submission type in one place, a split-pane on
// desktop (list ~420px, detail flex), a full-screen sheet on a phone. Realtime
// on both submissions and replies. The reply modal has a Write and a Preview so
// nothing goes to a lead without the team seeing the exact email first, the same
// buildReplyEmailHTML the function sends. Form-type colors carry meaning and are
// kept. No oxford commas, no dashes.

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Input, Center, Spinner,
  Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton,
  Textarea, Button, useToast, Divider, IconButton, Tooltip, Container,
} from '@chakra-ui/react';
import {
  TbInbox, TbSearch, TbArchive, TbArchiveOff, TbSend, TbArrowLeft,
  TbCircleCheck, TbCircleDashed, TbHistory, TbEdit, TbEye, TbTrash, TbAlertTriangle,
} from 'react-icons/tb';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import colors from '../../theme/colors';
import { FORM_TYPE_LABELS, FORM_TYPE_COLORS } from '../../lib/uiConstants';
import { buildReplyEmailHTML } from '../../lib/replyEmailTemplate';

const P = colors.paper;
const FALLBACK_COLOR = P.inkMuted;

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'unread',    label: 'Unread' },
  { key: 'responded', label: 'Responded' },
  { key: 'archived',  label: 'Archived' },
];

const getSenderName = (s) => s.name || s.metadata?.name || s.metadata?.full_name || s.metadata?.contact_name || 'Anonymous';
const getSenderEmail = (s) => s.email || s.metadata?.email || s.metadata?.contact_email || null;
const getPreviewMessage = (s) =>
  s.message || s.metadata?.message || s.metadata?.description || s.metadata?.brief || s.metadata?.request || s.metadata?.notes || '';

// ============================================================
// MAIN
// ============================================================
const Forms = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [submissions, setSubmissions] = useState([]);
  const [replies, setReplies] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  useEffect(() => {
    fetchAll();
    const submissionsChannel = supabase.channel('form_submissions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_submissions' }, () => fetchAll())
      .subscribe();
    const repliesChannel = supabase.channel('form_replies_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_replies' }, () => fetchReplies())
      .subscribe();
    return () => {
      supabase.removeChannel(submissionsChannel);
      supabase.removeChannel(repliesChannel);
    };
  }, []);

  const groupReplies = (rows) => {
    const grouped = {};
    (rows || []).forEach((r) => {
      if (!grouped[r.submission_id]) grouped[r.submission_id] = [];
      grouped[r.submission_id].push(r);
    });
    return grouped;
  };

  const fetchAll = async () => {
    const [subsRes, repsRes] = await Promise.all([
      supabase.from('form_submissions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('form_replies').select('*').order('created_at', { ascending: false }),
    ]);
    if (subsRes.data) setSubmissions(subsRes.data);
    if (repsRes.data) setReplies(groupReplies(repsRes.data));
    setLoading(false);
  };

  const fetchReplies = async () => {
    const { data } = await supabase.from('form_replies').select('*').order('created_at', { ascending: false });
    if (data) setReplies(groupReplies(data));
  };

  const filtered = useMemo(() => submissions.filter((s) => {
    if (statusFilter === 'unread' && s.status !== 'unread') return false;
    if (statusFilter === 'responded' && s.status !== 'responded') return false;
    if (statusFilter === 'archived' && !s.archived_at) return false;
    if (statusFilter === 'all' && s.archived_at) return false;
    if (typeFilter && s.form_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = [s.name, s.email, s.message, s.phone, s.company, s.metadata?.name, s.metadata?.email, s.metadata?.message, s.metadata?.description, s.metadata?.brief]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [submissions, statusFilter, typeFilter, search]);

  const selected = useMemo(() => submissions.find((s) => s.id === selectedId) || null, [submissions, selectedId]);
  const selectedReplies = selected ? (replies[selected.id] || []) : [];

  const counts = useMemo(() => ({
    all: submissions.filter((s) => !s.archived_at).length,
    unread: submissions.filter((s) => s.status === 'unread' && !s.archived_at).length,
    responded: submissions.filter((s) => s.status === 'responded').length,
    archived: submissions.filter((s) => !!s.archived_at).length,
  }), [submissions]);

  const typesPresent = useMemo(() => {
    const set = new Set();
    submissions.forEach((s) => { if (s.form_type) set.add(s.form_type); });
    return Array.from(set);
  }, [submissions]);

  const handleSelect = async (submission) => {
    setSelectedId(submission.id);
    if (window.innerWidth < 992) setMobileDetailOpen(true);
    if (submission.status === 'unread') {
      await supabase.from('form_submissions').update({ status: 'read', viewed_at: new Date().toISOString(), viewed_by: user?.id }).eq('id', submission.id);
      setSubmissions((prev) => prev.map((s) => (s.id === submission.id ? { ...s, status: 'read' } : s)));
    }
  };

  const handleArchive = async (id) => {
    const at = new Date().toISOString();
    await supabase.from('form_submissions').update({ archived_at: at }).eq('id', id);
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, archived_at: at } : s)));
    if (selectedId === id) setSelectedId(null);
    toast({ title: 'Archived', status: 'success', duration: 1500 });
  };

  const handleUnarchive = async (id) => {
    await supabase.from('form_submissions').update({ archived_at: null }).eq('id', id);
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, archived_at: null } : s)));
    toast({ title: 'Unarchived', status: 'success', duration: 1500 });
  };

  // Hard delete, only offered from the archive. Clears the replies first so the
  // foreign key does not block, drops the submission, logs the removal.
  const handleDeleteForever = async (id) => {
    try {
      await supabase.from('form_replies').delete().eq('submission_id', id);
      const { error } = await supabase.from('form_submissions').delete().eq('id', id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'form_submission_deleted',
        entity_type: 'form_submission',
        entity_id: id,
        metadata: { hard_delete: true },
        created_at: new Date().toISOString(),
      });
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast({ title: 'Deleted forever', status: 'info', duration: 1800 });
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, status: 'error', duration: 4000 });
    }
  };

  const handleMarkUnread = async (id) => {
    await supabase.from('form_submissions').update({ status: 'unread', viewed_at: null, viewed_by: null }).eq('id', id);
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'unread' } : s)));
  };

  return (
    <Box position="relative" minH="100vh" bg={P.mat}>
      <Box position="absolute" top={0} left={0} right={0} h="300px" bg={`radial-gradient(ellipse at top center, ${P.lime}12, transparent 70%)`} pointerEvents="none" />

      <Container maxW="1500px" mx={0} px={{ base: 5, md: 8 }} py={{ base: 6, md: 10 }} position="relative">
        <VStack align="stretch" spacing={5} mb={6}>
          <VStack align="start" spacing={2}>
            <Text fontFamily="mono" fontSize="2xs" fontWeight="600" letterSpacing="0.22em" textTransform="uppercase" color={P.inkMuted}>Forms</Text>
            <HStack align="baseline" spacing={3}>
              <Text fontFamily="display" fontSize={{ base: '4xl', md: '5xl' }} fontWeight="500" color={P.ink} lineHeight="1">{counts.unread}</Text>
              <Text fontFamily="mono" fontSize="sm" color={P.inkMuted} pb={1}>unread</Text>
            </HStack>
          </VStack>

          <HStack spacing={2} flexWrap="wrap" rowGap={2}>
            {STATUS_FILTERS.map((f) => (
              <FilterPill key={f.key} active={statusFilter === f.key} onClick={() => setStatusFilter(f.key)} count={counts[f.key]}>{f.label}</FilterPill>
            ))}
            {typesPresent.length > 0 && (
              <>
                <Box w="1px" h="20px" bg={P.hair} mx={2} alignSelf="center" />
                <FilterPill active={typeFilter === null} onClick={() => setTypeFilter(null)}>All types</FilterPill>
                {typesPresent.map((t) => (
                  <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t === typeFilter ? null : t)} color={FORM_TYPE_COLORS[t]}>{FORM_TYPE_LABELS[t] || t}</FilterPill>
                ))}
              </>
            )}
          </HStack>

          <HStack bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="full" px={5} h="50px" spacing={2} _focusWithin={{ borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}22` }}>
            <Icon as={TbSearch} color={P.inkMuted} boxSize={4} />
            <Input placeholder="Search by name, email, or message..." variant="unstyled" fontSize="sm" color={P.ink} value={search} onChange={(e) => setSearch(e.target.value)} _placeholder={{ color: P.inkFaint }} />
          </HStack>
        </VStack>

        {loading ? (
          <Center py={20}><Spinner size="md" color={P.limeDeep} thickness="2px" /></Center>
        ) : (
          <HStack align="start" spacing={6} minH="60vh">
            <Box w={{ base: '100%', lg: '420px' }} flexShrink={0} borderTop="1px solid" borderColor={P.hair} maxH="calc(100vh - 280px)" overflowY="auto">
              {filtered.length === 0 ? (
                <VStack py={16} spacing={2}>
                  <Icon as={TbInbox} boxSize={8} color={P.inkFaint} />
                  <Text color={P.inkMuted} fontSize="sm" fontWeight="700">Nothing here</Text>
                  <Text color={P.inkFaint} fontSize="xs">
                    {statusFilter === 'unread' ? "You're all caught up" : statusFilter === 'archived' ? 'No archived submissions' : 'No submissions match these filters'}
                  </Text>
                </VStack>
              ) : (
                filtered.map((s) => (
                  <ListRow key={s.id} submission={s} replyCount={s.reply_count || 0} selected={s.id === selectedId} onClick={() => handleSelect(s)} />
                ))
              )}
            </Box>

            <Box display={{ base: 'none', lg: 'block' }} flex={1} minW={0}>
              {selected ? (
                <DetailPane submission={selected} replies={selectedReplies} onReply={() => setReplyOpen(true)} onArchive={() => handleArchive(selected.id)} onUnarchive={() => handleUnarchive(selected.id)} onMarkUnread={() => handleMarkUnread(selected.id)} onDeleteForever={() => handleDeleteForever(selected.id)} />
              ) : (
                <EmptyDetail />
              )}
            </Box>
          </HStack>
        )}
      </Container>

      <Modal isOpen={mobileDetailOpen && !!selected} onClose={() => setMobileDetailOpen(false)} size="full" motionPreset="slideInRight">
        <ModalOverlay />
        <ModalContent bg={P.mat} m={0} borderRadius={0} color={P.ink}>
          <ModalBody p={0}>
            {selected && (
              <Box>
                <HStack p={4} borderBottom="1px solid" borderColor={P.hair}>
                  <IconButton icon={<TbArrowLeft />} variant="ghost" color={P.inkSec} onClick={() => setMobileDetailOpen(false)} aria-label="Back" size="sm" _hover={{ bg: P.sunken, color: P.ink }} />
                  <Text color={P.ink} fontWeight="700" fontSize="sm">Submission</Text>
                </HStack>
                <Box p={5}>
                  <DetailPane submission={selected} replies={selectedReplies} onReply={() => setReplyOpen(true)} onArchive={() => handleArchive(selected.id)} onUnarchive={() => handleUnarchive(selected.id)} onMarkUnread={() => handleMarkUnread(selected.id)} onDeleteForever={() => handleDeleteForever(selected.id)} />
                </Box>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {selected && (
        <ReplyModal
          isOpen={replyOpen}
          onClose={() => setReplyOpen(false)}
          submission={selected}
          replyCount={selected.reply_count || 0}
          userId={user?.id}
          onSuccess={(updated) => {
            setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
            setReplyOpen(false);
            fetchReplies();
          }}
        />
      )}
    </Box>
  );
};

// ============================================================
// FILTER PILL
// ============================================================
const FilterPill = ({ active, onClick, children, count, color = P.limeDeep }) => (
  <Box as="button" onClick={onClick} px={3} py={1.5} borderRadius="full" bg={active ? P.sheet : 'transparent'} border="1px solid" borderColor={active ? color : P.hair} color={active ? P.ink : P.inkMuted} fontSize="xs" fontFamily="mono" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" transition="all 0.15s" _hover={{ color: P.ink, borderColor: active ? color : P.inkFaint }} display="flex" alignItems="center" gap={1.5}>
    {children}
    {typeof count === 'number' && count > 0 && <Box as="span" color={active ? color : P.inkFaint} fontWeight="800">{count}</Box>}
  </Box>
);

// ============================================================
// LIST ROW
// ============================================================
const ListRow = ({ submission, replyCount, selected, onClick }) => {
  const formType = submission.form_type || 'contact';
  const typeLabel = FORM_TYPE_LABELS[formType] || formType.replace(/_/g, ' ');
  const typeColor = FORM_TYPE_COLORS[formType] || FALLBACK_COLOR;
  const senderName = getSenderName(submission);
  const senderEmail = getSenderEmail(submission);
  const previewMessage = getPreviewMessage(submission);
  const isUnread = submission.status === 'unread';
  const isResponded = submission.status === 'responded';
  const timeAgo = formatDistanceToNow(new Date(submission.created_at), { addSuffix: true });

  return (
    <Box as="button" w="100%" textAlign="left" onClick={onClick} px={4} py={3.5} borderBottom="1px solid" borderColor={P.hairSoft} borderLeft="2px solid" borderLeftColor={selected ? typeColor : isUnread ? typeColor : 'transparent'} bg={selected ? P.sheet : 'transparent'} _hover={{ bg: P.sheet }} transition="all 0.15s">
      <HStack justify="space-between" mb={1}>
        <HStack spacing={2}>
          <Text fontSize="2xs" fontWeight="700" color={typeColor} textTransform="uppercase" letterSpacing="0.08em" fontFamily="mono">{typeLabel}</Text>
          {isResponded && (
            <HStack spacing={0.5}>
              <Icon as={TbCircleCheck} boxSize={3} color={P.green} />
              {replyCount > 1 && <Text color={P.green} fontSize="2xs" fontFamily="mono" fontWeight="800">×{replyCount}</Text>}
            </HStack>
          )}
        </HStack>
        <HStack spacing={1.5}>
          {isUnread && <Box w="6px" h="6px" borderRadius="full" bg={typeColor} />}
          <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">{timeAgo}</Text>
        </HStack>
      </HStack>
      <Text color={isUnread ? P.ink : P.inkSec} fontSize="sm" fontWeight={isUnread ? '700' : '500'} noOfLines={1}>{senderName}</Text>
      {senderEmail && <Text color={P.inkMuted} fontSize="xs" noOfLines={1} fontFamily="mono">{senderEmail}</Text>}
      {previewMessage && <Text color={P.inkMuted} fontSize="xs" noOfLines={1} mt={1}>{previewMessage}</Text>}
    </Box>
  );
};

// ============================================================
// DETAIL PANE
// ============================================================
const DetailPane = ({ submission, replies, onReply, onArchive, onUnarchive, onMarkUnread, onDeleteForever }) => {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [submission.id]);
  const formType = submission.form_type || 'contact';
  const typeLabel = FORM_TYPE_LABELS[formType] || formType.replace(/_/g, ' ');
  const typeColor = FORM_TYPE_COLORS[formType] || FALLBACK_COLOR;
  const senderName = getSenderName(submission);
  const senderEmail = getSenderEmail(submission);
  const isResponded = submission.status === 'responded';
  const isArchived = !!submission.archived_at;
  const replyCount = submission.reply_count || 0;

  const skipMetadataKeys = new Set(['form_type', 'submitted_at', 'ip', 'user_agent', '_internal', 'website', 'source', 'form', 'name', 'email', 'contact_name', 'contact_email', 'full_name', 'message', 'phone', 'company']);
  const fields = [];
  const addField = (label, value) => { if (value === null || value === undefined || value === '') return; fields.push({ label, value }); };
  if (senderName && senderName !== 'Anonymous') addField('Name', senderName);
  if (senderEmail) addField('Email', senderEmail);
  if (submission.phone) addField('Phone', submission.phone);
  if (submission.company) addField('Company', submission.company);
  if (submission.message) addField('Message', submission.message);
  if (submission.metadata && typeof submission.metadata === 'object') {
    Object.entries(submission.metadata).forEach(([k, v]) => {
      if (skipMetadataKeys.has(k)) return;
      if (v === null || v === undefined || v === '') return;
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const display = typeof v === 'object' ? JSON.stringify(v, null, 2) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
      addField(label, display);
    });
  }

  return (
    <VStack align="stretch" spacing={5}>
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="start">
          <VStack align="start" spacing={1}>
            <Text fontSize="2xs" fontWeight="700" color={typeColor} textTransform="uppercase" letterSpacing="0.15em" fontFamily="mono">{typeLabel}</Text>
            <Text color={P.ink} fontSize="2xl" fontWeight="700" letterSpacing="-0.01em">{senderName}</Text>
            {senderEmail && <Text color={P.inkMuted} fontSize="sm" fontFamily="mono">{senderEmail}</Text>}
          </VStack>
          <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono" flexShrink={0} pt={1}>{formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}</Text>
        </HStack>

        <HStack spacing={2} flexWrap="wrap">
          {isResponded && (
            <HStack spacing={1.5} px={2.5} py={1} borderRadius="full" bg={`${P.green}18`} border="1px solid" borderColor={`${P.green}40`}>
              <Icon as={TbCircleCheck} boxSize={3} color={P.green} />
              <Text color={P.green} fontSize="2xs" fontWeight="700" fontFamily="mono" letterSpacing="0.05em" textTransform="uppercase">{replyCount > 1 ? `Replied ${replyCount}×` : 'Responded'}</Text>
            </HStack>
          )}
          {isArchived && (
            <HStack spacing={1.5} px={2.5} py={1} borderRadius="full" bg={P.sheet} border="1px solid" borderColor={P.hair}>
              <Icon as={TbArchive} boxSize={3} color={P.inkMuted} />
              <Text color={P.inkMuted} fontSize="2xs" fontWeight="700" fontFamily="mono" letterSpacing="0.05em" textTransform="uppercase">Archived</Text>
            </HStack>
          )}
        </HStack>
      </VStack>

      <HStack spacing={2} flexWrap="wrap" rowGap={2}>
        <ActionButton icon={TbSend} label={replyCount === 0 ? 'Reply' : 'Send follow-up'} onClick={onReply} disabled={!senderEmail} primary />
        <ActionButton icon={TbCircleDashed} label="Mark unread" onClick={onMarkUnread} />
        {isArchived ? <ActionButton icon={TbArchiveOff} label="Unarchive" onClick={onUnarchive} /> : <ActionButton icon={TbArchive} label="Archive" onClick={onArchive} />}
        {isArchived && !confirming && <ActionButton icon={TbTrash} label="Delete forever" onClick={() => setConfirming(true)} destructive />}
      </HStack>

      {isArchived && confirming && (
        <HStack spacing={3} bg={`${P.coral}10`} border="1px solid" borderColor={`${P.coral}44`} borderRadius="14px" p={3.5} flexWrap="wrap" rowGap={2}>
          <Icon as={TbAlertTriangle} boxSize={4} color={P.coral} flexShrink={0} />
          <Text fontSize="sm" color={P.ink} fontWeight="600" flex={1} minW="180px">Delete this forever? It leaves the database and cannot be recovered.</Text>
          <HStack spacing={2}>
            <Button size="sm" variant="ghost" color={P.inkMuted} onClick={() => setConfirming(false)} _hover={{ bg: P.sunken, color: P.ink }}>Cancel</Button>
            <Button size="sm" bg={P.coral} color={P.sheet} fontWeight="700" leftIcon={<TbTrash size={14} />} onClick={onDeleteForever} _hover={{ bg: '#A8362A' }}>Delete forever</Button>
          </HStack>
        </HStack>
      )}

      <Divider borderColor={P.hair} />

      <VStack align="stretch" spacing={0} divider={<Box h="1px" bg={P.hairSoft} />}>
        {fields.map(({ label, value }) => (
          <HStack key={label} align="start" spacing={6} py={3}>
            <Text color={P.inkMuted} fontSize="2xs" fontWeight="700" fontFamily="mono" textTransform="uppercase" letterSpacing="0.08em" minW="120px" flexShrink={0} pt={0.5}>{label}</Text>
            <Text color={P.inkSec} fontSize="sm" flex={1} whiteSpace="pre-wrap" wordBreak="break-word" lineHeight={1.6}>{value}</Text>
          </HStack>
        ))}
      </VStack>

      {replies.length > 0 && (
        <>
          <Divider borderColor={P.hair} />
          <VStack align="stretch" spacing={3}>
            <HStack spacing={2}>
              <Icon as={TbHistory} boxSize={3.5} color={P.limeDeep} />
              <Text color={P.limeDeep} fontSize="2xs" fontWeight="700" fontFamily="mono" textTransform="uppercase" letterSpacing="0.12em">Reply history</Text>
              <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</Text>
            </HStack>
            <VStack align="stretch" spacing={3}>
              {replies.map((reply, idx) => <ReplyCard key={reply.id} reply={reply} index={replies.length - idx} />)}
            </VStack>
          </VStack>
        </>
      )}

      <HStack spacing={4} pt={2}>
        <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">ID {String(submission.id).slice(0, 8)}</Text>
        {submission.last_replied_at && <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">Last reply {formatDistanceToNow(new Date(submission.last_replied_at), { addSuffix: true })}</Text>}
      </HStack>
    </VStack>
  );
};

// ============================================================
// REPLY CARD
// ============================================================
const ReplyCard = ({ reply, index }) => {
  const sentAt = format(new Date(reply.created_at), "MMM d 'at' h:mma");
  return (
    <Box border="1px solid" borderColor={P.hair} borderRadius="lg" bg={P.sheet} p={4}>
      <HStack justify="space-between" mb={2}>
        <HStack spacing={2}>
          <Box w="20px" h="20px" borderRadius="full" bg={`${P.lime}2E`} border="1px solid" borderColor={`${P.lime}55`} display="flex" alignItems="center" justifyContent="center">
            <Text color={P.limeDeep} fontSize="3xs" fontWeight="800" fontFamily="mono">{index}</Text>
          </Box>
          <Text color={P.ink} fontSize="xs" fontWeight="700">{reply.sender_name || 'Admin'}</Text>
        </HStack>
        <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">{sentAt}</Text>
      </HStack>
      {reply.subject && <Text color={P.inkMuted} fontSize="xs" fontFamily="mono" mb={2}>{reply.subject}</Text>}
      <Text color={P.inkSec} fontSize="xs" whiteSpace="pre-wrap" wordBreak="break-word" lineHeight={1.6}>{reply.body}</Text>
    </Box>
  );
};

// ============================================================
// ACTION BUTTON
// ============================================================
const ActionButton = ({ icon, label, onClick, disabled, primary, destructive }) => (
  <Tooltip label={disabled ? 'No email address' : null} isDisabled={!disabled} placement="top" hasArrow bg={P.ink} color={P.sheet} fontSize="xs">
    <HStack as="button" onClick={disabled ? undefined : onClick} spacing={1.5} px={3.5} py={2} border="1px solid" borderColor={destructive ? `${P.coral}55` : (primary ? P.lime : P.hair)} bg={primary ? P.lime : 'transparent'} borderRadius="full" color={destructive ? P.coral : (primary ? P.limeInk : P.inkSec)} fontSize="xs" fontFamily="mono" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em" opacity={disabled ? 0.4 : 1} cursor={disabled ? 'not-allowed' : 'pointer'} transition="all 0.15s" _hover={disabled ? {} : (primary ? { bg: '#D2E26B' } : destructive ? { bg: `${P.coral}14`, borderColor: P.coral } : { color: P.ink, bg: P.sheet, borderColor: P.inkFaint })}>
      <Icon as={icon} boxSize={3.5} />
      <Text>{label}</Text>
    </HStack>
  </Tooltip>
);

const EmptyDetail = () => (
  <Center h="100%" minH="400px" border="1px dashed" borderColor={P.hair} borderRadius="xl" flexDirection="column" gap={3} bg={P.sheet}>
    <Icon as={TbInbox} boxSize={8} color={P.inkFaint} />
    <Text color={P.inkMuted} fontSize="sm" fontWeight="600">Select a submission</Text>
    <Text color={P.inkFaint} fontSize="xs" textAlign="center" maxW="280px">Pick any row on the left to see the full message and reply.</Text>
  </Center>
);

// ============================================================
// REPLY MODAL, with Write and Preview
// ============================================================
const ReplyModal = ({ isOpen, onClose, submission, replyCount, userId, onSuccess }) => {
  const toast = useToast();
  const senderName = getSenderName(submission);
  const senderEmail = getSenderEmail(submission);
  const isFollowUp = replyCount > 0;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('write');
  const [adminName, setAdminName] = useState('The Neon Burro team');

  useEffect(() => {
    if (!isOpen) return;
    setMode('write');
    const typeLabel = FORM_TYPE_LABELS[submission.form_type] || 'your message';
    if (isFollowUp) {
      setSubject('Following up — Neon Burro');
      setBody(`Hi ${senderName},\n\nWanted to follow up on our last message. `);
    } else {
      setSubject(`Re: ${typeLabel} — Neon Burro`);
      setBody(`Hi ${senderName},\n\nThanks for reaching out. `);
    }
    if (userId) {
      supabase.from('profiles').select('display_name, username').eq('id', userId).maybeSingle()
        .then(({ data }) => { if (data) setAdminName(data.display_name || data.username || 'The Neon Burro team'); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, submission.id]);

  const previewHtml = useMemo(
    () => buildReplyEmailHTML({ recipientName: senderName, body, adminName, isFollowUp }),
    [senderName, body, adminName, isFollowUp]
  );

  const handleSend = async () => {
    if (!body.trim()) { toast({ title: 'Message is empty', status: 'warning', duration: 1500 }); return; }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in again before sending.');
      const res = await fetch('/.netlify/functions/reply-to-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ submissionId: submission.id, subject, body }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Send failed');
      toast({ title: isFollowUp ? 'Follow-up sent' : 'Reply sent', description: `Email delivered to ${senderEmail}`, status: 'success', duration: 2500 });
      onSuccess({
        id: submission.id, status: 'responded',
        responded_at: submission.responded_at || new Date().toISOString(),
        responded_by: submission.responded_by || userId,
        last_replied_at: new Date().toISOString(),
        reply_count: (submission.reply_count || 0) + 1,
      });
    } catch (err) {
      toast({ title: 'Send failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSending(false);
    }
  };

  const Tab = ({ value, icon, children }) => (
    <HStack as="button" onClick={() => setMode(value)} spacing={1.5} pb={2} position="relative" color={mode === value ? P.ink : P.inkMuted} _hover={{ color: P.ink }}>
      <Icon as={icon} boxSize={3.5} />
      <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em">{children}</Text>
      {mode === value && <Box position="absolute" bottom="-1px" left={0} right={0} h="2px" bg={P.lime} borderRadius="full" />}
    </HStack>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" motionPreset="slideInBottom" scrollBehavior="inside" isCentered>
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(6px)" />
      <ModalContent bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" color={P.ink} mx={4} overflow="hidden">
        <ModalCloseButton color={P.inkMuted} _hover={{ color: P.ink, bg: P.sunken }} />
        <ModalBody p={0}>
          <Box px={6} pt={6} pb={4}>
            <VStack align="start" spacing={1}>
              <Text fontFamily="mono" fontSize="2xs" fontWeight="600" letterSpacing="0.2em" textTransform="uppercase" color={P.limeDeep}>{isFollowUp ? `Follow-up #${replyCount + 1}` : 'Reply'}</Text>
              <Text color={P.ink} fontSize="xl" fontWeight="600" letterSpacing="-0.01em">Sending to {senderName}</Text>
              <Text color={P.inkMuted} fontSize="sm" fontFamily="mono">{senderEmail}</Text>
            </VStack>
          </Box>

          <HStack spacing={6} px={6} borderBottom="1px solid" borderColor={P.hair}>
            <Tab value="write" icon={TbEdit}>Write</Tab>
            <Tab value="preview" icon={TbEye}>Preview</Tab>
          </HStack>

          {mode === 'write' ? (
            <VStack align="stretch" spacing={4} px={6} py={5}>
              <VStack align="stretch" spacing={1.5}>
                <Text fontFamily="mono" fontSize="2xs" fontWeight="600" letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>Subject</Text>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius="lg" color={P.ink} fontSize="sm" h="44px" _focus={{ borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}33` }} _placeholder={{ color: P.inkFaint }} />
              </VStack>
              <VStack align="stretch" spacing={1.5}>
                <Text fontFamily="mono" fontSize="2xs" fontWeight="600" letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>Message</Text>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius="lg" color={P.ink} fontSize="sm" minH="200px" _focus={{ borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}33` }} _placeholder={{ color: P.inkFaint }} />
              </VStack>
            </VStack>
          ) : (
            <Box px={6} py={5}>
              <Box borderRadius="14px" overflow="hidden" border="1px solid" borderColor={P.hair}>
                <Box as="iframe" srcDoc={previewHtml} title="Reply preview" width="100%" minH="440px" border="none" display="block" sandbox="allow-same-origin"
                  ref={(iframe) => {
                    if (!iframe) return;
                    const fit = () => { try { const d = iframe.contentDocument; if (d?.body) iframe.style.height = `${d.body.scrollHeight + 20}px`; } catch { /* ignore */ } };
                    iframe.addEventListener('load', fit);
                    setTimeout(fit, 300); setTimeout(fit, 900);
                  }} />
              </Box>
            </Box>
          )}

          <HStack justify="space-between" px={6} py={4} borderTop="1px solid" borderColor={P.hair} bg={P.mat} flexWrap="wrap" rowGap={2}>
            <Text color={P.inkFaint} fontSize="2xs" fontFamily="mono">Warm paper email · they can reply straight back</Text>
            <HStack spacing={2}>
              <Button variant="ghost" color={P.inkMuted} onClick={onClose} size="sm" isDisabled={sending} _hover={{ color: P.ink, bg: P.sunken }}>Cancel</Button>
              <Button onClick={handleSend} isLoading={sending} loadingText="Sending..." leftIcon={<TbSend />} bg={P.lime} color={P.limeInk} size="sm" fontWeight="700" borderRadius="full" _hover={{ bg: '#D2E26B' }}>{isFollowUp ? 'Send follow-up' : 'Send reply'}</Button>
            </HStack>
          </HStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default Forms;
