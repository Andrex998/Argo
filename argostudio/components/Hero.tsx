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

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.5,
        },
      });

      scrollTl.to(textBlockRef.current, { y: -80, ease: 'none' }, 0);

      if (cameraRef?.current) {
        scrollTl.to(cameraRef.current.position, { z: 3.2, ease: 'none' }, 0);
      }

      if (monolithRef?.current) {
        scrollTl.to(
          monolithRef.current.scale,
          { x: 1.15, y: 1.15, z: 1.15, ease: 'none' },
          0
        );
      }
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
        className="relative z-10 flex h-screen flex-col items-center justify-center px-6 pb-[18vh]"
      >
        <span
          ref={eyebrowRef}
          className="font-mono text-micro uppercase tracking-[0.16em] text-voltage mb-8 md:mb-10"
        >
          ARGO Studio
        </span>

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

        <p
          ref={subRef}
          className="mt-8 md:mt-10 font-body text-body-l text-pearl text-center max-w-md"
          style={{ lineHeight: '1.5' }}
        >
          Cinematic web experiences for future-forward brands.
        </p>

        <div
          ref={ctaGroupRef}
          className="mt-12 md:mt-14 flex flex-col items-center gap-4 sm:flex-row sm:gap-6"
        >
          <a
            ref={ctaPrimaryRef}
            href="#contact"
            className="inline-flex items-center gap-3 rounded-argo-2xl glass-default px-7 py-3.5 text-bone transition-all duration-fast ease-silk hover:shadow-glow-subtle hover:scale-[1.02]"
          >
            <span className="font-body text-body-m">Start a project</span>
            <span className="text-voltage" aria-hidden="true">→</span>
          </a>

          <a
            ref={ctaSecondaryRef}
            href="#manifesto"
            className="inline-flex items-center gap-2 px-4 py-3 font-mono text-micro uppercase tracking-[0.12em] text-pearl transition-colors duration-fast ease-silk hover:text-voltage"
          >
            <span>Our manifesto</span>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>

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
