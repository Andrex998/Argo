'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import { easings } from '@/motion/easings';
import { durations } from '@/motion/durations';

/**
 * Hero Section — ARGO Studio Website V1
 *
 * MOTION (Claude — Framer Motion, component-presence layer).
 * GSAP scroll-storytelling refs are preserved for Gemini's ScrollTrigger
 * handoff (camera dolly into the monolith, Lenis smooth scroll inertia).
 *
 * Reveal timeline (3-second rule budget, everything settled by ~2.9s):
 *   t=0.2s   eyebrow fades in
 *   t=0.8s   headline line 1 begins word-by-word stagger (0.12s, cinematic 1.4s)
 *   t=1.2s   headline line 2 (voltage accent) begins (overlaps the cascade)
 *   t=1.4s   sub fades in under the still-rising headline
 *   t=2.0s   CTA group rises (settles 2.9s)
 *   t=2.4s   scroll indicator emerges and starts silk pulse loop
 *
 * Stagger nesting is explicit: framer-motion's `staggerChildren` only
 * orchestrates direct motion children, so each level (section → headline →
 * line → words) declares its own staggering variant.
 *
 * GSAP anchors preserved: sectionRef, eyebrowRef, headlineRef,
 * headlineAccentRef, subRef, ctaGroupRef, ctaPrimaryRef, ctaSecondaryRef,
 * scrollIndicatorRef.
 */

const HEADLINE_LINE_1 = ['We', "don't", 'build', 'pages.'];
const HEADLINE_LINE_2 = ['We', 'build', 'presence.'];

/* ── Section-level orchestration (eyebrow → headline → sub → cta) ──
 * staggerChildren=0.6 spreads the 4 top-level reveals so sub doesn't
 * collide with the second headline line. CTA lands at ~t=2.0s. */
const sectionStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.6,
    },
  },
};

/* ── Headline-level orchestration (line 1 → line 2) ──
 * 0.4s between lines: line 2 begins as line 1's last word is mid-rise,
 * producing a continuous monumental cascade with no dead pause. */
const headlineStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.4,
    },
  },
};

/* ── Line-level orchestration (word by word, the doc-prescribed 0.12s) ── */
const lineStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

/* ── Word reveal: mask-clipped rise on the cinematic curve, slow 1.4s ── */
const wordRise: Variants = {
  hidden: {
    y: '110%',
    opacity: 0,
  },
  visible: {
    y: '0%',
    opacity: 1,
    transition: {
      duration: durations.slow,
      ease: [...easings.cinematic],
    },
  },
};

/* ── Generic fade-up + blur-in for accessory elements ── */
const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
    filter: 'blur(8px)',
  },
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
      className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-[18vh] text-center"
    >
      <motion.div
        style={{ opacity: contentOpacity, y: contentY, filter: contentBlur }}
        className="relative flex flex-col items-center"
        variants={sectionStagger}
        initial="hidden"
        animate="visible"
      >
        {/* ── Eyebrow label ── */}
        <motion.span
          ref={eyebrowRef}
          variants={fadeUp}
          className="font-mono text-micro uppercase tracking-widest text-voltage mb-10"
        >
          ARGO Studio
        </motion.span>

        {/* ── Monumental headline — nested stagger: lines → words ── */}
        <motion.h1
          ref={headlineRef}
          variants={headlineStagger}
          className="font-display text-display-xl text-bone max-w-5xl"
        >
          <HeadlineLine words={HEADLINE_LINE_1} />
          <HeadlineLine
            words={HEADLINE_LINE_2}
            accentRef={headlineAccentRef}
            className="text-voltage"
          />
        </motion.h1>

        {/* ── Sub ── */}
        <motion.p
          ref={subRef}
          variants={fadeUp}
          className="mt-10 font-body text-body-l text-pearl max-w-xl"
        >
          Cinematic web experiences for future-forward brands.
        </motion.p>

        {/* ── CTA group ── */}
        <motion.div
          ref={ctaGroupRef}
          variants={fadeUp}
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

      {/* ── Scroll indicator — independent fade-in, continuous silk pulse ── */}
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

/* ─────────────────────────────────────────────────────────────────────
 * HeadlineLine — one line of the monumental headline.
 * Each word is a direct motion child of a line-level staggering span,
 * so framer-motion's per-word stagger fires correctly. Mask via
 * overflow-hidden on the line wrapper; words rise from y:110% into place.
 * ──────────────────────────────────────────────────────────────────── */
function HeadlineLine({
  words,
  className,
  accentRef,
}: {
  words: string[];
  className?: string;
  accentRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <motion.span
      ref={accentRef}
      variants={lineStagger}
      className={`block overflow-hidden pb-[0.12em] ${className ?? ''}`}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={wordRise}
          className="inline-block will-change-transform"
        >
          {word}
          {i < words.length - 1 && ' '}
        </motion.span>
      ))}
    </motion.span>
  );
}
