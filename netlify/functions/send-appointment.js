// netlify/functions/send-appointment.js
// SENTINEL: NB_PULSE_APPOINTMENT_SEND_V2
//
// The notification half of the calendar. The app writes the appointment row
// itself (client-side, RLS), then calls this with the row id and three switches.
// The one caller is src/pages/Calendar/components/AppointmentModal.jsx.
//
// POST { appointmentId, mode, sendClient, notifyTeam, postPortal }. Staff only.
//
// This function owns everything that leaves the building:
//   1. builds a real .ics calendar file and a one-click Google Calendar link
//   2. emails the client the warm-paper invite with the .ics attached  (sendClient)
//   3. emails the team inbox a terse heads-up                          (notifyTeam)
//   4. drops a note into client_messages so it lands in their portal   (postPortal)
//   5. stamps client_notified_at (invite) or reminder_sent_at (reminder)
//   6. logs the whole thing to activity_log
//
// ── WHY THIS DOOR IS LOCKED, 2026-10-05 ─────────────────────────────────────
// Until this date it had no authentication and it took senderId, senderName,
// bookedBy and personaId from the body. Anybody holding an appointment id
// could mail a client and the team inbox from hello@neonburro.com and post a
// note into the client's portal thread signed with any name and any user id
// they chose. gate() in _social.js is the lock now, super_admin, admin or
// manager, the same one client-report-send.js uses.
//
// ── WHO SIGNED IT IS DECIDED HERE, NOT IN THE BODY ──────────────────────────
// The four identity fields are worked out on this side and anything the body
// says about them is ignored.
//   senderId    the signed in caller, from the session token
//   bookedBy    that caller's profiles.display_name, for the team mail
//   personaId   personaForClient(appt.client_id) from src/lib/personas.js
//   senderName  that persona's name, or neonburro when there is no client
// The modal computed the persona the same way from the same client id, so the
// face on the invite and the face in the thread are unchanged. personas.js is
// pure and dependency free, which is why a function can import it the way
// this file already imports appointmentEmail.js.
//
// ESM on purpose so it can import the shared appointmentEmail template, the same
// way reply-to-form.js imports the reply template. All dates are formatted HERE
// in the appointment's stored zone and handed to the template as finished
// strings, so the invoice off-by-one can never come back.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (all already set
// on the Pulse site, send-client-invite uses them), NOTIFICATION_EMAIL optional
// (falls back to hello@neonburro.com). No new secrets.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';
import { buildAppointmentEmailHTML } from '../../src/lib/appointmentEmail.js';
import { personaForClient } from '../../src/lib/personas.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TEAM_EMAIL = process.env.NOTIFICATION_EMAIL || 'hello@neonburro.com';

const FROM_EMAIL = 'NeonBurro <hello@neonburro.com>';
const REPLY_TO = 'hello@neonburro.com';
const PULSE_CAL_URL = 'https://pulse.neonburro.com/calendar/';

const TYPE_VERB = { call: 'Phone call', video: 'Video call', in_person: 'In-person meeting' };
const MODES = ['invite', 'reminder'];

// ── formatting, all in the appointment's zone ───────────────────────────────
const fmtDay = (iso, tz) =>
  new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz,
  });

const fmtTime = (iso, tz) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: tz,
  });

const fmtZone = (iso, tz) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === 'timeZoneName')?.value || '';
};

const buildTimeLine = (startIso, endIso, tz) =>
  `${fmtTime(startIso, tz)} to ${fmtTime(endIso, tz)} ${fmtZone(startIso, tz)}`.trim();

// ── .ics + Google Calendar link ─────────────────────────────────────────────
const toUTCStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const escICS = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const buildICS = ({ id, title, description, location, startIso, endIso, organizerEmail, attendeeEmail, attendeeName, cancelled }) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neon Burro//Pulse Calendar//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${id}@neonburro.com`,
    `DTSTAMP:${toUTCStamp(new Date().toISOString())}`,
    `DTSTART:${toUTCStamp(startIso)}`,
    `DTEND:${toUTCStamp(endIso)}`,
    `SUMMARY:${escICS(title)}`,
    description ? `DESCRIPTION:${escICS(description)}` : null,
    location ? `LOCATION:${escICS(location)}` : null,
    `ORGANIZER;CN=Neon Burro:mailto:${organizerEmail}`,
    attendeeEmail ? `ATTENDEE;CN=${escICS(attendeeName)};RSVP=TRUE:mailto:${attendeeEmail}` : null,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
};

const buildGCalLink = ({ title, description, location, startIso, endIso }) => {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Meeting',
    dates: `${toUTCStamp(startIso)}/${toUTCStamp(endIso)}`,
    details: description || '',
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

const sendEmail = async ({ to, subject, html, attachments }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, reply_to: REPLY_TO, subject, html, attachments }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${await res.text()}`);
  return res.json();
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabase = createDb();
  const gated = await gate(supabase, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  try {
    const {
      appointmentId,
      mode: askedMode = 'invite',
      sendClient = true,
      notifyTeam = true,
      postPortal = true,
    } = JSON.parse(event.body || '{}');
    const mode = MODES.includes(askedMode) ? askedMode : 'invite';

    if (!appointmentId) return json(400, { error: 'appointmentId required' });

    const { data: appt, error: apptErr } = await supabase
      .from('appointments').select('*').eq('id', appointmentId).single();
    if (apptErr || !appt) return json(404, { error: 'Appointment not found' });

    let client = null;
    if (appt.client_id) {
      const { data } = await supabase.from('clients').select('*').eq('id', appt.client_id).single();
      client = data || null;
    }

    // Who signed it, from the session and the row, never from the body.
    const senderId = gated.user.id;
    const persona = appt.client_id ? personaForClient(appt.client_id) : null;
    const senderName = persona ? persona.name : 'Neon Burro';
    const personaId = persona ? persona.id : null;
    let bookedBy = 'the team';
    const { data: caller } = await supabase
      .from('profiles').select('display_name').eq('id', senderId).maybeSingle();
    if (caller?.display_name) bookedBy = caller.display_name;

    const tz = appt.timezone || 'America/Denver';
    const typeVerb = TYPE_VERB[appt.meeting_type] || 'Meeting';
    const dayLine = fmtDay(appt.starts_at, tz);
    const timeLine = buildTimeLine(appt.starts_at, appt.ends_at, tz);
    const locationForCal = appt.meeting_type === 'video' ? (appt.meeting_url || '') : (appt.location || '');

    const ics = buildICS({
      id: appt.id,
      title: appt.title,
      description: appt.description,
      location: locationForCal,
      startIso: appt.starts_at,
      endIso: appt.ends_at,
      organizerEmail: 'hello@neonburro.com',
      attendeeEmail: client?.email || null,
      attendeeName: client?.name || 'Guest',
    });
    const icsAttachment = {
      filename: 'neonburro-meeting.ics',
      content: Buffer.from(ics, 'utf8').toString('base64'),
      content_type: 'text/calendar; charset=utf-8; method=REQUEST',
    };
    const calendarLink = buildGCalLink({
      title: appt.title,
      description: appt.description,
      location: locationForCal,
      startIso: appt.starts_at,
      endIso: appt.ends_at,
    });

    const results = { client: false, team: false, portal: false };

    // 1. Client invite
    if (sendClient && client?.email) {
      const html = buildAppointmentEmailHTML({
        audience: 'client', mode,
        clientName: client.name, firstName: (client.name || '').split(' ')[0],
        adminName: senderName, title: appt.title, typeId: appt.meeting_type, typeVerb,
        dayLine, timeLine,
        description: appt.description, videoUrl: appt.meeting_url, location: appt.location, phone: client.phone,
        calendarLink,
      });
      await sendEmail({
        to: client.email.toLowerCase(),
        subject: `${mode === 'reminder' ? 'Reminder' : 'Meeting'}: ${appt.title} on ${fmtDay(appt.starts_at, tz)}`,
        html,
        attachments: [icsAttachment],
      });
      results.client = true;
    }

    // 2. Team heads-up
    if (notifyTeam) {
      const html = buildAppointmentEmailHTML({
        audience: 'admin', mode,
        clientName: client?.name, adminName: bookedBy,
        title: appt.title, typeId: appt.meeting_type, typeVerb,
        dayLine, timeLine,
        description: appt.description, videoUrl: appt.meeting_url, location: appt.location, phone: client?.phone,
        pulseUrl: PULSE_CAL_URL,
      });
      await sendEmail({
        to: TEAM_EMAIL,
        subject: `${mode === 'reminder' ? 'Reminder sent' : 'New appointment'}: ${appt.title}${client?.name ? ` with ${client.name}` : ''}`,
        html,
        attachments: [icsAttachment],
      });
      results.team = true;
    }

    // 3. Portal note into the client's message thread
    if (postPortal && appt.client_id) {
      const detail = appt.meeting_type === 'video'
        ? 'The video room link is in your email invite.'
        : appt.meeting_type === 'in_person' && appt.location
          ? `Where: ${appt.location}.`
          : 'We will call you at the time above.';
      const message = `I put a ${typeVerb.toLowerCase()} on the calendar: "${appt.title}" on ${dayLine} at ${fmtTime(appt.starts_at, tz)} ${fmtZone(appt.starts_at, tz)}. ${detail} Reply here if that time does not work and we will move it.`;
      const { error: msgErr } = await supabase.from('client_messages').insert({
        client_id: appt.client_id,
        sender_id: senderId,
        sender_type: 'team',
        sender_name: senderName,
        persona_id: personaId,
        message,
        read_by_team: true,
        read_by_client: false,
      });
      if (!msgErr) results.portal = true;
    }

    // 4. Stamp the row
    const stampField = mode === 'reminder' ? 'reminder_sent_at' : 'client_notified_at';
    await supabase.from('appointments')
      .update({ [stampField]: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', appt.id);

    // 5. Activity trail
    await supabase.from('activity_log').insert({
      action: mode === 'reminder' ? 'appointment_reminder_sent' : 'appointment_scheduled',
      entity_type: 'appointment',
      entity_id: appt.id,
      client_id: appt.client_id,
      user_id: senderId,
      category: 'transactional',
      metadata: { title: appt.title, type: appt.meeting_type, starts_at: appt.starts_at, results },
      created_at: new Date().toISOString(),
    });

    return json(200, { success: true, results });
  } catch (err) {
    console.error('send-appointment error:', err);
    return json(500, { error: err.message || 'Failed to send appointment' });
  }
};
