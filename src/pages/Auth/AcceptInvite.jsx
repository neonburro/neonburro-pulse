// src/pages/Auth/AcceptInvite.jsx
// Where the Pulse invite email lands. send-team-invite.js calls
// inviteUserByEmail with redirectTo /accept-invite/, the mail written by
// scripts/auth-email-templates.mjs carries the link, and this page takes a
// name, a username and a first password.
//
// ── WHAT IS PRESERVED ────────────────────────────────────────────────────────
// Every step of the behavior is unchanged from the dark version. The invite
// tokens arrive in the URL hash and setSession takes them, or an existing
// session is used. The display name is guessed from the email. The username
// rules, the taken check against profiles, updateUser for the password, the
// profiles upsert with role admin, then sign out and back to /login/. Only
// the words and the look moved. The first password set here is what fires
// the password changed notice, which is why that mail says "set or changed".
//
// ── WHAT CHANGED, 2026-10-05 ─────────────────────────────────────────────────
// The page moved onto the paper shell (components/AuthPaper.jsx). Its title
// is "Pull up a chair.", the same line as the invite email, so the tap lands
// where it left. The placeholders were Tyler's own name and handle and are
// plain prompts now. The rules lost their oxford commas. The form submits on
// Enter.
//
// No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { Box, VStack, FormControl, Spinner } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  P, AuthScreen, Brand, Heading, ErrorNote, Label, Hint, TextInput,
  PasswordInput, Pill, Done, QuietLink,
} from './components/AuthPaper';

const AcceptInvite = () => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState('');
  const navigate = useNavigate();

  // Capture the invite session from URL hash
  useEffect(() => {
    const handleInviteSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setError('This invite has expired. Ask the studio for a fresh one.');
          setReady(true);
          return;
        }

        // Get the invited user's email
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setInvitedEmail(user.email);
          // Pre-fill display name from email if possible
          const emailName = user.email.split('@')[0];
          setDisplayName(emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
        }

        // Clear the hash so refresh doesn't break
        window.history.replaceState(null, '', window.location.pathname);
      } else {
        // No tokens - check if there's already a session (came in without hash)
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setInvitedEmail(user.email);
          const emailName = user.email.split('@')[0];
          setDisplayName(emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
        } else {
          setError('Open this page from the invite email.');
        }
      }
      setReady(true);
    };

    handleInviteSession();
  }, []);

  const handleAccept = async () => {
    setError('');

    if (!displayName.trim()) {
      setError('Add your name.');
      return;
    }
    if (!username.trim() || username.length < 3) {
      setError('Usernames are three characters or more.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setError('Usernames take lowercase letters, numbers and underscores.');
      return;
    }
    if (password.length < 6) {
      setError('Six characters at least for the password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Check if username is taken
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        throw new Error('That username is taken.');
      }

      // Set the password
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('The session ran out. Open the invite link again.');

      // Create or update the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          display_name: displayName.trim(),
          username: username.toLowerCase().trim(),
          role: 'admin', // default role - owner can promote later
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      setSuccess(true);

      // Sign out so they log in fresh with new credentials
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login/');
      }, 2500);

    } catch (err) {
      setError(err.message || 'Could not finish the invite.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <AuthScreen>
        <Box display="flex" justifyContent="center">
          <Spinner color={P.limeDeep} size="lg" thickness="2px" />
        </Box>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Brand />

      {success ? (
        <Done title="You are in." line="Sign in with the new password." />
      ) : (
        <>
          <Heading
            title="Pull up a chair."
            line={invitedEmail ? `A seat in Pulse for ${invitedEmail}.` : 'A seat in Pulse.'}
          />

          <ErrorNote error={error} />

          {invitedEmail ? (
            <VStack
              as="form"
              spacing={5}
              onSubmit={(e) => {
                e.preventDefault();
                handleAccept();
              }}
            >
              <FormControl>
                <Label>Your name</Label>
                <TextInput
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="first and last"
                  autoComplete="name"
                />
              </FormControl>

              <FormControl>
                <Label>Username</Label>
                <TextInput
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="short and lowercase"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                />
                <Hint>Lowercase letters, numbers and underscores.</Hint>
              </FormControl>

              <FormControl>
                <Label>Password</Label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="six characters or more"
                />
              </FormControl>

              <FormControl>
                <Label>Once more</Label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="the same again"
                  enterKeyHint="go"
                />
              </FormControl>

              <Pill type="submit" mt={1} isLoading={loading} loadingText="Setting up">
                Take the seat
              </Pill>
            </VStack>
          ) : (
            <QuietLink to="/login/">Back to sign in</QuietLink>
          )}
        </>
      )}
    </AuthScreen>
  );
};

export default AcceptInvite;
