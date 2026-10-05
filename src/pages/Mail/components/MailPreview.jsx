// src/pages/Mail/components/MailPreview.jsx
// The letter as it will land, drawn from the html renderMail returned in
// MailEditor.jsx. This component never builds html of its own. It is handed
// the bytes the door would send and puts them in a frame, and if it ever
// started drawing a letter itself the preview would stop being worth
// looking at. src/lib/mailRender.js is the one renderer.
//
// Desktop and phone. Desktop gives the frame the whole column, which is the
// 600 column on its ground the way Gmail on a laptop shows it. Phone narrows
// the frame to 375, the width of the phone most people open mail on, so the
// wrap of the headline and the cards can be checked before a client sees it.
// The narrow frame sits on the left edge like everything else in Pulse,
// src/theme/layout.js, one left edge and nothing centred.
//
// The frame is sandboxed with no scripts. Links inside it open in a new tab
// so they can be clicked and checked, set on the loaded document and never
// written into the html, which stays exactly what goes out.
//
// No oxford commas, no em dashes.

import { useRef, useEffect, useCallback } from 'react';
import { Box, HStack, Text, Icon } from '@chakra-ui/react';
import { TbDeviceDesktop, TbDeviceMobile, TbMailFast } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE, PLATE_RADIUS, EASE, FAST } from '../../../theme/layout';
import { Kicker } from '../../../components/common/Page';

const P = colors.paper;

const Toggle = ({ active, icon, children, onClick }) => (
  <HStack
    as="button"
    type="button"
    onClick={onClick}
    spacing={1.5}
    px={2.5}
    h="28px"
    borderRadius="full"
    bg={active ? P.sunken : 'transparent'}
    color={active ? P.ink : P.inkMuted}
    transition={`all ${FAST} ${EASE}`}
    _hover={{ color: P.ink }}
  >
    <Icon as={icon} boxSize={3.5} />
    <Text fontSize={TYPE.label} fontWeight={active ? '600' : '500'}>{children}</Text>
  </HStack>
);

const MailPreview = ({ html, width = 'desktop', onWidth, label = 'Exact preview' }) => {
  const frame = useRef(null);

  const fit = useCallback(() => {
    const el = frame.current;
    if (!el) return;
    try {
      const doc = el.contentDocument;
      if (!doc?.body) return;
      doc.querySelectorAll('a[href]').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
      el.style.height = `${doc.documentElement.scrollHeight}px`;
    } catch {
      // A frame we cannot read keeps its last height.
    }
  }, []);

  useEffect(() => {
    const t1 = setTimeout(fit, 60);
    const t2 = setTimeout(fit, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [html, width, fit]);

  return (
    <Box>
      <HStack justify="space-between" mb={3} flexWrap="wrap" rowGap={2}>
        <HStack spacing={2}>
          <Icon as={TbMailFast} boxSize={3.5} color={P.limeDeep} />
          <Kicker>{label}</Kicker>
        </HStack>
        {onWidth && (
          <HStack spacing={1}>
            <Toggle active={width === 'desktop'} icon={TbDeviceDesktop} onClick={() => onWidth('desktop')}>Desktop</Toggle>
            <Toggle active={width === 'phone'} icon={TbDeviceMobile} onClick={() => onWidth('phone')}>Phone</Toggle>
          </HStack>
        )}
      </HStack>
      <Box
        borderRadius={PLATE_RADIUS}
        overflow="hidden"
        border="1px solid"
        borderColor={P.hair}
        bg={P.sunken}
      >
        <Box
          ref={frame}
          as="iframe"
          title="The letter as it will land"
          srcDoc={html}
          onLoad={fit}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          display="block"
          w={width === 'phone' ? '375px' : '100%'}
          maxW="100%"
          minH="480px"
          border="none"
        />
      </Box>
    </Box>
  );
};

export default MailPreview;
