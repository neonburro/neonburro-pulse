// src/pages/Wallets/components/HolderBlock.jsx
// SENTINEL: NB_WALLETS_HOLDER_V1
//
// One holder and every wallet written against them.
//
// ── A BURRO IS NEVER NAMED WITHOUT A FACE ───────────────────────────────────
// Tyler's rule, 2026-09-12. Every burro and every agent in this block carries
// the avatar beside the name, read from src/data/walletHolders.js. A treasury
// holder is not a burro, has no face on purpose and gets a plain disc with
// its initial so the row still has something to aim at.
//
// The avatar is served from neonburro.com and a cold load can fail. It is an
// img with a fallback to the same disc rather than a broken picture icon,
// because a burro with a broken face is worse than a burro with a plain one.
//
// ── IT SHOWS WHAT IS MISSING ────────────────────────────────────────────────
// Three ways, all in words, none of them a coloured dot:
//
//   1. A holder with no wallet says so on its own line. That is the point of
//      listing every holder rather than only the ones with rows, because a
//      list of what exists cannot tell you what does not.
//   2. A published row missing a label or a purpose says which, because
//      those two become public copy and a blank on a transparency page is
//      not a formatting problem.
//   3. A row whose address does not read as base58 says so, in case one was
//      written before the room existed.
//
// ── THE PUBLISH SWITCH ──────────────────────────────────────────────────────
// Per row, and it writes immediately, because a switch that needs a save
// button is a switch somebody leaves half thrown. Turning it on does not
// publish anything. It marks the row for the export, and the export is text a
// person pastes into the studio repo and commits. Nothing in this room
// reaches the public page on its own and the head of the page says so.
//
// No width, no gutter, no inset and no font size in this file, they come from
// the page kit. No oxford commas, no em dashes.

import { useState } from 'react';
import { Box, VStack, HStack, Text, Icon, Button, Switch, Image } from '@chakra-ui/react';
import { TbPlus, TbPencil, TbTrash, TbCopy, TbCheck, TbExternalLink } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, INSET, EASE, FAST } from '../../../theme/layout';
import { Plate, Kicker } from '../../../components/common/Page';
import { shortAddr, explorerUrl, isAddress } from '../../../lib/walletParse';
import { shortfalls } from '../../../lib/walletExport';

const P = colors.paper;

const Disc = ({ name }) => (
  <Box
    w="28px"
    h="28px"
    borderRadius="full"
    bg={P.sunken}
    border="1px solid"
    borderColor={P.hair}
    display="flex"
    alignItems="center"
    justifyContent="center"
    flexShrink={0}
  >
    <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted}>
      {String(name || '?').replace(/^the\s+/i, '').slice(0, 1).toLowerCase()}
    </Text>
  </Box>
);

const Face = ({ holder }) => {
  const [broke, setBroke] = useState(false);
  if (!holder.avatar || broke) return <Disc name={holder.name} />;
  return (
    <Image
      src={holder.avatar}
      alt={holder.name}
      w="28px"
      h="28px"
      borderRadius="full"
      objectFit="cover"
      flexShrink={0}
      bg={P.sunken}
      onError={() => setBroke(true)}
    />
  );
};

const WalletRow = ({ row, canWrite, onEdit, onRemove, onPublish, onCopy, copied }) => {
  const gaps = row.published ? shortfalls(row) : [];
  const badAddress = !isAddress(row.address || '');
  const retired = Boolean(row.retired);

  return (
    <Plate pad={false} px={INSET} py={3} bg={retired ? P.sunken : undefined}>
      <VStack align="stretch" spacing={2}>
        <HStack justify="space-between" gap={4} flexWrap="wrap" rowGap={2}>
          <VStack align="start" spacing={1} minW={0} flex="1 1 260px">
            <HStack spacing={2} flexWrap="wrap" rowGap={1}>
              <Text fontSize={TYPE.body} fontWeight="700" color={P.ink}>
                {row.label || 'no label'}
              </Text>
              {row.burn && <Kicker color={P.coral}>burn</Kicker>}
              {retired && <Kicker>retired {String(row.retired).slice(0, 10)}</Kicker>}
              {row.since && !retired && <Kicker>since {String(row.since).slice(0, 10)}</Kicker>}
            </HStack>
            <HStack spacing={2}>
              <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>
                {shortAddr(row.address)}
              </Text>
              <Box
                as="button"
                type="button"
                onClick={() => onCopy(row)}
                color={copied ? P.limeDeep : P.inkFaint}
                _hover={{ color: P.limeDeep }}
                transition={`color ${FAST} ${EASE}`}
                aria-label="Copy the address"
              >
                <Icon as={copied ? TbCheck : TbCopy} boxSize={3.5} display="block" />
              </Box>
              <Box
                as="a"
                href={explorerUrl(row.address)}
                target="_blank"
                rel="noopener noreferrer"
                color={P.inkFaint}
                _hover={{ color: P.limeDeep }}
                transition={`color ${FAST} ${EASE}`}
                aria-label="Open on solscan"
              >
                <Icon as={TbExternalLink} boxSize={3.5} display="block" />
              </Box>
            </HStack>
            {row.purpose && (
              <Text fontSize={TYPE.small} color={P.inkMuted} noOfLines={2}>{row.purpose}</Text>
            )}
          </VStack>

          <HStack spacing={3} flexShrink={0}>
            <HStack spacing={2}>
              <Switch
                size="sm"
                isChecked={Boolean(row.published)}
                isDisabled={!canWrite}
                onChange={(event) => onPublish(row, event.target.checked)}
                aria-label="On the public map"
              />
              <Text fontFamily="mono" fontSize={TYPE.micro} color={row.published ? P.limeDeep : P.inkFaint}>
                {row.published ? 'on the map' : 'not on the map'}
              </Text>
            </HStack>
            <Box
              as="button"
              type="button"
              onClick={() => onEdit(row)}
              color={P.inkFaint}
              _hover={{ color: P.ink }}
              transition={`color ${FAST} ${EASE}`}
              aria-label={`Edit ${row.label || row.address}`}
            >
              <Icon as={TbPencil} boxSize={3.5} display="block" />
            </Box>
            <Box
              as="button"
              type="button"
              onClick={() => onRemove(row)}
              color={P.inkFaint}
              _hover={{ color: P.coral }}
              transition={`color ${FAST} ${EASE}`}
              aria-label={`Drop ${row.label || row.address}`}
            >
              <Icon as={TbTrash} boxSize={3.5} display="block" />
            </Box>
          </HStack>
        </HStack>

        {(gaps.length > 0 || badAddress) && (
          <VStack align="start" spacing={0.5}>
            {badAddress && (
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.coral}>
                that address does not read as base58
              </Text>
            )}
            {gaps.length > 0 && (
              <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold}>
                on the map and missing {gaps.join(' and ')}
              </Text>
            )}
          </VStack>
        )}
      </VStack>
    </Plate>
  );
};

const HolderBlock = ({
  holder, rows, canWrite, onAdd, onEdit, onRemove, onPublish, onCopy, copiedId, children,
}) => (
  <VStack align="stretch" spacing={3}>
    <HStack spacing={3} align="center" flexWrap="wrap" rowGap={2}>
      <Face holder={holder} />
      <VStack align="start" spacing={0} minW={0} flex="1 1 240px">
        <HStack spacing={2} align="baseline">
          <Text fontSize={TYPE.section} fontWeight="600" color={P.ink} letterSpacing="-0.01em">
            {holder.name}
          </Text>
          {holder.kind !== 'burro' && <Kicker>{holder.kind}</Kicker>}
        </HStack>
        <Text fontSize={TYPE.small} color={P.inkFaint} noOfLines={1}>{holder.line}</Text>
      </VStack>
      <Box flex={1} h="1px" bg={P.hair} minW="20px" />
      <Text fontFamily="mono" fontSize={TYPE.kicker} color={P.inkFaint}>
        {rows.length}
      </Text>
      {canWrite && holder.key && (
        <Button size="xs" variant="ghost" leftIcon={<Icon as={TbPlus} boxSize={3.5} />} onClick={() => onAdd(holder)}>
          Wallet
        </Button>
      )}
    </HStack>

    {children}

    {rows.length === 0 && !children && (
      <Text fontSize={TYPE.small} color={P.inkMuted}>
        Nobody has written a wallet for {holder.name}.
      </Text>
    )}

    {rows.map((row) => (
      <WalletRow
        key={row.id}
        row={row}
        canWrite={canWrite}
        onEdit={onEdit}
        onRemove={onRemove}
        onPublish={onPublish}
        onCopy={onCopy}
        copied={copiedId === row.id}
      />
    ))}
  </VStack>
);

export default HolderBlock;
