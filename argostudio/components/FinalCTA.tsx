'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { durations } from '@/motion/durations';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { parallaxLayer } from '@/lib/parallax';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function FinalCTA() {
  const sectionRef  = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef      = useRef<HTMLParagraphElement>(null);
  const ctaRef      = useRef<HTMLAnchorElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const els = [headlineRef.current, subRef.current, ctaRef.current];

      if (prefersReducedMotion) {
        gsap.set(els, { opacity: 1, y: 0, filter: 'blur(0px)' });
        return;
      }

      gsap.set(els, { opacity: 0, y: 40, filter: 'blur(12px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      });

      tl.to(headlineRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.slow, ease: 'cinematic',
        }, 0)
        .to(subRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.medium, ease: 'cinematic',
        }, 0.4)
        .to(ctaRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.base, ease: 'silk',
        }, 0.8);

      // ── Parallax depth layers — CTA pops forward, headline recedes ─────
      parallaxLayer(sectionRef.current, headlineRef.current, -20);
      parallaxLayer(sectionRef.current, subRef.current,      -10);
      parallaxLayer(sectionRef.current, ctaRef.current,      -56);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative px-6 py-48 md:px-12 lg:px-24 flex flex-col items-center text-center"
    >
      {/* Subtle voltage halo — only element allowed to reference voltage radially */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(97,255,167,0.04) 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      <h2
        ref={headlineRef}
        className="relative font-display text-display-xl text-bone max-w-3xl"
        style={{ letterSpacing: '-0.04em', lineHeight: '0.94', fontWeight: 500 }}
      >
        Your brand deserves
        <br />
        <span className="text-voltage">to be seen.</span>
      </h2>

      <p
        ref={subRef}
        className="relative mt-14 font-body text-body-l text-pearl max-w-sm"
        style={{ lineHeight: '1.55' }}
      >
        We take on a small number of projects each year. If you have something
        worth building, let&apos;s talk.
      </p>

      <a
        ref={ctaRef}
        href="mailto:hello@argostudio.com"
        className="relative mt-16 font-mono text-xs uppercase tracking-widest text-pearl border-b border-white/10 pb-1 transition-all duration-700 hover:text-voltage hover:border-voltage/40"
      >
        Start a project
      </a>
    </section>
  );
}
