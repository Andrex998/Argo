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

const STEPS = [
  {
    title: 'Discover',
    body: 'Deep brand archaeology. We map the territory — identity, competitors, audience, the unspoken promise — before a single pixel is drawn.',
  },
  {
    title: 'Strategize',
    body: 'Architecture of intent. We define the narrative arc, conversion logic, and motion language that will carry the experience from first frame to last.',
  },
  {
    title: 'Design',
    body: 'Craft at full resolution. Typography tuned to the millisecond, palette distilled to its essence, space used as structure, not decoration.',
  },
  {
    title: 'Develop',
    body: 'Engineered precision. Production-grade Next.js, GSAP-choreographed motion, and WebGL depth — all performing at 60fps without compromise.',
  },
  {
    title: 'Launch',
    body: 'Deployment is not the end. We monitor, measure, and refine until the experience is as sharp in the wild as it was in the studio.',
  },
] as const;

export default function Process() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const listRef    = useRef<HTMLOListElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const items = listRef.current
        ? Array.from(listRef.current.querySelectorAll('[data-step]'))
        : [];

      if (prefersReducedMotion) {
        gsap.set([labelRef.current, titleRef.current, ...items], {
          opacity: 1, y: 0, filter: 'blur(0px)',
        });
        return;
      }

      gsap.set([labelRef.current, titleRef.current], {
        opacity: 0, y: 24, filter: 'blur(12px)',
      });
      gsap.set(items, { opacity: 0, y: 36, filter: 'blur(10px)' });

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
        .to(titleRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.slow, ease: 'cinematic',
        }, 0.15)
        .to(items, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.medium, ease: 'cinematic', stagger: 0.12,
        }, 0.45);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="process"
      className="relative px-6 py-40 md:px-12 lg:px-24"
    >
      {/* Section header */}
      <div className="mb-20 max-w-3xl">
        <span
          ref={labelRef}
          className="font-mono text-micro uppercase tracking-[0.16em] text-voltage"
        >
          Process
        </span>
        <h2
          ref={titleRef}
          className="mt-8 font-display text-display-l text-bone"
          style={{ letterSpacing: '-0.04em', lineHeight: '0.98', fontWeight: 500 }}
        >
          How we build.
        </h2>
      </div>

      {/* Steps list */}
      <ol ref={listRef} className="flex flex-col divide-y divide-white/[0.06]">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            data-step
            className="group grid grid-cols-[3rem_1fr] gap-x-10 py-10 transition-colors duration-base ease-smooth-out md:grid-cols-[4rem_18rem_1fr] md:gap-x-14"
          >
            {/* Number */}
            <span className="font-mono text-micro uppercase tracking-[0.16em] text-smoke pt-1 select-none">
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* Title */}
            <h3
              className="font-display text-heading-l text-bone group-hover:text-voltage transition-colors duration-base ease-smooth-out"
              style={{ letterSpacing: '-0.03em', fontWeight: 500 }}
            >
              {step.title}
            </h3>

            {/* Body — hidden on mobile, shown md+ */}
            <p className="hidden font-body text-body-m text-smoke md:block" style={{ lineHeight: '1.6' }}>
              {step.body}
            </p>

            {/* Body — mobile fallback, full width */}
            <p className="col-span-2 mt-4 font-body text-body-m text-smoke md:hidden" style={{ lineHeight: '1.6' }}>
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
