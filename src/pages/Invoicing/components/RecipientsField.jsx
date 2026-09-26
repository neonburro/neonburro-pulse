// src/pages/Invoicing/components/RecipientsField.jsx
// Who gets this email, shown as chips you can read before you press send.
// Tyler, 2026-09-17. The first send, the resend and the reminder all use this
// one field, so a bookkeeper or a partner can be added in any of the three
// and the list is always visible before anything leaves. Add with Enter,
// comma or the button. A fixed address, the client on file for the first
// send, shows without an x. Duplicates and bad addresses never enter the
// list, and the server checks again. House field and label. No oxford
// commas, no dashes.

import { useState } from 'react';
import { Box, HStack, Text, Input, Button, Icon, Wrap, WrapItem } from '@chakra-ui/react';
import { TbX, TbPlus } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET } from '../../../theme/layout';
import { Field } from '../../../components/common/Page';

const P = colors.paper;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const cleanList = (list) => {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const e = String(raw || '').trim().toLowerCase();
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
};

const RecipientsField = ({ value, onChange, fixed = [], label = 'send to', note }) => {
  const [draft, setDraft] = useState('');
  const [bad, setBad] = useState(false);
  const fixedSet = new Set(cleanList(fixed));
  const list = cleanList([...fixed, ...(value || [])]);

  const add = () => {
    const pieces = draft.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
    if (!pieces.length) return;
    const good = pieces.filter((p) => EMAIL_RE.test(p));
    if (good.length !== pieces.length) { setBad(true); return; }
    setBad(false);
    onChange(cleanList([...list, ...good]).filter((e) => !fixedSet.has(e)));
    setDraft('');
  };

  const remove = (email) => onChange(list.filter((e) => e !== email && !fixedSet.has(e)));

  return (
    <Field label={label}>
      <Wrap spacing={2} mb={0.5}>
        {list.map((email) => (
          <WrapItem key={email}>
            <HStack spacing={1.5} px={INSET} h="30px" bg={P.mat} border="1px solid" borderColor={P.hair} borderRadius="full">
              <Text fontSize={TYPE.small} color={P.ink}>{email}</Text>
              {!fixedSet.has(email) && (
                <Box as="button" type="button" onClick={() => remove(email)} aria-label={`Remove ${email}`} color={P.inkMuted} display="inline-flex" _hover={{ color: P.coral }}>
                  <Icon as={TbX} boxSize={3.5} />
                </Box>
              )}
            </HStack>
          </WrapItem>
        ))}
        {list.length === 0 && <Text fontSize={TYPE.small} color={P.coral}>Nobody yet. Add at least one address.</Text>}
      </Wrap>
      <HStack spacing={2}>
        <Input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setBad(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          type="email"
          placeholder="add another address"
          bg={P.mat}
          borderColor={bad ? P.coral : P.hair}
        />
        <Button size="md" variant="outline" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={add} flexShrink={0}>
          Add
        </Button>
      </HStack>
      {bad && <Text fontSize={TYPE.small} color={P.coral}>That is not an email address.</Text>}
      {note && !bad && <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">{note}</Text>}
    </Field>
  );
};

export default RecipientsField;
