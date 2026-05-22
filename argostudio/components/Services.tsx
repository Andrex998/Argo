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

interface Service {
  title: string;
  description: string;
  icon: React.ReactNode;
}

/* ── Stroke icons — 1.5 width, consistent visual language (no emoji) ── */
const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const SERVICES: Service[] = [
  {
    title: 'Immersive Web Design',
    description:
      'Full-screen environments that pull the visitor inside the brand. Every scroll is a frame in the story.',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
        <path d="m3 18 9 5 9-5" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: 'Luxury Landing Pages',
    description:
      'High-conversion single pages engineered for premium brands. Precision typography, zero filler.',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2Z" />
      </svg>
    ),
  },
  {
    title: '3D Experiences',
    description:
      'Real-time WebGL scenes — refractive glass, procedural shaders, cinematic depth that runs at 60fps.',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
        <path d="M12 2v20" opacity="0.5" />
        <path d="M3 7l9 5 9-5" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: 'Motion Storytelling',
    description:
      'Choreographed scroll narratives. Camera moves, staggered reveals, and easing tuned to the millisecond.',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8 6 4-6 4V8Z" />
      </svg>
    ),
  },
  {
    title: 'AI-Assisted Development',
    description:
      'A multi-AI pipeline accelerates production without compromising craft — speed meets precision.',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
        <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
      </svg>
    ),
  },
  {
    title: 'Brand Experience Design',
    description:
      'The full sensory system — motion language, sound, palette, voice — engineered into one coherent presence.',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" opacity="0.6" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    ),
  },
];

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const gridRef    = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const cards = gridRef.current
        ? Array.from(gridRef.current.querySelectorAll('[data-service-card]'))
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
      gsap.set(cards, { opacity: 0, y: 40, filter: 'blur(12px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
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
          duration: durations.medium, ease: 'cinematic', stagger: 0.1,
        }, 0.4);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative px-6 py-32 md:px-12 lg:px-24"
    >
      {/* Section header */}
      <div className="mb-20 max-w-3xl">
        <span
          ref={labelRef}
          className="font-mono text-micro uppercase tracking-[0.16em] text-voltage"
        >
          Services
        </span>
        <h2
          ref={titleRef}
          className="mt-8 font-display text-display-l text-bone"
          style={{ letterSpacing: '-0.04em', lineHeight: '0.98', fontWeight: 500 }}
        >
          What we engineer.
        </h2>
      </div>

      {/* Glass card grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SERVICES.map((service, i) => (
          <article
            key={service.title}
            data-service-card
            className="group relative flex flex-col rounded-argo-lg glass-default p-8 transition-all duration-base ease-smooth-out hover:-translate-y-1 hover:border-voltage/20 hover:shadow-glow-subtle"
          >
            {/* Index + icon row */}
            <div className="mb-10 flex items-start justify-between">
              <span className="font-mono text-micro text-smoke">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-pearl transition-colors duration-base ease-smooth-out group-hover:text-voltage">
                {service.icon}
              </span>
            </div>

            <h3 className="font-display text-heading-m text-bone">
              {service.title}
            </h3>
            <p className="mt-4 font-body text-body-m text-smoke">
              {service.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
