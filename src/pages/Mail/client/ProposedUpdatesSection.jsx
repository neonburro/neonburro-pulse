// src/pages/Mail/client/ProposedUpdatesSection.jsx
// SENTINEL: NB_PULSE_PROPOSED_UPDATES_SECTION_V1
//
// Updates the system drafted for one client, waiting on Tyler. Tyler,
// 2026-10-05, "click a client and proposed updates appear there for
// approval". A proposal is a mail_documents row with status proposed and an
// origin that is not hand, written only through proposeUpdate in
// src/lib/mailPropose.js.
//
// Built to drop into Volt's one page ClientDetail.jsx as a single line right
// after InvoicesSection, <ProposedUpdatesSection clientId={clientId} />,
// imported from src/pages/Mail/client/index.js. It loads its own rows and
// renders nothing at all when nothing is proposed, so a client with no
// proposals does not carry an empty box. Until Volt's rewrite lands it is
// mounted on /mail/clients/:clientId/.
//
// ── APPROVE IS NOT SEND ─────────────────────────────────────────────────────
// Approve records who and when and moves the row to approved. Sending is
// still a person in the editor, with a test to tyler@neonburro.com first and
// the two press gate, and the door refuses a system drafted row that was not
// approved. When automatic sends come later they read approved rows and
// nothing else. Dismiss keeps the row and its record, it just never goes.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HStack, VStack, Text, Icon, Button } from '@chakra-ui/react';
import { TbCheck, TbX, TbPencil } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Section, Plate } from '../../../components/common/Page';
import { useAuth } from '../../../hooks/useAuth';
import { kindLabel, normalizeMail } from '../../../lib/mailDocument';
import { formatSmart } from '../../../lib/time';
import { loadClientMail, approveDoc, dismissDoc, kindOf } from './mailData';

const P = colors.paper;

// fixtureRows comes only from src/pages/Mail/MailFixture.jsx in development.
const ProposedUpdatesSection = ({ clientId, alwaysShow = false, fixtureRows = null }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    const res = fixtureRows ? { rows: fixtureRows } : await loadClientMail(clientId);
    setRows(res.rows.filter((r) => r.status === 'proposed'));
  }, [clientId, fixtureRows]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, fn, done) => {
    setBusy(id);
    const err = await fn(id, user?.id);
    setBusy(null);
    setNote(err ? { bad: true, text: err } : { text: done });
    load();
  };

  if (!rows.length && !alwaysShow) return null;

  return (
    <Section kicker="proposed updates" count={rows.length}>
      {!rows.length && <Text fontSize={TYPE.small} color={P.inkMuted}>Nothing proposed for this client.</Text>}
      {rows.length > 0 && (
        <Plate py={1}>
          {rows.map((row) => {
            const doc = normalizeMail(row.doc);
            return (
              <HStack key={row.id} spacing={3} py={3} borderTop="1px solid" borderColor={P.hairSoft} _first={{ borderTop: 'none' }} align="flex-start" flexWrap="wrap" rowGap={2}>
                <VStack align="start" spacing={0.5} flex="1 1 240px" minW={0}>
                  <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={P.gold}>
                    {kindLabel(kindOf(row))} {'·'} waiting on you
                  </Text>
                  <Text fontSize={TYPE.body} fontWeight="600" color={P.ink} noOfLines={1}>{doc.subject || 'Untitled update'}</Text>
                  <Text fontSize={TYPE.label} color={P.inkFaint}>drafted by {String(row.origin || 'the system').replace(/^system:/, '')} {formatSmart(row.created_at)}</Text>
                </VStack>
                <HStack spacing={1.5} flexShrink={0}>
                  <Button size="xs" variant="outline" leftIcon={<Icon as={TbPencil} boxSize={3.5} />} onClick={() => navigate(`/mail/${row.id}/`)}>Open</Button>
                  <Button size="xs" variant="outline" leftIcon={<Icon as={TbCheck} boxSize={3.5} />} isLoading={busy === row.id} onClick={() => act(row.id, approveDoc, 'Approved. Open it to test and send, nothing goes on its own.')}>Approve</Button>
                  <Button size="xs" variant="ghost" leftIcon={<Icon as={TbX} boxSize={3.5} />} onClick={() => act(row.id, dismissDoc, 'Dismissed. It is kept and never goes.')}>Dismiss</Button>
                </HStack>
              </HStack>
            );
          })}
        </Plate>
      )}
      {note && <Text fontSize={TYPE.small} color={note.bad ? P.coral : P.inkMuted}>{note.text}</Text>}
    </Section>
  );
};

export default ProposedUpdatesSection;
