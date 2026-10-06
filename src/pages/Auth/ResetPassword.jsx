// src/pages/Auth/ResetPassword.jsx
// Where the recovery email lands. Pulse's forgot password (Login.jsx) asks
// Supabase for a reset with redirectTo /reset-password/, the mail written by
// scripts/auth-email-templates.mjs carries the link, and this page sets the
// new password.
//
// ── WHAT IS PRESERVED ────────────────────────────────────────────────────────
// The session handling is unchanged from the dark version. The recovery
// tokens arrive in the URL hash, setSession takes them, the hash is cleared
// so a refresh cannot replay it, and ready gates the button until that has
// run. After updateUser the page signs out and returns to /login/ so the new
// password is used once straight away. That updateUser is also what fires the
// password changed notice, if its switch is on.
//
// ── WHAT CHANGED, 2026-10-05 ─────────────────────────────────────────────────
// The page moved onto the paper shell (components/AuthPaper.jsx), the same
// cream as the sign in page and the email that sent the person here. The
// form submits on Enter. An expired or reused link used to show Supabase's
// raw "Auth session missing" and now says what to do instead.
//
// No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { VStack, FormControl } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  AuthScreen, Brand, Heading, ErrorNote, PasswordInput, Pill, Done, QuietLink,
} from './components/AuthPaper';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // Capture the recovery session from URL hash and prevent auto-redirect
  useEffect(() => {
    const handleRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          // Clear the hash so user can't accidentally re-trigger
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      setReady(true);
    };

    handleRecoverySession();
  }, []);

  const handleReset = async () => {
    setError('');
    if (password.length < 6) {
      setError('Six characters at least.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      // Sign out so they have to log in fresh with new password
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login/'), 2500);
    } catch (err) {
      const message = err?.message || '';
      setError(
        /session/i.test(message)
          ? 'This link has expired. Ask for a fresh one from sign in.'
          : message || 'Could not save the password.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen>
      <Brand />

      {success ? (
        <Done title="Saved." line="Back to sign in with the new one." />
      ) : (
        <>
          <Heading title="A fresh password." line="Six characters or more. Then sign in with it." />

          <ErrorNote error={error} />

          <VStack
            as="form"
            spacing={4}
            onSubmit={(e) => {
              e.preventDefault();
              handleReset();
            }}
          >
            <FormControl>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="new password"
                enterKeyHint="next"
              />
            </FormControl>
            <FormControl>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="once more"
                enterKeyHint="go"
              />
            </FormControl>
            <Pill type="submit" mt={2} isLoading={loading} loadingText="Saving" isDisabled={!ready}>
              Save the password
            </Pill>
          </VStack>

          <QuietLink to="/login/">Back to sign in</QuietLink>
        </>
      )}
    </AuthScreen>
  );
};

export default ResetPassword;
