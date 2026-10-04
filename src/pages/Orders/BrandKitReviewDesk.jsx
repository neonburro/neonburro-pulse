// src/pages/Orders/BrandKitReviewDesk.jsx
//
// THE REVIEW DESK BEFORE THE DELIVERY RAIL
//
// This component may help a person inspect a Custom Brand Kit, but it cannot
// deliver one. The iframe is an explicit non-production fixture and each check
// lives only in this browser session. A later server receipt owns the durable
// reviewer, artifact hash, provider receipt and delivery time.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, HStack, Icon, SimpleGrid, Text, Tooltip, VStack,
} from '@chakra-ui/react';
import { TbCheck, TbLock, TbShieldCheck } from 'react-icons/tb';
import {
  BRAND_KIT_REVIEW_ITEMS,
  buildBrandKitReviewFixture,
  reviewCount,
  reviewIsComplete,
} from '../../lib/brandKitReview';
import colors from '../../theme/colors';
import { INSET, PLATE_RADIUS, TYPE } from '../../theme/layout';
import { Kicker } from '../../components/common/Page';

const P = colors.paper;

const ReviewCheck = ({ item, checked, onChange }) => (
  <Box
    as="button"
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={onChange}
    display="flex"
    alignItems="flex-start"
    gap={3}
    w="100%"
    py={3.5}
    textAlign="left"
    borderBottom="1px solid"
    borderColor={P.hairSoft}
    _focusVisible={{ outline: `2px solid ${P.limeDeep}`, outlineOffset: '2px' }}
  >
    <Box
      mt="2px"
      boxSize="18px"
      flexShrink={0}
      display="grid"
      placeItems="center"
      border="1px solid"
      borderColor={checked ? P.limeDeep : P.hair}
      borderRadius="5px 5px 5px 0"
      bg={checked ? P.lime : P.sheet}
    >
      {checked && <Icon as={TbCheck} boxSize={3.5} color={P.limeInk} />}
    </Box>
    <Box>
      <Text fontSize={TYPE.small} fontWeight="600" color={P.ink}>{item.label}</Text>
      <Text mt={1} fontSize={TYPE.micro} color={P.inkMuted} lineHeight="1.55">{item.proof}</Text>
    </Box>
  </Box>
);

const BrandKitReviewDesk = ({ row }) => {
  const [checked, setChecked] = useState({});
  const fixture = useMemo(() => buildBrandKitReviewFixture(row), [row]);
  const completed = reviewCount(checked);
  const complete = reviewIsComplete(checked);

  useEffect(() => { setChecked({}); }, [row.id]);

  const toggle = (id, next) => setChecked((current) => ({ ...current, [id]: next }));

  return (
    <Box mt={6} pt={6} borderTop="1px solid" borderColor={P.hair}>
      <HStack align="start" justify="space-between" spacing={4} flexWrap="wrap" rowGap={3}>
        <Box maxW="64ch">
          <Kicker color={P.limeDeep}>Custom Brand Kit review desk</Kicker>
          <Text mt={2} fontSize={TYPE.subtitle} fontWeight="600" color={P.ink} letterSpacing="-0.025em">
            Review the artifact before a delivery receipt exists.
          </Text>
          <Text mt={2} fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.65">
            The frame below is clearly marked as a non-production fixture. These six checks reset when you leave
            the order and create no server record. They rehearse the gate without pretending the gate is installed.
          </Text>
        </Box>
        <HStack spacing={2} px={3} py={2} border="1px solid" borderColor={P.lime} borderRadius="10px 10px 10px 0" bg={P.sunken}>
          <Icon as={TbShieldCheck} boxSize={4} color={P.limeDeep} />
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.limeDeep} textTransform="uppercase" letterSpacing="0.1em">
            fixture · no write
          </Text>
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5} mt={6} alignItems="start">
        <Box
          as="iframe"
          title={`Non-production Custom Brand Kit review fixture for ${row.business || 'this order'}`}
          srcDoc={fixture}
          sandbox=""
          w="100%"
          h={{ base: '620px', md: '760px' }}
          border="1px solid"
          borderColor={P.hair}
          borderRadius={PLATE_RADIUS}
          bg={P.sheet}
        />

        <Box border="1px solid" borderColor={P.hair} borderRadius={PLATE_RADIUS} bg={P.sheet} p={INSET}>
          <HStack justify="space-between" align="baseline" spacing={4}>
            <Kicker>six checks</Kicker>
            <Text fontFamily="mono" fontSize={TYPE.micro} color={complete ? P.green : P.inkFaint}>
              {completed} / {BRAND_KIT_REVIEW_ITEMS.length}
            </Text>
          </HStack>

          <VStack align="stretch" spacing={0} mt={3}>
            {BRAND_KIT_REVIEW_ITEMS.map((item) => (
              <ReviewCheck
                key={item.id}
                item={item}
                checked={checked[item.id] === true}
                onChange={() => toggle(item.id, checked[item.id] !== true)}
              />
            ))}
          </VStack>

          <Box mt={5} p={INSET} borderLeft="3px solid" borderColor={P.gold} bg={P.sunken} borderRadius="0 10px 10px 0">
            <Text fontSize={TYPE.small} color={P.inkSec} lineHeight="1.6">
              Checking every line still does not authorize delivery. Pulse needs a reviewed artifact hash, the
              signed-in reviewer, a stored checklist and a provider receipt from the delivery endpoint.
            </Text>
          </Box>

          <HStack mt={5} spacing={3} align="center" flexWrap="wrap" rowGap={2}>
            <Tooltip label="Delivery receipt endpoint not installed" placement="top" hasArrow>
              <Box display="inline-flex">
                <Button leftIcon={<Icon as={TbLock} boxSize={4} />} isDisabled>
                  Deliver held
                </Button>
              </Box>
            </Tooltip>
            <Text fontSize={TYPE.micro} color={complete ? P.gold : P.inkFaint} lineHeight="1.5">
              {complete ? 'Review rehearsal complete. No receipt was written.' : 'Finish the rehearsal to inspect the full gate.'}
            </Text>
          </HStack>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default BrandKitReviewDesk;
