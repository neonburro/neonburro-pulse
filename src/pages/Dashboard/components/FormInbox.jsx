// src/pages/Dashboard/components/FormInbox.jsx
// Condensed form inbox for Today, on Paper: the top 5 unread preview. Full
// management lives on /forms/. Type hues stay distinct, deepened for cream.
// The house section format, kicker, unread count and a view all door on the
// right, rows bleeding the inset. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { TbArrowRight, TbCircleCheck } from 'react-icons/tb';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST, INSET } from '../../../theme/layout';
import { Section, Empty, Loading } from '../../../components/common/Page';

const P = colors.paper;

const FORM_TYPE_LABELS = {
  contact: 'Contact', application: 'Application', collective_request: 'Collective',
  hosting: 'Hosting', nomination: 'Nomination', project_brief: 'Project Brief', wild_request: 'Wild Request',
};

const FORM_TYPE_COLORS = {
  contact: '#6E7A30', application: '#7A5Fc9', collective_request: '#B23A80',
  hosting: '#6C6F97', nomination: '#9A7B00', project_brief: '#5E7A1E', wild_request: '#C2402F',
};

const MAX_PREVIEW = 5;

const getSenderName = (s) => s.name || s.metadata?.name || s.metadata?.full_name || s.metadata?.contact_name || 'Anonymous';
const getSenderEmail = (s) => s.email || s.metadata?.email || s.metadata?.contact_email || null;
const getPreviewMessage = (s) => s.message || s.metadata?.message || s.metadata?.description || s.metadata?.brief || s.metadata?.request || '';

const FormInbox = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreview();
    const channel = supabase.channel('dashboard_form_inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_submissions' }, () => fetchPreview())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPreview = async () => {
    const { data } = await supabase.from('form_submissions').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(20);
    if (data) {
      const unread = data.filter((s) => s.status === 'unread');
      setTotalUnread(unread.length);
      const preview = unread.length >= MAX_PREVIEW ? unread.slice(0, MAX_PREVIEW) : [...unread, ...data.filter((s) => s.status !== 'unread')].slice(0, MAX_PREVIEW);
      setSubmissions(preview);
    }
    setLoading(false);
  };

  return (
    <Section
      kicker="Form inbox"
      count={totalUnread > 0 ? `${totalUnread} unread` : undefined}
      action={(
        <HStack as="button" type="button" onClick={() => navigate('/forms/')} spacing={1} color={P.inkMuted} _hover={{ color: P.ink }} transition={`color ${FAST} ${EASE}`}>
          <Text fontFamily="mono" fontSize={TYPE.kicker} letterSpacing="0.14em" textTransform="uppercase">View all</Text>
          <Icon as={TbArrowRight} boxSize={3} />
        </HStack>
      )}
    >
      {loading ? (
        <Loading label="loading forms" />
      ) : submissions.length === 0 ? (
        <Empty hint="Form submissions will appear here.">Inbox zero.</Empty>
      ) : (
        <Box borderTop="1px solid" borderColor={P.hair} mx={-INSET}>
          {submissions.map((s) => <PreviewRow key={s.id} submission={s} onClick={() => navigate('/forms/')} />)}
        </Box>
      )}
    </Section>
  );
};

const PreviewRow = ({ submission, onClick }) => {
  const formType = submission.form_type || 'contact';
  const typeLabel = FORM_TYPE_LABELS[formType] || formType.replace(/_/g, ' ');
  const typeColor = FORM_TYPE_COLORS[formType] || P.inkMuted;
  const senderName = getSenderName(submission);
  const senderEmail = getSenderEmail(submission);
  const previewMessage = getPreviewMessage(submission);
  const replyCount = submission.reply_count || 0;
  const isUnread = submission.status === 'unread';
  const isResponded = submission.status === 'responded';
  const timeAgo = formatDistanceToNow(new Date(submission.created_at), { addSuffix: true });

  return (
    <Box as="button" type="button" w="100%" textAlign="left" onClick={onClick} borderBottom="1px solid" borderColor={P.hairSoft} borderLeft="2px solid" borderLeftColor={isUnread ? typeColor : 'transparent'} transition={`all ${FAST} ${EASE}`} _hover={{ bg: P.sheet }}>
      <HStack spacing={3} py={3} px={INSET} align="center">
        <Box minW="90px" flexShrink={0}>
          <Text fontFamily="mono" fontSize={TYPE.kicker} fontWeight="500" color={typeColor} textTransform="uppercase" letterSpacing="0.1em">{typeLabel}</Text>
        </Box>
        <Box flex={1} minW={0}>
          <HStack spacing={2} align="baseline">
            <Text color={isUnread ? P.ink : P.inkSec} fontSize={TYPE.body} fontWeight={isUnread ? '700' : '500'} noOfLines={1}>{senderName}</Text>
            {senderEmail && <Text color={P.inkMuted} fontSize={TYPE.small} noOfLines={1} display={{ base: 'none', md: 'block' }}>{senderEmail}</Text>}
            {isResponded && (
              <HStack spacing={0.5}>
                <Icon as={TbCircleCheck} boxSize={3} color={P.green} />
                {replyCount > 1 && <Text color={P.green} fontSize={TYPE.label} fontFamily="mono" fontWeight="700">×{replyCount}</Text>}
              </HStack>
            )}
          </HStack>
          {previewMessage && <Text color={P.inkMuted} fontSize={TYPE.small} noOfLines={1} mt={0.5}>{previewMessage}</Text>}
        </Box>
        <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono" flexShrink={0} display={{ base: 'none', md: 'block' }}>{timeAgo}</Text>
        {isUnread && <Box w="6px" h="6px" borderRadius="full" bg={typeColor} flexShrink={0} />}
      </HStack>
    </Box>
  );
};

export default FormInbox;
