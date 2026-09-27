// src/pages/Reports/index.jsx
// SENTINEL: NB_PULSE_REPORTS_PAGE_V1
//
// The room behind the monthly client report. Tyler's ask on 2026-09-27, in
// his words: "all we have to do is approve it once, and then it's automated.
// It'd be cool if neonburro got an admin notification for anything that's
// going out. We need to have a preview of what their report looks like for
// every client."
//
// Three things live on this page and nothing else does.
//
//   1. EVERY CLIENT, with two pips each. Approved or waiting, and their own
//      palette or the house one. The list is the whole book and not a
//      filtered view, because a client who has never been invoiced is
//      exactly the client this feature exists for. Three of the eleven on
//      the books have never been invoiced once.
//   2. THE PREVIEW, for whichever client is selected, always available and
//      sending nothing. The html comes from client-report-preview.js, which
//      calls the same renderReport the schedule calls, so this iframe holds
//      the bytes a client would receive. If the preview ever rendered from
//      a template in this file it would stop being worth looking at, so it
//      does not, and it must not be made to.
//   3. THE GATE. Approve once and the monthly schedule picks that client up
//      from then on. Until then the schedule skips them and the count at
//      the top says how many are waiting.
//
// ── WHAT THIS PAGE REFUSES TO IMPLY ─────────────────────────────────────────
//
// A client with no brand kit gets the house letterhead, and the banner above
// the preview says so in plain words rather than letting a finished looking
// cream page suggest the branding is done. brand.house comes from the
// function, derived from the columns, and is never guessed here.
//
// ── SENDING IS A PERSON'S HAND, TWICE ───────────────────────────────────────
//
// Send is two presses. The first arms it and prints the actual addresses the
// mail would reach, the second sends. That is not friction for its own sake,
// it is the house rule that nothing reaches a client on a machine's
// signature, and the addresses are printed because the only unrecoverable
// mistake here is the right report to the wrong inbox.
//
// ── BEFORE THE MIGRATION ────────────────────────────────────────────────────
//
// supabase/migrations/20260927150000_client_reports.sql adds every brand and
// gate column this page reads. Until it is applied the select fails, and
// rather than showing an error this page falls back to the plain client list
// and prints one line saying the migration is pending. That is the honest
// state, it is visible, and nothing here works around it.
//
// Composed from src/components/common/Page.jsx. This file types no width, no
// gutter, no inset and no font size. Read src/theme/layout.js first.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Grid, HStack, VStack, Text, Button, Select, Icon } from '@chakra-ui/react';
import { TbCircleCheck, TbClock, TbPalette, TbSend, TbRefresh } from 'react-icons/tb';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, PLATE_RADIUS, FAST, EASE } from '../../theme/layout';
import { Page, PageHead, Section, Plate, Empty, Loading, Stats, Kicker } from '../../components/common/Page';

const P = colors.paper;

// The columns the migration adds. Selected as one string so the fallback
// below can drop them in a single swap rather than guessing which failed.
const REPORT_COLUMNS = 'report_approved, report_approved_at, report_sender, report_to, brand_ink, brand_soft, brand_accent, brand_edge, brand_paper, brand_mark_url';
const BASE_COLUMNS = 'id, name, company, email, status';

// The last twelve closed months, newest first. A month that has not finished
// is not offered, because half a month of numbers in a client's colours is
// the exact thing this build is trying not to do.
const closedMonths = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 0));
    return {
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  });
};

const bearer = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return `Bearer ${session?.access_token || ''}`;
};

const call = async (path, body) => {
  const res = await fetch(`/.netlify/functions/${path}`, {
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
  if (!data) return { ok: false, error: `the ${path} door answered ${res.status} with nothing` };
  return data;
};

const Pip = ({ icon, tone, children }) => (
  <HStack spacing={1} flexShrink={0}>
    <Icon as={icon} boxSize={3} color={tone} />
    <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.12em" textTransform="uppercase" color={tone}>
      {children}
    </Text>
  </HStack>
);

const ClientRow = ({ client, selected, onSelect, migrated }) => {
  const approved = !!client.report_approved;
  const branded = !!(client.brand_ink || client.brand_accent || client.brand_paper || client.brand_mark_url);
  return (
    <VStack
      as="button"
      type="button"
      onClick={() => onSelect(client.id)}
      align="stretch"
      spacing={1}
      w="100%"
      textAlign="left"
      px={3}
      py={2.5}
      borderRadius="12px"
      bg={selected ? P.sunken : 'transparent'}
      transition={`background ${FAST} ${EASE}`}
      _hover={{ bg: P.sunken }}
    >
      <Text fontSize={TYPE.body} fontWeight={selected ? '600' : '500'} color={P.ink} noOfLines={1}>
        {client.company || client.name}
      </Text>
      <HStack spacing={3}>
        {migrated && (approved
          ? <Pip icon={TbCircleCheck} tone={P.green}>approved</Pip>
          : <Pip icon={TbClock} tone={P.gold}>waiting</Pip>)}
        {migrated && branded && <Pip icon={TbPalette} tone={P.limeDeep}>their palette</Pip>}
        {!client.email && <Pip icon={TbClock} tone={P.coral}>no address</Pip>}
      </HStack>
    </VStack>
  );
};

const ReportsPage = () => {
  const [params, setParams] = useSearchParams();
  const months = useMemo(closedMonths, []);

  const [clients, setClients] = useState([]);
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [selected, setSelected] = useState(params.get('client') || null);
  const [period, setPeriod] = useState(months[0].value);

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [armed, setArmed] = useState(false);
  const [working, setWorking] = useState(null);
  const [outcome, setOutcome] = useState(null);

  // ── the book ──────────────────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const full = await supabase
      .from('clients')
      .select(`${BASE_COLUMNS}, ${REPORT_COLUMNS}`)
      .order('company', { ascending: true, nullsFirst: false });

    if (!full.error) {
      setMigrated(true);
      setClients(full.data || []);
      setLoading(false);
      return;
    }

    // The migration is not applied. Fall back and say so rather than erroring
    // at somebody who has no way to know which column is missing.
    const base = await supabase.from('clients').select(BASE_COLUMNS).order('company', { ascending: true, nullsFirst: false });
    setMigrated(false);
    setClients(base.data || []);
    setListError(base.error ? base.error.message : null);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  useEffect(() => {
    if (!selected && clients.length) setSelected(clients[0].id);
  }, [clients, selected]);

  // ── the preview ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return undefined;
    let live = true;
    setPreviewing(true);
    setPreview(null);
    setPreviewError(null);
    setArmed(false);
    setOutcome(null);
    call('client-report-preview', { client_id: selected, period_end: period }).then((answer) => {
      if (!live) return;
      if (answer.ok) setPreview(answer);
      else setPreviewError(answer.error || 'the preview did not build');
      setPreviewing(false);
    });
    return () => { live = false; };
  }, [selected, period]);

  const select = (id) => {
    setSelected(id);
    setParams(id ? { client: id } : {});
  };

  const client = clients.find((c) => c.id === selected) || null;
  const approvedCount = clients.filter((c) => c.report_approved).length;
  const waitingCount = clients.length - approvedCount;
  const brandedCount = clients.filter((c) => c.brand_ink || c.brand_accent || c.brand_paper || c.brand_mark_url).length;

  const approve = async (next) => {
    if (!client) return;
    setWorking('approve');
    const answer = await call('client-report-approve', { client_id: client.id, approved: next });
    setWorking(null);
    if (!answer.ok) { setOutcome({ bad: true, text: answer.error || 'the gate did not move' }); return; }
    setClients((rows) => rows.map((r) => (r.id === client.id
      ? { ...r, report_approved: answer.approved, report_approved_at: answer.approved_at }
      : r)));
    setPreview((p) => (p ? { ...p, approved: answer.approved } : p));
    setOutcome({ text: answer.approved
      ? 'approved. the schedule picks this client up on the 1st from now on.'
      : 'closed. the schedule skips this client until it is approved again.' });
  };

  const send = async () => {
    if (!client || !preview) return;
    setWorking('send');
    const answer = await call('client-report-send', { client_id: client.id, period_end: period });
    setWorking(null);
    setArmed(false);
    setOutcome(answer.ok
      ? { text: `sent to ${answer.count} ${answer.count === 1 ? 'address' : 'addresses'}. the studio inbox has the notice.${answer.notes?.length ? ` ${answer.notes.join(' ')}` : ''}` }
      : { bad: true, text: answer.error || 'nothing went' });
  };

  return (
    <Page>
      <PageHead
        kicker="the monthly report"
        title="Reports"
        lede="What every client would receive on the 1st, in their own colours. Approve a client once and the schedule carries them from then on. Nothing here sends until a hand presses send twice."
        actions={(
          <Button size="sm" variant="ghost" onClick={loadClients} leftIcon={<Icon as={TbRefresh} boxSize={4} />}>
            Refresh
          </Button>
        )}
      >
        <Stats items={[
          { key: 'clients', n: clients.length, label: 'clients' },
          migrated && { key: 'approved', n: approvedCount, label: 'approved', tone: approvedCount ? P.green : P.ink },
          migrated && { key: 'waiting', n: waitingCount, label: 'waiting on you', tone: waitingCount ? P.gold : P.ink },
          migrated && { key: 'branded', n: brandedCount, label: 'with a palette' },
        ]} />
        {!migrated && (
          <Text fontSize={TYPE.small} color={P.coral} mt={2}>
            The report columns are not in the database yet. supabase/migrations/20260927150000_client_reports.sql
            has not been applied, so no client can be approved and the schedule sends nothing. The list below is
            the plain client book.
          </Text>
        )}
        {listError && <Text fontSize={TYPE.small} color={P.coral} mt={2}>{listError}</Text>}
      </PageHead>

      <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap={{ base: 6, lg: 8 }} alignItems="start">

        <Section kicker="every client" count={clients.length}>
          <Plate pad={false} py={2} px={2}>
            {loading && <Loading label="reading the book" px={2} />}
            {!loading && !clients.length && <Empty hint="Add a client on the Clients page first." px={2}>Nobody on the books yet.</Empty>}
            {!loading && clients.map((row) => (
              <ClientRow
                key={row.id}
                client={row}
                selected={row.id === selected}
                onSelect={select}
                migrated={migrated}
              />
            ))}
          </Plate>
        </Section>

        <Section
          kicker={client ? (client.company || client.name) : 'preview'}
          action={(
            <Select
              size="sm"
              w="auto"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Which month to preview"
            >
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          )}
        >
          {!client && <Empty>Pick a client to see their report.</Empty>}

          {client && (
            <VStack align="stretch" spacing={4}>

              {previewing && <Loading label="building the report" />}
              {previewError && <Text fontSize={TYPE.body} color={P.coral}>{previewError}</Text>}

              {preview && (
                <>
                  {/* What the reader is looking at, said before they look at it. */}
                  <Plate>
                    <VStack align="stretch" spacing={3}>
                      <HStack spacing={3} flexWrap="wrap" rowGap={2}>
                        {preview.approved
                          ? <Pip icon={TbCircleCheck} tone={P.green}>approved, on the schedule</Pip>
                          : <Pip icon={TbClock} tone={P.gold}>waiting on your approval</Pip>}
                        <Pip icon={TbPalette} tone={preview.brand.house ? P.inkFaint : P.limeDeep}>
                          {preview.brand.house ? 'house palette' : (preview.brand.partial ? 'their palette, partial' : 'their palette')}
                        </Pip>
                      </HStack>

                      {preview.brand.house && (
                        <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
                          This client has no brand kit on file, so the report below is wearing the house
                          letterhead. It is finished neonburro paper and it is not their company's. Fill in
                          brand_ink, brand_soft, brand_accent, brand_edge, brand_paper and brand_mark_url on
                          their client row and this preview changes to match.
                        </Text>
                      )}
                      {preview.brand.partial && (
                        <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
                          Part of their kit is on file and the rest is borrowed from the house.
                          Missing: {preview.brand.missing.join(', ')}.
                        </Text>
                      )}
                      {preview.empty && (
                        <Text fontSize={TYPE.small} color={P.gold} lineHeight="1.6">
                          Nothing to report for {preview.period.label}. Nothing shipped, nothing was billed and
                          nothing is open, so the schedule would skip this client this month rather than send a
                          page about nothing.
                        </Text>
                      )}
                      {!preview.recipients.length && (
                        <Text fontSize={TYPE.small} color={P.coral} lineHeight="1.6">
                          No email address and no primary contact, so there is nowhere to send this.
                        </Text>
                      )}

                      <HStack spacing={4} flexWrap="wrap" rowGap={1}>
                        <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>
                          signed {preview.sender.name}
                        </Text>
                        <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>
                          {preview.data.shipped.days} days, {preview.data.shipped.releases} deploys
                        </Text>
                        <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted}>
                          to {preview.recipients.length || 'nobody'}
                        </Text>
                      </HStack>
                    </VStack>
                  </Plate>

                  {/* The artifact itself, not the code that makes it. This is
                      the rendered mail, byte for byte what a client receives.
                      Sandboxed because it is a document and not part of this
                      app, and the report carries no script of its own. */}
                  <Box
                    as="iframe"
                    title="The report as the client receives it"
                    srcDoc={preview.html}
                    sandbox=""
                    w="100%"
                    h={{ base: '600px', md: '900px' }}
                    border="1px solid"
                    borderColor={P.hair}
                    borderRadius={PLATE_RADIUS}
                    bg={P.sheet}
                  />

                  {/* The gate and the hand. */}
                  <Plate>
                    <VStack align="stretch" spacing={4}>
                      <VStack align="stretch" spacing={1.5}>
                        <Kicker>the gate</Kicker>
                        <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
                          {preview.approved
                            ? 'Approved. The 1st of every month this client receives the month that just closed, automatically, and the studio inbox hears about every one.'
                            : 'Not approved. The monthly schedule skips this client entirely. Approve once and it carries them from then on.'}
                        </Text>
                      </VStack>

                      <HStack spacing={3} flexWrap="wrap" rowGap={2}>
                        <Button
                          size="sm"
                          variant={preview.approved ? 'outline' : 'solid'}
                          isDisabled={!migrated}
                          isLoading={working === 'approve'}
                          onClick={() => approve(!preview.approved)}
                        >
                          {preview.approved ? 'Close the gate' : 'Approve this client'}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Icon as={TbSend} boxSize={4} />}
                          isDisabled={!migrated || !preview.approved || !preview.recipients.length}
                          isLoading={working === 'send'}
                          onClick={() => (armed ? send() : setArmed(true))}
                        >
                          {armed ? `Send now to ${preview.recipients.join(', ')}` : 'Send this one now'}
                        </Button>

                        {armed && (
                          <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Cancel</Button>
                        )}
                      </HStack>

                      {armed && (
                        <Text fontSize={TYPE.small} color={P.gold} lineHeight="1.6">
                          Press again and this leaves the building. It reaches {preview.recipients.join(', ')} and
                          nobody else, and a notice goes to the studio inbox with a link to exactly these bytes.
                        </Text>
                      )}

                      {outcome && (
                        <Text fontSize={TYPE.small} color={outcome.bad ? P.coral : P.green} lineHeight="1.6">
                          {outcome.text}
                        </Text>
                      )}
                    </VStack>
                  </Plate>
                </>
              )}
            </VStack>
          )}
        </Section>
      </Grid>
    </Page>
  );
};

export default ReportsPage;
