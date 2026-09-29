// src/pages/Report/PublicReport.jsx
// SENTINEL: NB_PULSE_PUBLIC_REPORT_V1
//
// What an owner sees when they open their monthly report from a text or an
// email. Prepared 2026-09-29 by Aster from Tyler's ask, "the link has got to
// be public, they have got to be able to open it".
//
// It is one of the few pages in Pulse that renders with no session, so it
// sits above the ProtectedRoute block in App.jsx beside login and accept
// invite. It carries no Pulse chrome, no nav, no sidebar. As far as the
// person reading it is concerned this is their report and not our software.
//
// ── WHY A TOKEN AND NOT A PASSWORD ──────────────────────────────────────
//
// Tyler asked whether this should carry a passcode, matched to a client
// login where one exists and issued where one does not.
//
// The token in the link already is the credential. It is long, unguessable,
// bound to one report and it expires, which is everything a password does
// here except that it costs the owner nothing. A passcode texted separately
// is a second thing to send, a second thing to lose and a support call on a
// Sunday, and it protects the same single document the link already names.
//
// Where it would be worth it is a portal, one address showing every report a
// client has ever had. That is a login, and it is the next piece of work, and
// it should reuse the client login rather than invent a code. This page is
// deliberately not that. One link, one report, one month.
//
// If a passcode is ever wanted on top, the place for it is the function, not
// here. This page would take a code alongside the token and post both, and
// report-public.js would check it. The door already answers every failure
// identically so adding a wrong code to that set changes nothing about what
// a caller can learn.
//
// ── HOW IT RENDERS ──────────────────────────────────────────────────────
//
// The report is already a finished html document, written for the client and
// carrying their own brand. It goes in an iframe srcDoc rather than being
// parsed into components, for the same reason client_reports.html is stored
// rather than regenerated, what the owner reads has to be the bytes we sent
// and not our re rendering of them.
//
// The frame is given the microphone, because the report asks the owner to
// talk rather than type and a framed page is refused the microphone unless
// the parent allows it. That permission is the whole reason the artifact
// version could not do it.
//
// Submitting is the page's job, not the frame's. The frame posts its state
// out, this page owns the network call and the one submit, and the door owns
// the timestamp.
//
// No oxford commas, no em dashes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Center, Spinner, VStack, Text, Icon } from '@chakra-ui/react';
import { TbAlertTriangle } from 'react-icons/tb';

const ENDPOINT = '/.netlify/functions/report-public';

const PublicReport = () => {
  const { token } = useParams();
  const frame = useRef(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [frameH, setFrameH] = useState(1200);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${ENDPOINT}?k=${encodeURIComponent(token || '')}`);
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) { setError(data.error || 'This link is not valid.'); return; }
        setReport(data);
        document.title = `${data.client?.name || 'Monthly report'}, ${new Date(data.period?.end || Date.now())
          .toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
      } catch {
        if (alive) setError('Could not load this report. Check your connection and try again.');
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // The frame tells us how tall it is and when the owner has sent it back.
  const onMessage = useCallback(async (e) => {
    const msg = e.data;
    if (!msg || msg.source !== 'cgc-report') return;

    if (msg.type === 'height' && Number(msg.height) > 0) {
      setFrameH(Math.ceil(Number(msg.height)));
      return;
    }

    if (msg.type === 'submit') {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            k: token,
            responses: msg.responses || {},
            submitted_html: msg.html || null,
            submitted_by: msg.by || null,
          }),
        });
        const data = await res.json();
        frame.current?.contentWindow?.postMessage(
          { source: 'pulse-report', type: 'submitted', ok: !!data.ok, submitted_at: data.submitted_at || null, error: data.error || null },
          '*',
        );
      } catch {
        frame.current?.contentWindow?.postMessage(
          { source: 'pulse-report', type: 'submitted', ok: false, error: 'Could not save that. Try again in a moment.' },
          '*',
        );
      }
    }
  }, [token]);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage]);

  if (error) {
    return (
      <Center minH="100vh" bg="#0B0B0C" px={6}>
        <VStack spacing={4} maxW="420px" textAlign="center">
          <Icon as={TbAlertTriangle} boxSize="30px" color="#C8893B" />
          <Text color="#F4F3F1" fontSize="17px" fontWeight="600">{error}</Text>
          <Text color="#A8A7A4" fontSize="14px">
            Links expire after a while. Reply to the message this came in on and we will send a fresh one.
          </Text>
        </VStack>
      </Center>
    );
  }

  if (!report) {
    return (
      <Center minH="100vh" bg="#0B0B0C">
        <Spinner thickness="2px" speed="0.7s" color="#C5D957" size="lg" />
      </Center>
    );
  }

  return (
    <Box bg="#0B0B0C" minH="100vh">
      <Box
        as="iframe"
        ref={frame}
        title="Monthly report"
        srcDoc={report.html}
        allow="microphone"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        width="100%"
        height={`${frameH}px`}
        border="0"
        display="block"
      />
    </Box>
  );
};

export default PublicReport;
