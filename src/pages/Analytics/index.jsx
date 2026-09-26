// src/pages/Analytics/index.jsx
// SENTINEL: NB_PULSE_ANALYTICS_V3
//
// ── V2, 2026-08-26. THE TRAFFIC PANEL IS LIVE ───────────────────────────────
// Did anybody hit the page stopped being a question for Google's console.
// The studio site carries a first party beacon (src/services/beacon.js in
// the neonburro repo) that writes one blind row per pageview into
// page_views, migration 2026082609, path and referrer host and a time and
// nothing else. This page reads the last seven days and aggregates in the
// browser, which is fine at the volumes a studio site sees. When rows pass
// six figures move the math into a database view and keep the panel.
//
// The source cards below the live panel stay, they are the honest map of
// what is wired next. GA4 still collects in parallel, deeper SEO tooling
// (search console, the semrush shaped stuff) rides on those cards.
//
// V3, 2026-09-25. On the house column, the house head and the house
// section. No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { Text, HStack, VStack, Icon, SimpleGrid } from '@chakra-ui/react';
import { TbActivity, TbCoin, TbChartArea, TbBrandStripe, TbServer } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE } from '../../theme/layout';
import { Page, PageHead, Section, Plate, Empty, Loading, Kicker } from '../../components/common/Page';

const P = colors.paper;

const SOURCES = [
  {
    icon: TbServer,
    title: 'Deploy health',
    line: 'Every property in one board, the shop, order, lounge, the studio site and Pulse. Last deploy, build time, up or down.',
    status: 'Ready to wire',
    tone: P.green,
    note: 'Uses the Netlify token you already have.',
  },
  {
    icon: TbCoin,
    title: 'Revenue and pipeline',
    line: 'Outstanding and collected, active clients, open sprints, subscriptions and forms in, pulled straight from Supabase.',
    status: 'Ready to wire',
    tone: P.green,
    note: 'No new keys, Pulse already reads this.',
  },
  {
    icon: TbBrandStripe,
    title: 'Stripe money',
    line: 'MRR, recent charges and payouts alongside everything else, so the money view is live not a monthly guess.',
    status: 'Needs a key on Pulse',
    tone: P.gold,
    note: 'Add STRIPE_SECRET_KEY to the Pulse site.',
  },
  {
    icon: TbChartArea,
    title: 'Search and rankings',
    line: 'Queries, clicks and positions the way the semrush shaped tools show them, riding on Google Search Console which is free.',
    status: 'Needs a connection',
    tone: P.gold,
    note: 'A GSC service account key unlocks it, ask when ready.',
  },
];

const dayKey = (d) => d.toISOString().slice(0, 10);

const Figure = ({ n, label, tone }) => (
  <HStack spacing={1.5} align="baseline">
    <Text fontFamily="mono" fontSize={TYPE.section} fontWeight="700" color={tone || P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{n}</Text>
    <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>{label}</Text>
  </HStack>
);

const Analytics = () => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from('page_views')
        .select('path, referrer, viewed_at')
        .gte('viewed_at', since)
        .order('viewed_at', { ascending: false })
        .limit(20000);
      setRows(data || []);
    })();
  }, []);

  const today = dayKey(new Date());
  const todayRows = (rows || []).filter((r) => r.viewed_at.slice(0, 10) === today);

  const countBy = (list, pick) => {
    const m = new Map();
    list.forEach((r) => {
      const k = pick(r);
      if (!k) return;
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const topPaths = countBy(rows || [], (r) => r.path).slice(0, 8);
  const topRefs = countBy(rows || [], (r) => r.referrer).slice(0, 6);
  const burroViews = (rows || []).filter((r) => r.path.startsWith('/send-a-burro')).length;

  return (
    <Page>
      <PageHead kicker="Command center" title="Analytics" lede="The house beacon on neonburro.com, last seven days, no cookies and no ids. The sources under it are what lands next." />

      <Section kicker="neonburro.com traffic">
        <Plate>
          {rows === null ? (
            <Loading label="reading the beacon" py={2} />
          ) : (
            <VStack align="stretch" spacing={5}>
              <HStack spacing={5} flexWrap="wrap" rowGap={2}>
                <Figure n={todayRows.length} label="views today" />
                <Figure n={rows.length} label="this week" />
                <Figure n={burroViews} label="on send a burro" tone={P.limeDeep} />
              </HStack>

              {rows.length === 0 ? (
                <Empty py={2}>Nothing yet. The beacon shipped with the latest studio deploy, rows appear the moment anybody loads a page.</Empty>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                  <VStack align="stretch" spacing={1.5}>
                    <Kicker mb={1}>Top pages</Kicker>
                    {topPaths.map(([path, n]) => (
                      <HStack key={path} justify="space-between">
                        <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec} noOfLines={1}>{path}</Text>
                        <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{n}</Text>
                      </HStack>
                    ))}
                  </VStack>
                  <VStack align="stretch" spacing={1.5}>
                    <Kicker mb={1}>Came from</Kicker>
                    {topRefs.length === 0 && (
                      <Text fontSize={TYPE.small} color={P.inkFaint}>Direct visits only so far.</Text>
                    )}
                    {topRefs.map(([host, n]) => (
                      <HStack key={host} justify="space-between">
                        <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkSec} noOfLines={1}>{host}</Text>
                        <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>{n}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </SimpleGrid>
              )}
            </VStack>
          )}
        </Plate>
      </Section>

      <Section kicker="What lands next">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {SOURCES.map((s) => (
            <Plate key={s.title}>
              <HStack justify="space-between" align="start" mb={3}>
                <HStack spacing={2.5}>
                  <Icon as={s.icon} boxSize={4} color={P.inkSec} />
                  <Text fontSize={TYPE.section} fontWeight="700" color={P.ink} letterSpacing="-0.01em">{s.title}</Text>
                </HStack>
                <Text fontFamily="mono" fontSize={TYPE.kicker} letterSpacing="0.12em" textTransform="uppercase" color={s.tone} flexShrink={0} pt={1}>{s.status}</Text>
              </HStack>
              <Text fontSize={TYPE.body} color={P.inkMuted} lineHeight="1.65">{s.line}</Text>
              <Text fontSize={TYPE.small} color={P.inkFaint} mt={3} fontFamily="mono">{s.note}</Text>
            </Plate>
          ))}
        </SimpleGrid>
        <HStack spacing={2} color={P.inkFaint}>
          <Icon as={TbActivity} boxSize={3.5} />
          <Text fontSize={TYPE.small} color={P.inkFaint}>The full plan and the env var names are in docs/analytics-and-integrations.md</Text>
        </HStack>
      </Section>
    </Page>
  );
};

export default Analytics;
