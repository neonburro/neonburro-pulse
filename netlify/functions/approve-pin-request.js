// netlify/functions/approve-pin-request.js
// Called when the admin clicks the approval link from the notice mail.
// Validates the token, sends the PIN to the client, marks the request approved.
// The PIN mail wears the letterhead from _letterhead.js, the same paper as the
// invoice, the portal invite and the Supabase auth mails. 2026-09-17.
//
//   GET  ?token=xxx                       -> request details for the Pulse page
//   POST ?token=xxx { action: approve|deny } -> executes the action
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { letterhead, button, code, escapeHtml } from './_letterhead.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const resend = new Resend(RESEND_API_KEY);

const LOOKUP_URL = 'https://neonburro.com/account/lookup/';

const buildClientPinEmail = ({ clientName, clientEmail, pin }) => {
  const first = escapeHtml(String(clientName || '').trim().split(/\s+/)[0] || 'there');
  return letterhead({
    preheader: 'The PIN that opens your invoice history on neonburro.com.',
    kicker: 'pulse · your pin',
    title: `Your PIN, ${first}.`,
    body: 'Here is the PIN that opens your invoice history on neonburro.com. It works with the email this was sent to.',
    action: code(escapeHtml(pin)) + button(LOOKUP_URL, 'Look up my invoices'),
    closing: 'Keep it private. Your email and this PIN together open every invoice we have sent you, so share it only with someone you would hand an invoice to.',
    to: clientEmail,
  });
};

export const handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token;
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token required' }) };
    }

    if (event.httpMethod === 'GET') {
      const { data: request } = await supabase
        .from('pin_requests')
        .select('*, clients(id, name, email, company, portal_pin, lookup_pin)')
        .eq('approval_token', token)
        .maybeSingle();

      if (!request) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Request not found or already processed' }) };
      }
      if (request.status !== 'pending') {
        return { statusCode: 410, body: JSON.stringify({ error: `This request has already been ${request.status}`, status: request.status }) };
      }
      if (new Date(request.token_expires_at) < new Date()) {
        await supabase.from('pin_requests').update({ status: 'expired' }).eq('id', request.id);
        return { statusCode: 410, body: JSON.stringify({ error: 'This request has expired' }) };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          request: {
            id: request.id,
            email: request.email,
            created_at: request.created_at,
            request_ip: request.request_ip,
            client: request.clients ? {
              id: request.clients.id,
              name: request.clients.name,
              email: request.clients.email,
              company: request.clients.company,
            } : null,
          },
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      const { action } = JSON.parse(event.body || '{}');
      if (!['approve', 'deny'].includes(action)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
      }

      const { data: request } = await supabase
        .from('pin_requests')
        .select('*, clients(id, name, email, portal_pin, lookup_pin)')
        .eq('approval_token', token)
        .maybeSingle();

      if (!request || request.status !== 'pending') {
        return { statusCode: 404, body: JSON.stringify({ error: 'Request not found or already processed' }) };
      }
      if (new Date(request.token_expires_at) < new Date()) {
        return { statusCode: 410, body: JSON.stringify({ error: 'This request has expired' }) };
      }

      if (action === 'deny') {
        await supabase.from('pin_requests')
          .update({ status: 'denied', approval_token: null, denial_reason: 'Denied by admin' })
          .eq('id', request.id);
        return { statusCode: 200, body: JSON.stringify({ success: true, action: 'denied' }) };
      }

      if (!request.clients) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No client record linked to this request' }) };
      }

      const pin = request.clients.portal_pin || request.clients.lookup_pin;
      if (!pin) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Client has no PIN set. Please generate one first.' }) };
      }

      const html = buildClientPinEmail({
        clientName: request.clients.name,
        clientEmail: request.clients.email,
        pin,
      });

      await resend.emails.send({
        from: 'neonburro <hello@neonburro.com>',
        to: request.clients.email,
        subject: 'Your PIN • neonburro',
        html,
      });

      await supabase.from('pin_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approval_token: null })
        .eq('id', request.id);

      return { statusCode: 200, body: JSON.stringify({ success: true, action: 'approved' }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('approve-pin-request error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Something went wrong' }) };
  }
};
