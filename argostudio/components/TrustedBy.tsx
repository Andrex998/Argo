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

// ── Brand data ─────────────────────────────────────────────────────────────────

const BRANDS = ['LUCID', 'Grid.', 'NEXUS', 'P·E', 'MOMENTUM', 'VANTA'] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export default function TrustedBy() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const stripRef   = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const brands = stripRef.current
        ? Array.from(stripRef.current.querySelectorAll('[data-brand]'))
        : [];

      if (prefersReducedMotion) {
        gsap.set([labelRef.current, ...brands], { opacity: 1, y: 0 });
        return;
      }

      gsap.set(labelRef.current, { opacity: 0, y: 16 });
      gsap.set(brands, { opacity: 0, y: 16 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      tl.to(labelRef.current, {
          opacity: 1,
          y: 0,
          duration: durations.base,
          ease: 'power2.out',
        }, 0)
        .to(brands, {
          opacity: 1,
          y: 0,
          duration: durations.medium,
          ease: 'power2.out',
          stagger: 0.07,
        }, 0.2);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="trusted"
      className="relative px-6 py-16 md:px-12 lg:px-24 border-t border-white/[0.06]"
    >
      {/* Label */}
      <span
        ref={labelRef}
        className="font-mono text-micro uppercase tracking-[0.16em] text-smoke block mb-10"
      >
        Trusted by world-class brands
      </span>

      {/* Brand strip */}
      <div
        ref={stripRef}
        className="flex items-center justify-between gap-8 md:gap-16 overflow-x-auto scrollbar-none"
      >
        {BRANDS.map((brand, i) => (
          <div key={brand} className="flex items-center gap-8 md:gap-16 shrink-0">
            {/* Brand name */}
            <span
              data-brand
              className="font-display text-heading-s text-graphite tracking-tight whitespace-nowrap transition-colors duration-fast ease-silk hover:text-pearl cursor-default select-none"
            >
              {brand}
            </span>

            {/* Vertical divider — hidden on mobile */}
            {i < BRANDS.length - 1 && (
              <span
                aria-hidden="true"
                className="hidden sm:block w-px h-4 bg-white/[0.08] shrink-0"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
