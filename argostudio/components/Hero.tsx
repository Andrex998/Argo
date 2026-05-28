'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { durations } from '@/motion/durations';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSceneStore } from '@/stores/sceneStore';
import { splitTextIntoWords } from '@/lib/splitText';

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

  const prefersReducedMotion = useReducedMotion();
  const { cameraRef, monolithRef } = useSceneStore();

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        gsap.set(
          [
            eyebrowRef.current,
            headlineRef.current,
            subRef.current,
            ctaPrimaryRef.current,
            ctaSecondaryRef.current,
            scrollIndicatorRef.current,
          ],
          { opacity: 1, y: 0, filter: 'blur(0px)' }
        );
        return;
      }

      // ── Entrance timeline ──────────────────────────────────────────────
      const headlineWords = splitTextIntoWords(headlineRef.current);

      gsap.set(
        [
          eyebrowRef.current,
          subRef.current,
          ctaPrimaryRef.current,
          ctaSecondaryRef.current,
          scrollIndicatorRef.current,
        ],
        { opacity: 0, y: 32, filter: 'blur(12px)' }
      );
      gsap.set(headlineWords, { opacity: 0, y: 32, filter: 'blur(12px)' });

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
        .to(scrollIndicatorRef.current, {
          opacity: 0.4, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'smoothOut',
        }, 2.4)
        .to(scrollIndicatorRef.current, {
          opacity: 0.9, duration: durations.slow, ease: 'cinematic',
          repeat: -1, yoyo: true,
        }, '>');

      // ── Spatial Penetration: pin hero + fly camera through the monolith ─
      // Camera travels z: 4 → -2, passing through the glass geometry.
      // Typography distorts naturally through MeshTransmissionMaterial
      // as the lens crosses the glass surface. Text fades as it enters.
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

      // Camera flies forward through the monolith — full pin duration
      if (cameraRef?.current) {
        scrollTl.to(cameraRef.current.position, { z: -2, duration: 1, ease: 'none' }, 0);
      }

      // Monolith scales subtly as camera approaches — full pin duration
      if (monolithRef?.current) {
        scrollTl.to(
          monolithRef.current.scale,
          { x: 1.08, y: 1.08, z: 1.08, duration: 1, ease: 'none' },
          0
        );
      }

      // Text holds at full opacity for the first 25% of the pin (read window),
      // then fades 25% → 70%. The brand statement gets time to land before the
      // glass crosses the lens.
      scrollTl.to(
        textBlockRef.current,
        { opacity: 0, duration: 0.45, ease: 'none' },
        0.25
      );
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion, cameraRef, monolithRef] }
  );

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen w-full overflow-hidden"
    >
      <div
        ref={textBlockRef}
        className="relative z-10 flex h-screen flex-col items-center justify-start pt-[15vh] px-6"
      >
        {/* Eyebrow */}
        <span
          ref={eyebrowRef}
          className="font-mono text-micro uppercase tracking-[0.16em] text-voltage mb-14 md:mb-16"
        >
          ARGO Studio
        </span>

        {/* Monumental headline */}
        <h1
          ref={headlineRef}
          className="font-display text-display-xl text-bone text-center max-w-4xl"
          style={{ letterSpacing: '-0.04em', lineHeight: '0.95', fontWeight: 500 }}
        >
          We don&apos;t build pages.
          <br />
          <span ref={headlineAccentRef} className="text-voltage">
            We build presence.
          </span>
        </h1>

        {/* Sub — isolated in the void */}
        <p
          ref={subRef}
          className="mt-20 md:mt-24 font-body text-body-l text-pearl text-center max-w-md"
          style={{ lineHeight: '1.5' }}
        >
          Cinematic web experiences for future-forward brands.
        </p>

        {/* CTA group — System Commands, not buttons */}
        <div
          ref={ctaGroupRef}
          className="mt-20 md:mt-24 flex flex-col items-center gap-8 sm:flex-row sm:gap-12"
        >
          <a
            ref={ctaPrimaryRef}
            href="#contact"
            className="font-mono text-xs uppercase tracking-widest text-pearl border-b border-white/10 pb-1 transition-all duration-700 hover:text-voltage hover:border-voltage/50"
          >
            Start a project
          </a>

          <a
            ref={ctaSecondaryRef}
            href="#manifesto"
            className="font-mono text-xs uppercase tracking-widest text-smoke border-b border-white/[0.06] pb-1 transition-all duration-700 hover:text-pearl hover:border-white/20"
          >
            Our manifesto
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 pointer-events-none"
      >
        <div className="w-px h-8 bg-gradient-to-b from-transparent to-smoke" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-smoke">
          Scroll
        </span>
      </div>
    </section>
  );
}
