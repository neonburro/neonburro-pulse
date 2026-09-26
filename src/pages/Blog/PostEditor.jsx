// src/pages/Blog/PostEditor.jsx
// SENTINEL: NB_PULSE_BLOG_EDITOR_V2
//
// One post, the whole life of it. Draft the words, save as often as you
// like, publish when it is ready, and the socials panel underneath hands
// back a paste ready draft for x, telegram, reddit and pump.fun.
//
// ── HOW PUBLISH WORKS ───────────────────────────────────────────────────────
// Save writes the row through the Supabase client, staff RLS allows it.
// Publish saves first, then calls the publish-blog-post function, which
// flips the row, wakes the studio build through its build hook and asks the
// model for social drafts. The studio build takes a couple of minutes, the
// live link on this page is real as soon as that build lands. Unpublish is
// the same trip in reverse.
//
// ── THE BODY IS MDX WITH THE POWER SWITCHED OFF ─────────────────────────────
// Write plain markdown. The studio side escapes { } and < in database posts
// so a stray character can never break the site build, which also means raw
// JSX in a database post renders as text. Hand written files in the repo
// keep full MDX, that is the deliberate split.
//
// ── THE SLUG FOLLOWS THE TITLE UNTIL TOUCHED ────────────────────────────────
// Lowercase letters, numbers and hyphens only, the studio build skips any
// row that does not match, so the rule is enforced here at write time. Once
// published the slug is the url, changing it breaks the shared link, so the
// field locks after first publish.
//
// V2, 2026-09-25. A form, so it sits on MEASURE, the width the post reads
// at on the studio site. The fields are the house fields. No oxford commas,
// no em dashes.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, VStack, HStack, Text, Icon, Input, Textarea, Button, SimpleGrid,
} from '@chakra-ui/react';
import {
  TbArrowLeft, TbCopy, TbCheck, TbExternalLink, TbSparkles, TbTrash,
} from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST } from '../../theme/layout';
import { Page, Field, Section, Plate, Empty, Loading } from '../../components/common/Page';

const P = colors.paper;

const PLATFORM_LABELS = { x: 'x', telegram: 'telegram', reddit: 'reddit', pumpfun: 'pump.fun' };

const kebab = (s) => String(s || '')
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const csv = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');
const uncsv = (s) => String(s || '').split(',').map((t) => t.trim()).filter(Boolean);

const EMPTY = {
  title: '', slug: '', excerpt: '', body_mdx: '', burro: 'epoch',
  categories: ['news'], tags: [], meta_title: '', meta_description: '',
  cover_image: '', image_alt: '', featured: false, status: 'draft',
  published_at: null,
};

const PostEditor = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const isNew = !postId;

  const [post, setPost] = useState(EMPTY);
  const [socials, setSocials] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [slugTouched, setSlugTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState('');

  const set = (patch) => { setPost((p) => ({ ...p, ...patch })); setDirty(true); setNote(''); };

  const fetchSocials = useCallback(async (id) => {
    if (!id) return;
    const { data } = await supabase
      .from('blog_social_drafts')
      .select('id, platform, body, status, posted_at')
      .eq('post_id', id)
      .order('created_at', { ascending: false });
    // Newest draft per platform wins the panel, posted rows show underneath.
    setSocials(data || []);
  }, []);

  useEffect(() => {
    if (isNew) { setPost(EMPTY); setSocials([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('blog_posts').select('*').eq('id', postId).single();
      if (data) { setPost(data); setSlugTouched(true); }
      await fetchSocials(postId);
      setLoading(false);
      setDirty(false);
    })();
  }, [postId, isNew, fetchSocials]);

  const save = async () => {
    const slug = post.slug || kebab(post.title);
    if (!post.title.trim()) { setNote('A post needs a title before it can be saved.'); return null; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setNote('The slug can only carry lowercase letters, numbers and hyphens.'); return null; }
    setBusy('saving');
    const row = {
      title: post.title.trim(),
      slug,
      excerpt: post.excerpt || '',
      body_mdx: post.body_mdx || '',
      burro: (post.burro || 'epoch').toLowerCase().replace(/\.$/, ''),
      categories: post.categories && post.categories.length ? post.categories : ['news'],
      tags: post.tags || [],
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || '',
      cover_image: post.cover_image || '',
      image_alt: post.image_alt || '',
      featured: !!post.featured,
      updated_at: new Date().toISOString(),
    };
    let id = postId;
    if (isNew) {
      const { data, error } = await supabase.from('blog_posts').insert(row).select('id').single();
      if (error) { setBusy(''); setNote(error.message.includes('duplicate') ? 'That slug is already taken by another post.' : error.message); return null; }
      id = data.id;
      navigate(`/blog/${id}/`, { replace: true });
    } else {
      const { error } = await supabase.from('blog_posts').update(row).eq('id', postId);
      if (error) { setBusy(''); setNote(error.message.includes('duplicate') ? 'That slug is already taken by another post.' : error.message); return null; }
    }
    setPost((p) => ({ ...p, slug }));
    setBusy('');
    setDirty(false);
    setNote('Saved.');
    return id;
  };

  const callPublish = async (action) => {
    let id = postId;
    if (action !== 'unpublish') {
      id = await save();
      if (!id) return;
    }
    setBusy(action);
    setNote(action === 'publish' ? 'Publishing, waking the studio and drafting socials, give it a moment.' : action === 'redraft' ? 'Asking for fresh social drafts.' : 'Unpublishing.');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/publish-blog-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action, post_id: id }),
      });
      const data = await res.json();
      if (!res.ok) { setNote(data.error || 'That did not go through.'); setBusy(''); return; }
      setPost((p) => ({ ...p, status: data.status || p.status }));
      await fetchSocials(id);
      const extras = (data.notes || []).join(' ');
      setNote(
        action === 'unpublish'
          ? `Unpublished. ${extras}`.trim()
          : `${action === 'publish' ? 'Published.' : 'Redrafted.'} ${data.socialsDrafted ? `${data.socialsDrafted} social drafts below.` : ''} ${extras}`.trim()
      );
    } catch {
      setNote('The publish call failed, check the connection and try again.');
    }
    setBusy('');
  };

  const removeDraft = async () => {
    if (post.status === 'published') return;
    if (!window.confirm('Remove this draft for good?')) return;
    await supabase.from('blog_posts').delete().eq('id', postId);
    navigate('/blog/');
  };

  const copyDraft = async (s) => {
    try {
      await navigator.clipboard.writeText(s.body);
      setCopied(s.id);
      setTimeout(() => setCopied(''), 1600);
    } catch { setNote('The clipboard said no, select and copy by hand.'); }
  };

  const markPosted = async (s) => {
    await supabase.from('blog_social_drafts')
      .update({ status: 'posted', posted_at: new Date().toISOString() })
      .eq('id', s.id);
    fetchSocials(postId);
  };

  if (loading) {
    return (
      <Page measure><Loading label="loading the post" /></Page>
    );
  }

  const published = post.status === 'published';
  const liveUrl = `https://neonburro.com/blog/${post.slug || kebab(post.title)}/`;
  const drafts = socials.filter((s) => s.status === 'draft');
  const posted = socials.filter((s) => s.status === 'posted');

  return (
    <Page measure spacing={6}>
      <HStack justify="space-between" align="center" gap={3} flexWrap="wrap">
        <HStack spacing={3}>
          <HStack as="button" type="button" onClick={() => navigate('/blog/')} spacing={1} color={P.inkMuted} _hover={{ color: P.ink }} transition={`color ${FAST} ${EASE}`}>
            <Icon as={TbArrowLeft} boxSize={4} />
            <Text fontSize={TYPE.small} fontWeight="600">Blog</Text>
          </HStack>
          <HStack spacing={1.5}>
            <Box boxSize="7px" borderRadius="full" bg={published ? P.lime : P.inkFaint} />
            <Text fontFamily="mono" fontSize={TYPE.label} color={published ? P.limeDeep : P.inkMuted}>{post.status}</Text>
          </HStack>
          {published && (
            <HStack as="a" href={liveUrl} target="_blank" rel="noopener" spacing={1} color={P.inkMuted} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}>
              <Icon as={TbExternalLink} boxSize={3.5} />
              <Text fontFamily="mono" fontSize={TYPE.label}>live</Text>
            </HStack>
          )}
        </HStack>

        <HStack spacing={2}>
          {!isNew && !published && (
            <Button size="sm" variant="ghost" px={2} onClick={removeDraft} aria-label="Remove draft" _hover={{ color: P.coral, bg: P.sunken }}>
              <Icon as={TbTrash} boxSize={3.5} />
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={save} isDisabled={Boolean(busy)}>
            {busy === 'saving' ? 'Saving' : dirty ? 'Save' : 'Saved'}
          </Button>
          {published ? (
            <Button size="sm" variant="outline" onClick={() => callPublish('unpublish')} isDisabled={Boolean(busy)} _hover={{ borderColor: P.coral, color: P.coral }}>
              {busy === 'unpublish' ? 'Working' : 'Unpublish'}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => callPublish('publish')} isDisabled={Boolean(busy)}>
            {busy === 'publish' ? 'Publishing' : published ? 'Republish' : 'Publish'}
          </Button>
        </HStack>
      </HStack>

      {note && (
        <Text fontFamily="mono" fontSize={TYPE.small} color={P.limeDeep}>{note}</Text>
      )}

      <Field label="Title">
        <Input
          fontSize={TYPE.section}
          fontWeight="700"
          h="52px"
          value={post.title}
          placeholder="lowercase, the house way"
          onChange={(e) => {
            const title = e.target.value;
            set(slugTouched ? { title } : { title, slug: kebab(title) });
          }}
        />
      </Field>

      <Field label="Slug" hint={published ? 'locked, it is the url now' : 'lowercase letters, numbers and hyphens'}>
        <Input
          fontFamily="mono"
          fontSize={TYPE.small}
          value={post.slug}
          isDisabled={published}
          onChange={(e) => { setSlugTouched(true); set({ slug: kebab(e.target.value) }); }}
        />
      </Field>

      <Field label="Excerpt" hint="one or two sentences, feeds the list card and the share text">
        <Textarea minH="72px" value={post.excerpt || ''} onChange={(e) => set({ excerpt: e.target.value })} />
      </Field>

      <Field label="Body" hint="plain markdown">
        <Textarea
          fontFamily="mono"
          fontSize={TYPE.small}
          lineHeight="1.7"
          minH="440px"
          value={post.body_mdx || ''}
          onChange={(e) => set({ body_mdx: e.target.value })}
        />
      </Field>

      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4}>
        <Field label="Burro" hint="lowercase, no period">
          <Input fontFamily="mono" fontSize={TYPE.small} value={post.burro || ''} onChange={(e) => set({ burro: e.target.value })} />
        </Field>
        <Field label="Categories" hint="comma separated">
          <Input fontFamily="mono" fontSize={TYPE.small} value={csv(post.categories)} onChange={(e) => set({ categories: uncsv(e.target.value) })} />
        </Field>
        <Field label="Tags" hint="comma separated">
          <Input fontFamily="mono" fontSize={TYPE.small} value={csv(post.tags)} onChange={(e) => set({ tags: uncsv(e.target.value) })} />
        </Field>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
        <Field label="Cover image" hint="a path on the studio site, like /blog/name.webp">
          <Input fontFamily="mono" fontSize={TYPE.small} value={post.cover_image || ''} onChange={(e) => set({ cover_image: e.target.value })} />
        </Field>
        <Field label="Image alt">
          <Input fontSize={TYPE.small} value={post.image_alt || ''} onChange={(e) => set({ image_alt: e.target.value })} />
        </Field>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
        <Field label="Meta title" hint="falls back to the title">
          <Input fontSize={TYPE.small} value={post.meta_title || ''} onChange={(e) => set({ meta_title: e.target.value })} />
        </Field>
        <Field label="Meta description" hint="falls back to the excerpt">
          <Input fontSize={TYPE.small} value={post.meta_description || ''} onChange={(e) => set({ meta_description: e.target.value })} />
        </Field>
      </SimpleGrid>

      <HStack as="button" type="button" onClick={() => set({ featured: !post.featured })} spacing={2.5} alignSelf="start">
        <Box w="34px" h="20px" borderRadius="full" bg={post.featured ? P.lime : P.hair} position="relative" transition={`background ${FAST} ${EASE}`}>
          <Box boxSize="16px" borderRadius="full" bg={P.sheet} position="absolute" top="2px" left={post.featured ? '16px' : '2px'} transition={`left ${FAST} ${EASE}`} boxShadow="0 1px 3px rgba(36,26,22,0.3)" />
        </Box>
        <Text fontSize={TYPE.small} color={P.inkSec}>Featured on the blog page</Text>
      </HStack>

      {!isNew && (
        <Section
          kicker="The social run"
          action={(
            <Button size="xs" variant="outline" leftIcon={<Icon as={TbSparkles} boxSize={3.5} />} onClick={() => callPublish('redraft')} isDisabled={Boolean(busy)}>
              {busy === 'redraft' ? 'Drafting' : 'Redraft'}
            </Button>
          )}
        >
          <Text fontSize={TYPE.small} color={P.inkSec}>
            One paste ready draft per platform. Copy, post it there, mark it posted.
          </Text>

          {drafts.length === 0 && posted.length === 0 && (
            <Empty py={2}>Nothing drafted yet. Publish drafts them on its own, or press redraft.</Empty>
          )}

          {drafts.map((s) => (
            <Plate key={s.id}>
              <VStack align="stretch" spacing={2.5}>
                <HStack justify="space-between">
                  <Text fontFamily="mono" fontSize={TYPE.label} fontWeight="700" color={P.limeDeep}>
                    {PLATFORM_LABELS[s.platform] || s.platform}
                  </Text>
                  <HStack spacing={2}>
                    <Button size="xs" variant="outline" leftIcon={<Icon as={copied === s.id ? TbCheck : TbCopy} boxSize={3.5} />} onClick={() => copyDraft(s)} color={copied === s.id ? P.limeDeep : P.inkSec}>
                      {copied === s.id ? 'copied' : 'copy'}
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => markPosted(s)}>
                      mark posted
                    </Button>
                  </HStack>
                </HStack>
                <Text fontSize={TYPE.small} color={P.ink} whiteSpace="pre-wrap" lineHeight="1.65">
                  {s.body}
                </Text>
              </VStack>
            </Plate>
          ))}

          {posted.map((s) => (
            <Plate key={s.id} sunken py={2.5} opacity={0.75}>
              <HStack justify="space-between">
                <HStack spacing={2.5}>
                  <Icon as={TbCheck} boxSize={3.5} color={P.green} />
                  <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}>
                    {PLATFORM_LABELS[s.platform] || s.platform} posted
                  </Text>
                </HStack>
                <HStack as="button" type="button" onClick={() => copyDraft(s)} spacing={1} color={P.inkFaint} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}>
                  <Icon as={TbCopy} boxSize={3.5} />
                </HStack>
              </HStack>
            </Plate>
          ))}
        </Section>
      )}
    </Page>
  );
};

export default PostEditor;
