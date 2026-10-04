// src/pages/Orders/BrandKitReviewFixture.jsx
//
// A DEVELOPMENT-ONLY DOOR FOR VISUAL REVIEW
//
// App.jsx exposes this page only while Vite runs in development. It carries no
// client record, makes no network call and exists so the review desk can be
// inspected at real phone and desktop widths before a paid order exists.

import { Box, Text } from '@chakra-ui/react';
import BrandKitReviewDesk from './BrandKitReviewDesk';
import colors from '../../theme/colors';
import { TYPE } from '../../theme/layout';
import { Kicker } from '../../components/common/Page';

const P = colors.paper;

const FIXTURE_ORDER = {
  id: 'review-fixture-custom-brand-kit',
  kind: 'signatures',
  inputs: { service: 'signatures', seats: 1 },
  status: 'paid',
  first_name: '',
  business: '',
  town: '',
  url: '',
  amount_cents: 2500,
};

const BrandKitReviewFixture = () => (
  <Box minH="100vh" bg={P.mat} color={P.ink} px={{ base: 4, md: 8 }} py={{ base: 8, md: 12 }}>
    <Box maxW="1440px" mx="auto">
      <Kicker color={P.coral}>development fixture · never an order</Kicker>
      <Text mt={2} fontSize={TYPE.title} fontWeight="600" letterSpacing="-0.03em">
        Custom Brand Kit delivery gate rehearsal.
      </Text>
      <BrandKitReviewDesk row={FIXTURE_ORDER} />
    </Box>
  </Box>
);

export default BrandKitReviewFixture;
