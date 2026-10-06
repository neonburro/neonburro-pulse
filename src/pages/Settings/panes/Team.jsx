// src/pages/Settings/panes/Team.jsx
// SENTINEL: NB_PULSE_SETTINGS_TEAM_V1
//
// Team, studio only. What SettingsTeam did, laid out the way /trademarks/
// lays out a list: a search on the left and the one action on the right,
// quiet column heads, rows on hairlines with no cards. The invite button is
// the pane's one lime.
//
// ── WHAT IT DOES, UNCHANGED ─────────────────────────────────────────────────
// Lists every profile with a studio role, super_admin, admin, manager and
// team. A role changes by writing profiles.role straight from the page, as
// before. super_admin is never offered and never edited, promotion stays
// SQL only, and nobody edits their own row.
//
// ── THE INVITE ──────────────────────────────────────────────────────────────
// The modal goes through sendTeamInvite in src/lib/teamInvite.js and never
// fetches the function itself, so the session always rides as a bearer
// token. send-team-invite.js was gated to super_admin and admin by Volt on
// 2026-10-05, the same evening this pane was built, after it was found
// taking invites from anybody. INVITABLE_ROLES comes from that lib, admin,
// manager and team, manager on Tyler's word, and it must match the
// function's own list. The old modal offered manager while the function
// quietly made them team, that is gone with it.
//
// deps.loadTeam lets the dev review route hand in sample people. Without it
// the pane reads profiles itself.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Icon, Button, Input, useToast, useDisclosure,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
} from '@chakra-ui/react';
import { TbPlus, TbCrown, TbShield, TbBriefcase, TbUser, TbMail } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { sendTeamInvite, INVITABLE_ROLES } from '../../../lib/teamInvite';
import { usePresence } from '../../../hooks/usePresence';
import colors from '../../../theme/colors';
import { TYPE, KICKER, INSET, HEAD_GAP, EASE, FAST } from '../../../theme/layout';
import { PageHead, SearchBox, Field, Loading, Empty } from '../../../components/common/Page';
import DotSelect from '../../../components/common/DotSelect';
import Avatar from '../../../components/common/Avatar';

const P = colors.paper;

const ROLE = {
  super_admin: { icon: TbCrown, color: P.gold, label: 'Super admin' },
  admin: { icon: TbShield, color: P.limeDeep, label: 'Admin' },
  manager: { icon: TbBriefcase, color: '#6C6F97', label: 'Manager' },
  team: { icon: TbUser, color: '#7A5FC9', label: 'Team' },
};

const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'team'];
const EDITABLE_ROLES = ['admin', 'manager', 'team'];
const GRID = { base: 'minmax(0,1fr) auto', sm: 'minmax(0,1fr) 168px' };

const loadStaff = async () => {
  const { data } = await supabase.from('profiles').select('*').in('role', STAFF_ROLES).order('role', { ascending: true });
  return data || [];
};

const Head = ({ children, ...rest }) => (
  <Text {...KICKER} color={P.inkFaint} {...rest}>{children}</Text>
);

const RoleLabel = ({ role }) => {
  const r = ROLE[role] || ROLE.team;
  return (
    <HStack spacing={1.5} justify={{ base: 'end', sm: 'start' }}>
      <Icon as={r.icon} boxSize={3.5} color={r.color} />
      <Text fontSize={TYPE.small} fontWeight="600" color={P.inkSec}>{r.label}</Text>
    </HStack>
  );
};

const MemberRow = ({ member, me, onRoleChange }) => {
  const { getStatus } = usePresence();
  const isMe = member.id === me;
  const fixed = isMe || member.role === 'super_admin';
  return (
    <Box
      display="grid"
      gridTemplateColumns={GRID}
      gap={{ base: 3, sm: 5 }}
      alignItems="center"
      py={3}
      px={1}
      borderTop="1px solid"
      borderColor={P.hair}
    >
      <HStack spacing={3} minW={0}>
        <Avatar name={member.display_name || member.username || member.email} url={member.avatar_url} size="md" presence={getStatus(member.id)} />
        <VStack align="start" spacing={0} minW={0}>
          <HStack spacing={2} minW={0}>
            <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{member.display_name || 'Unnamed'}</Text>
            {isMe && <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>you</Text>}
          </HStack>
          <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={1}>
            {member.username ? `@${member.username}` : member.email}
          </Text>
        </VStack>
      </HStack>
      {fixed ? (
        <RoleLabel role={member.role} />
      ) : (
        <Box w={{ base: '132px', sm: '100%' }}>
          <DotSelect
            value={EDITABLE_ROLES.includes(member.role) ? member.role : 'team'}
            onChange={(v) => onRoleChange(member.id, v)}
            options={EDITABLE_ROLES.map((r) => ({ value: r, label: ROLE[r].label }))}
            size="sm"
          />
        </Box>
      )}
    </Box>
  );
};

const InviteModal = ({ isOpen, onClose, onInvited }) => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('team');
  const [sending, setSending] = useState(false);

  const invite = async () => {
    if (!email.trim() || !email.includes('@')) { toast({ title: 'An email address is needed', status: 'warning', duration: 2000 }); return; }
    setSending(true);
    try {
      await sendTeamInvite({ email: email.trim().toLowerCase(), display_name: displayName.trim(), role });
      toast({ title: 'Invite sent', description: `${email} will get an email`, status: 'success', duration: 3000 });
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
      <ModalOverlay bg="rgba(36,26,22,0.45)" backdropFilter="blur(3px)" />
      <ModalContent bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="18px" mx={4}>
        <ModalHeader color={P.ink} fontSize={TYPE.section} fontWeight="600">Invite to the team</ModalHeader>
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
                  <Box
                    key={r}
                    as="button"
                    type="button"
                    flex={1}
                    py={2.5}
                    px={INSET}
                    textAlign="left"
                    borderRadius="12px"
                    border="1px solid"
                    borderColor={role === r ? P.ink : P.hair}
                    bg={role === r ? P.sunken : 'transparent'}
                    onClick={() => setRole(r)}
                    transition={`all ${FAST} ${EASE}`}
                  >
                    <Text fontSize={TYPE.small} fontWeight="600" color={role === r ? P.ink : P.inkMuted}>{ROLE[r].label}</Text>
                  </Box>
                ))}
              </HStack>
            </Field>
          </VStack>
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor={P.hair} gap={2}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" isLoading={sending} loadingText="Sending" onClick={invite} leftIcon={<TbMail size={14} />}>Send invite</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const Team = ({ user, deps = {} }) => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [members, setMembers] = useState(null);
  const [query, setQuery] = useState('');
  const load = deps.loadTeam || loadStaff;

  const refresh = useCallback(async () => {
    setMembers(await load());
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);

  const changeRole = async (memberId, role) => {
    if (!EDITABLE_ROLES.includes(role)) { toast({ title: 'Not from here', description: 'Super admin is set in SQL only', status: 'warning', duration: 3000 }); return; }
    const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', memberId);
    if (error) { toast({ title: 'Role not changed', description: error.message, status: 'error', duration: 3000 }); return; }
    toast({ title: 'Role changed', status: 'success', duration: 2000 });
    refresh();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members || []).filter((m) => !q
      || (m.display_name || '').toLowerCase().includes(q)
      || (m.username || '').toLowerCase().includes(q)
      || (m.email || '').toLowerCase().includes(q));
  }, [members, query]);

  return (
    <VStack align="stretch" spacing={HEAD_GAP}>
      <PageHead
        kicker="Studio"
        title="Team"
        lede={members ? `Everybody with a studio role, ${members.length} ${members.length === 1 ? 'person' : 'people'}. Change a role in place.` : 'Everybody with a studio role. Change a role in place.'}
      />

      <VStack align="stretch" spacing={4}>
        <HStack spacing={2}>
          <SearchBox value={query} onChange={setQuery} placeholder="search the team" flex={1} minW={0} />
          <Button size="md" flexShrink={0} leftIcon={<Icon as={TbPlus} boxSize={4} />} onClick={onOpen}>Invite</Button>
        </HStack>

        {members === null ? (
          <Loading label="reading the team" />
        ) : shown.length === 0 ? (
          <Empty hint={query ? 'Nobody on the team matches that.' : 'Invite the first teammate above.'}>
            {query ? 'No match.' : 'Nobody here yet.'}
          </Empty>
        ) : (
          <Box>
            <Box display={{ base: 'none', sm: 'grid' }} gridTemplateColumns={GRID} gap={5} px={1} pb={2}>
              <Head>Member</Head>
              <Head>Role</Head>
            </Box>
            {shown.map((m) => <MemberRow key={m.id} member={m} me={user?.id} onRoleChange={changeRole} />)}
            <Box borderTop="1px solid" borderColor={P.hair} />
          </Box>
        )}

        <Text fontSize={TYPE.small} color={P.inkFaint} lineHeight="1.6" maxW="62ch">
          Super admin is set in SQL only, never from here. Everybody else can be invited as, or moved to, admin, manager or team.
        </Text>
      </VStack>

      <InviteModal isOpen={isOpen} onClose={onClose} onInvited={refresh} />
    </VStack>
  );
};

export default Team;
