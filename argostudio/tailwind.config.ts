import type { Config } from 'tailwindcss';

/**
 * ARGO Studio — Design System v1.0 (LOCKED)
 * Single source of truth for all visual tokens.
 * Reference docs: /ARGO_STUDIO/03_BRANDING/PALETTE_AND_TYPE.md
 *                 /ARGO_STUDIO/01_SYSTEM_PROMPTS/MOTION_RULES.md
 */

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds — il "vuoto"
        void:      '#000000', // True black — hero, transitions
        obsidian:  '#050507', // Surface primaria (99% screen)
        graphite:  '#0E0E11', // Elevated surfaces, glass base

        // Foregrounds — luminanza
        bone:      '#F5F5F7', // Primary text — titles, body
        pearl:     '#D4D4D8', // Secondary text — subheadings
        smoke:     '#9CA3AF', // Tertiary text — captions, meta
        ash:       '#52525B', // Disabled, placeholder

        // Chrome — materia
        chrome:    '#C7C9CC', // Premium accents, dividers
        mercury:   '#A1A4A8', // Subtle borders, UI ornaments

        // Electric Blue — il segnale
        voltage:   '#3B8EFF', // Primary glow — hover, focus
        plasma:    '#0066FF', // Solid CTAs, primary action
        'deep-blue': '#0033CC', // Pressed state
      },

      fontFamily: {
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Fluid type scale — clamp-based, no media queries needed
        'display-xl': ['clamp(64px, 12vw, 160px)',  { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '500' }],
        'display-l':  ['clamp(48px, 8vw, 112px)',   { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '500' }],
        'display-m':  ['clamp(40px, 6vw, 80px)',    { lineHeight: '1',    letterSpacing: '-0.02em', fontWeight: '500' }],
        'heading-xl': ['clamp(32px, 4vw, 56px)',    { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '500' }],
        'heading-l':  ['clamp(28px, 3.5vw, 44px)',  { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '500' }],
        'heading-m':  ['clamp(22px, 2.5vw, 32px)',  { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '500' }],
        'heading-s':  ['clamp(18px, 2vw, 22px)',    { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '500' }],
        'body-l':     ['18px', { lineHeight: '1.5' }],
        'body-m':     ['16px', { lineHeight: '1.5' }],
        'body-s':     ['14px', { lineHeight: '1.5' }],
        'micro':      ['12px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
      },

      boxShadow: {
        // Voltage glow — use sparingly (max 2-3 active per viewport)
        'glow-subtle': '0 0 24px rgba(59, 142, 255, 0.15)',
        'glow-medium': '0 0 48px rgba(59, 142, 255, 0.25)',
        'glow-strong': '0 0 96px rgba(59, 142, 255, 0.40)',
        'glow-inner':  'inset 0 0 24px rgba(59, 142, 255, 0.10)',
      },

      backdropBlur: {
        glass: '24px',
      },

      transitionTimingFunction: {
        // ARGO cinematic easings — never use Tailwind defaults
        cinematic:    'cubic-bezier(0.6, 0.05, 0.01, 0.95)',
        silk:         'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        inertial:     'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
      },

      transitionDuration: {
        // Fixed duration scale — no arbitrary values
        micro:  '150ms',
        fast:   '300ms',
        base:   '600ms',
        medium: '900ms',
        slow:   '1400ms',
        epic:   '2400ms',
      },

      borderRadius: {
        'argo-sm': '4px',
        'argo-md': '8px',
        'argo-lg': '16px',
        'argo-xl': '24px',
        'argo-2xl': '32px',
      },
    },
  },
  plugins: [],
};

export default config;
