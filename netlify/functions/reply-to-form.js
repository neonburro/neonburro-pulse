// netlify/functions/reply-to-form.js
// SENTINEL: NB_PULSE_REPLY_TO_FORM_V2
//
// Sends one reviewed reply to the address stored on a form submission. The
// caller must present a valid Supabase access token and hold a staff role that
// may write. Identity, recipient and follow-up state come from trusted records,
// never from fields supplied by the browser.
//
// The service key stays inside this function. It is used only after Auth has
// verified the caller through getUser. The browser sees the delivery result and
// never receives privileged credentials.
//
// No oxford commas, no em dashes.

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { buildReplyEmailHTML } from '../../src/lib/replyEmailTemplate.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL = 'NeonBurro <hello@neonburro.com>';
const WRITER_ROLES = ['super_admin', 'admin', 'manager'];

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const senderEmail = (submission) => (
  submission?.email
  || submission?.metadata?.email
  || submission?.metadata?.contact_email
  || ''
).trim();

const senderName = (submission) => (
  submission?.name
  || submission?.metadata?.name
  || submission?.metadata?.full_name
  || submission?.metadata?.contact_name
  || ''
).trim();

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!supabase || !resend) return json(503, { error: 'The reply service is not configured.' });

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Sign in to send a reply.' });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return json(401, { error: 'Sign in to send a reply.' });

  const actorId = userData.user.id;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, username, role')
    .eq('id', actorId)
    .maybeSingle();

  if (profileError) return json(500, { error: 'Could not verify your permissions.' });
  if (!WRITER_ROLES.includes(profile?.role)) return json(403, { error: 'Sending a reply needs a staff writer role.' });

  let request;
  try {
    request = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  const submissionId = String(request.submissionId || '').trim();
  const subject = String(request.subject || '').trim();
  const body = String(request.body || '').trim();
  if (!submissionId || !body) return json(400, { error: 'A submission and message are required.' });

  try {
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('id', submissionId)
      .maybeSingle();

    if (submissionError) return json(500, { error: 'The submission could not be read.' });
    if (!submission) return json(404, { error: 'That submission does not exist.' });

    const recipientEmail = senderEmail(submission);
    const recipientName = senderName(submission);
    const isFollowUp = Number(submission.reply_count || 0) > 0;
    if (!recipientEmail) return json(400, { error: 'That submission has no reply address.' });

    const adminName = profile.display_name || profile.username || 'The Neon Burro team';
    const delivery = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      reply_to: 'hello@neonburro.com',
      subject: subject || 'Re: Your message to Neon Burro',
      html: buildReplyEmailHTML({ recipientName, body, adminName, isFollowUp }),
    });

    if (delivery.error) {
      console.error('Resend error:', delivery.error);
      return json(502, { error: 'Email send failed.' });
    }

    const emailId = delivery.data?.id || null;
    const now = new Date().toISOString();
    const nextCount = Number(submission.reply_count || 0) + 1;

    const { error: replyError } = await supabase.from('form_replies').insert({
      submission_id: submissionId,
      sender_id: actorId,
      sender_name: adminName,
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject: subject || null,
      body,
      email_message_id: emailId,
    });
    if (replyError) console.error('form_replies insert failed:', replyError);

    await supabase.from('form_submissions').update({
      status: 'responded',
      responded_at: submission.responded_at || now,
      responded_by: submission.responded_by || actorId,
      last_replied_at: now,
      reply_count: nextCount,
    }).eq('id', submissionId);

    await supabase.from('activity_log').insert({
      user_id: actorId,
      action: 'message_sent',
      category: 'form',
      metadata: {
        form_submission_id: submissionId,
        recipient_email: recipientEmail,
        recipient_name: recipientName || null,
        subject: subject || null,
        reply_number: nextCount,
        is_follow_up: isFollowUp,
      },
    });

    return json(200, { success: true, emailId, replyNumber: nextCount });
  } catch (error) {
    console.error('reply-to-form error:', error);
    return json(500, { error: 'The reply could not be sent.' });
  }
};
