// src/pages/Mail/MailEditor.jsx
// SENTINEL: NB_PULSE_MAIL_EDITOR_V1
//
// One letter, fields on one side and the letter on the other. Tyler,
// 2026-10-05, "send something just like that. If we want to edit the text
// in it, we can." Route /mail/:mailId/.
//
// ── THE ONE RENDERER ────────────────────────────────────────────────────────
// The preview is renderMail(doc) from src/lib/mailRender.js, called here on
// every edit. netlify/functions/mail-send.js calls the same function on the
// saved row when a test or a send is pressed. There is no second template
// and there must never be one, it is the only reason the preview can be
// trusted. The hash of what this page renders is compared with the hash the
// door stored for the last test, so the page can say tested, this exact
// version, without asking the server.
//
// ── SAVE, TEST, SEND ────────────────────────────────────────────────────────
// Save writes the whole normalized document to mail_documents.doc, never a
// partial, see the header of src/lib/mailDocument.js. Send a test saves
// first when there are edits, because the door renders the row and not this
// screen. Send opens MailSendGate, which only opens its own button once the
// saved version has been tested to tyler@neonburro.com and nothing blocks.
// Drafts stay drafts, nothing here sends on its own.
//
// ── THE LAYOUT ──────────────────────────────────────────────────────────────
// Side by side from lg, which this theme sets at 1440 and not Chakra's 992
// (src/theme/index.js breakpoints), the same width the sidebar appears. The
// preview is held at up to 640 so the 600 column reads at its real width
// beside the sidebar. Below lg the preview stacks under the fields, which is
// the phone and the iPad either way up. The preview column is sticky with
// its own scroll so it stays beside the field being typed in. Checked at
// 390, 834 and 1440, the three process.
//
// ── KIND, CLIENT AND APPROVAL ────────────────────────────────────────────────
// The row carries kind, origin and status, the document does not. A letter
// with no client cannot be sent, a system drafted one cannot be sent until
// it is approved, and the gate shows those in words from rowProblems in
// src/lib/mailDocument.js, the same function the door runs. A proposed row
// opens here with Approve and Dismiss in the head. The client's open items
// are read with loadOpenItems from src/lib/mailItems.js, the same read the
// door makes, and handed to renderMail so the preview prints them with
// their ages exactly as the letter will.
//
// ── THE FIXTURE ─────────────────────────────────────────────────────────────
// fixture is a document handed in by src/pages/Mail/MailFixture.jsx, the
// development only door in App.jsx. With it this page reads and writes
// nothing. A test is faked locally so the gate can be looked at and every
// action says so in its toast. Production never mounts it.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, VStack, HStack, Text, Icon, Button, useToast,
} from '@chakra-ui/react';
import {
  TbArrowLeft, TbDeviceFloppy, TbFlask, TbSend, TbCopy, TbTrash, TbAlertTriangle, TbInfoCircle, TbCheck, TbX,
} from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { renderMail } from '../../lib/mailRender';
import { loadOpenItems } from '../../lib/mailItems';
import {
  normalizeMail, checkMail, rowProblems, blockingFor, presetForClient, themeMatchesPreset, themeLabel,
  kindLabel, hasOpenItemsBlock, sampleItems, PRESETS, TEST_TO,
} from '../../lib/mailDocument';
import { approveDoc, dismissDoc } from './client/mailData';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST } from '../../theme/layout';
import { Page, Kicker, Section, Loading, Empty } from '../../components/common/Page';
import { formatDateTime } from '../../lib/time';
import MailFields from './components/MailFields';
import MailPreview from './components/MailPreview';
import MailSendGate from './components/MailSendGate';
import SendHistory from './components/SendHistory';

const P = colors.paper;

const sha256 = async (text) => {
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const bearer = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return `Bearer ${session?.access_token || ''}`;
};

const callDoor = async (body) => {
  const res = await fetch('/.netlify/functions/mail-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await bearer() },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data) return { ok: false, error: `the mail door answered ${res.status} with nothing` };
  return data;
};

const snapshot = (doc, clientId, kind) => JSON.stringify({ doc: normalizeMail(doc), clientId: clientId || null, kind: kind || 'letter' });

const MailEditor = ({ fixture = null }) => {
  const { mailId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(!fixture);
  const [missing, setMissing] = useState(null);
  const [doc, setDoc] = useState(() => (fixture ? normalizeMail(fixture) : null));
  const [clientId, setClientId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [sentAt, setSentAt] = useState(null);
  const [saved, setSaved] = useState(() => (fixture ? snapshot(fixture, null, 'letter') : ''));
  const [kind, setKind] = useState('letter');
  const [hasKind, setHasKind] = useState(!!fixture);
  const [row, setRow] = useState(fixture ? { origin: 'hand', status: 'draft', client_id: 'fixture' } : null);
  const [items, setItems] = useState(() => (fixture ? sampleItems() : []));
  const [itemsMissing, setItemsMissing] = useState(false);
  const [clients, setClients] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(null);
  const [gate, setGate] = useState(false);
  const [width, setWidth] = useState('desktop');
  const [hash, setHash] = useState(null);
  const [armDelete, setArmDelete] = useState(false);

  // ── reading ───────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (fixture || !mailId) return;
    const { data } = await supabase
      .from('mail_sends')
      .select('id, kind, status, to_emails, cc_emails, subject, from_address, sent_by_email, resend_id, error, content_hash, created_at, html')
      .eq('document_id', mailId)
      .order('created_at', { ascending: false })
      .limit(25);
    setHistory(data || []);
  }, [fixture, mailId]);

  useEffect(() => {
    if (fixture) return undefined;
    let live = true;
    (async () => {
      setLoading(true);
      const [row, book] = await Promise.all([
        supabase.from('mail_documents').select('*').eq('id', mailId).maybeSingle(),
        supabase.from('clients').select('id, name, company, email').order('company', { ascending: true, nullsFirst: false }),
      ]);
      if (!live) return;
      if (row.error || !row.data) {
        setMissing(row.error ? row.error.message : 'That letter does not exist, or it was deleted.');
        setLoading(false);
        return;
      }
      const next = normalizeMail(row.data.doc);
      const k = row.data.kind || 'letter';
      setDoc(next);
      setRow(row.data);
      setKind(k);
      setHasKind(Object.prototype.hasOwnProperty.call(row.data, 'kind'));
      setClientId(row.data.client_id || null);
      setStatus(row.data.status || 'draft');
      setSentAt(row.data.sent_at || null);
      setSaved(snapshot(next, row.data.client_id, k));
      setClients(book.data || []);
      setLoading(false);
    })();
    loadHistory();
    return () => { live = false; };
  }, [fixture, mailId, loadHistory]);

  // ── the client's open items, the same read the door makes ─────────────────
  useEffect(() => {
    if (fixture || !clientId) { if (!fixture) setItems([]); return undefined; }
    let live = true;
    loadOpenItems(supabase, clientId).then((res) => {
      if (!live) return;
      setItems(res.items);
      setItemsMissing(res.missing);
    });
    return () => { live = false; };
  }, [fixture, clientId, history.length]);

  // ── what it renders, and what was tested ─────────────────────────────────
  const rendered = useMemo(() => (doc ? renderMail(doc, { items }) : null), [doc, items]);
  const previewHtml = useDeferredValue(rendered?.html || '');
  const rowState = { ...(row || {}), client_id: fixture ? 'fixture' : clientId, kind, status };
  const problems = useMemo(() => (doc ? [...rowProblems(rowState), ...checkMail(doc)] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, clientId, kind, status, row]);
  const blockingSend = blockingFor(problems, 'send');
  const advice = problems.filter((p) => !p.block);
  const dirty = !!doc && snapshot(doc, clientId, kind) !== saved;
  const proposed = status === 'proposed';

  useEffect(() => {
    if (!rendered) return undefined;
    let live = true;
    sha256(rendered.hashInput).then((h) => { if (live) setHash(h); });
    return () => { live = false; };
  }, [rendered]);

  const lastTest = history.find((r) => r.kind === 'test' && r.status === 'sent') || null;
  const tested = !!lastTest && !!hash && lastTest.content_hash === hash;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ── the hands ─────────────────────────────────────────────────────────────
  const say = (title, description, kind = 'success') => toast({ title, description, status: kind, duration: kind === 'success' ? 3000 : 7000 });

  const save = useCallback(async () => {
    if (!doc) return false;
    const clean = normalizeMail(doc);
    if (fixture) {
      setSaved(snapshot(clean, clientId, kind));
      say('Fixture', 'Nothing is saved from the fixture.', 'info');
      return true;
    }
    setBusy('save');
    const patch = { doc: clean, client_id: clientId || null, updated_by: user?.id || null };
    if (hasKind) patch.kind = kind;
    const { error } = await supabase
      .from('mail_documents')
      .update(patch)
      .eq('id', mailId);
    setBusy(null);
    if (error) { say('Not saved', error.message, 'error'); return false; }
    setSaved(snapshot(clean, clientId, kind));
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, clientId, kind, hasKind, fixture, mailId, user]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) save().then((ok) => ok && !fixture && say('Saved', 'The draft is saved.'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, save, fixture]);

  const sendTest = async () => {
    if (dirty && !(await save())) return;
    if (fixture) {
      setHistory((rows) => [{
        id: `fixture-${Date.now()}`, kind: 'test', status: 'sent', to_emails: [TEST_TO], cc_emails: [],
        subject: `Test • ${rendered.subject}`, from_address: '', content_hash: hash, created_at: new Date().toISOString(), html: rendered.html,
      }, ...rows]);
      say('Fixture', 'A local test row was added. Nothing was sent.', 'info');
      return;
    }
    setBusy('test');
    const answer = await callDoor({ document_id: mailId, mode: 'test' });
    setBusy(null);
    if (!answer.ok) { say('The test did not go', answer.error, 'error'); return; }
    say('Test sent', `It is on its way to ${TEST_TO}.${answer.notes?.length ? ` ${answer.notes.join(' ')}` : ''}`);
    loadHistory();
  };

  const send = async ({ again }) => {
    if (fixture) { say('Fixture', 'Nothing is ever sent from the fixture.', 'info'); setGate(false); return; }
    setBusy('send');
    const answer = await callDoor({ document_id: mailId, mode: 'send', again });
    setBusy(null);
    if (!answer.ok) { say('Nothing went', answer.error, 'error'); return; }
    setGate(false);
    setStatus('sent');
    setSentAt(answer.at || new Date().toISOString());
    const n = (answer.to?.length || 0) + (answer.cc?.length || 0);
    say('Sent', `It went to ${n} ${n === 1 ? 'address' : 'addresses'} and the studio inbox has the notice.${answer.notes?.length ? ` ${answer.notes.join(' ')}` : ''}`);
    loadHistory();
  };

  const duplicate = async () => {
    if (fixture) { say('Fixture', 'Nothing is copied from the fixture.', 'info'); return; }
    setBusy('duplicate');
    const { data, error } = await supabase
      .from('mail_documents')
      .insert({ doc: normalizeMail(doc), client_id: clientId || null, status: 'draft', created_by: user?.id || null, updated_by: user?.id || null })
      .select('id')
      .maybeSingle();
    setBusy(null);
    if (error || !data) { say('Not copied', error?.message || 'the copy did not write', 'error'); return; }
    say('Copied', 'A fresh draft with the same words and colours.');
    navigate(`/mail/${data.id}/`);
  };

  const remove = async () => {
    if (!armDelete) { setArmDelete(true); return; }
    if (fixture) { setArmDelete(false); say('Fixture', 'Nothing is deleted from the fixture.', 'info'); return; }
    setBusy('delete');
    const { error } = await supabase.from('mail_documents').delete().eq('id', mailId);
    setBusy(null);
    if (error) { say('Not deleted', error.message, 'error'); return; }
    navigate('/mail/');
  };

  const decide = async (fn, done) => {
    if (fixture) { say('Fixture', 'Nothing is approved from the fixture.', 'info'); return; }
    if (dirty && !(await save())) return;
    setBusy('decide');
    const err = await fn(mailId, user?.id);
    setBusy(null);
    if (err) { say('Not changed', err, 'error'); return; }
    const { data } = await supabase.from('mail_documents').select('*').eq('id', mailId).maybeSingle();
    if (data) { setRow(data); setStatus(data.status); }
    say(done, null, 'success');
  };

  const pickClient = (id) => {
    const next = id || null;
    setClientId(next);
    const client = clients.find((c) => c.id === next);
    if (!client) return;
    setDoc((d) => {
      let out = d;
      if (!d.to.length && client.email) out = { ...out, to: [String(client.email).toLowerCase()] };
      const preset = presetForClient(client);
      if (preset && themeMatchesPreset(d.theme) && d.theme.preset === PRESETS.neonburro.key) {
        out = { ...out, theme: { preset: preset.key, ...preset.base } };
      }
      return out;
    });
  };

  // ── the page ──────────────────────────────────────────────────────────────
  if (loading) return <Page><Loading label="opening the letter" /></Page>;
  if (missing || !doc) {
    return (
      <Page>
        <Empty
          hint={missing}
          action={<Button size="sm" variant="outline" onClick={() => navigate('/mail/')}>All mail</Button>}
        >
          This letter could not be opened.
        </Empty>
      </Page>
    );
  }

  const count = doc.to.length + doc.cc.filter((e) => !doc.to.includes(e)).length;
  const statusWord = status === 'sent' ? `sent ${sentAt ? formatDateTime(sentAt) : ''}` : status;

  return (
    <Page spacing={6}>
      <HStack
        as="button"
        type="button"
        spacing={2}
        color={P.inkMuted}
        _hover={{ color: P.ink }}
        transition={`color ${FAST} ${EASE}`}
        onClick={() => navigate(fixture ? '/__review/mail/' : '/mail/')}
        alignSelf="flex-start"
      >
        <Icon as={TbArrowLeft} boxSize={3.5} />
        <Kicker color="inherit">All mail</Kicker>
      </HStack>

      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" align="flex-end" flexWrap="wrap" gap={4}>
          <VStack align="start" spacing={1.5} minW={0} flex="1 1 320px">
            <HStack spacing={3}>
              <Kicker color={status === 'sent' ? P.green : proposed ? P.gold : P.inkMuted}>{statusWord}</Kicker>
              {hasKind && <Kicker color={P.inkFaint}>{kindLabel(kind)}</Kicker>}
              <Kicker color={P.inkFaint}>{themeLabel(doc.theme)}</Kicker>
              {dirty && <Kicker color={P.gold}>unsaved</Kicker>}
            </HStack>
            <Text fontSize={TYPE.title} fontWeight="600" letterSpacing="-0.03em" lineHeight="1.1" color={P.ink}>
              {doc.subject.trim() || 'Untitled letter'}
            </Text>
            <Text fontSize={TYPE.lede} color={P.inkMuted}>
              {count ? `to ${doc.to[0] || doc.cc[0]}${count > 1 ? ` and ${count - 1} more` : ''}` : 'nobody yet'}
            </Text>
          </VStack>

          <HStack spacing={2} flexWrap="wrap" rowGap={2}>
            {proposed && (
              <>
                <Button size="sm" variant="outline" leftIcon={<Icon as={TbCheck} boxSize={4} />} onClick={() => decide(approveDoc, 'Approved. Test it and send it when it reads right.')} isLoading={busy === 'decide'}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<Icon as={TbX} boxSize={4} />} onClick={() => decide(dismissDoc, 'Dismissed. It is kept and never goes.')}>
                  Dismiss
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={TbDeviceFloppy} boxSize={4} />}
              onClick={() => save().then((ok) => ok && !fixture && say('Saved', 'The draft is saved.'))}
              isDisabled={!dirty}
              isLoading={busy === 'save'}
              loadingText="Saving"
            >
              {dirty ? 'Save draft' : 'Saved'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={TbFlask} boxSize={4} />}
              onClick={sendTest}
              isLoading={busy === 'test'}
              loadingText="Testing"
              isDisabled={!doc.subject.trim()}
              title={`Goes to ${TEST_TO} and nobody else`}
            >
              {tested ? 'Test again' : 'Send a test to me'}
            </Button>
            <Button size="sm" leftIcon={<Icon as={TbSend} boxSize={4} />} onClick={() => setGate(true)}>
              {status === 'sent' ? 'Send again' : 'Send'}
            </Button>
          </HStack>
        </HStack>

        <Text fontSize={TYPE.small} color={tested ? P.green : P.inkMuted}>
          {tested
            ? `This version went to ${TEST_TO} as a test ${formatDateTime(lastTest.created_at)}. The send is open.`
            : `A test goes to ${TEST_TO} and nobody else. The real send opens once this exact version has been tested.`}
        </Text>

        {proposed && (
          <Text fontSize={TYPE.small} color={P.gold}>
            Drafted by {String(row?.origin || 'the system').replace(/^system:/, '')} and waiting on you. Read it, change anything, then approve it. Approving sends nothing, the send is still yours after a test.
          </Text>
        )}
        {itemsMissing && hasOpenItemsBlock(doc) && (
          <Text fontSize={TYPE.small} color={P.inkMuted}>
            The open items block prints nothing is waiting, because the open items table arrives with supabase/migrations/20261005130000_mail_updates_and_open_items.sql.
          </Text>
        )}

        {(blockingSend.length > 0 || advice.length > 0) && (
          <VStack align="stretch" spacing={1.5}>
            {blockingSend.map((p) => (
              <HStack key={p.text} spacing={2} align="flex-start">
                <Icon as={TbAlertTriangle} boxSize={3.5} color={P.coral} mt={0.5} flexShrink={0} />
                <Text fontSize={TYPE.small} color={P.coral}>{p.text}</Text>
              </HStack>
            ))}
            {advice.map((p) => (
              <HStack key={p.text} spacing={2} align="flex-start">
                <Icon as={TbInfoCircle} boxSize={3.5} color={P.inkFaint} mt={0.5} flexShrink={0} />
                <Text fontSize={TYPE.small} color={P.inkMuted}>{p.text}</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {history.length > 0 && (
          <Section kicker="tests and sends" count={history.length}>
            <SendHistory rows={history} />
          </Section>
        )}
      </VStack>

      <Grid
        templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(340px, 1fr) minmax(0, 640px)' }}
        gap={{ base: 10, lg: 8 }}
        alignItems="start"
      >
        <Box minW={0}>
          <MailFields
            doc={doc}
            onChange={setDoc}
            clients={clients}
            clientId={clientId}
            onClientChange={fixture ? null : pickClient}
            kind={kind}
            onKindChange={hasKind ? setKind : null}
          />
        </Box>
        <Box
          minW={0}
          position={{ base: 'static', lg: 'sticky' }}
          top={{ lg: 4 }}
          maxH={{ lg: 'calc(100dvh - 32px)' }}
          overflowY={{ lg: 'auto' }}
          pb={{ lg: 4 }}
        >
          <MailPreview html={previewHtml} width={width} onWidth={setWidth} />
        </Box>
      </Grid>

      <HStack spacing={6} pt={4} flexWrap="wrap" rowGap={3}>
        <HStack
          as="button"
          type="button"
          spacing={1.5}
          onClick={duplicate}
          color={P.inkMuted}
          _hover={{ color: P.ink }}
          transition={`all ${FAST} ${EASE}`}
        >
          <Icon as={TbCopy} boxSize={3} />
          <Kicker color="inherit">{busy === 'duplicate' ? 'Copying' : 'Duplicate as a new draft'}</Kicker>
        </HStack>
        <HStack
          as="button"
          type="button"
          spacing={1.5}
          onClick={remove}
          onBlur={() => setArmDelete(false)}
          color={armDelete ? P.coral : P.inkFaint}
          _hover={{ color: P.coral }}
          transition={`all ${FAST} ${EASE}`}
        >
          <Icon as={armDelete ? TbAlertTriangle : TbTrash} boxSize={3} />
          <Kicker color="inherit">
            {busy === 'delete' ? 'Deleting' : armDelete ? 'Press again to delete this letter' : 'Delete this letter'}
          </Kicker>
        </HStack>
      </HStack>

      <MailSendGate
        isOpen={gate}
        onClose={() => setGate(false)}
        doc={doc}
        html={rendered?.html || ''}
        blocking={blockingSend}
        tested={tested}
        lastTest={lastTest}
        dirty={dirty}
        status={status}
        sentAt={sentAt}
        sending={busy === 'send'}
        testing={busy === 'test'}
        onTest={sendTest}
        onSend={send}
      />
    </Page>
  );
};

export default MailEditor;
