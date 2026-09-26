// src/pages/Clients/components/ClientFilters.jsx
// The house search box, the house tabs and a quieter sort row. Mobile
// stacks, desktop is inline. No oxford commas, no dashes.

import { HStack, VStack, Text } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { SearchBox, Tabs, Kicker } from '../../../components/common/Page';

const P = colors.paper;

const STATUS_OPTIONS = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'lead',     label: 'Leads' },
  { key: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { value: 'recent',       label: 'Recent' },
  { value: 'activity',     label: 'Activity' },
  { value: 'alphabetical', label: 'A to Z' },
  { value: 'most_funded',  label: 'Funded' },
  { value: 'most_sprints', label: 'Sprints' },
];

const ClientFilters = ({ search, onSearch, filterStatus, onFilterStatus, sortBy, onSortBy, counts }) => (
  <VStack align="stretch" spacing={5}>
    <SearchBox value={search} onChange={onSearch} placeholder="Search by name, email, company, phone or tag" />

    <Tabs items={STATUS_OPTIONS.map((o) => ({ ...o, count: counts[o.key] || 0 }))} value={filterStatus} onChange={onFilterStatus} />

    <HStack spacing={5} flexWrap="wrap" align="center">
      <Kicker>Sort</Kicker>
      {SORT_OPTIONS.map((opt) => {
        const active = sortBy === opt.value;
        return (
          <Text key={opt.value} as="button" type="button" onClick={() => onSortBy(opt.value)} fontSize={TYPE.small} fontFamily="mono" fontWeight={active ? '700' : '500'} letterSpacing="0.04em" color={active ? P.ink : P.inkMuted} _hover={{ color: P.ink }}>
            {opt.label}
          </Text>
        );
      })}
    </HStack>
  </VStack>
);

export default ClientFilters;
