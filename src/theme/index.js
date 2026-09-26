// src/theme/index.js
// NeonBurro Pulse, the Chakra UI v2 theme. Aligned to the marketing brand
// canon. Topo Lime primary, Rubik, warm cream paper.
//
// ── V3, 2026-09-25. THE FIELDS AND THE BUTTONS READ layout.js ───────────────
// Input, Textarea and Select default to a paper variant built from INPUT and
// TEXTAREA in src/theme/layout.js, so a bare <Input> in any page carries the
// one inset, the one height, the one radius and the one placeholder colour.
// Button sizes come from BUTTON there, one height and one padding per size,
// and the variants are painted on Paper. A page never restates these. Five
// pages used to carry their own copy of an input style, that is the drift
// this closes. The old naked underline variant stays available by name.
//
// The Select keeps its right padding wide so the chevron never sits on the
// value, that is the only place the inset is not symmetric.
//
// No oxford commas, no em dashes.

import { extendTheme } from '@chakra-ui/react';
import colors from './colors';
import typography from './typography';
import {
  INPUT, TEXTAREA, BUTTON, FIELD_H, FIELD_H_SM, FIELD_RADIUS, INSET, TYPE, EASE, FAST,
} from './layout';

const P = colors.paper;

const motion = {
  standard: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '320ms cubic-bezier(0.4, 0, 0.2, 1)',
  sheet: '320ms cubic-bezier(0.16, 1, 0.3, 1)',
};

// The height rides on the size so size="sm" works, everything else rides on
// the variant. Chakra merges base, then size, then variant.
const { h: fieldHeight, ...FIELD } = INPUT;
const { h: areaHeight, minH: areaMinH, ...AREA } = TEXTAREA;

const theme = extendTheme({
  config: { initialColorMode: 'dark', useSystemColorMode: false },

  colors,

  fonts: typography.fonts,
  fontSizes: typography.fontSizes,
  fontWeights: typography.fontWeights,
  lineHeights: typography.lineHeights,
  letterSpacings: typography.letterSpacings,
  textStyles: typography.textStyles,

  breakpoints: { base: '0px', sm: '640px', md: '1024px', lg: '1440px', xl: '1920px' },

  radii: {
    none: '0', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px', full: '9999px',
  },

  shadows: {
    none: 'none',
    card: '0 2px 8px rgba(0, 0, 0, 0.3)',
    modal: '0 16px 64px rgba(0, 0, 0, 0.5)',
    sheet: '0 -8px 32px rgba(0, 0, 0, 0.4)',
    focus: '0 0 0 2px rgba(197, 217, 87, 0.4)',
    glow:  '0 0 20px rgba(197, 217, 87, 0.25)',
  },

  motion,

  styles: {
    global: {
      'html, body': {
        bg: 'paper.mat',
        color: 'text.primary',
        fontFamily: 'body',
        fontSize: 'md',
        lineHeight: 'base',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      },
      'body': { minHeight: '100dvh' },
      '*::selection': {
        bg: 'rgba(197, 217, 87, 0.35)',
        color: 'paper.ink',
      },
      '::-webkit-scrollbar': { width: '8px', height: '8px', bg: 'transparent' },
      '::-webkit-scrollbar-thumb': {
        bg: 'rgba(36,26,22,0.24)', borderRadius: '4px', _hover: { bg: 'rgba(36,26,22,0.42)' },
      },
      'code, kbd, pre, samp': { fontFamily: 'mono' },
      a: { textDecoration: 'none', _hover: { textDecoration: 'none' } },
      '@keyframes pulse': {
        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
        '50%': { opacity: 0.6, transform: 'scale(1.05)' },
      },
      '@keyframes fadeIn': {
        '0%': { opacity: 0, transform: 'translateY(8px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
      '@keyframes slideUp': {
        '0%': { transform: 'translateY(100%)' },
        '100%': { transform: 'translateY(0)' },
      },
    },
  },

  components: {
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: 'full',
        letterSpacing: '-0.01em',
        transition: `all ${FAST} ${EASE}`,
        _focus: { boxShadow: 'none' },
        _focusVisible: { boxShadow: 'focus' },
      },
      sizes: {
        xs: BUTTON.xs,
        sm: BUTTON.sm,
        md: BUTTON.md,
        lg: BUTTON.lg,
      },
      variants: {
        solid: {
          bg: P.lime, color: P.limeInk,
          _hover: {
            bg: P.limeDeep, color: P.sheet, transform: 'translateY(-1px)',
            _disabled: { bg: P.lime, color: P.limeInk, transform: 'none' },
          },
          _active: { transform: 'scale(0.98)' },
          _disabled: { opacity: 0.45, cursor: 'not-allowed' },
        },
        outline: {
          bg: P.sheet, borderColor: P.hair, color: P.ink,
          _hover: { borderColor: P.inkFaint, bg: P.sunken },
          _active: { transform: 'scale(0.98)' },
        },
        ghost: {
          color: P.inkMuted,
          _hover: { bg: P.sunken, color: P.ink },
          _active: { transform: 'scale(0.98)' },
        },
        neon: {
          bg: 'transparent', color: P.limeDeep, borderWidth: '1px', borderColor: P.limeDeep,
          _hover: { bg: `${P.lime}22` },
          _active: { transform: 'scale(0.98)' },
        },
        destructive: {
          bg: P.coral, color: P.sheet,
          _hover: { bg: '#A8362A', transform: 'translateY(-1px)' },
          _active: { transform: 'scale(0.98)' },
        },
      },
      defaultProps: { size: 'md', variant: 'solid' },
    },

    Input: {
      sizes: {
        sm: { field: { h: FIELD_H_SM, fontSize: TYPE.small, px: INSET, borderRadius: FIELD_RADIUS } },
        md: { field: { h: FIELD_H, fontSize: TYPE.body, px: INSET, borderRadius: FIELD_RADIUS } },
      },
      variants: {
        paper: { field: FIELD },
        naked: {
          field: {
            bg: 'transparent', border: 'none', borderBottom: '1px solid',
            borderColor: P.hair, borderRadius: 0, px: 0, fontSize: TYPE.body,
            color: P.ink, transition: motion.fast,
            _placeholder: { color: P.inkFaint },
            _hover: { borderColor: P.inkFaint },
            _focus: { borderColor: P.limeDeep, boxShadow: 'none', outline: 'none' },
            _focusVisible: { borderColor: P.limeDeep, boxShadow: 'none', outline: 'none' },
          },
        },
      },
      defaultProps: { variant: 'paper', size: 'md' },
    },

    Textarea: {
      sizes: {
        sm: { fontSize: TYPE.small, px: INSET, borderRadius: FIELD_RADIUS, minH: '72px' },
        md: { fontSize: TYPE.body, px: INSET, borderRadius: FIELD_RADIUS, minH: areaMinH },
      },
      variants: {
        paper: AREA,
      },
      defaultProps: { variant: 'paper', size: 'md' },
    },

    Select: {
      sizes: {
        sm: { field: { h: FIELD_H_SM, fontSize: TYPE.small, pl: INSET, pr: 8, borderRadius: FIELD_RADIUS } },
        md: { field: { h: FIELD_H, fontSize: TYPE.body, pl: INSET, pr: 8, borderRadius: FIELD_RADIUS } },
      },
      variants: {
        paper: {
          field: { ...FIELD, px: undefined, pl: INSET, pr: 8, '> option': { bg: P.sheet, color: P.ink } },
          icon: { color: P.inkMuted },
        },
      },
      defaultProps: { variant: 'paper', size: 'md' },
    },

    // Text INHERITS its color. It used to force text.primary (a near white),
    // which overrode any color set on a parent, so a <Text> inside an HStack
    // that set color would still render near white, the white on cream bug on
    // little labels like View all. Inheriting means a Text takes the nearest
    // ancestor color: the AppShell main sets paper.ink for the whole authed
    // app, colored rows pass their own color down, and dark surfaces still set
    // a light color at their root. Set an explicit color on a Text only when
    // it differs from its surroundings.
    Text: { baseStyle: { color: 'inherit' } },
  },
});

export default theme;
