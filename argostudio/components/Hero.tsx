'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import { easings } from '@/motion/easings';
import { durations } from '@/motion/durations';

/**
 * Hero Section — ARGO Studio Website V1
 *
 * MOTION LAYERS (Claude — Framer Motion, component-presence layer):
 *   1. Eyebrow            → fade + blur in, `base`, smoothOut
 *   2. Headline (line 1)  → word-by-word, stagger 0.12s, `slow`, cinematic
 *   3. Headline (line 2)  → word-by-word, continues stagger, voltage accent
 *   4. Sub                → fade + blur in, `medium`, smoothOut, delayed
 *   5. CTA group          → slide up + glass glow, `medium`, smoothOut, delayed
 *   6. Scroll indicator   → late fade in, continuous pulse (CSS)
 *
 * SCROLL LAYER (Claude — Framer Motion useScroll, hand-off ready):
 *   - Hero content fades to 0 and blurs out as user scrolls past hero.
 *   - Camera dolly into the monolith is reserved for Gemini (ScrollTrigger).
 *
 * GSAP ANCHORS (preserved for Gemini scroll-storytelling integration):
 *   sectionRef, eyebrowRef, headlineRef, headlineAccentRef,
 *   subRef, ctaGroupRef, ctaPrimaryRef, ctaSecondaryRef, scrollIndicatorRef
 *
 * Reference: /motion/easings.ts, /motion/durations.ts, MOTION_RULES.md
 */

const HEADLINE_LINE_1 = ['We', "don't", 'build', 'pages.'];
const HEADLINE_LINE_2 = ['We', 'build', 'presence.'];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const wordVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 48,
    filter: 'blur(12px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: durations.slow,
      ease: [...easings.cinematic],
    },
  },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: durations.medium,
      ease: [...easings.smoothOut],
    },
  },
};

export default function Hero() {
  /* ── GSAP anchor refs (preserved for Gemini ScrollTrigger handoff) ── */
  const sectionRef         = useRef<HTMLElement>(null);
  const eyebrowRef         = useRef<HTMLSpanElement>(null);
  const headlineRef        = useRef<HTMLHeadingElement>(null);
  const headlineAccentRef  = useRef<HTMLSpanElement>(null);
  const subRef             = useRef<HTMLParagraphElement>(null);
  const ctaGroupRef        = useRef<HTMLDivElement>(null);
  const ctaPrimaryRef      = useRef<HTMLAnchorElement>(null);
  const ctaSecondaryRef    = useRef<HTMLAnchorElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  /* ── Scroll-driven fade: content recedes as user scrolls past hero ── */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  // Respect parallax rule: max 20% offset (translate stays small)
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const contentY       = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);
  const contentBlur    = useTransform(
    scrollYProgress,
    [0, 0.6],
    ['blur(0px)', 'blur(8px)'],
  );

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      <motion.div
        style={{ opacity: contentOpacity, y: contentY, filter: contentBlur }}
        className="relative flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Eyebrow label ── */}
        <motion.span
          ref={eyebrowRef}
          variants={fadeUpVariants}
          className="font-mono text-micro uppercase tracking-widest text-voltage mb-10"
        >
          ARGO Studio
        </motion.span>

        {/* ── Monumental headline — word-by-word cinematic reveal ── */}
        <h1
          ref={headlineRef}
          className="font-display text-display-xl text-bone max-w-5xl"
        >
          <span className="block overflow-hidden pb-[0.12em]">
            {HEADLINE_LINE_1.map((word, i) => (
              <motion.span
                key={`l1-${i}`}
                variants={wordVariants}
                className="inline-block will-change-transform"
              >
                {word}
                {i < HEADLINE_LINE_1.length - 1 && ' '}
              </motion.span>
            ))}
          </span>
          <span
            ref={headlineAccentRef}
            className="block overflow-hidden pb-[0.12em] text-voltage"
          >
            {HEADLINE_LINE_2.map((word, i) => (
              <motion.span
                key={`l2-${i}`}
                variants={wordVariants}
                className="inline-block will-change-transform"
              >
                {word}
                {i < HEADLINE_LINE_2.length - 1 && ' '}
              </motion.span>
            ))}
          </span>
        </h1>

        {/* ── Sub ── */}
        <motion.p
          ref={subRef}
          variants={fadeUpVariants}
          className="mt-10 font-body text-body-l text-pearl max-w-xl"
        >
          Cinematic web experiences for future-forward brands.
        </motion.p>

        {/* ── CTA group ── */}
        <motion.div
          ref={ctaGroupRef}
          variants={fadeUpVariants}
          className="mt-16 flex flex-col items-center gap-4 sm:flex-row"
        >
          <a
            ref={ctaPrimaryRef}
            href="#contact"
            className="group relative inline-flex items-center gap-3 rounded-argo-2xl glass-default px-8 py-4 text-bone transition-all duration-fast ease-silk hover:shadow-glow-medium hover:scale-[1.02]"
          >
            <span className="font-body text-body-m">Start a project</span>
            <span
              className="text-voltage transition-transform duration-fast ease-silk group-hover:translate-x-1"
              aria-hidden="true"
            >
              →
            </span>
          </a>

          <a
            ref={ctaSecondaryRef}
            href="#manifesto"
            className="inline-flex items-center gap-3 px-8 py-4 text-pearl transition-colors duration-fast ease-silk hover:text-voltage"
          >
            <span className="font-body text-body-m">Our manifesto</span>
          </a>
        </motion.div>
      </motion.div>

      {/* ── Scroll indicator — independent fade-in, continuous pulse ── */}
      <motion.div
        ref={scrollIndicatorRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: durations.base,
          delay: 2.4,
          ease: [...easings.smoothOut],
        }}
        style={{ opacity: contentOpacity }}
        className="absolute bottom-12 flex flex-col items-center gap-3"
      >
        <motion.span
          aria-hidden="true"
          animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.6, 1, 0.6] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: [...easings.silk],
          }}
          className="block w-px h-8 origin-top bg-gradient-to-b from-voltage to-transparent"
        />
        <span className="font-mono text-micro uppercase tracking-widest text-smoke">
          Scroll
        </span>
      </motion.div>
    </section>
  );
}
