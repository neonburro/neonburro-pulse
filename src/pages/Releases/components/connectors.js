// src/pages/Releases/components/connectors.js
// SENTINEL: NB_PULSE_SOCIALS_CONNECTORS_V1
//
// The page's line to the Pulse functions behind the Socials desk. Three
// doors, all session gated on the other side, so every call carries the
// bearer the same way Blog/PostEditor.jsx does.
//
//   probeConnector   GET publish-facebook or publish-instagram, answers
//                    whether the channel is connected by env name, never a
//                    value. This is how the page says dark or ready
//                    honestly instead of guessing.
//   postNow          POST the same door with a release id, carries one
//                    staged and approved row on a person's click.
//   draftRelease     POST draft-release, Volt writes a draft on the row.
//
// On the vite dev server there are no functions, so a probe answers
// unknown and the page says so rather than dark. useConnectors probes both
// Meta channels once per mount.
//
// No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { META_CHANNELS } from './shared';

const bearer = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return `Bearer ${session?.access_token || ''}`;
};

const call = async (path, options = {}) => {
  try {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: await bearer(), ...(options.headers || {}) },
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) return { ok: false, status: res.status, error: data?.error || `the door answered ${res.status}`, data };
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, error: 'the door did not answer', data: null };
  }
};

export const probeConnector = async (channel) => {
  const result = await call(`/.netlify/functions/publish-${channel}`);
  if (!result.ok) return { channel, ready: false, missing: [], unknown: true, error: result.error };
  return { ...result.data, unknown: false };
};

export const postNow = (channel, releaseId) => call(`/.netlify/functions/publish-${channel}`, {
  method: 'POST',
  body: JSON.stringify({ release_id: releaseId }),
});

export const draftRelease = (payload) => call('/.netlify/functions/draft-release', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const connectorLine = (probe) => {
  if (!probe) return 'checking the connector';
  if (probe.unknown) return `connector unknown, ${probe.error}`;
  if (probe.ready) return 'connector ready';
  return `dark, ${probe.missing.join(' and ')} not set on the Pulse site`;
};

export const useConnectors = () => {
  const [probes, setProbes] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(META_CHANNELS.map(probeConnector)).then((list) => {
      if (cancelled) return;
      setProbes(Object.fromEntries(list.map((probe) => [probe.channel, probe])));
    });
    return () => { cancelled = true; };
  }, []);

  return probes;
};
