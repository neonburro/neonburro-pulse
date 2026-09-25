// netlify/functions/publish-instagram.js
// SENTINEL: NB_PULSE_PUBLISH_INSTAGRAM_V1
//
// The Instagram adapter and its door. Instagram publishes in two steps, a
// container then a publish. POST /{ig-user-id}/media with image_url and
// caption answers a creation id, the container is polled a few times for
// FINISHED, then POST /{ig-user-id}/media_publish with creation_id answers
// the media id which release-meta.js writes to external_id.
//
// Instagram takes jpeg by url and nothing else, so a webp scene fails here
// with a plain reason before Meta is asked. The share cards on the studio
// are jpg and post fine. A release with no picture is refused, there is no
// text only post on Instagram. The caption rail is 2200 characters, the
// house rail is three hashtags at the end and the drafter holds to that,
// this hand does not police style.
//
// The container poll is short, three reads a little over a second apart,
// because a function has ten seconds. A container still in progress after
// that is published anyway and Meta says so if it is not ready, the row
// fails with the reason and one tap puts it back on the ramp.
//
// GET answers readiness by env name. POST with a release_id carries one
// staged and approved row now. Needs META_PAGE_ACCESS_TOKEN and
// META_IG_USER_ID on the Pulse site, functions scope. The Instagram account
// must be a business or creator account connected to the Page the token
// belongs to.
//
// No oxford commas, no em dashes.

import { assetUrl, releaseCopy, formatOf, graph, sleep, metaDoor } from './_social.js';

const POLLS = 3;
const POLL_MS = 1200;

export const instagram = async ({ release, env }) => {
  const caption = releaseCopy(release);
  const picture = assetUrl(release);
  if (!picture) throw new Error('instagram needs a picture, there is no text only post');
  const format = formatOf(picture);
  if (format !== 'jpg') throw new Error(`instagram takes jpeg only, this plate is ${format || 'unreadable'}`);
  if (caption.length > 2200) throw new Error(`instagram caption is ${caption.length} characters, the rail is 2200`);

  const container = await graph(`${env.igUserId}/media`, { image_url: picture, caption }, env.token);
  const creationId = String(container.id || '');
  if (!creationId) throw new Error('instagram answered without a creation id');

  for (let poll = 0; poll < POLLS; poll += 1) {
    const status = await graph(creationId, { fields: 'status_code' }, env.token, 'GET');
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`instagram container ${status.status_code.toLowerCase()}`);
    }
    await sleep(POLL_MS);
  }

  const published = await graph(`${env.igUserId}/media_publish`, { creation_id: creationId }, env.token);
  return String(published.id || '');
};

export const handler = metaDoor('instagram', instagram);
