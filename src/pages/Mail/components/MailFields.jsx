// src/pages/Mail/components/MailFields.jsx
// Every field of one letter, in the order the letter reads, so the eye can
// go from a field to the preview beside it and find the same thing in the
// same place. Who it goes to, the envelope, the opening, the card, the
// sections, the link cards, the signature, the colours.
//
// The kind is a column on the row and not part of the document, so it comes
// in as its own prop with its own setter, and is shown only once the second
// migration has added the column. asOf is part of the document, the date
// the ages in the open items count to, see src/lib/mailDocument.js.
//
// This file holds no letter of its own. It takes the document and hands
// back a whole new one on every change through onChange, and MailEditor
// keeps it. The shape is src/lib/mailDocument.js, read its header before
// adding a field, a field the renderer does not draw is a field that lies.
//
// The form sits on the Pulse paper and the house fields, the same kit as
// Invoicing and Reports, src/components/common/Page.jsx. Paired fields sit
// in a SimpleGrid by minimum width rather than by breakpoint, because the
// column is narrow beside the preview on a desktop and wide on a tablet
// where the preview stacks under it.
//
// No oxford commas, no em dashes.

import {
  Box, VStack, HStack, Text, Input, Textarea, SimpleGrid, Icon, Button,
} from '@chakra-ui/react';
import { TbPlus, TbArrowUp, TbArrowDown, TbTrash } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Section, Field, Plate, Kicker } from '../../../components/common/Page';
import DotSelect from '../../../components/common/DotSelect';
import { SENDERS, MAX_CARDS, KINDS, blankCard, pathOf } from '../../../lib/mailDocument';
import AddressField from './AddressField';
import ThemePicker from './ThemePicker';
import SectionsEditor from './SectionsEditor';

const P = colors.paper;

const Pair = ({ children }) => <SimpleGrid minChildWidth="200px" spacing={4}>{children}</SimpleGrid>;

const CardEditor = ({ card, index, count, onChange, onMove, onRemove }) => {
  const set = (k) => (e) => onChange({ ...card, [k]: e.target.value });
  return (
    <Plate sunken>
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Kicker>link card {index + 1}</Kicker>
          <HStack spacing={1}>
            <Button size="xs" variant="ghost" aria-label="Move this card up" isDisabled={index === 0} onClick={() => onMove(-1)}>
              <Icon as={TbArrowUp} boxSize={3.5} />
            </Button>
            <Button size="xs" variant="ghost" aria-label="Move this card down" isDisabled={index === count - 1} onClick={() => onMove(1)}>
              <Icon as={TbArrowDown} boxSize={3.5} />
            </Button>
            <Button size="xs" variant="ghost" aria-label="Remove this card" onClick={onRemove} _hover={{ color: P.coral }}>
              <Icon as={TbTrash} boxSize={3.5} />
            </Button>
          </HStack>
        </HStack>
        <Pair>
          <Field label="kicker"><Input value={card.kicker} onChange={set('kicker')} placeholder="Brand" /></Field>
          <Field label="title"><Input value={card.title} onChange={set('title')} placeholder="The brand guide" /></Field>
        </Pair>
        <Field label="line"><Textarea rows={2} minH="72px" value={card.line} onChange={set('line')} placeholder="One sentence on what is behind the link." /></Field>
        <Field label="address" hint={card.url.trim() ? `prints as ${pathOf(card.url)}` : 'the path under the card is drawn from this'}>
          <Input value={card.url} onChange={set('url')} placeholder="https://" spellCheck={false} />
        </Field>
      </VStack>
    </Plate>
  );
};

const MailFields = ({ doc, onChange, clients = [], clientId, onClientChange, kind, onKindChange }) => {
  const set = (k, v) => onChange({ ...doc, [k]: v });
  const setHero = (k) => (e) => onChange({ ...doc, hero: { ...doc.hero, [k]: e.target.value } });
  const setSig = (k) => (e) => onChange({ ...doc, signature: { ...doc.signature, [k]: e.target.value } });

  const setCard = (i, card) => set('cards', doc.cards.map((c, j) => (j === i ? card : c)));
  const moveCard = (i, d) => {
    const next = [...doc.cards];
    const [card] = next.splice(i, 1);
    next.splice(i + d, 0, card);
    set('cards', next);
  };
  const removeCard = (i) => set('cards', doc.cards.filter((_, j) => j !== i));
  const addCard = () => set('cards', [...doc.cards, blankCard()]);

  return (
    <VStack align="stretch" spacing={10}>
      <Section kicker="who it goes to">
        <VStack align="stretch" spacing={5}>
          <Pair>
            <Field label="from" hint="replies come back here">
              <DotSelect
                value={doc.from}
                onChange={(v) => set('from', v)}
                options={Object.values(SENDERS).map((s) => ({ value: s.key, label: `${s.name} <${s.address}>` }))}
              />
            </Field>
            {onClientChange && (
              <Field label="client" hint="optional">
                <DotSelect
                  value={clientId || ''}
                  onChange={onClientChange}
                  placeholder="No client"
                  options={[{ value: '', label: 'No client' }, ...clients.map((c) => ({ value: c.id, label: c.company || c.name, hint: c.company ? c.name : undefined }))]}
                />
              </Field>
            )}
          </Pair>
          <AddressField label="to" value={doc.to} onChange={(v) => set('to', v)} />
          <AddressField label="cc" value={doc.cc} onChange={(v) => set('cc', v)} optional hint="everyone here sees everyone else" />
        </VStack>
      </Section>

      <Section kicker="the envelope">
        <VStack align="stretch" spacing={5}>
          <Field label="subject">
            <Input value={doc.subject} onChange={(e) => set('subject', e.target.value)} placeholder="The month, in a few words" />
          </Field>
          <Field label="preheader" hint="the grey line beside the subject in an inbox">
            <Input value={doc.preheader} onChange={(e) => set('preheader', e.target.value)} placeholder="Optional. Left empty the inbox shows the opening." />
          </Field>
          <Pair>
            {onKindChange && (
              <Field label="kind">
                <DotSelect value={kind || 'letter'} onChange={onKindChange} options={Object.values(KINDS).map((k) => ({ value: k.key, label: k.label }))} />
              </Field>
            )}
            <Field label="as of" hint="open item ages count to this day">
              <Input type="date" value={doc.asOf} onChange={(e) => set('asOf', e.target.value)} />
            </Field>
          </Pair>
        </VStack>
      </Section>

      <Section kicker="the opening">
        <Field label="above everything, plain type" hint="a blank line starts a new paragraph">
          <Textarea
            value={doc.opening}
            onChange={(e) => set('opening', e.target.value)}
            rows={9}
            minH="200px"
            placeholder="Hi there, just checking in."
          />
        </Field>
      </Section>

      <Section kicker="the card">
        <VStack align="stretch" spacing={5}>
          <Field label="kicker" hint="small, uppercase">
            <Input value={doc.hero.kicker} onChange={setHero('kicker')} placeholder="Month end report  ·  September 2026" />
          </Field>
          <Field label="headline" hint="a new line breaks the headline">
            <Textarea rows={2} minH="72px" value={doc.hero.headline} onChange={setHero('headline')} placeholder={'A few questions,\none tap each.'} />
          </Field>
          <Field label="lede">
            <Textarea rows={4} value={doc.hero.lede} onChange={setHero('lede')} placeholder="What is behind the button, in two or three sentences." />
          </Field>
          <Pair>
            <Field label="button label"><Input value={doc.hero.buttonLabel} onChange={setHero('buttonLabel')} placeholder="Open the report ›" /></Field>
            <Field label="button address"><Input value={doc.hero.buttonUrl} onChange={setHero('buttonUrl')} placeholder="https://" spellCheck={false} /></Field>
          </Pair>
          <Pair>
            <Field label="code line"><Input value={doc.hero.codeLine} onChange={setHero('codeLine')} placeholder="It asks for a code once." /></Field>
            <Field label="code" hint="set bright inside the line"><Input value={doc.hero.code} onChange={setHero('code')} fontFamily="mono" spellCheck={false} /></Field>
          </Pair>
        </VStack>
      </Section>

      <Section kicker="sections" count={doc.sections.length || null}>
        <SectionsEditor sections={doc.sections} onChange={(v) => set('sections', v)} />
      </Section>

      <Section kicker="link cards" count={`${doc.cards.length} of ${MAX_CARDS}`}>
        <VStack align="stretch" spacing={4}>
          <Field label="the line above them">
            <Input value={doc.cardsLabel} onChange={(e) => set('cardsLabel', e.target.value)} placeholder="Also yours, no charge" />
          </Field>
          {doc.cards.map((card, i) => (
            <CardEditor
              key={i}
              card={card}
              index={i}
              count={doc.cards.length}
              onChange={(c) => setCard(i, c)}
              onMove={(d) => moveCard(i, d)}
              onRemove={() => removeCard(i)}
            />
          ))}
          {doc.cards.length < MAX_CARDS && (
            <Box>
              <Button size="sm" variant="outline" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={addCard}>
                Add a link card
              </Button>
            </Box>
          )}
        </VStack>
      </Section>

      <Section kicker="the signature">
        <VStack align="stretch" spacing={5}>
          <Field label="tagline" hint="written for this client"><Input value={doc.signature.tagline} onChange={setSig('tagline')} placeholder="One line written for their business" /></Field>
          <Field label="second line"><Input value={doc.signature.subline} onChange={setSig('subline')} /></Field>
          <Pair>
            <Field label="name"><Input value={doc.signature.name} onChange={setSig('name')} /></Field>
            <Field label="title"><Input value={doc.signature.title} onChange={setSig('title')} /></Field>
          </Pair>
          <Pair>
            <Field label="phone" hint="sent as a tap to call link"><Input value={doc.signature.phone} onChange={setSig('phone')} inputMode="tel" /></Field>
            <Field label="email"><Input value={doc.signature.email} onChange={setSig('email')} type="email" /></Field>
          </Pair>
          <Pair>
            <Field label="site label"><Input value={doc.signature.siteLabel} onChange={setSig('siteLabel')} /></Field>
            <Field label="site address"><Input value={doc.signature.siteUrl} onChange={setSig('siteUrl')} spellCheck={false} /></Field>
          </Pair>
          <Pair>
            <Field label="login label"><Input value={doc.signature.loginLabel} onChange={setSig('loginLabel')} /></Field>
            <Field label="login address"><Input value={doc.signature.loginUrl} onChange={setSig('loginUrl')} spellCheck={false} /></Field>
          </Pair>
          <Field label="sign off"><Input value={doc.signature.signoff} onChange={setSig('signoff')} /></Field>
        </VStack>
      </Section>

      <Section kicker="the colours">
        <ThemePicker theme={doc.theme} onChange={(t) => set('theme', t)} />
      </Section>

      <Text fontSize={TYPE.small} color={P.inkFaint} lineHeight="1.6">
        Every link goes out exactly as written here. The phone is sent as a tap to call link built from its digits.
      </Text>
    </VStack>
  );
};

export default MailFields;
