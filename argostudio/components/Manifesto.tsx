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

export default function Manifesto() {
  const sectionRef   = useRef<HTMLElement>(null);
  const labelRef     = useRef<HTMLSpanElement>(null);
  const dividerRef   = useRef<HTMLDivElement>(null);
  const titleRef     = useRef<HTMLHeadingElement>(null);
  const block1Ref    = useRef<HTMLParagraphElement>(null);
  const block2Ref    = useRef<HTMLParagraphElement>(null);
  const block3Ref    = useRef<HTMLParagraphElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        gsap.set(
          [
            labelRef.current,
            titleRef.current,
            block1Ref.current,
            block2Ref.current,
            block3Ref.current,
            signatureRef.current,
          ],
          { opacity: 1, y: 0, filter: 'blur(0px)' }
        );
        gsap.set(dividerRef.current, { scaleX: 1 });
        return;
      }

      gsap.set(
        [
          labelRef.current,
          block1Ref.current,
          block2Ref.current,
          block3Ref.current,
          signatureRef.current,
        ],
        { opacity: 0, y: 24 }
      );

      gsap.set(titleRef.current, { opacity: 0, y: 32, filter: 'blur(12px)' });
      gsap.set(dividerRef.current, { scaleX: 0, transformOrigin: 'left center' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          end: 'top 30%',
          scrub: 1.5,
        },
      });

      tl.to(labelRef.current, {
          opacity: 1, y: 0, duration: durations.base, ease: 'smoothOut',
        }, 0)
        .to(dividerRef.current, {
          scaleX: 1, duration: durations.medium, ease: 'smoothOut',
        }, 0)
        .to(titleRef.current, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: durations.slow, ease: 'cinematic',
        }, 0.2)
        .to(block1Ref.current, {
          opacity: 1, y: 0, duration: durations.medium, ease: 'cinematic',
        }, 0.4)
        .to(block2Ref.current, {
          opacity: 1, y: 0, duration: durations.medium, ease: 'cinematic',
        }, 0.5)
        .to(block3Ref.current, {
          opacity: 1, y: 0, duration: durations.medium, ease: 'cinematic',
        }, 0.6)
        .to(signatureRef.current, {
          opacity: 1, y: 0, duration: durations.base, ease: 'smoothOut',
        }, 0.7);

      const mm = gsap.matchMedia();
      mm.add('(min-width: 768px)', () => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=150%',
          pin: true,
          pinSpacing: true,
        });
      });

      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={sectionRef}
      id="manifesto"
      className="relative min-h-screen px-6 py-32 md:px-12 lg:px-24 flex flex-col justify-center"
    >
      <span
        ref={labelRef}
        className="font-mono text-micro uppercase tracking-[0.16em] text-voltage mb-16"
      >
        Manifesto
      </span>

      <div
        ref={dividerRef}
        className="w-16 h-px bg-voltage mb-16"
      />

      <h2
        ref={titleRef}
        className="font-display text-display-l text-bone max-w-4xl mb-20"
        style={{ letterSpacing: '-0.04em', lineHeight: '0.98', fontWeight: 500 }}
      >
        Websites should be experiences.
        <br />
        <span className="text-pearl">Not just interfaces.</span>
      </h2>

      <div className="max-w-2xl space-y-12">
        <p ref={block1Ref} className="font-body text-body-l text-pearl leading-relaxed">
          We believe every brand deserves a digital environment that feels as
          intentional as their product. Not a template. Not a page. An experience
          that communicates quality before a single word is read.
        </p>

        <p ref={block2Ref} className="font-body text-body-l text-pearl leading-relaxed">
          ARGO Studio exists at the intersection of cinematic storytelling and
          precision engineering. We craft immersive web experiences that make
          people feel something — then remember it.
        </p>

        <p ref={block3Ref} className="font-body text-body-l text-pearl leading-relaxed">
          Our work is for brands that refuse to blend in. Luxury houses,
          visionary startups, architectural firms, fashion labels — anyone
          who understands that presence is not optional.
        </p>
      </div>

      <div ref={signatureRef} className="mt-24 flex items-center gap-6">
        <div className="w-8 h-px bg-chrome" />
        <span className="font-mono text-micro uppercase tracking-[0.12em] text-smoke">
          Andrea Lo Cascio — Founder
        </span>
      </div>
    </section>
  );
}
