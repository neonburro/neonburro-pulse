// src/pages/Settings/components/SettingsTeam.jsx
// Team management for super_admin and admin, on Paper. super_admin is protected
// from edits, the role select offers admin/manager/team, the invite flow accepts
// the same. super_admin promotion stays SQL only. Role tones carry meaning and
// are kept, deepened for cream. A section like the others, house fields in
// the invite modal. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import {
  VStack, HStack, Text, Box, Icon, Button, Input, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import DotSelect from '../../../components/common/DotSelect';
import { TbUserPlus, TbCrown, TbShield, TbBriefcase, TbUser, TbBuilding, TbMail } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import Avatar from '../../../components/common/Avatar';
import { usePresence } from '../../../hooks/usePresence';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Section, Field, Loading } from '../../../components/common/Page';

const P = colors.paper;

const ROLE_CONFIG = {
  super_admin: { icon: TbCrown,     color: P.gold,     label: 'Super Admin' },
  admin:       { icon: TbShield,    color: P.limeDeep, label: 'Admin' },
  manager:     { icon: TbBriefcase, color: '#6C6F97',  label: 'Manager' },
  team:        { icon: TbUser,      color: '#7A5Fc9',  label: 'Team' },
  client:      { icon: TbBuilding,  color: P.inkFaint, label: 'Client' },
};

const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'team'];
const EDITABLE_ROLES = ['admin', 'manager', 'team'];
const INVITABLE_ROLES = ['admin', 'manager', 'team'];

const TeamMemberRow = ({ member, currentUserId, onRoleChange }) => {
  const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.team;
  const { getStatus } = usePresence();
  const status = getStatus(member.id);
  const isMe = member.id === currentUserId;
  const isSuperAdmin = member.role === 'super_admin';

  return (
    <HStack justify="space-between" py={3} px={INSET} mx={-INSET} borderRadius="lg" transition={`all ${FAST} ${EASE}`} _hover={{ bg: P.sheet }}>
      <HStack spacing={3} flex={1} minW={0}>
        <Avatar name={member.display_name || member.username || member.email} url={member.avatar_url} size="md" presence={status} />
        <Box flex={1} minW={0}>
          <HStack spacing={2}>
            <Text color={P.ink} fontSize={TYPE.body} fontWeight="700" noOfLines={1}>{member.display_name || 'Unnamed'}</Text>
            {isMe && <Text fontSize={TYPE.label} color={P.inkFaint} fontFamily="mono">you</Text>}
          </HStack>
          <HStack spacing={2} mt={0.5}>
            {member.username && <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">@{member.username}</Text>}
            <HStack spacing={1}>
              <Icon as={config.icon} boxSize={2.5} color={config.color} />
              <Text fontSize={TYPE.label} color={config.color} fontWeight="700">{config.label}</Text>
            </HStack>
          </HStack>
        </Box>
      </HStack>

      {!isMe && !isSuperAdmin && (
        <Box w="140px" flexShrink={0}>
          <DotSelect
            value={EDITABLE_ROLES.includes(member.role) ? member.role : 'team'}
            onChange={(v) => onRoleChange(member.id, v)}
            options={EDITABLE_ROLES.map((r) => ({ value: r, label: ROLE_CONFIG[r].label }))}
            size="sm"
          />
        </Box>
      )}
    </HStack>
  );
};

const InviteModal = ({ isOpen, onClose, onInvited }) => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('team');
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) { toast({ title: 'Valid email required', status: 'warning', duration: 2000 }); return; }
    setSending(true);
    try {
      const res = await fetch('/.netlify/functions/send-team-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), display_name: displayName.trim(), role }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Invite failed'); }
      toast({ title: 'Invite sent', description: `${email} will receive an email`, status: 'success', duration: 3000 });
      setEmail(''); setDisplayName(''); setRole('team');
      onInvited();
      onClose();
    } catch (err) {
      toast({ title: 'Invite failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(4px)" />
      <ModalContent bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" mx={4}>
        <ModalHeader color={P.ink} fontSize={TYPE.section}>
          <HStack spacing={2}><Icon as={TbUserPlus} color={P.limeDeep} boxSize={5} /><Text>Invite to the herd</Text></HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} _hover={{ color: P.ink, bg: P.sunken }} />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@neonburro.com" autoFocus />
            </Field>
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Their full name" />
            </Field>
            <Field label="Role" hint="admin runs the place, manager runs projects, team is limited">
              <HStack spacing={2}>
                {INVITABLE_ROLES.map((r) => (
                  <Box key={r} as="button" type="button" flex={1} py={2.5} px={INSET} textAlign="left" borderRadius="lg" border="1px solid" borderColor={role === r ? ROLE_CONFIG[r].color : P.hair} bg={role === r ? `${ROLE_CONFIG[r].color}1A` : 'transparent'} onClick={() => setRole(r)} transition={`all ${FAST} ${EASE}`}>
                    <Text fontSize={TYPE.small} fontWeight="700" color={role === r ? ROLE_CONFIG[r].color : P.inkMuted}>{ROLE_CONFIG[r].label}</Text>
                  </Box>
                ))}
              </HStack>
            </Field>
          </VStack>
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor={P.hair} gap={2}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" isLoading={sending} loadingText="Sending" onClick={handleInvite} leftIcon={<TbMail size={14} />}>Send invite</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const SettingsTeam = ({ currentUserId }) => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').in('role', STAFF_ROLES).order('role', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  };

  const handleRoleChange = async (memberId, newRole) => {
    if (!EDITABLE_ROLES.includes(newRole)) { toast({ title: 'Cannot set that role', description: 'Super admin promotion is SQL only', status: 'warning', duration: 3000 }); return; }
    const { error } = await supabase.from('profiles').update({ role: newRole, updated_at: new Date().toISOString() }).eq('id', memberId);
    if (error) { toast({ title: 'Update failed', description: error.message, status: 'error', duration: 3000 }); return; }
    toast({ title: 'Role updated', status: 'success', duration: 2000 });
    fetchMembers();
  };

  return (
    <Section
      kicker="Team"
      count={`${members.length} member${members.length !== 1 ? 's' : ''}`}
      action={<Button size="xs" variant="outline" leftIcon={<TbUserPlus size={12} />} onClick={onOpen}>Invite</Button>}
    >
      {loading ? (
        <Loading label="loading the team" py={2} />
      ) : (
        <VStack spacing={1} align="stretch">
          {members.map((member) => <TeamMemberRow key={member.id} member={member} currentUserId={currentUserId} onRoleChange={handleRoleChange} />)}
        </VStack>
      )}

      <InviteModal isOpen={isOpen} onClose={onClose} onInvited={fetchMembers} />
    </Section>
  );
};

export default SettingsTeam;
