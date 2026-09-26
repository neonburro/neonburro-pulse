// src/pages/Clients/components/SitesTab.jsx
// Sites tab on ClientDetail, on Paper: connected Netlify sites, a searchable
// picker to connect more, and a merged deploy feed filterable per site. Deploy
// state reads as a coloured dot (ready green, error coral, building gold). All
// logic unchanged. House fields, house tabs, house empty lines. No oxford
// commas, no dashes.

import { useState, useEffect, useMemo } from 'react';
import { Box, VStack, HStack, Text, Icon, Input, Button, Checkbox, useToast } from '@chakra-ui/react';
import { TbWorld, TbPlus, TbExternalLink, TbCheck, TbLink, TbAlertCircle, TbGitBranch } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { formatSmart } from '../../../lib/time';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Section, Field, Empty, Loading, Tabs, Kicker, SearchBox, Plate } from '../../../components/common/Page';

const P = colors.paper;

const cleanDomain = (url) => {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const getSiteDomain = (site) => {
  if (site.primary_url) return cleanDomain(site.primary_url);
  return site.netlify_site_name;
};

const DEPLOY_STATE_COLORS = {
  ready:    P.green,
  error:    P.coral,
  building: P.gold,
  enqueued: P.gold,
  new:      P.inkFaint,
};

const SitesTab = ({ clientId, clientName }) => {
  const [sites, setSites] = useState([]);
  const [deploys, setDeploys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSiteFilter, setActiveSiteFilter] = useState('all');

  const [showPicker, setShowPicker] = useState(false);
  const [netlifySites, setNetlifySites] = useState([]);
  const [loadingNetlify, setLoadingNetlify] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);

  const toast = useToast();

  useEffect(() => { fetchSitesAndDeploys(); }, [clientId]);

  const fetchSitesAndDeploys = async () => {
    setLoading(true);
    const [sitesRes, deploysRes] = await Promise.all([
      supabase.from('client_sites').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('netlify_deploys').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(200),
    ]);
    setSites(sitesRes.data || []);
    setDeploys(deploysRes.data || []);
    setLoading(false);
  };

  const openPicker = async () => {
    setShowPicker(true);
    setConnectError(null);
    setSelectedSite(null);
    setDisplayName('');
    setIsInternal(false);
    setSearchQuery('');
    if (netlifySites.length > 0) return;

    setLoadingNetlify(true);
    try {
      const res = await fetch('/.netlify/functions/list-netlify-sites');
      if (!res.ok) throw new Error(`Failed to load Netlify sites (${res.status})`);
      const data = await res.json();
      setNetlifySites(data.sites || []);
    } catch (err) {
      toast({ title: 'Could not load Netlify sites', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setLoadingNetlify(false);
    }
  };

  const filteredNetlifySites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return netlifySites
      .filter((s) => {
        if (s.connected && s.connected_to_client_id !== clientId) return q && s.name.toLowerCase().includes(q);
        if (s.connected && s.connected_to_client_id === clientId) return false;
        if (q) return s.name.toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q);
        return true;
      })
      .slice(0, 50);
  }, [netlifySites, searchQuery, clientId]);

  const handleSelectSite = (site) => {
    if (site.connected && site.connected_to_client_id !== clientId) {
      toast({ title: 'Already connected', description: `This site is linked to ${site.connected_to_client}`, status: 'warning', duration: 3000 });
      return;
    }
    setSelectedSite(site);
    setDisplayName(site.name);
    setConnectError(null);
  };

  const handleConnect = async () => {
    if (!selectedSite) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/.netlify/functions/connect-netlify-site', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName: selectedSite.name, clientId, isInternal, displayName: displayName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error || `Connect failed (${res.status})`);
        toast({ title: 'Could not connect site', description: data.error || 'Unknown error', status: 'error', duration: 5000 });
        return;
      }
      toast({ title: 'Site connected', description: data.message || `${selectedSite.name} linked to ${clientName}`, status: 'success', duration: 4000 });
      setShowPicker(false);
      setSelectedSite(null);
      setDisplayName('');
      setIsInternal(false);
      setNetlifySites([]);
      fetchSitesAndDeploys();
    } catch (err) {
      setConnectError(err.message);
      toast({ title: 'Network error', description: err.message, status: 'error', duration: 5000 });
    } finally {
      setConnecting(false);
    }
  };

  const siteLookup = useMemo(() => {
    const map = {};
    sites.forEach((s) => { map[s.id] = s; });
    return map;
  }, [sites]);

  const filteredDeploys = useMemo(() => {
    if (activeSiteFilter === 'all') return deploys;
    return deploys.filter((d) => d.site_id === activeSiteFilter);
  }, [deploys, activeSiteFilter]);

  const deployCounts = useMemo(() => {
    const counts = { all: deploys.length };
    deploys.forEach((d) => { if (d.site_id) counts[d.site_id] = (counts[d.site_id] || 0) + 1; });
    return counts;
  }, [deploys]);

  if (loading) return <Loading label="loading sites" />;

  const hasSites = sites.length > 0;
  const hasDeploys = deploys.length > 0;

  return (
    <VStack spacing={8} align="stretch">
      <Section kicker="Connected sites" count={sites.length || undefined}>
        {!hasSites && !showPicker && (
          <Empty>No sites connected yet.</Empty>
        )}

        {sites.map((site) => {
          const domain = getSiteDomain(site);
          return (
            <HStack key={site.id} py={3.5} spacing={3} borderBottom="1px solid" borderColor={P.hairSoft}>
              <Icon as={TbWorld} boxSize={3.5} color={P.inkMuted} />
              <Box flex={1} minW={0}>
                <HStack spacing={2}>
                  <Text color={P.ink} fontSize={TYPE.body} fontWeight="600" noOfLines={1}>{domain}</Text>
                  {site.is_internal && <Kicker color={P.inkFaint}>Internal</Kicker>}
                </HStack>
                <HStack spacing={2} mt={0.5} flexWrap="wrap">
                  <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{site.netlify_site_name}</Text>
                  {site.framework && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{site.framework}</Text></>)}
                  {site.last_synced_at && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">synced {formatSmart(site.last_synced_at)}</Text></>)}
                </HStack>
              </Box>
              {site.primary_url && (
                <Box as="a" href={site.primary_url} target="_blank" rel="noopener noreferrer" color={P.inkMuted} _hover={{ color: P.limeDeep }} transition={`color ${FAST} ${EASE}`}><Icon as={TbExternalLink} boxSize={3.5} /></Box>
              )}
              {site.webhook_registered_at && (
                <HStack spacing={1}><Box w="6px" h="6px" borderRadius="full" bg={P.green} /><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">live</Text></HStack>
              )}
            </HStack>
          );
        })}

        {showPicker ? (
          <Plate>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Kicker color={P.limeDeep}>Pick a Netlify site</Kicker>
                <Button size="xs" variant="ghost" onClick={() => setShowPicker(false)}>Cancel</Button>
              </HStack>

              {loadingNetlify ? (
                <Loading label="loading your Netlify sites" py={2} />
              ) : selectedSite ? (
                <VStack spacing={4} align="stretch">
                  <Box bg={P.sunken} border="1px solid" borderColor={P.limeDeep} borderRadius="lg" p={INSET}>
                    <HStack spacing={3}>
                      <Icon as={TbWorld} boxSize={5} color={P.limeDeep} />
                      <Box flex={1}>
                        <Text color={P.ink} fontSize={TYPE.body} fontWeight="700">{selectedSite.name}</Text>
                        {selectedSite.url && <Text color={P.inkMuted} fontSize={TYPE.small} fontFamily="mono">{cleanDomain(selectedSite.url)}</Text>}
                        <HStack spacing={2} mt={1} flexWrap="wrap">
                          {selectedSite.framework && <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{selectedSite.framework}</Text>}
                          {selectedSite.published_at && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">deployed {formatSmart(selectedSite.published_at)}</Text></>)}
                        </HStack>
                      </Box>
                      <Button size="xs" variant="ghost" onClick={() => setSelectedSite(null)}>Change</Button>
                    </HStack>
                  </Box>

                  <Field label="Display name" hint="how this site shows up in Pulse and the client portal">
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Production Site" />
                  </Field>

                  <Checkbox isChecked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} colorScheme="green" size="sm">
                    <Text color={P.inkSec} fontSize={TYPE.small}>Internal site (hide from client portal)</Text>
                  </Checkbox>

                  {connectError && (
                    <HStack bg={`${P.coral}12`} border="1px solid" borderColor={`${P.coral}40`} borderRadius="lg" p={3} spacing={2} align="start">
                      <Icon as={TbAlertCircle} boxSize={4} color={P.coral} mt={0.5} />
                      <Text color={P.coral} fontSize={TYPE.small} flex={1}>{connectError}</Text>
                    </HStack>
                  )}

                  <HStack spacing={2}>
                    <Button size="sm" leftIcon={<TbCheck size={14} />} onClick={handleConnect} isLoading={connecting} loadingText="Connecting">Connect site</Button>
                  </HStack>
                </VStack>
              ) : (
                <VStack spacing={3} align="stretch">
                  <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder={`Search ${netlifySites.length} Netlify sites`} inputProps={{ autoFocus: true }} />

                  {filteredNetlifySites.length === 0 ? (
                    <Empty py={2}>{searchQuery ? 'No matches.' : 'No sites available to connect.'}</Empty>
                  ) : (
                    <Box maxH="360px" overflowY="auto">
                      {filteredNetlifySites.map((site) => {
                        const takenByOther = site.connected && site.connected_to_client_id !== clientId;
                        return (
                          <HStack key={site.id} py={2.5} px={2} spacing={3} cursor={takenByOther ? 'not-allowed' : 'pointer'} onClick={() => !takenByOther && handleSelectSite(site)} borderRadius="md" transition={`all ${FAST} ${EASE}`} opacity={takenByOther ? 0.4 : 1} _hover={takenByOther ? {} : { bg: P.sunken }} role="group">
                            <Icon as={TbLink} boxSize={3} color={P.inkFaint} _groupHover={takenByOther ? {} : { color: P.limeDeep }} />
                            <Box flex={1} minW={0}>
                              <HStack spacing={2}>
                                <Text color={P.ink} fontSize={TYPE.body} fontWeight="600" fontFamily="mono">{site.name}</Text>
                                {takenByOther && <Text fontSize={TYPE.label} color={P.gold} fontFamily="mono" fontWeight="700" textTransform="uppercase">→ {site.connected_to_client}</Text>}
                              </HStack>
                              <HStack spacing={2} mt={0.5} flexWrap="wrap">
                                {site.url && <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono" noOfLines={1}>{cleanDomain(site.url)}</Text>}
                                {site.framework && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{site.framework}</Text></>)}
                                {site.published_at && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{formatSmart(site.published_at)}</Text></>)}
                              </HStack>
                            </Box>
                          </HStack>
                        );
                      })}
                    </Box>
                  )}
                </VStack>
              )}
            </VStack>
          </Plate>
        ) : (
          <HStack as="button" type="button" py={2} spacing={1.5} onClick={openPicker} color={P.limeDeep} _hover={{ color: P.ink }}>
            <Icon as={TbPlus} boxSize={3} />
            <Kicker color="inherit">Connect Netlify site</Kicker>
          </HStack>
        )}
      </Section>

      {hasSites && (
        <Section kicker="Recent deploys" count={`${deploys.length} total`}>
          {sites.length > 1 && (
            <Tabs
              items={[
                { key: 'all', label: 'All', count: deployCounts.all || 0 },
                ...sites.map((site) => ({ key: site.id, label: getSiteDomain(site), count: deployCounts[site.id] || 0 })),
              ]}
              value={activeSiteFilter}
              onChange={setActiveSiteFilter}
            />
          )}

          {!hasDeploys ? (
            <Empty hint="Push a change to see it here.">No deploys yet.</Empty>
          ) : filteredDeploys.length === 0 ? (
            <Empty>No deploys for this site yet.</Empty>
          ) : (
            <VStack spacing={0} align="stretch">
              {filteredDeploys.map((d) => {
                const site = siteLookup[d.site_id];
                const domain = site ? getSiteDomain(site) : d.netlify_site_id;
                const stateColor = DEPLOY_STATE_COLORS[d.state] || P.inkFaint;
                const isError = d.state === 'error';
                const href = d.deploy_url || site?.primary_url;
                return (
                  <HStack key={d.id} py={3.5} spacing={3} borderBottom="1px solid" borderColor={P.hairSoft} cursor={href ? 'pointer' : 'default'} role="group" transition={`all ${FAST} ${EASE}`} _hover={href ? { bg: P.sheet } : {}} onClick={() => { if (href) window.open(href, '_blank', 'noopener,noreferrer'); }}>
                    <Box w="6px" h="6px" borderRadius="full" bg={stateColor} flexShrink={0} />
                    <Box flex={1} minW={0}>
                      <Text color={isError ? P.coral : P.ink} fontSize={TYPE.body} fontWeight="600" noOfLines={1}>{d.commit_message || (isError ? 'Deploy failed' : 'Deploy')}</Text>
                      <HStack spacing={2} mt={0.5} flexWrap="wrap">
                        <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono" noOfLines={1}>{domain}</Text>
                        {d.branch && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><HStack spacing={1}><Icon as={TbGitBranch} boxSize={2.5} color={P.inkFaint} /><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{d.branch}</Text></HStack></>)}
                        {d.commit_ref && (<><Text color={P.inkFaint} fontSize={TYPE.label}>·</Text><Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{d.commit_ref.slice(0, 7)}</Text></>)}
                      </HStack>
                    </Box>
                    <VStack align="end" spacing={0} flexShrink={0}>
                      <Text color={P.inkMuted} fontSize={TYPE.label} fontFamily="mono">{formatSmart(d.published_at || d.created_at)}</Text>
                      {d.deploy_time > 0 && <Text color={P.inkFaint} fontSize={TYPE.label} fontFamily="mono">{formatDuration(d.deploy_time)}</Text>}
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </Section>
      )}
    </VStack>
  );
};

export default SitesTab;
