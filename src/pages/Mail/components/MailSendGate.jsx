// src/pages/Mail/components/MailSendGate.jsx
// SENTINEL: NB_PULSE_MAIL_GATE_V1
//
// The gate. A letter reaches a client only through here, and only after a
// test of the same bytes reached tyler@neonburro.com. Opening the gate is
// the first press, the send button inside it is the second, the same two
// hands as ReviewSendModal in Invoicing and the armed send on Reports.
//
// What it shows before the second press, in this order, because the only
// unrecoverable mistake is the right letter to the wrong inbox.
//   1. who it is from and every address it reaches, to and cc, as chips
//   2. the subject
//   3. whether this exact version was tested and when
//   4. anything that blocks it, in words
//   5. the letter itself, the same html the door will render
//
// The button stays shut while the letter has unsaved edits, while a block
// stands or until the test matches. The door checks all three again, this
// is a courtesy and mail-send.js is the rule.
//
// No oxford commas, no em dashes.

import {
  Modal, ModalOverlay, ModalContent, ModalBody,
  Box, VStack, HStack, Text, Icon, Button, Wrap, WrapItem,
} from '@chakra-ui/react';
import { TbArrowLeft, TbSend, TbAlertTriangle, TbCircleCheck, TbFlask } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, PLATE_RADIUS, INSET } from '../../../theme/layout';
import { Kicker } from '../../../components/common/Page';
import { formatDateTime } from '../../../lib/time';
import { TEST_TO, fromLine } from '../../../lib/mailDocument';
import MailPreview from './MailPreview';

const P = colors.paper;

const Chips = ({ list }) => (
  <Wrap spacing={1.5}>
    {list.map((e) => (
      <WrapItem key={e}>
        <Box px={INSET} h="28px" display="flex" alignItems="center" bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius="full">
          <Text fontSize={TYPE.small} color={P.ink}>{e}</Text>
        </Box>
      </WrapItem>
    ))}
  </Wrap>
);

const Row = ({ label, children }) => (
  <HStack align="flex-start" spacing={4}>
    <Box w="64px" flexShrink={0} pt={1.5}><Kicker>{label}</Kicker></Box>
    <Box flex={1} minW={0}>{children}</Box>
  </HStack>
);

const MailSendGate = ({
  isOpen, onClose, doc, html, blocking = [], tested, lastTest, dirty,
  status, sentAt, sending, testing, onTest, onSend,
}) => {
  const count = (doc?.to?.length || 0) + (doc?.cc?.filter((e) => !doc.to.includes(e)).length || 0);
  const again = status === 'sent';
  const canSend = !dirty && tested && !blocking.length && count > 0;
  const word = count === 1 ? 'address' : 'addresses';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside" isCentered>
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(3px)" />
      <ModalContent
        bg={P.sheet}
        borderRadius={PLATE_RADIUS}
        border="1px solid"
        borderColor={P.hair}
        overflow="hidden"
        mx={4}
        boxShadow="0 30px 80px rgba(23,17,12,0.5)"
      >
        <Box px={{ base: 5, md: 7 }} pt={{ base: 5, md: 6 }} pb={4} borderBottom="1px solid" borderColor={P.hairSoft}>
          <HStack spacing={2} mb={4}>
            <Icon as={TbSend} boxSize={3.5} color={P.limeDeep} />
            <Kicker>Review and send</Kicker>
          </HStack>

          <VStack align="stretch" spacing={3}>
            <Row label="from"><Text fontSize={TYPE.body} color={P.ink} pt={1}>{fromLine(doc?.from)}</Text></Row>
            <Row label="to"><Chips list={doc?.to || []} /></Row>
            {doc?.cc?.length > 0 && <Row label="cc"><Chips list={doc.cc} /></Row>}
            <Row label="subject"><Text fontSize={TYPE.body} fontWeight="600" color={P.ink} pt={1}>{doc?.subject}</Text></Row>
          </VStack>

          <VStack align="stretch" spacing={2} mt={4}>
            {dirty && (
              <HStack spacing={2} align="flex-start">
                <Icon as={TbAlertTriangle} boxSize={3.5} color={P.gold} mt={0.5} />
                <Text fontSize={TYPE.small} color={P.gold}>There are unsaved edits. Save first, then test, then send.</Text>
              </HStack>
            )}
            {!dirty && tested && (
              <HStack spacing={2} align="flex-start">
                <Icon as={TbCircleCheck} boxSize={3.5} color={P.green} mt={0.5} />
                <Text fontSize={TYPE.small} color={P.green}>
                  This exact version went to {TEST_TO} as a test {lastTest?.created_at ? `on ${formatDateTime(lastTest.created_at)}` : ''}.
                </Text>
              </HStack>
            )}
            {!dirty && !tested && (
              <HStack spacing={2} align="flex-start" flexWrap="wrap">
                <Icon as={TbFlask} boxSize={3.5} color={P.gold} mt={0.5} />
                <Text fontSize={TYPE.small} color={P.gold} flex="1 1 240px">
                  {lastTest
                    ? `The letter changed after the last test. Send this version to ${TEST_TO} and the send opens.`
                    : `Nothing has been tested yet. Send it to ${TEST_TO} first and the send opens.`}
                </Text>
                <Button size="xs" variant="outline" leftIcon={<Icon as={TbFlask} boxSize={3.5} />} onClick={onTest} isLoading={testing} loadingText="Testing">
                  Send the test
                </Button>
              </HStack>
            )}
            {blocking.map((p) => (
              <HStack key={p.text} spacing={2} align="flex-start">
                <Icon as={TbAlertTriangle} boxSize={3.5} color={P.coral} mt={0.5} />
                <Text fontSize={TYPE.small} color={P.coral}>{p.text}</Text>
              </HStack>
            ))}
            {again && (
              <Text fontSize={TYPE.small} color={P.inkMuted}>
                This one already went {sentAt ? `on ${formatDateTime(sentAt)}` : 'before'}. Sending again sends the same letter a second time.
              </Text>
            )}
          </VStack>
        </Box>

        <ModalBody p={{ base: 4, md: 6 }} bg={P.mat}>
          <MailPreview html={html} label="what they receive" />
        </ModalBody>

        <HStack justify="space-between" px={{ base: 5, md: 7 }} py={4} borderTop="1px solid" borderColor={P.hair} bg={P.sheet} flexWrap="wrap" rowGap={2}>
          <Button variant="ghost" size="sm" leftIcon={<TbArrowLeft size={15} />} onClick={onClose} isDisabled={sending}>
            Back to edit
          </Button>
          <Button
            size="sm"
            rightIcon={<TbSend size={15} />}
            onClick={() => onSend({ again })}
            isLoading={sending}
            loadingText="Sending"
            isDisabled={!canSend}
          >
            {again ? `Send again to ${count} ${word}` : `Send to ${count} ${word}`}
          </Button>
        </HStack>
      </ModalContent>
    </Modal>
  );
};

export default MailSendGate;
