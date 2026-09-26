// src/pages/Invoicing/components/InvoiceEditor.jsx
// Invoice compose, preview and send. Paper surface (src/theme/colors.js paper.*):
// a warm cream worktable that matches the document it produces.
//
// ── THE SEND GATE ────────────────────────────────────────────────────────────
// Review and send never emails on click. It validates, persists the draft, then
// re-enters the invoice with ?review=1 so it reloads with real ids (no double
// create) and ReviewSendModal opens over it showing the exact client document.
// Only Approve and send inside that gate fires the email. persistInvoice is side
// effect free so Save Draft and the gate both reuse it.
//
// Mark Paid records an off-platform payment from any source. Duplicate clones to
// a fresh draft. Cancel soft cancels and kills the pay link, keeping the snapshot.
//
// 2026-09-25. The house column, the house fields and labels, the house tabs,
// nothing centred. No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, VStack, HStack, Text, Icon, Button,
  Input, Textarea, Divider, Tooltip, useToast,
} from '@chakra-ui/react';
import DotSelect from '../../../components/common/DotSelect';
import {
  TbArrowLeft, TbPlus, TbTrash, TbEye, TbSend,
  TbAlertTriangle, TbRotateClockwise, TbBellRinging, TbCash, TbCopy,
} from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import {
  fetchNextInvoiceNumber,
  fetchNextSprintNumber,
  withInvoiceNumberRetry,
} from '../../../lib/numbering';
import {
  SENT_STATUSES,
  TOOLTIP_PROPS,
  formatCurrency,
} from '../../../lib/invoiceConstants';
import { validateSprintsForSend } from '../../../lib/invoiceValidation';
import colors from '../../../theme/colors';
import { TYPE, EASE, FAST } from '../../../theme/layout';
import { Page, Field, Kicker, Tabs, Empty, Loading, Plate } from '../../../components/common/Page';

import SprintEditRow from './SprintEditRow';
import InvoiceAttachments from './InvoiceAttachments';
import CancelInvoiceModal from './CancelInvoiceModal';
import MarkPaidModal from './MarkPaidModal';
import InvoicePreview from './InvoicePreview';
import InvoiceSnapshotModal from './InvoiceSnapshotModal';
import SendHistoryStrip from './SendHistoryStrip';
import ReminderModal from './ReminderModal';
import ResendModal, { payLinkFor } from './ResendModal';
import ReviewSendModal from './ReviewSendModal';

const P = colors.paper;

// Strip timestamp to YYYY-MM-DD for <input type="date"> compatibility
const dateInputValue = (val) => {
  if (!val) return '';
  if (val.length === 10 && val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const InvoiceEditor = ({ invoiceId, clientId: initialClientId, clients, onClose, onSaved, voltDraft = null }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('compose');
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [clientId, setClientId] = useState(initialClientId || '');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [previewNumber, setPreviewNumber] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);

  const [resending, setResending] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Send gate. Nothing reaches a client without passing through ReviewSendModal.
  const [showSendGate, setShowSendGate] = useState(false);
  const [reviewInvoiceId, setReviewInvoiceId] = useState(null);

  const isNew = !invoiceId;
  const client = clients.find((c) => c.id === clientId);
  const isPaid = invoice?.status === 'paid';
  const isSentish = SENT_STATUSES.includes(invoice?.status);
  const isDraft = invoice?.status === 'draft' || isNew;
  const wasSent = !isNew && invoice?.status && invoice.status !== 'draft';
  const canResendOrRemind = isSentish && !invoice?.cancelled_at;
  // A paid invoice can still be sent, as the receipt. It cannot be reminded.
  const canResend = (isSentish || isPaid) && !invoice?.cancelled_at;
  const canMarkPaid = isSentish && !invoice?.cancelled_at;
  const canDuplicate = !isNew && !invoice?.cancelled_at;

  useEffect(() => { loadData(); }, [invoiceId]);
  useEffect(() => {
    if (clientId) loadProjectsForClient(clientId);
  }, [clientId]);

  // After a send button round trip (persist then navigate with ?review=1) the
  // invoice reloads with real ids, then the gate opens over it.
  useEffect(() => {
    if (!loading && !isNew && invoiceId && searchParams.get('review') === '1') {
      setReviewInvoiceId(invoiceId);
      setShowSendGate(true);
      setSearchParams({ invoice: invoiceId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isNew, invoiceId, searchParams]);

  const loadData = async () => {
    setLoading(true);
    if (isNew) {
      setInvoice({ status: 'draft' });
      // Volt can hand a new invoice a set of drafted lines and a matched client.
      // They land as fresh sprints the operator reviews, edits and sends, so the
      // whole create and send path stays the editor's own tested logic.
      if (voltDraft?.lines?.length) {
        setSprints(voltDraft.lines.map((l, i) => ({
          id: `new-${Date.now()}-${i}`,
          title: l.title || 'Item',
          description: l.description || '',
          amount: parseFloat(l.amount || 0),
          payment_mode: l.payment_mode || 'approve_only',
          payment_status: null,
          is_billable: true,
          sort_order: i,
          _isNew: true,
        })));
        if (voltDraft.clientId) setClientId(voltDraft.clientId);
        if (voltDraft.notes) setNotes(voltDraft.notes);
      } else {
        setSprints([]);
      }
      try {
        const nextNum = await fetchNextInvoiceNumber();
        setPreviewNumber(nextNum);
      } catch (err) {
        console.warn('Could not preview invoice number:', err);
      }
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .maybeSingle();

    if (data) {
      setInvoice(data);
      setClientId(data.client_id || '');
      setProjectId(data.project_id || '');
      setNotes(data.notes || '');
      setDueDate(dateInputValue(data.due_date));
      setSprints(
        (data.invoice_items || [])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((item) => ({ ...item, _dirty: false }))
      );
    }
    setLoading(false);
  };

  const loadProjectsForClient = async (cId) => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', cId)
      .order('created_at', { ascending: false });
    setProjects(data || []);
  };

  const addSprint = () => {
    setSprints([
      ...sprints,
      {
        id: `new-${Date.now()}`,
        title: '',
        description: '',
        amount: 0,
        payment_mode: 'approve_only',
        payment_status: null,
        is_billable: true,
        sort_order: sprints.length,
        _isNew: true,
      },
    ]);
  };

  const updateSprint = (updated) => {
    setSprints(sprints.map((s) => (s.id === updated.id ? { ...updated, _dirty: true } : s)));
  };

  const deleteSprint = async (sprintId) => {
    if (String(sprintId).startsWith('new-')) {
      setSprints(sprints.filter((s) => s.id !== sprintId));
      return;
    }
    const { error } = await supabase.from('invoice_items').delete().eq('id', sprintId);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, status: 'error' });
      return;
    }
    setSprints(sprints.filter((s) => s.id !== sprintId));
    toast({ title: 'Sprint removed', status: 'success', duration: 1500 });
  };

  // Persist the invoice and its sprints, no side effects beyond the write, so
  // both Save Draft and the send gate can reuse it and decide what happens next.
  // Returns the saved id and number.
  const persistInvoice = async () => {
    const total = sprints
      .filter((s) => s.is_billable !== false)
      .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

    let savedInvoiceId = invoiceId;
    let savedInvoiceNumber = invoice?.invoice_number;

    if (isNew) {
      const inserted = await withInvoiceNumberRetry(async (newNumber) => {
        const { data, error } = await supabase
          .from('invoices')
          .insert({
            client_id: clientId,
            project_id: projectId || null,
            status: 'draft',
            invoice_number: newNumber,
            total,
            total_paid: 0,
            notes: notes || null,
            due_date: dueDate || null,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      });
      savedInvoiceId = inserted.id;
      savedInvoiceNumber = inserted.invoice_number;
    } else {
      const { error } = await supabase
        .from('invoices')
        .update({
          client_id: clientId,
          project_id: projectId || null,
          total,
          notes: notes || null,
          due_date: dueDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);
      if (error) throw error;
    }

    for (const sprint of sprints) {
      const sprintPayload = {
        title: sprint.title || 'Untitled Sprint',
        description: sprint.description || null,
        amount: parseFloat(sprint.amount || 0),
        payment_mode: sprint.payment_mode || 'approve_only',
        is_billable: sprint.is_billable !== false,
        sort_order: sprint.sort_order || 0,
        invoice_id: savedInvoiceId,
      };

      if (sprint._isNew) {
        const childNumber = await fetchNextSprintNumber(savedInvoiceId);
        if (childNumber) sprintPayload.sprint_number = childNumber;
        sprintPayload.created_at = new Date().toISOString();
        await supabase.from('invoice_items').insert(sprintPayload);
      } else if (sprint._dirty) {
        await supabase
          .from('invoice_items')
          .update({ ...sprintPayload, updated_at: new Date().toISOString() })
          .eq('id', sprint.id);
      }
    }

    return { id: savedInvoiceId, number: savedInvoiceNumber };
  };

  // Save Draft. Persist and stay in the editor.
  const handleSave = async () => {
    if (!clientId) {
      toast({ title: 'Select a client first', status: 'warning', duration: 2000 });
      return;
    }
    if (sprints.length === 0) {
      toast({ title: 'Add at least one sprint', status: 'warning', duration: 2000 });
      return;
    }
    setSaving(true);
    try {
      const { id, number } = await persistInvoice();
      toast({
        title: isNew ? `Invoice ${number} created` : 'Invoice saved',
        status: 'success',
        duration: 2000,
      });
      onSaved();
      if (isNew) navigate(`/invoicing/?invoice=${id}`);
      else loadData();
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  // The send button. Validate, persist, then re-enter this invoice with a review
  // flag so it reloads with real ids (no double create) and the gate opens over
  // it. The email only goes out when Approve and send is pressed in the gate.
  const handleReviewSend = async () => {
    if (!clientId) {
      toast({ title: 'Select a client first', status: 'warning', duration: 2000 });
      return;
    }
    if (sprints.length === 0) {
      toast({ title: 'Add at least one sprint', status: 'warning', duration: 2000 });
      return;
    }
    const check = validateSprintsForSend(sprints);
    if (!check.valid) {
      toast({ title: 'Cannot send yet', description: check.reason, status: 'warning', duration: 3500 });
      return;
    }
    setSaving(true);
    try {
      const { id } = await persistInvoice();
      onSaved();
      navigate(`/invoicing/?invoice=${id}&review=1`);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id = invoiceId, ccEmails = null) => {
    if (!id) {
      toast({ title: 'Save first before sending', status: 'warning' });
      return;
    }
    setSending(true);
    try {
      // The extra addresses from the review gate ride on the invoice row, so
      // send-invoice.js and every later resend and reminder see them.
      if (Array.isArray(ccEmails)) {
        const { error: ccErr } = await supabase.from('invoices').update({ cc_emails: ccEmails }).eq('id', id);
        if (ccErr) throw new Error(ccErr.message || 'Could not save the extra addresses');
      }
      const res = await fetch('/.netlify/functions/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Send failed');
      }
      toast({
        title: 'Invoice sent',
        description: `${client?.name} will receive an email`,
        status: 'success',
        duration: 3000,
      });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: 'Send failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSending(false);
    }
  };

  const handleResend = async ({ recipients, forwarding } = {}) => {
    if (!invoiceId) return;
    setResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/.netlify/functions/resend-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, action: 'resend', userId: user?.id, recipients }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Resend failed');

      toast({
        title: isPaid ? 'Receipt sent' : forwarding ? 'Copy sent' : 'Invoice resent',
        description: `Delivered to ${Array.isArray(result.recipients) ? result.recipients.join(', ') : result.recipient}`,
        status: 'success',
        duration: 3000,
      });
      setShowResendModal(false);
      setHistoryRefreshKey((k) => k + 1);
      onSaved();
    } catch (err) {
      toast({ title: 'Resend failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setResending(false);
    }
  };

  const handleSendReminder = async ({ subject, body, recipients }) => {
    if (!invoiceId) return;
    setSendingReminder(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/.netlify/functions/resend-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId, action: 'reminder', subject, body, userId: user?.id, recipients,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Reminder failed');

      toast({
        title: 'Reminder sent',
        description: `Friendly nudge delivered to ${result.recipient}`,
        status: 'success',
        duration: 3000,
      });
      setShowReminderModal(false);
      setHistoryRefreshKey((k) => k + 1);
      onSaved();
    } catch (err) {
      toast({ title: 'Reminder failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSendingReminder(false);
    }
  };

  const handleMarkPaid = async ({ method, reference, amount, notes: payNotes, paid_date }) => {
    if (!invoiceId) return;
    setMarkingPaid(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const newTotalPaid = parseFloat(invoice.total_paid || 0) + amount;
      const fullyPaid = newTotalPaid >= parseFloat(invoice.total || 0);

      const { error } = await supabase
        .from('invoices')
        .update({
          status: fullyPaid ? 'paid' : 'partial',
          total_paid: newTotalPaid,
          paid_at: fullyPaid ? `${paid_date}T12:00:00Z` : null,
          payment_method: method,
          payment_reference: reference,
          pay_token: fullyPaid ? null : invoice.pay_token,
          updated_at: now,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action: fullyPaid ? 'invoice_paid' : 'invoice_partial_payment',
        entity_type: 'invoice',
        entity_id: invoiceId,
        metadata: {
          invoice_number: invoice?.invoice_number,
          client_name: client?.name,
          method,
          reference,
          amount,
          notes: payNotes,
          paid_date,
          off_platform: true,
        },
        created_at: now,
      });

      await supabase.from('invoice_history').insert({
        invoice_id: invoiceId,
        sent_at: now,
        sent_by: user?.id,
        send_type: 'initial',
        amount,
        method,
        notes: `Off-platform payment: ${method}${reference ? ` (${reference})` : ''}${payNotes ? ` — ${payNotes}` : ''}`,
      });

      toast({
        title: fullyPaid ? 'Invoice marked paid' : 'Partial payment recorded',
        description: fullyPaid
          ? `${formatCurrency(amount)} via ${method} — fully paid`
          : `${formatCurrency(amount)} via ${method} — ${formatCurrency(parseFloat(invoice.total) - newTotalPaid)} still due`,
        status: 'success',
        duration: 4000,
      });

      setShowMarkPaidModal(false);
      onSaved();
      loadData();
    } catch (err) {
      toast({ title: 'Mark paid failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDuplicate = async () => {
    if (!invoiceId || duplicating) return;
    setDuplicating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const newInvoice = await withInvoiceNumberRetry(async (newNumber) => {
        const { data, error } = await supabase
          .from('invoices')
          .insert({
            client_id: invoice.client_id,
            project_id: invoice.project_id || null,
            status: 'draft',
            invoice_number: newNumber,
            total: invoice.total,
            total_paid: 0,
            notes: invoice.notes || null,
            due_date: null,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      });

      const sprintsToClone = (invoice.invoice_items || sprints).filter((s) => !String(s.id).startsWith('new-'));

      for (let i = 0; i < sprintsToClone.length; i++) {
        const original = sprintsToClone[i];
        const childNumber = await fetchNextSprintNumber(newInvoice.id);

        await supabase.from('invoice_items').insert({
          invoice_id: newInvoice.id,
          sprint_number: childNumber,
          title: original.title || 'Untitled Sprint',
          description: original.description || null,
          amount: parseFloat(original.amount || 0),
          payment_mode: original.payment_mode || 'approve_only',
          is_billable: original.is_billable !== false,
          sort_order: original.sort_order || i,
          created_at: new Date().toISOString(),
        });
      }

      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'invoice_duplicated',
        entity_type: 'invoice',
        entity_id: newInvoice.id,
        metadata: {
          source_invoice_id: invoiceId,
          source_invoice_number: invoice.invoice_number,
          new_invoice_number: newInvoice.invoice_number,
          sprint_count: sprintsToClone.length,
          client_name: client?.name,
        },
        created_at: new Date().toISOString(),
      });

      toast({
        title: 'Invoice duplicated',
        description: `${newInvoice.invoice_number} created as draft from ${invoice.invoice_number}`,
        status: 'success',
        duration: 3000,
      });

      onSaved();
      navigate(`/invoicing/?invoice=${newInvoice.id}`);
    } catch (err) {
      toast({ title: 'Duplicate failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setDuplicating(false);
    }
  };

  const handleHardDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
      await supabase.from('invoices').delete().eq('id', invoiceId);

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'invoice_deleted',
        entity_type: 'invoice',
        entity_id: invoiceId,
        metadata: { invoice_number: invoice?.invoice_number, hard_delete: true },
        created_at: new Date().toISOString(),
      });

      toast({ title: 'Invoice deleted', status: 'success', duration: 2000 });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, status: 'error' });
      setDeleting(false);
    }
  };

  const handleSoftCancel = async (reason) => {
    setCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('invoices')
        .update({
          cancelled_at: now,
          cancelled_by: user?.id,
          cancellation_reason: reason || null,
          pay_token: null,
          status: 'cancelled',
          updated_at: now,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await supabase.from('activity_log').insert({
        user_id: user?.id,
        action: 'invoice_cancelled',
        entity_type: 'invoice',
        entity_id: invoiceId,
        metadata: {
          invoice_number: invoice?.invoice_number,
          client_name: client?.name,
          reason: reason || null,
          original_status: invoice?.status,
        },
        created_at: now,
      });

      toast({
        title: 'Invoice cancelled',
        description: 'Pay link invalidated, snapshot preserved',
        status: 'success',
        duration: 3000,
      });
      setShowCancelModal(false);
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: 'Cancel failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <Page><Loading label="loading the invoice" /></Page>;
  }

  const billableTotal = sprints
    .filter((s) => s.is_billable !== false)
    .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
  const billableCount = sprints.filter((s) => s.is_billable !== false).length;

  const displayNumber = isNew
    ? (previewNumber || 'New invoice')
    : (invoice?.invoice_number || 'Invoice');

  const previewInvoice = {
    ...invoice,
    invoice_number: isNew ? previewNumber : invoice?.invoice_number,
    client_id: clientId,
    notes,
    due_date: dueDate,
  };

  const statusColor =
    invoice?.status === 'paid' ? P.green :
    invoice?.status === 'overdue' ? P.coral :
    invoice?.status === 'draft' ? P.inkMuted : P.limeDeep;

  return (
    <Page spacing={6}>
      <HStack
        as="button"
        type="button"
        spacing={2}
        color={P.inkMuted}
        _hover={{ color: P.ink }}
        transition={`color ${FAST} ${EASE}`}
        onClick={onClose}
        userSelect="none"
        alignSelf="flex-start"
      >
        <Icon as={TbArrowLeft} boxSize={3.5} />
        <Kicker color="inherit">All invoices</Kicker>
      </HStack>

      <VStack align="stretch" spacing={5}>
        <HStack justify="space-between" align="flex-end" flexWrap="wrap" gap={4}>
          <VStack align="start" spacing={1.5}>
            <HStack spacing={3} align="baseline">
              <Kicker color={statusColor}>
                {isNew ? (previewNumber ? 'Draft preview' : 'New invoice') : invoice?.status}
              </Kicker>
              {wasSent && (
                <Tooltip label="View the email we sent" {...TOOLTIP_PROPS}>
                  <Box
                    as="button"
                    type="button"
                    onClick={() => setShowSnapshot(true)}
                    color={P.inkFaint}
                    _hover={{ color: P.limeDeep }}
                    transition={`color ${FAST} ${EASE}`}
                    p={0.5}
                  >
                    <Icon as={TbEye} boxSize={3.5} />
                  </Box>
                </Tooltip>
              )}
            </HStack>
            <Text
              fontFamily="mono"
              fontSize={TYPE.title}
              fontWeight="600"
              color={P.ink}
              letterSpacing="-0.02em"
              lineHeight="1.1"
            >
              {displayNumber}
            </Text>
            <Text color={P.inkMuted} fontSize={TYPE.lede}>
              {billableCount} sprint{billableCount !== 1 ? 's' : ''} · {formatCurrency(billableTotal)}
            </Text>
          </VStack>

          <HStack spacing={2} flexWrap="wrap" rowGap={2}>
            {!isPaid && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                isLoading={saving && !showSendGate}
                loadingText="Saving"
              >
                Save draft
              </Button>
            )}
            {isDraft && billableCount > 0 && clientId && (
              <Button
                size="sm"
                leftIcon={<TbSend size={14} />}
                onClick={handleReviewSend}
                isLoading={saving}
                loadingText="Preparing"
              >
                Review and send
              </Button>
            )}

            {canResend && (
              <>
                <Tooltip label={isPaid ? 'Send the stamped receipt' : 'Send it again, or to somebody else'} {...TOOLTIP_PROPS}>
                  <Button
                    size="sm"
                    variant="outline"
                    color={P.limeDeep}
                    leftIcon={<TbRotateClockwise size={14} />}
                    onClick={() => setShowResendModal(true)}
                    isLoading={resending}
                    loadingText="Sending"
                  >
                    {isPaid ? 'Receipt' : 'Resend'}
                  </Button>
                </Tooltip>
                {payLinkFor(invoice) && !isPaid && (
                  <Tooltip label="Copy the pay link" {...TOOLTIP_PROPS}>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<TbCopy size={14} />}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(payLinkFor(invoice));
                          toast({ title: 'Link copied', description: 'Paste it anywhere the client will see it', status: 'success', duration: 2500 });
                        } catch {
                          toast({ title: 'Could not copy', description: payLinkFor(invoice), status: 'warning', duration: 6000 });
                        }
                      }}
                    >
                      Copy link
                    </Button>
                  </Tooltip>
                )}
                {canResendOrRemind && !isPaid && (
                <Tooltip label="Send a friendly nudge" {...TOOLTIP_PROPS}>
                  <Button
                    size="sm"
                    variant="outline"
                    color={P.gold}
                    leftIcon={<TbBellRinging size={14} />}
                    onClick={() => setShowReminderModal(true)}
                  >
                    Remind
                  </Button>
                </Tooltip>
                )}
              </>
            )}

            {canMarkPaid && (
              <Tooltip label="Record an off-platform payment" {...TOOLTIP_PROPS}>
                <Button
                  size="sm"
                  variant="outline"
                  color={P.green}
                  leftIcon={<TbCash size={14} />}
                  onClick={() => setShowMarkPaidModal(true)}
                >
                  Mark paid
                </Button>
              </Tooltip>
            )}

            {canDuplicate && (
              <Tooltip label="Create a fresh draft with the same sprints" {...TOOLTIP_PROPS}>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<TbCopy size={14} />}
                  onClick={handleDuplicate}
                  isLoading={duplicating}
                  loadingText="Duplicating"
                >
                  Duplicate
                </Button>
              </Tooltip>
            )}
          </HStack>
        </HStack>

        {!isNew && (
          <SendHistoryStrip
            invoiceId={invoiceId}
            refreshKey={historyRefreshKey}
            onViewSnapshot={() => setShowSnapshot(true)}
          />
        )}
      </VStack>

      <Tabs
        items={[{ key: 'compose', label: 'Compose' }, { key: 'preview', label: 'Preview' }]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'compose' && (
        <VStack spacing={8} align="stretch">
          <HStack spacing={6} align="start" flexWrap="wrap" rowGap={6}>
            <Box flex={1} minW="220px">
              <Field label="Client">
                <DotSelect
                  value={clientId}
                  onChange={setClientId}
                  placeholder="Select a client"
                  isDisabled={isPaid}
                  options={clients.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ` · ${c.company}` : ''}` }))}
                />
              </Field>
            </Box>
            {projects.length > 0 && (
              <Box flex={1} minW="220px">
                <Field label="Project">
                  <DotSelect
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="No project"
                    isDisabled={isPaid}
                    options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
                  />
                </Field>
              </Box>
            )}
          </HStack>

          <Box>
            <HStack justify="space-between" align="center" mb={2}>
              <Kicker>Sprints</Kicker>
              {!isPaid && (
                <HStack
                  as="button"
                  type="button"
                  spacing={1.5}
                  onClick={addSprint}
                  color={P.limeDeep}
                  _hover={{ color: P.ink }}
                >
                  <Icon as={TbPlus} boxSize={3} />
                  <Kicker color="inherit">Add sprint</Kicker>
                </HStack>
              )}
            </HStack>

            {sprints.length === 0 ? (
              <Empty
                hint="A sprint is a line the client sees and can fund."
                action={<Button size="sm" leftIcon={<TbPlus size={12} />} onClick={addSprint}>Add first sprint</Button>}
              >
                No sprints yet.
              </Empty>
            ) : (
              <Box borderTop="1px solid" borderColor={P.hair}>
                {sprints.map((sprint) => (
                  <SprintEditRow
                    key={sprint.id}
                    sprint={sprint}
                    onUpdate={updateSprint}
                    onDelete={() => deleteSprint(sprint.id)}
                  />
                ))}
              </Box>
            )}

            {sprints.length > 0 && (
              <HStack justify="flex-end" pt={5} spacing={6}>
                <VStack align="end" spacing={0.5}>
                  <Kicker>Billable total</Kicker>
                  <Text fontFamily="mono" fontSize={TYPE.figure} color={P.ink} fontWeight="600" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(billableTotal)}
                  </Text>
                </VStack>
              </HStack>
            )}
          </Box>

          <Divider borderColor={P.hair} />

          {/* Backup documents. Sits between the sprints and the internal
              notes because it belongs to what the CLIENT sees, not to what
              the team writes to itself. A supplier invoice attached here is
              what turns a line billed at cost into a line they can check.
              See InvoiceAttachments.jsx for why these are emailed rather
              than linked. */}
          <InvoiceAttachments invoiceId={invoiceId} readOnly={isPaid} />

          <Divider borderColor={P.hair} />

          <HStack spacing={6} align="start" flexWrap="wrap" rowGap={6}>
            <Box flex={2} minW="240px">
              <Field label="Internal notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes only your team sees"
                  rows={3}
                  isReadOnly={isPaid}
                />
              </Field>
            </Box>
            <Box flex={1} minW="180px">
              <Field label="Due date">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  isDisabled={isPaid}
                />
              </Field>
            </Box>
          </HStack>

          {!isNew && (
            <Box pt={4}>
              {isDraft && (
                <HStack
                  as="button"
                  type="button"
                  spacing={1.5}
                  onClick={handleHardDelete}
                  color={confirmDelete ? P.coral : P.inkFaint}
                  _hover={{ color: P.coral }}
                  transition={`all ${FAST} ${EASE}`}
                  userSelect="none"
                >
                  <Icon as={confirmDelete ? TbAlertTriangle : TbTrash} boxSize={3} />
                  <Kicker color="inherit">
                    {deleting ? 'Deleting' : confirmDelete ? 'Click again to confirm' : 'Delete draft'}
                  </Kicker>
                </HStack>
              )}

              {isSentish && (
                <HStack
                  as="button"
                  type="button"
                  spacing={1.5}
                  onClick={() => setShowCancelModal(true)}
                  color={P.inkFaint}
                  _hover={{ color: P.coral }}
                  transition={`all ${FAST} ${EASE}`}
                  userSelect="none"
                >
                  <Icon as={TbAlertTriangle} boxSize={3} />
                  <Kicker color="inherit">Cancel invoice</Kicker>
                </HStack>
              )}

              {isPaid && (
                <Kicker color={P.inkFaint}>Paid invoices cannot be deleted</Kicker>
              )}
            </Box>
          )}
        </VStack>
      )}

      {activeTab === 'preview' && (
        <InvoicePreview
          invoice={previewInvoice}
          client={client}
          sprints={sprints.filter((s) => s.is_billable !== false)}
        />
      )}

      <CancelInvoiceModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        invoice={invoice}
        onConfirm={handleSoftCancel}
        processing={cancelling}
      />

      <ResendModal
        isOpen={showResendModal}
        onClose={() => setShowResendModal(false)}
        invoice={invoice}
        client={client}
        onSend={handleResend}
        sending={resending}
      />

      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        invoice={invoice}
        client={client}
        onSend={handleSendReminder}
        sending={sendingReminder}
      />

      <MarkPaidModal
        isOpen={showMarkPaidModal}
        onClose={() => setShowMarkPaidModal(false)}
        invoice={invoice}
        onConfirm={handleMarkPaid}
        processing={markingPaid}
      />

      <InvoiceSnapshotModal
        isOpen={showSnapshot}
        onClose={() => setShowSnapshot(false)}
        invoiceId={invoiceId}
      />

      <ReviewSendModal
        isOpen={showSendGate}
        onClose={() => setShowSendGate(false)}
        invoice={previewInvoice}
        client={client}
        project={projects.find((p) => p.id === projectId) || null}
        sprints={sprints}
        dueDate={dueDate}
        sending={sending}
        onConfirm={({ ccEmails } = {}) => handleSend(reviewInvoiceId, ccEmails)}
      />
    </Page>
  );
};

export default InvoiceEditor;
