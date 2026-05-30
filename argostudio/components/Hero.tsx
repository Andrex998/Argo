'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { durations } from '@/motion/durations';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { splitTextIntoWords } from '@/lib/splitText';
import WireframeGem from '@/components/WireframeGem';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function Hero() {
  const sectionRef         = useRef<HTMLElement>(null);
  const eyebrowRef         = useRef<HTMLSpanElement>(null);
  const headlineRef        = useRef<HTMLHeadingElement>(null);
  const headlineAccentRef  = useRef<HTMLSpanElement>(null);
  const subRef             = useRef<HTMLParagraphElement>(null);
  const ctaGroupRef        = useRef<HTMLDivElement>(null);
  const ctaPrimaryRef      = useRef<HTMLAnchorElement>(null);
  const ctaSecondaryRef    = useRef<HTMLAnchorElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const textBlockRef       = useRef<HTMLDivElement>(null);
  const gemsRef            = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        gsap.set(
          [eyebrowRef.current, headlineRef.current, subRef.current,
           ctaPrimaryRef.current, ctaSecondaryRef.current, scrollIndicatorRef.current],
          { opacity: 1, y: 0, filter: 'blur(0px)' }
        );
        return;
      }

      // ── Entrance timeline ──────────────────────────────────────────────
      const headlineWords = splitTextIntoWords(headlineRef.current);

      gsap.set(
        [eyebrowRef.current, subRef.current, ctaPrimaryRef.current,
         ctaSecondaryRef.current, scrollIndicatorRef.current],
        { opacity: 0, y: 32, filter: 'blur(12px)' }
      );
      gsap.set(headlineWords, { opacity: 0, y: 32, filter: 'blur(12px)' });
      gsap.set(gemsRef.current, { opacity: 0 });

      const tl = gsap.timeline();

      tl.to(eyebrowRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'smoothOut',
        }, 0.3)
        .to(headlineWords, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.slow, ease: 'cinematic', stagger: 0.12,
        }, 0.6)
        .to(subRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.medium, ease: 'cinematic',
        }, 1.4)
        .to([ctaPrimaryRef.current, ctaSecondaryRef.current], {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'silk', stagger: 0.08,
        }, 1.8)
        .to(gemsRef.current, {
          opacity: 1, duration: durations.slow, ease: 'cinematic',
        }, 1.0)
        .to(scrollIndicatorRef.current, {
          opacity: 0.4, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'smoothOut',
        }, 2.4)
        .to(scrollIndicatorRef.current, {
          opacity: 0.9, duration: durations.slow, ease: 'cinematic',
          repeat: -1, yoyo: true,
        }, '>');

      // ── Scroll-bound text fade ─────────────────────────────────────────
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=200%',
          scrub: 1.5,
          pin: true,
          pinSpacing: true,
        },
      });

      scrollTl.to(textBlockRef.current, { opacity: 0, duration: 0.45, ease: 'none' }, 0.25);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen w-full overflow-hidden"
    >
      {/* Wireframe crystal cluster — right side decoration */}
      <div
        ref={gemsRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        {/* Large gem — right center */}
        <WireframeGem
          size={320}
          speed={0.006}
          initialAngle={0.4}
          style={{ position: 'absolute', top: '18%', right: '8%', opacity: 0.75 }}
        />
        {/* Medium gem — upper right */}
        <WireframeGem
          size={180}
          speed={0.009}
          initialAngle={1.8}
          color="#9fffcf"
          style={{ position: 'absolute', top: '6%', right: '28%', opacity: 0.5 }}
        />
        {/* Small gem — lower right */}
        <WireframeGem
          size={120}
          speed={0.012}
          initialAngle={3.2}
          color="#61FFA7"
          style={{ position: 'absolute', top: '60%', right: '16%', opacity: 0.4 }}
        />
      </div>

      <div
        ref={textBlockRef}
        className="relative z-10 flex h-screen flex-col items-start justify-start pt-[18vh] px-6 md:px-12 lg:px-24 max-w-3xl"
      >
        {/* Eyebrow */}
        <span
          ref={eyebrowRef}
          className="font-mono text-micro uppercase tracking-[0.16em] text-voltage mb-14 md:mb-16"
        >
          ARGO Studio
        </span>

        {/* Monumental headline — left-aligned */}
        <h1
          ref={headlineRef}
          className="font-display text-display-xl text-bone"
          style={{ letterSpacing: '-0.04em', lineHeight: '0.95', fontWeight: 500 }}
        >
          We design digital experiences
          <br />
          <span ref={headlineAccentRef} className="text-voltage">
            that set new standards.
          </span>
        </h1>

        {/* Sub */}
        <p
          ref={subRef}
          className="mt-16 md:mt-20 font-body text-body-l text-pearl max-w-sm"
          style={{ lineHeight: '1.5' }}
        >
          Cinematic web experiences for future-forward brands.
        </p>

        {/* CTA group */}
        <div
          ref={ctaGroupRef}
          className="mt-16 md:mt-20 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-12"
        >
          <a
            ref={ctaPrimaryRef}
            href="#contact"
            className="font-mono text-xs uppercase tracking-widest text-pearl border-b border-white/10 pb-1 transition-all duration-700 hover:text-voltage hover:border-voltage/50"
          >
            Start a project →
          </a>

          <a
            ref={ctaSecondaryRef}
            href="#work"
            className="font-mono text-xs uppercase tracking-widest text-smoke border-b border-white/[0.06] pb-1 transition-all duration-700 hover:text-pearl hover:border-white/20"
          >
            View our work
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-10 left-6 md:left-12 lg:left-24 z-10 flex flex-col items-start gap-3 pointer-events-none"
      >
        <div className="w-px h-8 bg-gradient-to-b from-transparent to-smoke" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-smoke">
          Scroll
        </span>
      </div>
    </section>
  );
}
