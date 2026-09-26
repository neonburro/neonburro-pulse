// src/pages/Blog/index.jsx
// SENTINEL: NB_PULSE_BLOG_LIST_V2
//
// The writing desk. Every post the studio has ever drafted or published, one
// row each, newest movement first. A row is a door to the editor, the lime
// button starts a fresh draft. Published rows carry a quiet link to the live
// page on neonburro.com.
//
// Posts live in blog_posts in Supabase and this page reads them straight
// through the client, staff RLS lets a signed in operator see drafts. The
// studio site only ever sees published rows, that boundary is enforced by
// policy in migration 2026082604 and pulled by scripts/db-posts.mjs in the
// neonburro repo at build time. Nothing here talks to the public site
// directly, publishing goes through the publish-blog-post function from
// inside the editor.
//
// V2, 2026-09-25. The house column, head, tabs and empty line. No oxford
// commas, no em dashes.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, VStack, HStack, Text, Icon, Button } from '@chakra-ui/react';
import { TbPlus, TbExternalLink } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE, EASE, FAST, INSET, PLATE_RADIUS } from '../../theme/layout';
import { Page, PageHead, Tabs, Empty, Loading } from '../../components/common/Page';

const P = colors.paper;

const FILTERS = [
  { key: 'all', label: 'all' },
  { key: 'draft', label: 'drafts' },
  { key: 'published', label: 'published' },
];

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StatusPip = ({ status }) => (
  <HStack spacing={1.5}>
    <Box boxSize="7px" borderRadius="full" bg={status === 'published' ? P.lime : P.inkFaint} />
    <Text fontFamily="mono" fontSize={TYPE.label} color={status === 'published' ? P.limeDeep : P.inkMuted}>
      {status}
    </Text>
  </HStack>
);

const Blog = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, slug, title, excerpt, burro, status, featured, published_at, updated_at, created_at')
        .order('updated_at', { ascending: false });
      setPosts(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = posts.filter((p) => filter === 'all' || p.status === filter);
  const counts = {
    all: posts.length,
    draft: posts.filter((p) => p.status === 'draft').length,
    published: posts.filter((p) => p.status === 'published').length,
  };

  return (
    <Page>
      <PageHead
        kicker="Blog"
        title="The posts, written here, live there."
        actions={(
          <Button size="sm" leftIcon={<Icon as={TbPlus} boxSize={4} />} onClick={() => navigate('/blog/new/')}>
            Post
          </Button>
        )}
      />

      <VStack align="stretch" spacing={5}>
        <Tabs items={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} />

        {loading ? (
          <Loading label="loading posts" />
        ) : filtered.length === 0 ? (
          <Empty>
            {filter === 'all' ? 'Nothing written yet. The lime button starts the first one.' : `No ${filter === 'draft' ? 'drafts' : 'published posts'} right now.`}
          </Empty>
        ) : (
          <VStack spacing={2.5} align="stretch">
            {filtered.map((p) => (
              <HStack
                key={p.id}
                as="button"
                type="button"
                onClick={() => navigate(`/blog/${p.id}/`)}
                textAlign="left"
                bg={P.sheet}
                border="1px solid"
                borderColor={P.hair}
                borderRadius={PLATE_RADIUS}
                px={INSET}
                py={4}
                justify="space-between"
                gap={4}
                transition={`all ${FAST} ${EASE}`}
                _hover={{ borderColor: P.limeDeep, transform: 'translateY(-1px)' }}
              >
                <VStack align="start" spacing={1} minW={0} flex={1}>
                  <Text fontSize={TYPE.body} fontWeight="700" color={P.ink} noOfLines={1}>
                    {p.title || 'untitled'}
                  </Text>
                  <HStack spacing={2} flexWrap="wrap">
                    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} noOfLines={1}>
                      /blog/{p.slug || '…'}/
                    </Text>
                    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}>
                      {p.burro || 'epoch'}.
                    </Text>
                    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>
                      {p.status === 'published' ? when(p.published_at) : `touched ${when(p.updated_at || p.created_at)}`}
                    </Text>
                  </HStack>
                </VStack>

                <HStack spacing={4} flexShrink={0}>
                  {p.status === 'published' && (
                    <Box
                      as="span"
                      role="link"
                      onClick={(e) => { e.stopPropagation(); window.open(`https://neonburro.com/blog/${p.slug}/`, '_blank', 'noopener'); }}
                      color={P.inkMuted}
                      transition={`color ${FAST} ${EASE}`}
                      _hover={{ color: P.limeDeep }}
                    >
                      <Icon as={TbExternalLink} boxSize={4} display="block" />
                    </Box>
                  )}
                  <StatusPip status={p.status} />
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Page>
  );
};

export default Blog;
