// src/pages/Mail/client/EmailsSection.jsx
// SENTINEL: NB_PULSE_EMAILS_SECTION_V1
//
// Every letter and update that belongs to one client, and the two controls
// that start one or set how often the system report goes. Tyler, 2026-10-05,
// "every email belongs to a client and appears on that client's page".
//
// Built to drop into Volt's one page ClientDetail.jsx as a single line right
// after InvoicesSection, <EmailsSection clientId={clientId} />, imported from
// src/pages/Mail/client/index.js. Volt adds no cadence column, no updates
// panel and no email feature, those live here. Until Volt's rewrite lands it
// is mounted on /mail/clients/:clientId/, src/pages/Mail/MailClient.jsx.
//
// ── NEW STARTS ON THE CLIENT ────────────────────────────────────────────────
// New writes a draft that already belongs to this client, in their colours
// when a preset matches them, addressed to their email, from the template
// for the kind picked in src/lib/mailDocument.js, then opens the editor. A
// periodic report template opens with the open items and the work done.
//
// ── THE CADENCE ─────────────────────────────────────────────────────────────
// clients.report_cadence, off, weekly, biweekly or monthly. It is a setting
// and nothing more today. Nothing reads it on a schedule, the generator is
// not built, see src/lib/mailPropose.js isReportDue for the rule it will use.
//
// Proposed rows are not listed here, ProposedUpdatesSection holds them, and
// dismissed rows are counted and not listed.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HStack, VStack, Text, Icon, Button, Box } from '@chakra-ui/react';
import { TbPlus, TbCircleCheck, TbPencil } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, FAST, EASE } from '../../../theme/layout';
import { Section, Plate, Empty, Field } from '../../../components/common/Page';
import DotSelect from '../../../components/common/DotSelect';
import { useAuth } from '../../../hooks/useAuth';
import { KINDS, CADENCES, kindLabel, normalizeMail } from '../../../lib/mailDocument';
import { formatSmart, formatDate } from '../../../lib/time';
import {
  loadClient, loadClientMail, createForClient, setCadence, kindOf, MIGRATION_TWO,
} from './mailData';

const P = colors.paper;

// fixtureRows and fixtureClient come only from src/pages/Mail/MailFixture.jsx.
const EmailsSection = ({ clientId, fixtureRows = null, fixtureClient = null }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [cadenceMissing, setCadenceMissing] = useState(false);
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState('letter');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    if (fixtureRows) { setClient(fixtureClient); setRows(fixtureRows); return; }
    const [c, m] = await Promise.all([loadClient(clientId), loadClientMail(clientId)]);
    setClient(c.client);
    setCadenceMissing(c.cadenceMissing);
    setRows(m.rows);
  }, [clientId, fixtureRows, fixtureClient]);

  useEffect(() => { load(); }, [load]);

  const shown = rows.filter((r) => !['proposed', 'dismissed'].includes(r.status));
  const dismissed = rows.filter((r) => r.status === 'dismissed').length;

  const start = async () => {
    if (!client) return;
    setBusy(true);
    const res = await createForClient({ client, kind, userId: user?.id });
    setBusy(false);
    if (res.error || !res.id) { setNote({ bad: true, text: res.error || 'The draft did not write.' }); return; }
    navigate(`/mail/${res.id}/`);
  };

  const cadence = async (value) => {
    const err = await setCadence(clientId, value);
    setNote(err ? { bad: true, text: err } : { text: `The system report is set to ${CADENCES[value].label.toLowerCase()}. Nothing sends on a schedule yet, this is the setting the schedule will read.` });
    if (!err) setClient((c) => ({ ...c, report_cadence: value }));
  };

  return (
    <Section kicker="emails" count={shown.length}>
      <VStack align="stretch" spacing={4}>
        <HStack spacing={3} align="flex-end" flexWrap="wrap" rowGap={3}>
          <Box flex="1 1 200px" minW="180px">
            <Field label="start a new one">
              <DotSelect value={kind} onChange={setKind} options={Object.values(KINDS).map((k) => ({ value: k.key, label: k.label }))} />
            </Field>
          </Box>
          <Button size="md" leftIcon={<Icon as={TbPlus} boxSize={4} />} onClick={start} isLoading={busy} loadingText="Starting" isDisabled={!client}>
            New
          </Button>
          <Box flex="1 1 200px" minW="180px">
            <Field label="system report" hint={cadenceMissing ? 'needs the migration' : 'how often they get it'}>
              <DotSelect
                value={client?.report_cadence || 'off'}
                onChange={cadence}
                isDisabled={cadenceMissing}
                options={Object.values(CADENCES).map((c) => ({ value: c.key, label: c.label }))}
              />
            </Field>
          </Box>
        </HStack>
        {cadenceMissing && (
          <Text fontSize={TYPE.small} color={P.inkMuted}>The cadence and the update kinds arrive with {MIGRATION_TWO}. Plain letters work today.</Text>
        )}

        {!shown.length && <Empty hint="Start one above. It opens in the editor already addressed to them.">No emails to this client yet.</Empty>}
        {shown.length > 0 && (
          <Plate pad={false}>
            {shown.map((row) => {
              const doc = normalizeMail(row.doc);
              const sent = row.status === 'sent';
              return (
                <HStack
                  key={row.id}
                  as="button"
                  type="button"
                  onClick={() => navigate(`/mail/${row.id}/`)}
                  w="100%"
                  textAlign="left"
                  spacing={3}
                  px={{ base: 3, md: 4 }}
                  py={3}
                  borderTop="1px solid"
                  borderColor={P.hairSoft}
                  _first={{ borderTop: 'none' }}
                  transition={`background ${FAST} ${EASE}`}
                  _hover={{ bg: P.sunken }}
                >
                  <Icon as={sent ? TbCircleCheck : TbPencil} boxSize={3.5} color={sent ? P.green : P.inkFaint} flexShrink={0} />
                  <VStack align="start" spacing={0} flex={1} minW={0}>
                    <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{doc.subject || 'Untitled'}</Text>
                    <Text fontSize={TYPE.label} color={P.inkMuted}>{kindLabel(kindOf(row))} {'·'} {row.status}</Text>
                  </VStack>
                  <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} flexShrink={0}>
                    {sent && row.sent_at ? formatDate(row.sent_at) : formatSmart(row.updated_at)}
                  </Text>
                </HStack>
              );
            })}
          </Plate>
        )}
        {dismissed > 0 && <Text fontSize={TYPE.label} color={P.inkFaint}>{dismissed} dismissed, kept and never sent.</Text>}
        {note && <Text fontSize={TYPE.small} color={note.bad ? P.coral : P.inkMuted}>{note.text}</Text>}
      </VStack>
    </Section>
  );
};

export default EmailsSection;
