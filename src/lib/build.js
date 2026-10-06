// src/lib/build.js
// The build stamp. vite.config.js defines __PULSE_BUILD__ at build time from
// the variables Netlify sets on every build, COMMIT_REF and CONTEXT, so the
// running page knows which commit it was built from without asking anybody.
// Settings reads it twice, in the Netlify row on Tools and in the version
// line under the list. Under yarn dev both are empty and every reader says
// nothing rather than guess. No oxford commas, no em dashes.

/* global __PULSE_BUILD__ */
const stamp = typeof __PULSE_BUILD__ !== 'undefined' ? __PULSE_BUILD__ : null;

export const BUILD = {
  commit: stamp?.commit || '',
  short: (stamp?.commit || '').slice(0, 7),
  context: stamp?.context || '',
};

export const commitUrl = (sha) => `https://github.com/neonburro/neonburro-pulse/commit/${sha}`;

export default BUILD;
