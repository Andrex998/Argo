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

interface Project {
  index: string;
  title: string;
  category: string;
  year: string;
  aspect: string;
}

const PROJECTS: Project[] = [
  {
    index: '01',
    title: 'Obsidian Residences',
    category: 'Luxury Real Estate',
    year: '2025',
    aspect: 'aspect-[4/5]',
  },
  {
    index: '02',
    title: 'Maison Ōkuro',
    category: 'Hospitality',
    year: '2025',
    aspect: 'aspect-[4/5] lg:aspect-[3/4] lg:mt-20',
  },
  {
    index: '03',
    title: 'Aether Collective',
    category: 'Fashion & Editorial',
    year: '2024',
    aspect: 'aspect-[4/5]',
  },
];

export default function Showcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const gridRef    = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const cards = gridRef.current
        ? Array.from(gridRef.current.querySelectorAll('[data-project-card]'))
        : [];

      if (prefersReducedMotion) {
        gsap.set([labelRef.current, titleRef.current, ...cards], {
          opacity: 1, y: 0, filter: 'blur(0px)',
        });
        return;
      }

      gsap.set([labelRef.current, titleRef.current], {
        opacity: 0, y: 24, filter: 'blur(12px)',
      });
      gsap.set(cards, { opacity: 0, y: 48, filter: 'blur(12px)' });

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
        .to(cards, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.medium, ease: 'cinematic', stagger: 0.15,
        }, 0.45);

      // ── Parallax depth layers — header only (cards keep layout stable) ─
      parallaxLayer(sectionRef.current, labelRef.current, -52);
      parallaxLayer(sectionRef.current, titleRef.current, -28);

      // Cards: staggered depth — closer to center = further back
      const cardEls = gridRef.current
        ? Array.from(gridRef.current.querySelectorAll<HTMLElement>('[data-project-card]'))
        : [];
      const cardDepths = [-48, -24, -56]; // asymmetric for visual interest
      cardEls.forEach((card, i) => {
        parallaxLayer(sectionRef.current, card, cardDepths[i] ?? -30);
      });
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="work"
      className="relative px-6 py-40 md:px-12 lg:px-24"
    >
      {/* Section header */}
      <div className="mb-20 flex items-end justify-between">
        <div>
          <span
            ref={labelRef}
            className="font-mono text-micro uppercase tracking-[0.16em] text-voltage"
          >
            Selected Work
          </span>
          <h2
            ref={titleRef}
            className="mt-8 font-display text-display-l text-bone"
            style={{ letterSpacing: '-0.04em', lineHeight: '0.98', fontWeight: 500 }}
          >
            What we&apos;ve shipped.
          </h2>
        </div>
      </div>

      {/* Project grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:items-start"
      >
        {PROJECTS.map((project) => (
          <article
            key={project.title}
            data-project-card
            className={`group relative overflow-hidden rounded-argo-lg glass-subtle ${project.aspect} cursor-pointer`}
          >
            {/* Placeholder canvas — obsidian void until real assets ship */}
            <div
              className="absolute inset-0 bg-obsidian transition-transform duration-epic ease-cinematic group-hover:scale-[1.03]"
              aria-hidden="true"
            />

            {/* Subtle voltage shimmer on hover */}
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-slow ease-cinematic group-hover:opacity-100"
              style={{
                background:
                  'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(97,255,167,0.05) 0%, transparent 70%)',
              }}
              aria-hidden="true"
            />

            {/* Project info overlay */}
            <div className="absolute inset-0 flex flex-col justify-between p-8">
              <span className="font-mono text-micro uppercase tracking-[0.16em] text-smoke select-none">
                {project.index}
              </span>

              <div>
                <p className="font-mono text-micro uppercase tracking-[0.14em] text-smoke mb-3">
                  {project.category} — {project.year}
                </p>
                <h3
                  className="font-display text-heading-l text-bone transition-colors duration-base ease-smooth-out group-hover:text-voltage"
                  style={{ letterSpacing: '-0.03em', fontWeight: 500 }}
                >
                  {project.title}
                </h3>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
