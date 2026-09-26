// src/components/common/HolderFace.jsx
// SENTINEL: NB_HOLDER_FACE_V1
//
// The one way a holder's face is drawn in Pulse.
//
// ── A BURRO IS NEVER NAMED WITHOUT A FACE ───────────────────────────────────
// Tyler's rule, 2026-09-12. Anywhere a burro or an agent is named, the avatar
// is beside the name. The holder objects come from src/data/walletHolders.js
// and carry the url. A treasury holder is not a burro, has no face on purpose
// and gets a plain disc with its initial so the row still has something to
// aim at.
//
// ── WHY IT IS ITS OWN FILE ──────────────────────────────────────────────────
// This was written inside src/pages/Wallets/components/HolderBlock.jsx first.
// The payouts room needs the same face beside the same names, and a second
// copy of the fallback logic is a second answer to what happens when
// neonburro.com is slow, so it moved here and HolderBlock imports it. Both
// rooms now fail the same way. If a third room needs a holder's face it
// imports this and does not write its own.
//
// ── THE FALLBACK IS NOT A BROKEN IMAGE ──────────────────────────────────────
// The avatar is served from neonburro.com because Pulse does not carry copies
// of the portraits and should not. A cold load can fail, so this is an img
// with a fallback to the same disc rather than a broken picture icon. A burro
// with a plain face is better than a burro with a torn one.
//
// No width and no font size of its own beyond the disc itself, which is a
// fixed 28px because it sits on a text baseline. No oxford commas, no em
// dashes.

import { useState } from 'react';
import { Box, Text, Image } from '@chakra-ui/react';
import colors from '../../theme/colors';
import { TYPE } from '../../theme/layout';

const P = colors.paper;

export const HolderDisc = ({ name, size = '28px' }) => (
  <Box
    w={size}
    h={size}
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

const HolderFace = ({ holder, size = '28px' }) => {
  const [broke, setBroke] = useState(false);
  if (!holder?.avatar || broke) return <HolderDisc name={holder?.name} size={size} />;
  return (
    <Image
      src={holder.avatar}
      alt={holder.name}
      w={size}
      h={size}
      borderRadius="full"
      objectFit="cover"
      flexShrink={0}
      bg={P.sunken}
      onError={() => setBroke(true)}
    />
  );
};

export default HolderFace;
