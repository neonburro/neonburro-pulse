// src/lib/mailItems.js
// SENTINEL: NB_PULSE_MAIL_ITEMS_V1
//
// The one read of a client's open items that feeds the renderer. The editor
// preview calls it on a staff session and netlify/functions/mail-send.js
// calls it on the service role, with the same select, the same filter and
// the same order, because the bytes of an open items block are only the same
// on both sides if the rows are. renderMail sorts again by opened_at and
// token through cleanItems in src/lib/mailRender.js, so even a reordered
// answer from the database makes the same letter.
//
// Before supabase/migrations/20261005130000_mail_updates_and_open_items.sql
// is applied the table is not there. Both callers then get an empty list and
// missing true, the open items block prints "Nothing is waiting on you", and
// the editor says why in words rather than pretending the client has
// answered everything.
//
// No oxford commas, no em dashes.

export const ITEM_FIELDS = 'id, client_id, title, detail, kind, choices, status, opened_at, answered_at, answered_by, answered_via, answer_choice, answer_note, answer_device, seen_at, token, first_document_id, first_send_id, source_note, source_url, created_at';

export const loadOpenItems = async (db, clientId) => {
  if (!db || !clientId) return { items: [], missing: false };
  const { data, error } = await db
    .from('client_items')
    .select(ITEM_FIELDS)
    .eq('client_id', clientId)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) return { items: [], missing: /client_items|schema cache|does not exist/i.test(error.message || ''), error: error.message };
  return { items: data || [], missing: false };
};

export const loadAllItems = async (db, clientId) => {
  if (!db || !clientId) return { items: [], missing: false };
  const { data, error } = await db
    .from('client_items')
    .select(ITEM_FIELDS)
    .eq('client_id', clientId)
    .order('opened_at', { ascending: true });
  if (error) return { items: [], missing: /client_items|schema cache|does not exist/i.test(error.message || ''), error: error.message };
  return { items: data || [], missing: false };
};
