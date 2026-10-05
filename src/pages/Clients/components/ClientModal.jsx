// src/pages/Clients/components/ClientModal.jsx
// New and edit client, on Paper. A wide cream sheet on desktop, full screen on a
// phone. ONE SCROLLING FORM IN FIVE SECTIONS, NO TABS.
//
// ── WHY THE TABS WENT, 2026-10-05 ───────────────────────────────────────────
// It was Profile, Billing, Portal and Projects. The billing address and the
// contacts, the two things an invoice actually needs, were on the second tab,
// so a client could be saved with a name and an email and nothing anybody
// would notice was missing until the invoice printed a bare name. Tyler asked
// for forms that are already open and nicely formatted, so every field is on
// one page now, in the order somebody fills them in.
//
//   01 Who        individual or business, name, company, status, tags
//   02 Reach      email, phone, website
//   03 Bill to    the address, EIN and timezone, plus a live readout of the
//                 Billed to block exactly as the invoice will print it
//   04 People     any number of contacts, each primary or a billing CC
//   05 Portal     the lookup PIN and the portal invite
//   Notes         team only, last
//
// Projects left this form. They save the moment they are added rather than
// on Save, which inside a form that otherwise waits for Save was a trap, and
// they live on the client page now where they are read. See ClientDetail.jsx.
//
// ── WHAT IT GATHERS, AND WHY ─────────────────────────────────────────────────
// A real billing address so the invoice Bill To is complete. A timezone so the
// shared calendar can line people up. And contacts, any number of them, each
// flaggable as primary or as a billing CC, which is who gets copied on an
// invoice. Contacts live in the client_contacts table and are replaced as a
// set on save.
//
// The Bill to readout follows the same rule as the Billed to block in
// src/lib/invoiceEmailTemplate.js and the card on ClientDetail.jsx. A business
// leads with the company and lists the contact as Attn. Change all three or
// none.
//
// ── MOBILE ───────────────────────────────────────────────────────────────────
// Every field grid is one column on a phone and at most two on desktop
// (SimpleGrid base 1 md 2). The sections are plates from md up and bare on a
// phone, no containers around content on a phone. Nothing overlaps.
//
// Preserves the PIN, the portal invite and the contact sync. No oxford
// commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, VStack, HStack, Text, Input, Button, Textarea,
  Box, Wrap, WrapItem, Icon, useToast, InputGroup, InputRightElement, SimpleGrid,
} from '@chakra-ui/react';
import {
  TbAlertTriangle, TbCheck, TbMail, TbRefresh, TbPlus, TbTrash,
  TbUser, TbBuilding,
} from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST, PLATE_RADIUS } from '../../../theme/layout';
import DotSelect from '../../../components/common/DotSelect';
import { Field, FieldLabel, Kicker, Empty } from '../../../components/common/Page';
import {
  formatPhoneDisplay, formatPhoneStorage, isValidEmail, isValidPhone,
  generatePortalPin, getInitials, getAvatarColor,
} from '../../../utils/phone';

const P = colors.paper;

const PRESET_TAGS = [
  { value: 'local',        label: 'Local' },
  { value: 'recurring',    label: 'Recurring' },
  { value: 'vip',          label: 'VIP' },
  { value: 'lab',          label: 'Lab' },
  { value: 'hosting',      label: 'Hosting' },
  { value: 'web3',         label: 'Web3' },
  { value: 'subscription', label: 'Subscription' },
];

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active',   color: P.green },
  { value: 'lead',     label: 'Lead',     color: P.gold },
  { value: 'inactive', label: 'Inactive', color: P.inkFaint },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'UTC',
];

// A small pill toggle, filled lime when on.
const PillToggle = ({ on, onClick, children }) => (
  <Box
    as="button"
    type="button"
    onClick={onClick}
    px={3}
    h="30px"
    borderRadius="full"
    border="1px solid"
    borderColor={on ? 'transparent' : P.hair}
    bg={on ? P.lime : 'transparent'}
    transition={`all ${FAST} ${EASE}`}
    _hover={{ borderColor: on ? 'transparent' : P.inkFaint }}
  >
    <Text fontSize={TYPE.kicker} fontWeight="500" fontFamily="mono" letterSpacing="0.1em" textTransform="uppercase" color={on ? P.limeInk : P.inkMuted}>
      {children}
    </Text>
  </Box>
);

// One numbered section. A plate from md up, bare on a phone.
const FormSection = ({ n, title, hint, action, children }) => (
  <Box
    bg={{ base: 'transparent', md: P.sheet }}
    border={{ base: 'none', md: '1px solid' }}
    borderColor={P.hair}
    borderRadius={{ base: 0, md: PLATE_RADIUS }}
    p={{ base: 0, md: 5 }}
  >
    <HStack justify="space-between" align="baseline" mb={4} spacing={3}>
      <HStack spacing={3} align="baseline" minW={0}>
        {n && <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} fontWeight="600">{n}</Text>}
        <Text fontSize={TYPE.section} fontWeight="600" color={P.ink} letterSpacing="-0.01em">{title}</Text>
      </HStack>
      {action}
    </HStack>
    {hint && <Text fontSize={TYPE.small} color={P.inkMuted} mt={-2} mb={4} lineHeight="1.55">{hint}</Text>}
    {children}
  </Box>
);

const ClientModal = ({ isOpen, onClose, client, onSave }) => {
  const [clientType, setClientType] = useState('individual');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('active');
  const [tags, setTags] = useState([]);
  const [portalPin, setPortalPin] = useState('');
  const [notes, setNotes] = useState('');

  const [taxId, setTaxId] = useState('');
  const [timezone, setTimezone] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('US');
  const [contacts, setContacts] = useState([]);

  const [saving, setSaving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  const isEditing = !!client?.id;
  const isBusiness = clientType === 'business';
  const emailValid = email ? isValidEmail(email) : null;
  const phoneValid = phone ? isValidPhone(phone) : null;

  useEffect(() => {
    if (client) {
      setClientType(client.client_type || (client.company ? 'business' : 'individual'));
      setName(client.name || '');
      setCompany(client.company || '');
      setWebsite(client.website || '');
      setEmail(client.email || '');
      setPhone(formatPhoneDisplay(client.phone || ''));
      setStatus(client.status || 'active');
      setTags(client.tags || []);
      setPortalPin(client.portal_pin || client.lookup_pin || '');
      setNotes(client.notes || '');
      setTaxId(client.tax_id || '');
      setTimezone(client.timezone || '');
      setAddr1(client.address_line1 || '');
      setAddr2(client.address_line2 || '');
      setCity(client.city || '');
      setRegion(client.region || '');
      setPostal(client.postal_code || '');
      setCountry(client.country || 'US');
      loadContacts(client.id);
    } else {
      setClientType('individual');
      setName(''); setCompany(''); setWebsite(''); setEmail(''); setPhone('');
      setStatus('active'); setTags([]); setPortalPin(generatePortalPin()); setNotes('');
      setTaxId(''); setTimezone(''); setAddr1(''); setAddr2(''); setCity('');
      setRegion(''); setPostal(''); setCountry('US'); setContacts([]);
    }
    setConfirmDelete(false);
  }, [client, isOpen]);

  const loadContacts = async (clientId) => {
    if (!clientId) { setContacts([]); return; }
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('sort_order');
    setContacts(data || []);
  };

  const toggleTag = (v) => setTags(tags.includes(v) ? tags.filter((t) => t !== v) : [...tags, v]);
  const regeneratePin = () => { setPortalPin(generatePortalPin()); toast({ title: 'New PIN generated', status: 'info', duration: 1500 }); };

  const addContact = () => setContacts([...contacts, { _key: `new-${Date.now()}`, name: '', email: '', phone: '', role: '', is_primary: contacts.length === 0, is_billing: contacts.length === 0 }]);
  const updateContact = (idx, patch) => setContacts(contacts.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeContact = (idx) => setContacts(contacts.filter((_, i) => i !== idx));

  const logActivity = async (action, entityId, metadata) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      user_id: user?.id, action, entity_type: 'client', entity_id: entityId, metadata,
      created_at: new Date().toISOString(),
    });
  };

  // Replace the whole contact set for a client. Small N, so a clean delete then
  // insert keeps the table exactly in sync with the form.
  const syncContacts = async (clientId) => {
    await supabase.from('client_contacts').delete().eq('client_id', clientId);
    const rows = contacts
      .filter((c) => (c.name || c.email || c.phone))
      .map((c, i) => ({
        client_id: clientId,
        name: c.name?.trim() || null,
        email: c.email?.trim().toLowerCase() || null,
        phone: c.phone ? formatPhoneStorage(c.phone) : null,
        role: c.role?.trim() || null,
        is_primary: !!c.is_primary,
        is_billing: !!c.is_billing,
        sort_order: i,
      }));
    if (rows.length) await supabase.from('client_contacts').insert(rows);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', status: 'warning', duration: 2000 }); return; }
    if (email && !isValidEmail(email)) { toast({ title: 'Email looks invalid', status: 'warning', duration: 2000 }); return; }

    setSaving(true);
    try {
      const payload = {
        client_type: clientType,
        name: name.trim(),
        company: company.trim() || null,
        website: website.trim() || null,
        email: email.trim().toLowerCase() || null,
        phone: formatPhoneStorage(phone) || null,
        status,
        tags: tags.length > 0 ? tags : null,
        portal_pin: portalPin || null,
        lookup_pin: portalPin || null,
        notes: notes.trim() || null,
        tax_id: isBusiness ? (taxId.trim() || null) : null,
        timezone: timezone || null,
        address_line1: addr1.trim() || null,
        address_line2: addr2.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        postal_code: postal.trim() || null,
        country: country.trim() || null,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let clientId = client?.id;
      if (isEditing) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
        if (error) throw error;
        await logActivity('client_updated', client.id, { client_name: name.trim() });
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select().single();
        if (error) throw error;
        clientId = data.id;
        await logActivity('client_created', data.id, { client_name: name.trim() });
      }

      await syncContacts(clientId);

      toast({ title: isEditing ? 'Client updated' : 'Client added', status: 'success', duration: 2000 });
      onSave();
      onClose();
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;
      await logActivity('client_deleted', client.id, { client_name: client.name });
      toast({ title: 'Client removed', status: 'success', duration: 2000 });
      onSave();
      onClose();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSendPortalInvite = async () => {
    if (!client?.id) return;
    setSendingInvite(true);
    try {
      const res = await fetch('/.netlify/functions/send-client-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Invite failed'); }
      toast({ title: 'Portal invite sent', description: `${client.email} will receive an email`, status: 'success', duration: 3000 });
      onSave();
    } catch (err) {
      toast({ title: 'Invite failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSendingInvite(false);
    }
  };

  const initials = getInitials(isBusiness && company ? company : name);
  const avatarColor = getAvatarColor(name);

  // The live Billed to readout. Same rule as the template, see the header.
  const billPrimary = (isBusiness && company.trim()) || name.trim() || 'Client name';
  const billAttn = isBusiness && company.trim() ? name.trim() : null;
  const cityRegion = [city.trim(), region.trim()].filter(Boolean).join(', ');
  const cityLine = [cityRegion, postal.trim()].filter(Boolean).join(' ').trim();
  const billLines = [addr1.trim(), addr2.trim(), cityLine, country.trim() && country.trim().toUpperCase() !== 'US' ? country.trim() : ''].filter(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }} scrollBehavior="inside" isCentered>
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(4px)" />
      <ModalContent
        bg={P.sheet}
        border={{ base: 'none', md: '1px solid' }}
        borderColor={P.hair}
        mx={{ base: 0, md: 4 }}
        borderRadius={{ base: 0, md: '20px' }}
        maxW={{ md: '720px' }}
        maxH={{ md: 'calc(100vh - 48px)' }}
        overflow="hidden"
      >
        <ModalHeader pb={4} pt={6} px={{ base: 5, md: 7 }} borderBottom="1px solid" borderColor={P.hair}>
          <HStack spacing={3}>
            <Box w="42px" h="42px" borderRadius="12px" bg={name ? avatarColor : P.sunken} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Text color={name ? P.sheet : P.inkFaint} fontSize={TYPE.body} fontWeight="800" letterSpacing="-0.02em">{initials || '··'}</Text>
            </Box>
            <VStack align="start" spacing={0} minW={0}>
              <Text color={P.ink} fontSize={TYPE.section} fontWeight="600" lineHeight="1.2" noOfLines={1}>
                {isEditing ? (company || name || 'Edit client') : 'New client'}
              </Text>
              <Text fontSize={TYPE.label} color={P.inkMuted} fontFamily="mono">
                {isEditing ? (company && name ? `edit · ${name}` : 'edit') : 'fill in what you know, save, come back for the rest'}
              </Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <ModalBody px={{ base: 5, md: 7 }} py={6} bg={P.mat}>
          <VStack spacing={{ base: 9, md: 5 }} align="stretch">
            {/* 01 Who */}
            <FormSection n="01" title="Who">
              <VStack spacing={5} align="stretch">
                <HStack spacing={2}>
                  <PillToggle on={!isBusiness} onClick={() => setClientType('individual')}>
                    <HStack spacing={1.5}><Icon as={TbUser} boxSize={3} /><Text as="span">Individual</Text></HStack>
                  </PillToggle>
                  <PillToggle on={isBusiness} onClick={() => setClientType('business')}>
                    <HStack spacing={1.5}><Icon as={TbBuilding} boxSize={3} /><Text as="span">Business</Text></HStack>
                  </PillToggle>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: isBusiness ? 2 : 1 }} spacing={4}>
                  {isBusiness && (
                    <Field label="Company" hint="prints first on the invoice">
                      <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" autoFocus={!isEditing} />
                    </Field>
                  )}
                  <Field label={isBusiness ? 'Contact name' : 'Name'}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isBusiness ? 'Who you deal with' : 'Full name'} autoFocus={!isEditing && !isBusiness} />
                  </Field>
                </SimpleGrid>

                <Field label="Status">
                  <HStack spacing={2} flexWrap="wrap" rowGap={2}>
                    {STATUS_OPTIONS.map((s) => (
                      <Box key={s.value} as="button" type="button" onClick={() => setStatus(s.value)} px={3} h="30px" borderRadius="full" border="1px solid" borderColor={status === s.value ? s.color : P.hair} bg={status === s.value ? `${s.color}1A` : 'transparent'} transition={`all ${FAST} ${EASE}`}>
                        <HStack spacing={1.5}>
                          <Box w="6px" h="6px" borderRadius="full" bg={s.color} opacity={status === s.value ? 1 : 0.5} />
                          <Text fontSize={TYPE.kicker} fontWeight="500" fontFamily="mono" letterSpacing="0.1em" textTransform="uppercase" color={status === s.value ? P.ink : P.inkMuted}>{s.label}</Text>
                        </HStack>
                      </Box>
                    ))}
                  </HStack>
                </Field>

                <Field label="Tags">
                  <Wrap spacing={2}>
                    {PRESET_TAGS.map((t) => (
                      <WrapItem key={t.value}><PillToggle on={tags.includes(t.value)} onClick={() => toggleTag(t.value)}>{t.label}</PillToggle></WrapItem>
                    ))}
                  </Wrap>
                </Field>
              </VStack>
            </FormSection>

            {/* 02 Reach */}
            <FormSection n="02" title="Reach">
              <VStack spacing={4} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Field label="Email" hint="invoices go here">
                    <InputGroup>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
                      {emailValid !== null && (
                        <InputRightElement pr={INSET} w="auto" h="100%"><Icon as={emailValid ? TbCheck : TbAlertTriangle} color={emailValid ? P.green : P.gold} boxSize={3.5} /></InputRightElement>
                      )}
                    </InputGroup>
                  </Field>
                  <Field label="Phone">
                    <InputGroup>
                      <Input type="tel" value={phone} onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))} placeholder="(970) 555-1234" />
                      {phoneValid !== null && (
                        <InputRightElement pr={INSET} w="auto" h="100%"><Icon as={phoneValid ? TbCheck : TbAlertTriangle} color={phoneValid ? P.green : P.gold} boxSize={3.5} /></InputRightElement>
                      )}
                    </InputGroup>
                  </Field>
                </SimpleGrid>
                <Field label="Main website" hint="every other site is connected on the client page">
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" />
                </Field>
              </VStack>
            </FormSection>

            {/* 03 Bill to */}
            <FormSection n="03" title="Bill to" hint="Without an address the invoice prints the name and the email only.">
              <VStack spacing={4} align="stretch">
                <Field label="Street"><Input value={addr1} onChange={(e) => setAddr1(e.target.value)} placeholder="210 Sherman St" /></Field>
                <Field label="Suite or unit"><Input value={addr2} onChange={(e) => setAddr2(e.target.value)} placeholder="Optional" /></Field>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ridgway" /></Field>
                  <Field label="State or region"><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="CO" /></Field>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Field label="Postal code"><Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="81432" /></Field>
                  <Field label="Country"><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" /></Field>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {isBusiness && (
                    <Field label="EIN or tax id"><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="00-0000000" /></Field>
                  )}
                  <Field label="Timezone">
                    <DotSelect value={timezone} onChange={setTimezone} placeholder="Select timezone" options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace('_', ' ') }))} />
                  </Field>
                </SimpleGrid>

                <Box mt={1} pt={4} borderTop="1px dashed" borderColor={P.hair}>
                  <FieldLabel>As the invoice prints it</FieldLabel>
                  <Box pl={3.5} borderLeft="2px solid" borderColor={P.hair}>
                    <Text fontSize={TYPE.body} fontWeight="600" color={name || company ? P.ink : P.inkFaint}>{billPrimary}</Text>
                    {billAttn && <Text fontSize={TYPE.small} color={P.inkSec}>Attn {billAttn}</Text>}
                    {billLines.map((line) => <Text key={line} fontSize={TYPE.small} color={P.inkSec}>{line}</Text>)}
                    {email.trim() && <Text fontSize={TYPE.small} color={P.inkSec}>{email.trim().toLowerCase()}</Text>}
                  </Box>
                </Box>
              </VStack>
            </FormSection>

            {/* 04 People */}
            <FormSection
              n="04"
              title="People"
              action={(
                <HStack as="button" type="button" spacing={1.5} onClick={addContact} color={P.limeDeep} _hover={{ color: P.ink }} userSelect="none">
                  <Icon as={TbPlus} boxSize={3} />
                  <Kicker color="inherit">Add person</Kicker>
                </HStack>
              )}
            >
              {contacts.length === 0 ? (
                <Empty py={0}>Only the main contact so far. Add a bookkeeper, a partner or anyone who should be copied on invoices.</Empty>
              ) : (
                <VStack spacing={3} align="stretch">
                  {contacts.map((c, idx) => (
                    <Box key={c.id || c._key || idx} bg={P.mat} border="1px solid" borderColor={P.hairSoft} borderRadius="xl" p={4}>
                      <HStack justify="space-between" mb={3}>
                        <Kicker color={P.inkFaint}>Person {idx + 1}</Kicker>
                        <Box as="button" type="button" onClick={() => removeContact(idx)} color={P.inkFaint} _hover={{ color: P.coral }} aria-label="Remove person"><Icon as={TbTrash} boxSize={3.5} /></Box>
                      </HStack>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                        <Input value={c.name || ''} onChange={(e) => updateContact(idx, { name: e.target.value })} placeholder="Name" />
                        <Input value={c.role || ''} onChange={(e) => updateContact(idx, { role: e.target.value })} placeholder="Role, eg bookkeeper" />
                        <Input value={c.email || ''} onChange={(e) => updateContact(idx, { email: e.target.value })} placeholder="Email" />
                        <Input value={c.phone || ''} onChange={(e) => updateContact(idx, { phone: formatPhoneDisplay(e.target.value) })} placeholder="Phone" />
                      </SimpleGrid>
                      <HStack spacing={2} mt={3}>
                        <PillToggle on={!!c.is_primary} onClick={() => updateContact(idx, { is_primary: !c.is_primary })}>Primary</PillToggle>
                        <PillToggle on={!!c.is_billing} onClick={() => updateContact(idx, { is_billing: !c.is_billing })}>Copy on invoices</PillToggle>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </FormSection>

            {/* 05 Portal */}
            <FormSection n="05" title="Portal">
              <VStack spacing={5} align="stretch">
                <Field label="Lookup PIN" hint="with their email, opens their invoices">
                  <HStack spacing={3} pt={1}>
                    <Text flex={1} fontFamily="mono" fontSize={TYPE.figure} fontWeight="700" color={P.ink} letterSpacing="0.15em">{portalPin || 'no pin yet'}</Text>
                    <Box as="button" type="button" onClick={regeneratePin} color={P.inkMuted} _hover={{ color: P.limeDeep, transform: 'rotate(180deg)' }} transition="all 0.3s" p={2} aria-label="Regenerate PIN"><Icon as={TbRefresh} boxSize={4} /></Box>
                  </HStack>
                </Field>

                {isEditing && client?.email ? (
                  <Box pt={4} borderTop="1px solid" borderColor={P.hairSoft}>
                    <HStack justify="space-between" align="start" spacing={4}>
                      <Box flex={1}>
                        <FieldLabel>Portal account</FieldLabel>
                        <Text color={P.ink} fontSize={TYPE.body} fontWeight="600">
                          {client.portal_account_created_at ? 'Active' : client.portal_invite_sent_at ? 'Invite sent' : 'Not activated'}
                        </Text>
                        <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono" mt={0.5}>
                          {client.portal_account_created_at ? `Joined ${new Date(client.portal_account_created_at).toLocaleDateString()}` : client.portal_invite_sent_at ? `Sent ${new Date(client.portal_invite_sent_at).toLocaleDateString()}` : 'No invite sent'}
                        </Text>
                      </Box>
                      {!client.portal_account_created_at && (
                        <Button size="sm" variant="outline" leftIcon={<TbMail size={13} />} onClick={handleSendPortalInvite} isLoading={sendingInvite} loadingText="Sending">
                          {client.portal_invite_sent_at ? 'Resend invite' : 'Send invite'}
                        </Button>
                      )}
                    </HStack>
                  </Box>
                ) : (
                  <Text fontSize={TYPE.small} color={P.inkMuted}>
                    {isEditing ? 'Add an email above to send a portal invite.' : 'Save this client first, then send the portal invite from here.'}
                  </Text>
                )}
              </VStack>
            </FormSection>

            {/* Notes */}
            <FormSection title="Notes" hint="Team only. Never printed and never sent.">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the next person should know" rows={4} />
            </FormSection>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} pt={4} pb={{ base: 8, md: 5 }} px={{ base: 5, md: 7 }} bg={P.sheet} justifyContent="space-between" flexWrap="wrap" gap={3}>
          {isEditing ? (
            <HStack as="button" type="button" spacing={1.5} onClick={handleDelete} color={confirmDelete ? P.coral : P.inkFaint} _hover={{ color: P.coral }} transition={`all ${FAST} ${EASE}`} userSelect="none">
              <Icon as={confirmDelete ? TbAlertTriangle : TbTrash} boxSize={3} />
              <Kicker color="inherit">
                {deleting ? 'Removing' : confirmDelete ? 'Press again to remove for good' : 'Remove client'}
              </Kicker>
            </HStack>
          ) : <Box />}
          <HStack spacing={2}>
            <Button size="md" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="md" onClick={handleSave} isLoading={saving} loadingText="Saving">
              {isEditing ? 'Save changes' : 'Add client'}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ClientModal;
