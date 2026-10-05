// src/pages/Mail/client/mailData.js
// The browser's reads and writes for the Mail parts that sit on a client's
// page and in the admin queue. One file so the three sections, the room and
// the client page ask the database the same questions the same way, on the
// signed in staff session, under the is_staff() policies in
// supabase/migrations/20261005113806_mail_composer.sql and
// 20261005130000_mail_updates_and_open_items.sql.
//
// Every read here says when a table or a column is missing instead of
// returning an empty list that looks like a quiet week. Until the second
// migration is applied there are no open items, no kind and no cadence, and
// the sections say so in words.
//
// Nothing here sends anything. Approve moves a proposed update to approved
// and records who and when, the send is still a person in the editor with a
// test first. Recording an answer by hand, withdrawing an item and marking
// one seen are row writes and nothing else, never a mail to the client.
//
// No oxford commas, no em dashes.

import { supabase } from '../../../lib/supabase';
import { loadAllItems } from '../../../lib/mailItems';
import {
  templateFor, presetForClient, normalizeMail, todayInRidgway, KINDS,
} from '../../../lib/mailDocument';

export const MIGRATION_TWO = 'supabase/migrations/20261005130000_mail_updates_and_open_items.sql';

const missing = (error) => !!error && /column|schema cache|does not exist|client_items|report_cadence|kind|origin/i.test(error.message || '');

export const loadClient = async (clientId) => {
  const full = await supabase.from('clients').select('id, name, company, email, report_cadence').eq('id', clientId).maybeSingle();
  if (!full.error) return { client: full.data, cadenceMissing: false };
  const base = await supabase.from('clients').select('id, name, company, email').eq('id', clientId).maybeSingle();
  return { client: base.data, cadenceMissing: true };
};

export const loadClientMail = async (clientId) => {
  const { data, error } = await supabase
    .from('mail_documents')
    .select('*')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false });
  return { rows: data || [], error: error?.message || null };
};

export const loadItems = async (clientId) => loadAllItems(supabase, clientId);

export const createForClient = async ({ client, kind = 'letter', userId }) => {
  const preset = presetForClient(client);
  const doc = templateFor(kind, { presetKey: preset?.key, asOf: todayInRidgway(), companyName: client?.company || client?.name });
  if (client?.email) doc.to = [String(client.email).toLowerCase()];
  const row = { doc: normalizeMail(doc), client_id: client.id, status: 'draft', created_by: userId || null, updated_by: userId || null };
  if (kind !== 'letter') { row.kind = kind; row.origin = 'hand'; }
  const { data, error } = await supabase.from('mail_documents').insert(row).select('id').maybeSingle();
  if (error && kind !== 'letter' && missing(error)) {
    return { id: null, error: `Updates need ${MIGRATION_TWO} applied first. A plain letter works today.` };
  }
  return { id: data?.id || null, error: error?.message || null };
};

export const approveDoc = async (id, userId) => {
  const { error } = await supabase
    .from('mail_documents')
    .update({ status: 'approved', approved_by: userId || null, approved_at: new Date().toISOString(), updated_by: userId || null })
    .eq('id', id)
    .eq('status', 'proposed');
  return error?.message || null;
};

export const dismissDoc = async (id, userId) => {
  const { error } = await supabase
    .from('mail_documents')
    .update({ status: 'dismissed', dismissed_by: userId || null, dismissed_at: new Date().toISOString(), updated_by: userId || null })
    .eq('id', id)
    .in('status', ['proposed', 'approved', 'draft']);
  return error?.message || null;
};

export const setCadence = async (clientId, cadence) => {
  const { error } = await supabase.from('clients').update({ report_cadence: cadence }).eq('id', clientId);
  return error?.message || null;
};

export const addItem = async ({ clientId, title, detail, kind, openedAt, choices, userId }) => {
  const row = {
    client_id: clientId,
    title: String(title || '').trim(),
    detail: String(detail || '').trim() || null,
    kind,
    created_by: userId || null,
  };
  if (openedAt) row.opened_at = `${openedAt}T12:00:00Z`;
  const list = String(choices || '').split(',').map((c) => c.trim()).filter(Boolean);
  if (list.length >= 2) row.choices = list.slice(0, 4);
  const { error } = await supabase.from('client_items').insert(row);
  return error?.message || null;
};

export const withdrawItem = async (id, userEmail) => {
  const { error } = await supabase
    .from('client_items')
    .update({ status: 'withdrawn', answered_at: new Date().toISOString(), answered_via: 'pulse', answered_by: userEmail || null, seen_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');
  return error?.message || null;
};

// A person records an answer that came by phone or in a reply. Marked seen
// at once, because the person recording it has seen it.
export const answerInPulse = async (item, { status, choice = null, note = '', userEmail }) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('client_items')
    .update({ status, answer_choice: choice, answer_note: note || null, answered_at: now, answered_via: 'pulse', answered_by: userEmail || null, seen_at: now })
    .eq('id', item.id)
    .eq('status', 'open');
  return error?.message || null;
};

export const markSeen = async (ids) => {
  if (!ids.length) return null;
  const { error } = await supabase.from('client_items').update({ seen_at: new Date().toISOString() }).in('id', ids).is('seen_at', null);
  return error?.message || null;
};

// The admin queue, everything waiting on Tyler across every client.
// Proposed updates, and answers that came back through a link and nobody
// has looked at yet.
export const loadQueue = async () => {
  const [docs, answers] = await Promise.all([
    supabase.from('mail_documents').select('id, client_id, status, doc, created_at, updated_at, clients(id, name, company)').eq('status', 'proposed').order('created_at', { ascending: true }),
    supabase.from('client_items').select('id, client_id, title, status, answer_choice, answered_at, answered_by, answer_device, answer_note, clients(id, name, company)').not('answered_at', 'is', null).is('seen_at', null).neq('status', 'withdrawn').order('answered_at', { ascending: true }),
  ]);
  return {
    proposed: docs.data || [],
    answers: answers.data || [],
    missing: missing(answers.error),
  };
};

export const kindOf = (row) => (KINDS[row?.kind] ? row.kind : 'letter');
