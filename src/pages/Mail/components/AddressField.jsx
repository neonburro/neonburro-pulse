// src/pages/Mail/components/AddressField.jsx
// The to and cc lists of a letter, as chips that can be read before
// anything is pressed. The same look as RecipientsField in Invoicing, the
// cream chip, the x, Add on Enter or comma, and its own file because a cc
// list is allowed to be empty and RecipientsField says "Nobody yet" in
// coral when it is, which is right for an invoice and wrong here.
//
// The browser check is a courtesy. EMAIL_RE comes from
// src/lib/mailDocument.js so this field and the door agree, and
// netlify/functions/mail-send.js checks every address again before
// anything goes.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import { Box, HStack, Text, Input, Button, Icon, Wrap, WrapItem } from '@chakra-ui/react';
import { TbX, TbPlus } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET } from '../../../theme/layout';
import { Field } from '../../../components/common/Page';
import { EMAIL_RE } from '../../../lib/mailDocument';

const P = colors.paper;

const AddressField = ({ label, value = [], onChange, optional = false, hint, isDisabled = false }) => {
  const [draft, setDraft] = useState('');
  const [bad, setBad] = useState(false);

  const add = () => {
    const pieces = draft.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!pieces.length) return;
    if (pieces.some((p) => !EMAIL_RE.test(p))) { setBad(true); return; }
    setBad(false);
    onChange([...new Set([...value, ...pieces])]);
    setDraft('');
  };

  const remove = (email) => onChange(value.filter((e) => e !== email));

  return (
    <Field label={label} hint={hint}>
      {value.length > 0 && (
        <Wrap spacing={2} mb={0.5}>
          {value.map((email) => (
            <WrapItem key={email}>
              <HStack spacing={1.5} px={INSET} h="30px" bg={P.mat} border="1px solid" borderColor={EMAIL_RE.test(email) ? P.hair : P.coral} borderRadius="full">
                <Text fontSize={TYPE.small} color={P.ink}>{email}</Text>
                {!isDisabled && (
                  <Box as="button" type="button" onClick={() => remove(email)} aria-label={`Remove ${email}`} color={P.inkMuted} display="inline-flex" _hover={{ color: P.coral }}>
                    <Icon as={TbX} boxSize={3.5} />
                  </Box>
                )}
              </HStack>
            </WrapItem>
          ))}
        </Wrap>
      )}
      {!value.length && !optional && (
        <Text fontSize={TYPE.small} color={P.gold}>Nobody yet. A letter needs at least one address.</Text>
      )}
      {!isDisabled && (
        <HStack spacing={2}>
          <Input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setBad(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
            onBlur={() => { if (draft.trim()) add(); }}
            type="email"
            placeholder={optional ? 'add a copy, or leave it empty' : 'add an address'}
            borderColor={bad ? P.coral : P.hair}
          />
          <Button size="md" variant="outline" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={add} flexShrink={0}>
            Add
          </Button>
        </HStack>
      )}
      {bad && <Text fontSize={TYPE.small} color={P.coral}>That is not an email address.</Text>}
    </Field>
  );
};

export default AddressField;
