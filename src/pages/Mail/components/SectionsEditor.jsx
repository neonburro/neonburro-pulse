// src/pages/Mail/components/SectionsEditor.jsx
// The blocks between the hero card and the link cards. A system update is
// mostly these, a list of what changed, a small table of accounts or
// deploys, a checklist of security items, the open items and the work done.
// Every one is drawn by renderMail in src/lib/mailRender.js on its own light
// card, so a block added here is in the preview beside it at once.
//
// Kept plain on purpose. A list is one line per item. A table is the column
// names comma separated and one row per line with a bar between the cells,
// because a grid editor for a four column table is a lot of machinery to
// type six rows. A checklist and the work done get a row each, because the
// state and the date are the point of them.
//
// open_items holds nothing. It is filled from the client's open items when
// the letter renders, with their ages, which is why a periodic report
// always carries every one still waiting. The shape of every block is
// cleanSection in src/lib/mailDocument.js.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import {
  Box, VStack, HStack, Text, Input, Textarea, Icon, Button,
} from '@chakra-ui/react';
import { TbPlus, TbArrowUp, TbArrowDown, TbTrash, TbX } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Field, Plate, Kicker } from '../../../components/common/Page';
import DotSelect from '../../../components/common/DotSelect';
import {
  SECTION_TYPES, CHECK_STATES, MAX_SECTIONS, MAX_ROWS, blankSection,
} from '../../../lib/mailDocument';

const P = colors.paper;

const splitLines = (text) => String(text || '').split('\n');
const cellsOf = (line) => line.split('|').map((c) => c.trim());

const Rows = ({ items, render, onAdd, addLabel }) => (
  <VStack align="stretch" spacing={2}>
    {items.map(render)}
    {items.length < MAX_ROWS && (
      <Box>
        <Button size="xs" variant="ghost" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={onAdd}>{addLabel}</Button>
      </Box>
    )}
  </VStack>
);

const Remove = ({ onClick, label }) => (
  <Button size="xs" variant="ghost" aria-label={label} onClick={onClick} flexShrink={0} _hover={{ color: P.coral }}>
    <Icon as={TbX} boxSize={3.5} />
  </Button>
);

const Body = ({ section, onChange }) => {
  const s = section;
  const set = (patch) => onChange({ ...s, ...patch });

  if (s.type === 'text') {
    return <Field label="paragraph"><Textarea rows={4} value={s.body} onChange={(e) => set({ body: e.target.value })} /></Field>;
  }
  if (s.type === 'list') {
    return (
      <Field label="items" hint="one per line">
        <Textarea rows={5} value={s.items.join('\n')} onChange={(e) => set({ items: splitLines(e.target.value) })} placeholder={'The site moved to faster images.\nThe sign in page was tested live.'} />
      </Field>
    );
  }
  if (s.type === 'table') {
    return (
      <VStack align="stretch" spacing={3}>
        <Field label="columns" hint="comma separated, up to four">
          <Input value={s.columns.join(', ')} onChange={(e) => set({ columns: e.target.value.split(',').map((c) => c.trim()).slice(0, 4) })} placeholder="Account, State" />
        </Field>
        <Field label="rows" hint="one per line, a bar between cells">
          <Textarea
            rows={5}
            fontFamily="mono"
            fontSize={TYPE.small}
            value={s.rows.map((r) => r.join(' | ')).join('\n')}
            onChange={(e) => set({ rows: splitLines(e.target.value).map(cellsOf) })}
            placeholder={'owner@example.com | active\npulse@neonburro.com | waiting on approval'}
          />
        </Field>
      </VStack>
    );
  }
  if (s.type === 'checklist') {
    return (
      <Rows
        items={s.items}
        addLabel="Add a check"
        onAdd={() => set({ items: [...s.items, { label: '', state: 'pass', note: '' }] })}
        render={(it, i) => (
          <HStack key={i} spacing={2} align="flex-start" flexWrap="wrap" rowGap={2}>
            <Input flex="2 1 200px" value={it.label} placeholder="What was checked" onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Box flex="0 0 140px">
              <DotSelect value={it.state} onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? { ...x, state: v } : x)) })} options={Object.values(CHECK_STATES).map((c) => ({ value: c.key, label: c.label }))} />
            </Box>
            <Input flex="2 1 180px" value={it.note} placeholder="A note, optional" onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
            <Remove label="Remove this check" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })} />
          </HStack>
        )}
      />
    );
  }
  if (s.type === 'work_done') {
    return (
      <Rows
        items={s.items}
        addLabel="Add work"
        onAdd={() => set({ items: [...s.items, { date: '', text: '' }] })}
        render={(it, i) => (
          <HStack key={i} spacing={2} align="flex-start" flexWrap="wrap" rowGap={2}>
            <Input type="date" flex="0 0 170px" value={it.date} onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
            <Input flex="3 1 220px" value={it.text} placeholder="What the studio did" onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            <Remove label="Remove this line" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })} />
          </HStack>
        )}
      />
    );
  }
  return (
    <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.6">
      Filled from this client&apos;s open items when the letter renders, oldest first, each with its age and an approve and
      a deny link. Add or answer items on the client&apos;s page.
    </Text>
  );
};

const SectionsEditor = ({ sections, onChange }) => {
  const [type, setType] = useState('list');
  const setAt = (i, s) => onChange(sections.map((x, j) => (j === i ? s : x)));
  const move = (i, d) => {
    const next = [...sections];
    const [s] = next.splice(i, 1);
    next.splice(i + d, 0, s);
    onChange(next);
  };

  return (
    <VStack align="stretch" spacing={4}>
      {sections.map((s, i) => (
        <Plate key={i} sunken>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between">
              <Kicker>{SECTION_TYPES[s.type].label}</Kicker>
              <HStack spacing={1}>
                <Button size="xs" variant="ghost" aria-label="Move this section up" isDisabled={i === 0} onClick={() => move(i, -1)}><Icon as={TbArrowUp} boxSize={3.5} /></Button>
                <Button size="xs" variant="ghost" aria-label="Move this section down" isDisabled={i === sections.length - 1} onClick={() => move(i, 1)}><Icon as={TbArrowDown} boxSize={3.5} /></Button>
                <Button size="xs" variant="ghost" aria-label="Remove this section" onClick={() => onChange(sections.filter((_, j) => j !== i))} _hover={{ color: P.coral }}><Icon as={TbTrash} boxSize={3.5} /></Button>
              </HStack>
            </HStack>
            <Field label="title" hint="small, uppercase in the letter">
              <Input value={s.title} onChange={(e) => setAt(i, { ...s, title: e.target.value })} />
            </Field>
            <Body section={s} onChange={(next) => setAt(i, next)} />
          </VStack>
        </Plate>
      ))}
      {sections.length < MAX_SECTIONS && (
        <HStack spacing={2} flexWrap="wrap" rowGap={2}>
          <Box flex="1 1 220px" maxW="320px">
            <DotSelect value={type} onChange={setType} options={Object.values(SECTION_TYPES).map((t) => ({ value: t.key, label: t.label }))} />
          </Box>
          <Button size="md" variant="outline" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={() => onChange([...sections, blankSection(type)])}>
            Add a section
          </Button>
        </HStack>
      )}
    </VStack>
  );
};

export default SectionsEditor;
