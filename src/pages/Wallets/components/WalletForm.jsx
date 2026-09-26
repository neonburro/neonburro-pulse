// src/pages/Wallets/components/WalletForm.jsx
// SENTINEL: NB_WALLETS_FORM_V1
//
// One wallet's fields, used for adding and for editing because they are the
// same fields and two forms would drift.
//
// ── WHAT A PERSON ACTUALLY DOES HERE ────────────────────────────────────────
// Copies an address out of Phantom or Jupiter Mobile and pastes it. So the
// address box cleans up after the clipboard rather than making somebody do
// it, see addressFromPaste in src/lib/walletParse.js. It takes a bare
// address, an address with a label in front of it and a whole solscan url.
// The base58 shape test runs as you type and the answer is words in the hint
// slot, not a red ring, because a red ring on a 44 character string tells you
// nothing about which character is wrong.
//
// ── THE FIELDS AND WHY EACH ONE ─────────────────────────────────────────────
//   holder    who the wallet belongs to. It is a select rather than the block
//             you opened, because a wallet lands under the wrong holder often
//             enough that moving one has to be possible, and because a row
//             written by the Registry with a burro nobody recognises has to
//             be assignable without a trip to the SQL editor.
//   label     what the wallet is in two or three words. Public copy.
//   address   the public address, base58, in full. Never truncated in the
//             record, the room decides how to display it.
//   purpose   one honest sentence. Public copy, and the room names a
//             published row that has none.
//   since     the day it started being used. Empty is allowed and means
//             nobody wrote it down, which beats a guessed date on a page
//             whose whole argument is that it does not guess.
//   retired   the day it stopped. Setting it does not delete anything, the
//             row stays and the date says what happened.
//   burn      exactly one wallet in the table may carry it and the database
//             enforces that with a partial unique index, so a second one is
//             refused by the table and not only by this form.
//
// NEVER A KEY, NEVER A SEED. There is no field for one, there is no column
// for one and there is no reason for one to be typed into a browser.
//
// The page kit owns every size here. This file types no width, no gutter, no
// inset and no font size. No oxford commas, no em dashes.

import { Box, VStack, HStack, Text, Input, Textarea, Select, Button, Checkbox } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE, MEASURE } from '../../../theme/layout';
import { Field } from '../../../components/common/Page';
import { addressFromPaste, isAddress } from '../../../lib/walletParse';

const P = colors.paper;

export const EMPTY_WALLET = {
  holder: '',
  label: '',
  address: '',
  purpose: '',
  since: '',
  retired: '',
  burn: false,
};

// A supabase row into the draft shape. A date comes back as an iso day or as
// null, and an input type date wants an empty string rather than a null or it
// warns about a controlled field going uncontrolled.
export const draftFromRow = (row) => ({
  holder: String(row.burro || '').trim().toLowerCase(),
  label: row.label || '',
  address: row.address || '',
  purpose: row.purpose || '',
  since: row.since ? String(row.since).slice(0, 10) : '',
  retired: row.retired ? String(row.retired).slice(0, 10) : '',
  burn: row.burn === true,
});

const WalletForm = ({
  draft,
  holders,
  onChange,
  onSave,
  onCancel,
  saving = false,
  note = '',
  submitLabel = 'Save',
  burnHeldBy = '',
}) => {
  const set = (key) => (event) => onChange({ ...draft, [key]: event.target.value });
  const addressReads = !draft.address || isAddress(draft.address.trim());

  return (
    <VStack
      as="form"
      align="stretch"
      spacing={4}
      maxW={MEASURE}
      onSubmit={(event) => { event.preventDefault(); onSave(); }}
    >
      <Field label="Holder" hint="who this wallet belongs to">
        <Select value={draft.holder} onChange={set('holder')}>
          <option value="">nobody named</option>
          {holders.map((holder) => (
            <option key={holder.key} value={holder.key}>
              {holder.name}
              {holder.kind === 'burro' ? '' : `, ${holder.kind}`}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Label" hint="public copy">
        <Input
          value={draft.label}
          onChange={set('label')}
          placeholder="Settlement, desk"
          autoComplete="off"
        />
      </Field>

      <Field
        label="Address"
        hint={addressReads ? 'base58, public' : 'that does not read as an address'}
        hintColor={addressReads ? undefined : P.coral}
      >
        <Input
          fontFamily="mono"
          value={draft.address}
          spellCheck={false}
          autoComplete="off"
          placeholder="paste the public address"
          onChange={(event) => onChange({ ...draft, address: event.target.value })}
          onBlur={(event) => onChange({ ...draft, address: addressFromPaste(event.target.value) })}
          onPaste={(event) => {
            const text = event.clipboardData?.getData('text');
            if (!text) return;
            event.preventDefault();
            onChange({ ...draft, address: addressFromPaste(text) });
          }}
        />
      </Field>

      <Field label="Purpose" hint="one sentence, public copy">
        <Textarea
          value={draft.purpose}
          onChange={set('purpose')}
          placeholder="What this wallet is for, honest about the boring answer."
        />
      </Field>

      <HStack spacing={4} align="flex-start" flexWrap="wrap" rowGap={4}>
        <Box flex="1 1 180px">
          <Field label="Since" hint="empty is allowed">
            <Input type="date" value={draft.since} onChange={set('since')} />
          </Field>
        </Box>
        <Box flex="1 1 180px">
          <Field label="Retired" hint="nothing is deleted">
            <Input type="date" value={draft.retired} onChange={set('retired')} />
          </Field>
        </Box>
      </HStack>

      <Checkbox
        isChecked={draft.burn}
        onChange={(event) => onChange({ ...draft, burn: event.target.checked })}
        isDisabled={Boolean(burnHeldBy)}
      >
        <Text fontSize={TYPE.small} color={P.inkSec}>
          {burnHeldBy
            ? `The burn wallet is ${burnHeldBy}. Clear it there first.`
            : 'This is the burn wallet. Only one in the table may be.'}
        </Text>
      </Checkbox>

      {note && (
        <Text fontFamily="mono" fontSize={TYPE.small} color={P.coral}>{note}</Text>
      )}

      <HStack spacing={2}>
        <Button type="submit" size="sm" isLoading={saving} loadingText="Writing">{submitLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} type="button">Cancel</Button>
      </HStack>
    </VStack>
  );
};

export default WalletForm;
