// netlify/functions/publish-facebook.js
// SENTINEL: NB_PULSE_PUBLISH_FACEBOOK_V1
//
// The Facebook adapter and its door. The adapter posts one approved release
// to the studio Page through the Graph API, a photo with a caption when the
// row carries a picture, POST /{page-id}/photos with url and message and the
// alt line as alt_text_custom, or a plain feed post with the link when it
// does not, POST /{page-id}/feed. It returns the post id Facebook answers
// with and release-meta.js writes it to external_id.
//
// The door is the same file. GET answers whether the Page is connected, by
// env name and never by value, so the Socials page can say dark or ready
// honestly. POST with a release_id carries one staged and approved row now
// on a person's click, the same gate the five minute runner uses. Both need
// a signed in staff session.
//
// Needs META_PAGE_ACCESS_TOKEN and META_PAGE_ID on the Pulse site, functions
// scope, plus SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY which are already
// there. A long lived Page token is the one to set, a User token expires in
// an hour and the row fails with meta 190.
//
// No oxford commas, no em dashes.

import { assetUrl, releaseCopy, graph, metaDoor } from './_social.js';

export const facebook = async ({ release, env }) => {
  const copy = releaseCopy(release);
  const picture = assetUrl(release);
  if (!copy && !picture) throw new Error('nothing to post, no body and no picture');

  if (picture) {
    const params = { url: picture, message: copy, published: 'true' };
    if (release.asset_alt) params.alt_text_custom = String(release.asset_alt).slice(0, 1000);
    const out = await graph(`${env.pageId}/photos`, params, env.token);
    return String(out.post_id || out.id || '');
  }

  const params = { message: copy };
  if (release.link) params.link = String(release.link).trim();
  const out = await graph(`${env.pageId}/feed`, params, env.token);
  return String(out.id || '');
};

export const handler = metaDoor('facebook', facebook);
