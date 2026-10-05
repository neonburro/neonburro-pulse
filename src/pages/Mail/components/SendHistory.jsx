// src/pages/Mail/components/SendHistory.jsx
// Every test and every send of one letter, newest first, read from
// mail_sends. Who pressed it, when, where it went, the Resend id and the
// stored bytes behind a View, so what opens here is what they received
// rather than the letter as it reads today.
//
// The rows are written only by netlify/functions/mail-send.js on the
// service role. This page can read them and cannot write them, there is no
// insert policy, see supabase/migrations/20261005113806_mail_composer.sql.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import {
  Box, HStack, VStack, Text, Icon, Button,
  Modal, ModalOverlay, ModalContent, ModalBody,
} from '@chakra-ui/react';
import { TbEye, TbFlask, TbSend, TbAlertTriangle } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, PLATE_RADIUS } from '../../../theme/layout';
import { Kicker } from '../../../components/common/Page';
import { formatDateTime } from '../../../lib/time';
import MailPreview from './MailPreview';

const P = colors.paper;

const tone = (row) => {
  if (row.status === 'failed') return { color: P.coral, icon: TbAlertTriangle, word: 'failed' };
  if (row.kind === 'test') return { color: P.inkMuted, icon: TbFlask, word: 'test' };
  return { color: P.green, icon: TbSend, word: 'sent' };
};

const SendHistory = ({ rows = [] }) => {
  const [open, setOpen] = useState(null);
  if (!rows.length) return null;

  return (
    <VStack align="stretch" spacing={0}>
      {rows.map((row) => {
        const t = tone(row);
        const count = (row.to_emails?.length || 0) + (row.cc_emails?.length || 0);
        return (
          <HStack
            key={row.id}
            spacing={3}
            py={2.5}
            borderTop="1px solid"
            borderColor={P.hairSoft}
            align="center"
            flexWrap="wrap"
            rowGap={1}
          >
            <HStack spacing={1.5} minW="64px">
              <Icon as={t.icon} boxSize={3.5} color={t.color} />
              <Text fontFamily="mono" fontSize={TYPE.micro} letterSpacing="0.14em" textTransform="uppercase" color={t.color}>{t.word}</Text>
            </HStack>
            <Text fontSize={TYPE.small} color={P.ink} flex="1 1 200px" noOfLines={1}>
              {row.kind === 'test' ? row.to_emails?.[0] : `${row.to_emails?.[0] || ''}${count > 1 ? ` and ${count - 1} more` : ''}`}
            </Text>
            <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}>{formatDateTime(row.created_at)}</Text>
            {row.resend_id && (
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint} title={row.resend_id}>{row.resend_id.slice(0, 8)}</Text>
            )}
            {row.html && (
              <Button size="xs" variant="ghost" leftIcon={<Icon as={TbEye} boxSize={3.5} />} onClick={() => setOpen(row)}>
                View
              </Button>
            )}
            {row.error && (
              <Text fontSize={TYPE.small} color={P.coral} w="100%">{row.error}</Text>
            )}
          </HStack>
        );
      })}

      <Modal isOpen={!!open} onClose={() => setOpen(null)} size="3xl" scrollBehavior="inside">
        <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(3px)" />
        <ModalContent bg={P.sheet} borderRadius={PLATE_RADIUS} border="1px solid" borderColor={P.hair} mx={4}>
          <ModalBody p={{ base: 4, md: 6 }}>
            {open && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Kicker>{open.kind === 'test' ? 'the test, as it went' : 'the letter, as it went'}</Kicker>
                  <Text fontSize={TYPE.section} fontWeight="600" color={P.ink} mt={1}>{open.subject}</Text>
                  <Text fontSize={TYPE.small} color={P.inkMuted} mt={1} lineHeight="1.6">
                    {formatDateTime(open.created_at)} by {open.sent_by_email || 'somebody in Pulse'} from {open.from_address}
                  </Text>
                  <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
                    to {(open.to_emails || []).join(', ')}{open.cc_emails?.length ? `, cc ${open.cc_emails.join(', ')}` : ''}
                  </Text>
                </Box>
                <MailPreview html={open.html} label="the stored bytes" />
                <HStack>
                  <Button size="sm" variant="outline" onClick={() => setOpen(null)}>Close</Button>
                </HStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default SendHistory;
