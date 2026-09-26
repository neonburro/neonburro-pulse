// src/pages/Clients/components/ClientModal.jsx
// New and edit client, on Paper. A wide cream sheet on desktop, full screen on a
// phone, organized into short tabs so nothing is crammed: Profile, Billing,
// Portal, and Projects when editing.
//
// ── WHAT IT GATHERS, AND WHY ─────────────────────────────────────────────────
// Individual or business (business reveals company and an EIN). A real billing
// address so the invoice Bill To is complete. A timezone so the shared calendar
// can line people up later. And contacts, any number of them, each flaggable as
// primary or as a billing CC, which is who gets copied on an invoice. Contacts
// live in the client_contacts table and are replaced as a set on save.
//
// ── MOBILE ───────────────────────────────────────────────────────────────────
// Every field grid is one column on a phone and at most two on desktop
// (SimpleGrid base 1 md 2). Toggles are plain pills, no floating badges, nothing
// overlaps. The cream is the frame.
//
// 2026-09-25. House fields, house labels, house tabs. Nothing centred.
// Preserves the PIN, the portal invite and the projects logic. No oxford
// commas, no dashes.

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, VStack, HStack, Text, Input, Button, Textarea,
  Box, Wrap, WrapItem, Icon, useToast, InputGroup, InputRightElement, SimpleGrid,
} from '@chakra-ui/react';
import {
  TbAlertTriangle, TbCheck, TbMail, TbRefresh, TbPlus, TbFolder, TbTrash, TbX,
  TbUser, TbBuilding,
} from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import DotSelect from '../../../components/common/DotSelect';
import { Field, FieldLabel, Kicker, Tabs, Empty } from '../../../components/common/Page';
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

// ============================================
// PROJECTS SUBSECTION
// ============================================
const ProjectsSection = ({ clientId, toast }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (clientId) fetchProjects(); }, [clientId]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('id, name, status, project_number')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({ client_id: clientId, name: newName.trim(), status: 'active' })
        .select().single();
      if (error) throw error;
      setProjects([data, ...projects]);
      setNewName('');
      setShowAdd(false);
      toast({ title: 'Project added', status: 'success', duration: 1500 });
    } catch (err) {
      toast({ title: 'Failed to add', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(projects.filter((p) => p.id !== id));
      toast({ title: 'Project removed', status: 'success', duration: 1500 });
    } catch (err) {
      toast({ title: 'Failed to remove', description: err.message, status: 'error', duration: 3000 });
    }
  };

  if (!clientId) {
    return <Empty py={2}>Save this client first to add projects.</Empty>;
  }

  return (
    <VStack align="stretch" spacing={2}>
      {loading ? (
        <Text fontSize={TYPE.small} color={P.inkMuted} fontFamily="mono">loading projects</Text>
      ) : (
        <>
          {projects.length === 0 && !showAdd && (
            <Empty py={2}>No projects yet.</Empty>
          )}
          {projects.map((project) => (
            <HStack key={project.id} py={2.5} px={INSET} spacing={3} bg={P.sheet} border="1px solid" borderColor={P.hairSoft} borderRadius="lg" role="group">
              <Icon as={TbFolder} boxSize={3.5} color={P.inkFaint} />
              <Box flex={1} minW={0}>
                <Text color={P.ink} fontSize={TYPE.body} fontWeight="600" noOfLines={1}>{project.name}</Text>
                {project.project_number && (
                  <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{project.project_number}</Text>
                )}
              </Box>
              <Text fontSize={TYPE.kicker} color={project.status === 'active' ? P.limeDeep : P.inkFaint} fontFamily="mono" fontWeight="500" letterSpacing="0.1em" textTransform="uppercase">
                {project.status}
              </Text>
              <Box as="button" type="button" onClick={() => handleDelete(project.id)} opacity={0} transition="opacity 0.15s" _groupHover={{ opacity: 0.6 }} _hover={{ opacity: '1 !important', color: P.coral }} color={P.inkFaint}>
                <Icon as={TbTrash} boxSize={3.5} />
              </Box>
            </HStack>
          ))}
          {showAdd ? (
            <HStack spacing={2} pt={1}>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name" autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
                  else if (e.key === 'Escape') { setShowAdd(false); setNewName(''); }
                }} />
              <Button size="md" onClick={handleAdd} isLoading={adding} isDisabled={!newName.trim()}>Add</Button>
              <Box as="button" type="button" onClick={() => { setShowAdd(false); setNewName(''); }} color={P.inkMuted} _hover={{ color: P.ink }}><Icon as={TbX} boxSize={4} /></Box>
            </HStack>
          ) : (
            <HStack as="button" type="button" spacing={1.5} onClick={() => setShowAdd(true)} color={P.limeDeep} _hover={{ color: P.ink }} pt={1} userSelect="none">
              <Icon as={TbPlus} boxSize={3} />
              <Kicker color="inherit">Add project</Kicker>
            </HStack>
          )}
        </>
      )}
    </VStack>
  );
};

// ============================================
// MAIN MODAL
// ============================================
const ClientModal = ({ isOpen, onClose, client, onSave }) => {
  const [activeTab, setActiveTab] = useState('profile');
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
    setActiveTab('profile');
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

  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'billing', label: 'Billing' },
    { key: 'portal', label: 'Portal' },
    ...(isEditing ? [{ key: 'projects', label: 'Projects' }] : []),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }} scrollBehavior="inside" isCentered>
      <ModalOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(4px)" />
      <ModalContent
        bg={P.sheet}
        border={{ base: 'none', md: '1px solid' }}
        borderColor={P.hair}
        mx={{ base: 0, md: 4 }}
        borderRadius={{ base: 0, md: '20px' }}
        maxW={{ md: '660px' }}
        overflow="hidden"
      >
        <ModalHeader pb={3} pt={6} px={{ base: 5, md: 7 }}>
          <HStack spacing={3}>
            <Box w="42px" h="42px" borderRadius="12px" bg={name ? avatarColor : P.sunken} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Text color={name ? P.sheet : P.inkFaint} fontSize={TYPE.body} fontWeight="800" letterSpacing="-0.02em">{initials || '··'}</Text>
            </Box>
            <VStack align="start" spacing={0}>
              <Text color={P.ink} fontSize={TYPE.section} fontWeight="600" lineHeight="1.2">{isEditing ? 'Edit client' : 'New client'}</Text>
              {name && <Text fontSize={TYPE.label} color={P.inkMuted} fontFamily="mono">{company || (isBusiness ? 'Business' : 'Individual')}</Text>}
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color={P.inkMuted} top={5} right={5} />

        <Box px={{ base: 5, md: 7 }}>
          <Tabs items={TABS} value={activeTab} onChange={setActiveTab} />
        </Box>

        <ModalBody px={{ base: 5, md: 7 }} py={6} bg={P.mat}>
          {activeTab === 'profile' && (
            <VStack spacing={5} align="stretch">
              <Field label="Type">
                <HStack spacing={2}>
                  <PillToggle on={!isBusiness} onClick={() => setClientType('individual')}>
                    <HStack spacing={1.5}><Icon as={TbUser} boxSize={3} /><Text as="span">Individual</Text></HStack>
                  </PillToggle>
                  <PillToggle on={isBusiness} onClick={() => setClientType('business')}>
                    <HStack spacing={1.5}><Icon as={TbBuilding} boxSize={3} /><Text as="span">Business</Text></HStack>
                  </PillToggle>
                </HStack>
              </Field>

              <Field label={isBusiness ? 'Contact name' : 'Name'}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isBusiness ? 'Primary contact' : 'Full name'} autoFocus={!isEditing} />
              </Field>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {isBusiness && (
                  <Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" /></Field>
                )}
                <Field label="Website"><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" /></Field>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Field label="Email">
                  <InputGroup>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" />
                    {emailValid !== null && (
                      <InputRightElement pr={INSET} w="auto"><Icon as={emailValid ? TbCheck : TbAlertTriangle} color={emailValid ? P.green : P.gold} boxSize={3.5} /></InputRightElement>
                    )}
                  </InputGroup>
                </Field>
                <Field label="Phone">
                  <InputGroup>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))} placeholder="(970) 555-1234" />
                    {phoneValid !== null && (
                      <InputRightElement pr={INSET} w="auto"><Icon as={phoneValid ? TbCheck : TbAlertTriangle} color={phoneValid ? P.green : P.gold} boxSize={3.5} /></InputRightElement>
                    )}
                  </InputGroup>
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

              <Field label="Notes">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" rows={3} />
              </Field>
            </VStack>
          )}

          {activeTab === 'billing' && (
            <VStack spacing={6} align="stretch">
              <VStack spacing={4} align="stretch">
                <Kicker>Bill to address</Kicker>
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
              </VStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {isBusiness && (
                  <Field label="EIN or tax id"><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="00-0000000" /></Field>
                )}
                <Field label="Timezone">
                  <DotSelect value={timezone} onChange={setTimezone} placeholder="Select timezone" options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace('_', ' ') }))} />
                </Field>
              </SimpleGrid>

              <VStack spacing={3} align="stretch">
                <HStack justify="space-between" align="center">
                  <Kicker>Contacts</Kicker>
                  <HStack as="button" type="button" spacing={1.5} onClick={addContact} color={P.limeDeep} _hover={{ color: P.ink }} userSelect="none">
                    <Icon as={TbPlus} boxSize={3} />
                    <Kicker color="inherit">Add contact</Kicker>
                  </HStack>
                </HStack>

                {contacts.length === 0 ? (
                  <Empty py={2}>No extra contacts. Add anyone who should be copied on invoices.</Empty>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {contacts.map((c, idx) => (
                      <Box key={c.id || c._key || idx} bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="xl" p={4}>
                        <HStack justify="space-between" mb={3}>
                          <Kicker color={P.inkFaint}>Contact {idx + 1}</Kicker>
                          <Box as="button" type="button" onClick={() => removeContact(idx)} color={P.inkFaint} _hover={{ color: P.coral }}><Icon as={TbTrash} boxSize={3.5} /></Box>
                        </HStack>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                          <Input value={c.name || ''} onChange={(e) => updateContact(idx, { name: e.target.value })} placeholder="Name" />
                          <Input value={c.role || ''} onChange={(e) => updateContact(idx, { role: e.target.value })} placeholder="Role, eg Accounts payable" />
                          <Input value={c.email || ''} onChange={(e) => updateContact(idx, { email: e.target.value })} placeholder="Email" />
                          <Input value={c.phone || ''} onChange={(e) => updateContact(idx, { phone: formatPhoneDisplay(e.target.value) })} placeholder="Phone" />
                        </SimpleGrid>
                        <HStack spacing={2} mt={3}>
                          <PillToggle on={!!c.is_primary} onClick={() => updateContact(idx, { is_primary: !c.is_primary })}>Primary</PillToggle>
                          <PillToggle on={!!c.is_billing} onClick={() => updateContact(idx, { is_billing: !c.is_billing })}>Bill to CC</PillToggle>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                )}
              </VStack>
            </VStack>
          )}

          {activeTab === 'portal' && (
            <VStack spacing={6} align="stretch">
              <Field label="Lookup PIN" hint="the client uses this PIN plus their email to look up invoices">
                <HStack spacing={3} pt={1}>
                  <Text flex={1} fontFamily="mono" fontSize={TYPE.figure} fontWeight="700" color={P.ink} letterSpacing="0.15em">{portalPin || 'no pin yet'}</Text>
                  <Box as="button" type="button" onClick={regeneratePin} color={P.inkMuted} _hover={{ color: P.limeDeep, transform: 'rotate(180deg)' }} transition="all 0.3s" p={2} aria-label="Regenerate PIN"><Icon as={TbRefresh} boxSize={4} /></Box>
                </HStack>
              </Field>

              {isEditing && client?.email && (
                <Box pt={4} borderTop="1px solid" borderColor={P.hair}>
                  <HStack justify="space-between" align="start">
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
                        {client.portal_invite_sent_at ? 'Resend' : 'Send invite'}
                      </Button>
                    )}
                  </HStack>
                </Box>
              )}

              {!isEditing && <Empty py={2}>Save this client first to send a portal invite.</Empty>}
            </VStack>
          )}

          {activeTab === 'projects' && (
            <VStack spacing={4} align="stretch">
              <Field label="Projects" hint="websites, apps and other work for this client" />
              <ProjectsSection clientId={client?.id} toast={toast} />
            </VStack>
          )}
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={P.hair} pt={4} pb={{ base: 8, md: 6 }} px={{ base: 5, md: 7 }} bg={P.sheet} justifyContent="space-between" flexWrap="wrap" gap={3}>
          {isEditing ? (
            <HStack as="button" type="button" spacing={1.5} onClick={handleDelete} color={confirmDelete ? P.coral : P.inkFaint} _hover={{ color: P.coral }} transition={`all ${FAST} ${EASE}`} userSelect="none">
              <Icon as={confirmDelete ? TbAlertTriangle : TbTrash} boxSize={3} />
              <Kicker color="inherit">
                {deleting ? 'Removing' : confirmDelete ? 'Click again to confirm' : 'Remove client'}
              </Kicker>
            </HStack>
          ) : <Box />}
          <Button size="md" onClick={handleSave} isLoading={saving} loadingText="Saving">
            {isEditing ? 'Save changes' : 'Add client'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ClientModal;
