// src/pages/Forms/index.jsx
// Forms inbox, on Paper. Every submission type in one place, a split pane on
// desktop (list 420px, detail flex), a full screen sheet on a phone. Realtime
// on both submissions and replies. The reply modal has a Write and a Preview so
// nothing goes to a lead without the team seeing the exact email first, the same
// buildReplyEmailHTML the function sends. Form type colours carry meaning and
// are kept, they tint the type tabs. House column, head, tabs, search and
// empty lines. No oxford commas, no dashes.

import { useState, useEffect, useMemo } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Input,
  Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton,
  Textarea, Button, useToast, Divider, IconButton, Tooltip,
} from '@chakra-ui/react';
import {
  TbSearch, TbArchive, TbArchiveOff, TbSend, TbArrowLeft,
  TbCircleCheck, TbCircleDashed, TbHistory, TbEdit, TbEye, TbTrash, TbAlertTriangle,
} from 'react-icons/tb';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import colors from '../../theme/colors';
import { TYPE, INSET, EASE, FAST, PLATE_RADIUS } from '../../theme/layout';
import { FORM_TYPE_LABELS, FORM_TYPE_COLORS } from '../../lib/uiConstants';
import { buildReplyEmailHTML } from '../../lib/replyEmailTemplate';
import { Page, PageHead, Tabs, SearchBox, Empty, Loading, Plate, Kicker, Field } from '../../components/common/Page';

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
  const [typeFilter, setTypeFilter] = useState('all');
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
    if (typeFilter !== 'all' && s.form_type !== typeFilter) return false;
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

  const detailProps = selected ? {
    submission: selected,
    replies: selectedReplies,
    onReply: () => setReplyOpen(true),
    onArchive: () => handleArchive(selected.id),
    onUnarchive: () => handleUnarchive(selected.id),
    onMarkUnread: () => handleMarkUnread(selected.id),
    onDeleteForever: () => handleDeleteForever(selected.id),
  } : null;

  return (
    <Page>
      <PageHead
        kicker="Forms"
        title={`${counts.unread} unread`}
        lede="Everything that came in through the site, newest first. Reply from here and the lead gets the letterhead."
      />

      <VStack align="stretch" spacing={5}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email or message" />
        <Tabs items={STATUS_FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={statusFilter} onChange={setStatusFilter} />
        {typesPresent.length > 0 && (
          <Tabs
            items={[{ key: 'all', label: 'All types' }, ...typesPresent.map((t) => ({ key: t, label: FORM_TYPE_LABELS[t] || t, color: FORM_TYPE_COLORS[t] }))]}
            value={typeFilter}
            onChange={setTypeFilter}
          />
        )}
      </VStack>

      {loading ? (
        <Loading label="loading the inbox" />
      ) : (
        <HStack align="start" spacing={6} minH="60vh">
          <Box w={{ base: '100%', lg: '420px' }} flexShrink={0} borderTop="1px solid" borderColor={P.hair} maxH="calc(100vh - 280px)" overflowY="auto" mx={-INSET}>
            {filtered.length === 0 ? (
              <Empty px={INSET}>
                {statusFilter === 'unread' ? 'Nothing unread. You are caught up.' : statusFilter === 'archived' ? 'No archived submissions.' : 'No submissions match these filters.'}
              </Empty>
            ) : (
              filtered.map((s) => (
                <ListRow key={s.id} submission={s} replyCount={s.reply_count || 0} selected={s.id === selectedId} onClick={() => handleSelect(s)} />
              ))
            )}
          </Box>

          <Box display={{ base: 'none', lg: 'block' }} flex={1} minW={0}>
            {selected ? <DetailPane {...detailProps} /> : <EmptyDetail />}
          </Box>
        </HStack>
      )}

      <Modal isOpen={mobileDetailOpen && !!selected} onClose={() => setMobileDetailOpen(false)} size="full" motionPreset="slideInRight">
        <ModalOverlay />
        <ModalContent bg={P.mat} m={0} borderRadius={0} color={P.ink}>
          <ModalBody p={0}>
            {selected && (
              <Box>
                <HStack p={4} borderBottom="1px solid" borderColor={P.hair}>
                  <IconButton icon={<TbArrowLeft />} variant="ghost" onClick={() => setMobileDetailOpen(false)} aria-label="Back" size="sm" />
                  <Text color={P.ink} fontWeight="700" fontSize={TYPE.body}>Submission</Text>
                </HStack>
                <Box p={5}>
                  <DetailPane {...detailProps} />
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
    </Page>
  );
};

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
    <Box as="button" type="button" w="100%" textAlign="left" onClick={onClick} px={INSET} py={3.5} borderBottom="1px solid" borderColor={P.hairSoft} borderLeft="2px solid" borderLeftColor={selected ? typeColor : isUnread ? typeColor : 'transparent'} bg={selected ? P.sheet : 'transparent'} _hover={{ bg: P.sheet }} transition={`all ${FAST} ${EASE}`}>
      <HStack justify="space-between" mb={1}>
        <HStack spacing={2}>
          <Text fontFamily="mono" fontSize={TYPE.kicker} fontWeight="500" color={typeColor} textTransform="uppercase" letterSpacing="0.1em">{typeLabel}</Text>
          {isResponded && (
            <HStack spacing={0.5}>
              <Icon as={TbCircleCheck} boxSize={3} color={P.green} />
              {replyCount > 1 && <Text color={P.green} fontSize={TYPE.label} fontFamily="mono" fontWeight="700">×{replyCount}</Text>}
            </HStack>
          )}
        </HStack>
        <HStack spacing={1.5}>
          {isUnread && <Box w="6px" h="6px" borderRadius="full" bg={typeColor} />}
          <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{timeAgo}</Text>
        </HStack>
      </HStack>
      <Text color={isUnread ? P.ink : P.inkSec} fontSize={TYPE.body} fontWeight={isUnread ? '700' : '500'} noOfLines={1}>{senderName}</Text>
      {senderEmail && <Text color={P.inkMuted} fontSize={TYPE.small} noOfLines={1} fontFamily="mono">{senderEmail}</Text>}
      {previewMessage && <Text color={P.inkMuted} fontSize={TYPE.small} noOfLines={1} mt={1}>{previewMessage}</Text>}
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
            <Kicker color={typeColor}>{typeLabel}</Kicker>
            <Text color={P.ink} fontSize={TYPE.title} fontWeight="600" letterSpacing="-0.02em" lineHeight="1.1">{senderName}</Text>
            {senderEmail && <Text color={P.inkMuted} fontSize={TYPE.body} fontFamily="mono">{senderEmail}</Text>}
          </VStack>
          <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" flexShrink={0} pt={1}>{formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}</Text>
        </HStack>

        <HStack spacing={4} flexWrap="wrap">
          {isResponded && (
            <HStack spacing={1.5}>
              <Icon as={TbCircleCheck} boxSize={3} color={P.green} />
              <Kicker color={P.green}>{replyCount > 1 ? `Replied ${replyCount}×` : 'Responded'}</Kicker>
            </HStack>
          )}
          {isArchived && (
            <HStack spacing={1.5}>
              <Icon as={TbArchive} boxSize={3} color={P.inkMuted} />
              <Kicker>Archived</Kicker>
            </HStack>
          )}
        </HStack>
      </VStack>

      <HStack spacing={2} flexWrap="wrap" rowGap={2}>
        <ActionButton icon={TbSend} label={replyCount === 0 ? 'Reply' : 'Send follow up'} onClick={onReply} disabled={!senderEmail} primary />
        <ActionButton icon={TbCircleDashed} label="Mark unread" onClick={onMarkUnread} />
        {isArchived ? <ActionButton icon={TbArchiveOff} label="Unarchive" onClick={onUnarchive} /> : <ActionButton icon={TbArchive} label="Archive" onClick={onArchive} />}
        {isArchived && !confirming && <ActionButton icon={TbTrash} label="Delete forever" onClick={() => setConfirming(true)} destructive />}
      </HStack>

      {isArchived && confirming && (
        <HStack spacing={3} bg={`${P.coral}10`} border="1px solid" borderColor={`${P.coral}44`} borderRadius="14px" p={INSET} flexWrap="wrap" rowGap={2}>
          <Icon as={TbAlertTriangle} boxSize={4} color={P.coral} flexShrink={0} />
          <Text fontSize={TYPE.body} color={P.ink} fontWeight="600" flex={1} minW="180px">Delete this forever? It leaves the database and cannot be recovered.</Text>
          <HStack spacing={2}>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" leftIcon={<TbTrash size={14} />} onClick={onDeleteForever}>Delete forever</Button>
          </HStack>
        </HStack>
      )}

      <Divider borderColor={P.hair} />

      <VStack align="stretch" spacing={0} divider={<Box h="1px" bg={P.hairSoft} />}>
        {fields.map(({ label, value }) => (
          <HStack key={label} align="start" spacing={6} py={3}>
            <Kicker minW="120px" flexShrink={0} pt={0.5}>{label}</Kicker>
            <Text color={P.inkSec} fontSize={TYPE.body} flex={1} whiteSpace="pre-wrap" wordBreak="break-word" lineHeight={1.6}>{value}</Text>
          </HStack>
        ))}
      </VStack>

      {replies.length > 0 && (
        <>
          <Divider borderColor={P.hair} />
          <VStack align="stretch" spacing={3}>
            <HStack spacing={2}>
              <Icon as={TbHistory} boxSize={3.5} color={P.inkMuted} />
              <Kicker>Reply history</Kicker>
              <Text color={P.inkFaint} fontSize={TYPE.kicker} fontFamily="mono">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</Text>
            </HStack>
            <VStack align="stretch" spacing={3}>
              {replies.map((reply, idx) => <ReplyCard key={reply.id} reply={reply} index={replies.length - idx} />)}
            </VStack>
          </VStack>
        </>
      )}

      <HStack spacing={4} pt={2}>
        <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">ID {String(submission.id).slice(0, 8)}</Text>
        {submission.last_replied_at && <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">Last reply {formatDistanceToNow(new Date(submission.last_replied_at), { addSuffix: true })}</Text>}
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
    <Plate>
      <HStack justify="space-between" mb={2}>
        <HStack spacing={2}>
          <Box w="20px" h="20px" borderRadius="full" bg={`${P.lime}2E`} border="1px solid" borderColor={`${P.lime}55`} display="flex" alignItems="center" justifyContent="center">
            <Text color={P.limeDeep} fontSize={TYPE.micro} fontWeight="800" fontFamily="mono">{index}</Text>
          </Box>
          <Text color={P.ink} fontSize={TYPE.small} fontWeight="700">{reply.sender_name || 'Admin'}</Text>
        </HStack>
        <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{sentAt}</Text>
      </HStack>
      {reply.subject && <Text color={P.inkMuted} fontSize={TYPE.small} fontFamily="mono" mb={2}>{reply.subject}</Text>}
      <Text color={P.inkSec} fontSize={TYPE.small} whiteSpace="pre-wrap" wordBreak="break-word" lineHeight={1.6}>{reply.body}</Text>
    </Plate>
  );
};

// ============================================================
// ACTION BUTTON
// ============================================================
const ActionButton = ({ icon, label, onClick, disabled, primary, destructive }) => (
  <Tooltip label={disabled ? 'No email address' : null} isDisabled={!disabled} placement="top" hasArrow bg={P.ink} color={P.sheet} fontSize={TYPE.small}>
    <Button
      size="sm"
      variant={primary ? 'solid' : 'outline'}
      leftIcon={<Icon as={icon} boxSize={3.5} />}
      onClick={disabled ? undefined : onClick}
      isDisabled={disabled}
      color={destructive ? P.coral : undefined}
      _hover={destructive ? { bg: `${P.coral}14`, borderColor: P.coral } : undefined}
    >
      {label}
    </Button>
  </Tooltip>
);

const EmptyDetail = () => (
  <Plate>
    <Empty py={2} hint="Pick any row on the left to see the full message and reply.">Select a submission.</Empty>
  </Plate>
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
      setSubject('Following up, Neon Burro');
      setBody(`Hi ${senderName},\n\nWanted to follow up on our last message. `);
    } else {
      setSubject(`Re: ${typeLabel}, Neon Burro`);
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
      toast({ title: isFollowUp ? 'Follow up sent' : 'Reply sent', description: `Email delivered to ${senderEmail}`, status: 'success', duration: 2500 });
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" motionPreset="slideInBottom" scrollBehavior="inside" isCentered>
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(6px)" />
      <ModalContent bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius={PLATE_RADIUS} color={P.ink} mx={4} overflow="hidden">
        <ModalCloseButton color={P.inkMuted} _hover={{ color: P.ink, bg: P.sunken }} />
        <ModalBody p={0}>
          <Box px={6} pt={6} pb={4}>
            <VStack align="start" spacing={1}>
              <Kicker color={P.limeDeep}>{isFollowUp ? `Follow up #${replyCount + 1}` : 'Reply'}</Kicker>
              <Text color={P.ink} fontSize={TYPE.section} fontWeight="600" letterSpacing="-0.01em">Sending to {senderName}</Text>
              <Text color={P.inkMuted} fontSize={TYPE.body} fontFamily="mono">{senderEmail}</Text>
            </VStack>
          </Box>

          <Box px={6}>
            <Tabs
              items={[{ key: 'write', label: 'Write' }, { key: 'preview', label: 'Preview' }]}
              value={mode}
              onChange={setMode}
            />
          </Box>

          {mode === 'write' ? (
            <VStack align="stretch" spacing={4} px={6} py={5}>
              <Field label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} bg={P.mat} />
              </Field>
              <Field label="Message">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} bg={P.mat} minH="200px" />
              </Field>
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
            <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">Warm paper email · they can reply straight back</Text>
            <HStack spacing={2}>
              <Button variant="ghost" onClick={onClose} size="sm" isDisabled={sending}>Cancel</Button>
              <Button onClick={handleSend} isLoading={sending} loadingText="Sending" leftIcon={<TbSend />} size="sm">{isFollowUp ? 'Send follow up' : 'Send reply'}</Button>
            </HStack>
          </HStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default Forms;
