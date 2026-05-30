'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { durations } from '@/motion/durations';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { parallaxLayer } from '@/lib/parallax';
import WireframeGem from '@/components/WireframeGem';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

interface ServiceItem {
  index: string;
  title: string;
  description: string;
  gemSize: number;
  gemSpeed: number;
  gemAngle: number;
  gemColor?: string;
}

const SERVICES: ServiceItem[] = [
  {
    index: '01',
    title: 'Web Design',
    description: 'Full-screen environments that pull the visitor inside the brand. Every scroll is a frame in the story.',
    gemSize: 100,
    gemSpeed: 0.008,
    gemAngle: 0.2,
  },
  {
    index: '02',
    title: 'Development',
    description: 'Production-grade Next.js, zero-compromise performance. Ships fast, scales further.',
    gemSize: 90,
    gemSpeed: 0.011,
    gemAngle: 1.6,
  },
  {
    index: '03',
    title: 'Interactive 3D',
    description: 'Real-time scenes — refractive glass, procedural shaders, cinematic depth at 60fps.',
    gemSize: 110,
    gemSpeed: 0.007,
    gemAngle: 3.1,
    gemColor: '#9fffcf',
  },
  {
    index: '04',
    title: 'Motion Storytelling',
    description: 'Choreographed scroll narratives. Camera moves, staggered reveals, easing tuned to the millisecond.',
    gemSize: 95,
    gemSpeed: 0.010,
    gemAngle: 2.4,
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

      gsap.set([labelRef.current, titleRef.current], { opacity: 0, y: 24, filter: 'blur(12px)' });
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
          duration: durations.medium, ease: 'cinematic', stagger: 0.12,
        }, 0.4);

      // ── Parallax depth layers ──────────────────────────────────────────
      parallaxLayer(sectionRef.current, labelRef.current, -52);
      parallaxLayer(sectionRef.current, titleRef.current, -28);
      parallaxLayer(sectionRef.current, gridRef.current,  -8);
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative px-6 py-40 md:px-12 lg:px-24"
    >
      {/* Section header */}
      <div className="mb-20 max-w-3xl">
        <span
          ref={labelRef}
          className="font-mono text-micro uppercase tracking-[0.16em] text-voltage"
        >
          What We Do
        </span>
        <h2
          ref={titleRef}
          className="mt-8 font-display text-display-l text-bone"
          style={{ letterSpacing: '-0.04em', lineHeight: '0.98', fontWeight: 500 }}
        >
          Websites that look exceptional.
          <br />
          <span className="text-pearl" style={{ fontWeight: 400 }}>
            And perform even better.
          </span>
        </h2>
      </div>

      {/* 4-card grid with wireframe gems as visual assets */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {SERVICES.map((service) => (
          <article
            key={service.title}
            data-service-card
            className="group flex flex-col rounded-argo-lg glass-subtle overflow-hidden"
          >
            {/* Gem slot — dark chamber with rotating wireframe */}
            <div className="relative flex items-center justify-center bg-obsidian aspect-square overflow-hidden">
              <WireframeGem
                size={service.gemSize}
                speed={service.gemSpeed}
                initialAngle={service.gemAngle}
                color={service.gemColor ?? '#61FFA7'}
              />
              {/* Subtle voltage radial on hover */}
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-slow ease-cinematic group-hover:opacity-100 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(97,255,167,0.07) 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />
            </div>

            {/* Text */}
            <div className="flex flex-col gap-3 p-6 flex-1">
              <div className="flex items-start justify-between">
                <span className="font-mono text-micro uppercase tracking-[0.16em] text-smoke">
                  {service.index}
                </span>
              </div>
              <h3
                className="font-display text-heading-m text-bone group-hover:text-voltage transition-colors duration-base ease-smooth-out"
                style={{ letterSpacing: '-0.02em', fontWeight: 500 }}
              >
                {service.title}
              </h3>
              <p className="font-body text-body-m text-smoke flex-1" style={{ lineHeight: '1.6' }}>
                {service.description}
              </p>
              <a
                href="#contact"
                className="mt-2 font-mono text-micro uppercase tracking-widest text-pearl border-b border-white/10 pb-0.5 w-fit transition-all duration-fast ease-silk hover:text-voltage hover:border-voltage/40"
              >
                Explore →
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
