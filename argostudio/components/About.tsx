'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { durations } from '@/motion/durations';
import { useReducedMotion } from '@/hooks/useReducedMotion';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function About() {
  const sectionRef  = useRef<HTMLElement>(null);
  const labelRef    = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const bodyRef     = useRef<HTMLDivElement>(null);
  const reelRef     = useRef<HTMLAnchorElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const els = [labelRef.current, headlineRef.current, bodyRef.current, reelRef.current];

      if (prefersReducedMotion) {
        gsap.set(els, { opacity: 1, y: 0, filter: 'blur(0px)' });
        return;
      }

      gsap.set(els, { opacity: 0, y: 32, filter: 'blur(12px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      });

      tl.to(labelRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'smoothOut',
        }, 0)
        .to(headlineRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.slow, ease: 'cinematic',
        }, 0.15)
        .to(bodyRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.medium, ease: 'cinematic',
        }, 0.5)
        .to(reelRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'silk',
        }, 0.85);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative px-6 py-40 md:px-12 lg:px-24"
    >
      <div className="grid grid-cols-1 gap-20 lg:grid-cols-2 lg:gap-32">
        {/* Left — headline column */}
        <div className="flex flex-col justify-start">
          <span
            ref={labelRef}
            className="font-mono text-micro uppercase tracking-[0.16em] text-voltage mb-10"
          >
            About
          </span>
          <h2
            ref={headlineRef}
            className="font-display text-display-l text-bone"
            style={{ letterSpacing: '-0.04em', lineHeight: '0.96', fontWeight: 500 }}
          >
            We build more than websites.
            <br />
            <span className="text-voltage">We build legacies.</span>
          </h2>
        </div>

        {/* Right — body column */}
        <div ref={bodyRef} className="flex flex-col justify-end gap-10 pt-2 lg:pt-[5.5rem]">
          <p className="font-body text-body-l text-pearl" style={{ lineHeight: '1.6' }}>
            ARGO is a boutique studio at the intersection of design, motion, and
            technology. We work exclusively with brands that demand the extraordinary —
            luxury hospitality, premium real estate, fashion, and the boldest new startups.
          </p>
          <p className="font-body text-body-m text-smoke" style={{ lineHeight: '1.65' }}>
            Every project begins with a single question: what is this brand&apos;s most
            powerful form? From that answer we build backwards — into code, into motion,
            into every frame of the experience.
          </p>

          {/* Play Reel — system command, no button frame */}
          <a
            ref={reelRef}
            href="#reel"
            className="group inline-flex items-center gap-4 font-mono text-xs uppercase tracking-widest text-pearl border-b border-white/10 pb-1 w-fit transition-all duration-700 hover:text-voltage hover:border-voltage/40"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-voltage opacity-60 group-hover:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-voltage" />
            </span>
            Play reel
          </a>
        </div>
      </div>
    </section>
  );
}
