// src/pages/Settings/panes/Account.jsx
// SENTINEL: NB_PULSE_SETTINGS_ACCOUNT_V1
//
// Account, for everybody who signs in. What used to be SettingsPassword,
// SettingsAccountInfo and SettingsFooter, as rows.
//
// ── PASSWORD ────────────────────────────────────────────────────────────────
// A row with a Change button that opens the three fields in place, the way
// the Claude settings open a form under its row instead of on a new screen.
// The check is unchanged: sign in again with the current password, and only
// then updateUser with the new one, six characters at least. The submit is
// the pane's one lime and it only exists while the form is open.
//
// ── THE FACTS ───────────────────────────────────────────────────────────────
// Role, member since, last sign in and the user id, read from the profile
// and the session. The role line says what the role is for in the words the
// invite always used, admin runs the place, manager runs projects, team is
// limited. super_admin is set in SQL only and the line says so. The id copies
// in full, it is a person's own row id and not a secret, and the copy is how
// somebody hands it to the studio when something is wrong.
//
// ── SESSIONS ────────────────────────────────────────────────────────────────
// Sign out ends this device. Sign out everywhere is new, signOut with scope
// global, which revokes every refresh token for the user, this device too.
// It asks once in place before it goes, because it also signs out the
// phone in somebody's pocket.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import {
  Box, VStack, HStack, Text, Input, Button, Icon, useToast, InputGroup, InputRightElement,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { TbCheck, TbCopy, TbEye, TbEyeOff } from 'react-icons/tb';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE, INSET, MEASURE, HEAD_GAP, FIELD_H } from '../../../theme/layout';
import { PageHead, Section, Field, Rows, Row } from '../../../components/common/Page';

const P = colors.paper;

const ROLE = {
  super_admin: { label: 'Super admin', say: 'Everything, and set in SQL only, never from here' },
  admin: { label: 'Admin', say: 'Runs the place, the team and the tools included' },
  manager: { label: 'Manager', say: 'Runs projects' },
  team: { label: 'Team', say: 'Works on projects, with a limited view' },
  client: { label: 'Client', say: 'Your own work with the studio, invoices, reports and messages' },
};

const Value = ({ children, mono = false }) => (
  <Text fontSize={TYPE.small} fontWeight="600" color={P.ink} fontFamily={mono ? 'mono' : undefined} textAlign="right">
    {children}
  </Text>
);

const PasswordField = ({ label, value, onChange, autoComplete, show, onToggle }) => (
  <Field label={label}>
    <InputGroup>
      <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={show ? '' : '••••••••'} pr={12} />
      <InputRightElement pr={INSET} w="auto" h={FIELD_H}>
        <Box as="button" type="button" onClick={onToggle} p={1} borderRadius="md" color={P.inkFaint} _hover={{ color: P.ink }} aria-label={show ? 'Hide password' : 'Show password'}>
          <Icon as={show ? TbEyeOff : TbEye} boxSize={4} />
        </Box>
      </InputRightElement>
    </InputGroup>
  </Field>
);

const PasswordForm = ({ user, onDone }) => {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [changing, setChanging] = useState(false);

  const flip = (key) => setShow((s) => ({ ...s, [key]: !s[key] }));

  const change = async () => {
    if (next.length < 6) { toast({ title: 'Too short', description: 'Six characters at least', status: 'warning', duration: 3000 }); return; }
    if (next !== confirm) { toast({ title: 'The two new passwords differ', status: 'warning', duration: 3000 }); return; }
    setChanging(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signInError) throw new Error('The current password is not right');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast({ title: 'Password changed', status: 'success', duration: 2000 });
      onDone();
    } catch (err) {
      toast({ title: 'Password not changed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setChanging(false);
    }
  };

  return (
    <VStack as="form" onSubmit={(e) => { e.preventDefault(); change(); }} spacing={5} align="stretch" maxW={MEASURE} pt={4}>
      <PasswordField label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" show={show.current} onToggle={() => flip('current')} />
      <PasswordField label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" show={show.next} onToggle={() => flip('next')} />
      <PasswordField label="New password again" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" show={show.confirm} onToggle={() => flip('confirm')} />
      <HStack spacing={2}>
        <Button type="submit" size="md" isLoading={changing} loadingText="Changing" isDisabled={!current || !next || !confirm}>
          Change password
        </Button>
        <Button size="md" variant="ghost" onClick={onDone} isDisabled={changing}>Cancel</Button>
      </HStack>
    </VStack>
  );
};

const CopyId = ({ id }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <HStack spacing={1.5}>
      <Value mono>{id ? `${id.slice(0, 8)}…` : 'unknown'}</Value>
      {id && (
        <Button size="xs" variant="ghost" onClick={copy} aria-label="Copy your user id" px={2} leftIcon={<Icon as={copied ? TbCheck : TbCopy} boxSize={3.5} color={copied ? P.green : undefined} />}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      )}
    </HStack>
  );
};

const Account = ({ user, profile }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(null);

  const role = ROLE[profile?.role] || { label: profile?.role || 'Unknown', say: 'A role Pulse does not describe yet' };
  const memberSince = profile?.created_at ? format(new Date(profile.created_at), 'MMM d, yyyy') : 'unknown';
  const lastSignIn = user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, h:mm a') : 'this is the first';

  const signOut = async (scope) => {
    setLeaving(scope);
    const { error } = await supabase.auth.signOut(scope === 'global' ? { scope: 'global' } : undefined);
    if (error) {
      toast({ title: 'Sign out failed', description: error.message, status: 'error', duration: 3000 });
      setLeaving(null);
      return;
    }
    toast({ title: scope === 'global' ? 'Signed out everywhere' : 'Signed out', status: 'success', duration: 2000 });
    navigate('/login/');
  };

  return (
    <VStack align="stretch" spacing={HEAD_GAP}>
      <PageHead kicker="Settings" title="Account" lede="Your password, what your role is for and where you are signed in." />

      <Section kicker="Password">
        <Rows flush>
          <Row
            label="Password"
            desc="Change it with the current one in hand."
            control={!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change</Button>}
          >
            {editing && <PasswordForm user={user} onDone={() => setEditing(false)} />}
          </Row>
        </Rows>
      </Section>

      <Section kicker="This account">
        <Rows flush>
          <Row label="Role" desc={role.say} control={<Value>{role.label}</Value>} />
          <Row label="Member since" control={<Value>{memberSince}</Value>} />
          <Row label="Last sign in" control={<Value>{lastSignIn}</Value>} />
          <Row label="User id" desc="Copy it when the studio asks which account is yours." control={<CopyId id={user?.id} />} />
        </Rows>
      </Section>

      <Section kicker="Sessions">
        <Rows flush>
          <Row
            label="Sign out"
            desc="Ends this session on this device."
            control={<Button size="sm" variant="outline" isLoading={leaving === 'local'} loadingText="Signing out" onClick={() => signOut('local')}>Sign out</Button>}
          />
          <Row
            label="Sign out everywhere"
            desc="Ends every session on every device, this one too. For a lost phone or a shared computer."
            control={asking ? (
              <HStack spacing={2}>
                <Button size="sm" variant="ghost" color={P.coral} isLoading={leaving === 'global'} loadingText="Signing out" onClick={() => signOut('global')}>Yes, everywhere</Button>
                <Button size="sm" variant="ghost" onClick={() => setAsking(false)} isDisabled={leaving === 'global'}>Keep</Button>
              </HStack>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAsking(true)} _hover={{ color: P.coral, borderColor: `${P.coral}66`, bg: `${P.coral}0F` }}>
                Sign out everywhere
              </Button>
            )}
          />
        </Rows>
      </Section>
    </VStack>
  );
};

export default Account;
