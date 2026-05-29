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

const QUOTES = [
  {
    text: 'They didn\'t build us a website. They built us a world. Every visitor feels it the moment they arrive.',
    author: 'CEO',
    company: 'Obsidian Residences',
  },
  {
    text: 'The craft is surgical. Every frame, every transition — nothing is arbitrary. It feels inevitable.',
    author: 'Creative Director',
    company: 'Maison Ōkuro',
  },
  {
    text: 'We\'ve worked with agencies three times their size. None of them delivered an experience like this.',
    author: 'Founder',
    company: 'Aether Collective',
  },
] as const;

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const items = listRef.current
        ? Array.from(listRef.current.querySelectorAll('[data-quote]'))
        : [];

      if (prefersReducedMotion) {
        gsap.set([labelRef.current, ...items], { opacity: 1, y: 0, filter: 'blur(0px)' });
        return;
      }

      gsap.set(labelRef.current, { opacity: 0, y: 20, filter: 'blur(12px)' });
      gsap.set(items, { opacity: 0, y: 40, filter: 'blur(12px)' });

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
        .to(items, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.slow, ease: 'cinematic', stagger: 0.2,
        }, 0.2);

      // ── Parallax depth layers ──────────────────────────────────────────
      parallaxLayer(sectionRef.current, labelRef.current, -52);
      // Stagger quote depths for subtle wave effect
      const quoteEls = listRef.current
        ? Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-quote]'))
        : [];
      const quoteDepths = [-24, -36, -18];
      quoteEls.forEach((el, i) => {
        parallaxLayer(sectionRef.current, el, quoteDepths[i] ?? -24);
      });
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="relative px-6 py-40 md:px-12 lg:px-24"
    >
      <span
        ref={labelRef}
        className="font-mono text-micro uppercase tracking-[0.16em] text-voltage block mb-20"
      >
        Voices
      </span>

      <ul ref={listRef} className="flex flex-col divide-y divide-white/[0.06]">
        {QUOTES.map((quote, i) => (
          <li
            key={i}
            data-quote
            className="py-16 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_14rem] lg:gap-20 lg:items-start"
          >
            {/* Quote text — large editorial */}
            <blockquote>
              <p
                className="font-display text-heading-xl text-bone"
                style={{ letterSpacing: '-0.035em', lineHeight: '1.1', fontWeight: 400 }}
              >
                &ldquo;{quote.text}&rdquo;
              </p>
            </blockquote>

            {/* Attribution — mono, right-aligned on desktop */}
            <footer className="flex flex-col gap-1 lg:text-right lg:pt-1">
              <span className="font-mono text-micro uppercase tracking-[0.14em] text-pearl">
                {quote.author}
              </span>
              <span className="font-mono text-micro uppercase tracking-[0.14em] text-smoke">
                {quote.company}
              </span>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
