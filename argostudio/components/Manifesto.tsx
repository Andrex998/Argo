'use client';

import { useRef } from 'react';

/**
 * Manifesto Section — ARGO Studio Website V1
 *
 * ARCHITECTURE NOTE FOR GEMINI:
 * Each text block has an independent ref for staggered scroll reveals.
 * Suggested ScrollTrigger approach:
 *   - sectionRef as trigger container
 *   - labelRef: fade in at top of viewport entry
 *   - dividerRef: width animate from 0 → 64px (ease: smoothOut)
 *   - titleRef: reveal from y:32 + blur(12px) → 0 (ease: cinematic)
 *   - block1/2/3Ref: stagger reveal, 0.08s delay each (ease: cinematic)
 *   - signatureRef: final fade at bottom
 *
 * Pin this section if desired for slow-read pacing.
 * scrub: 1.5 recommended for smooth narrative feel.
 */

export default function Manifesto() {
  /* ── GSAP anchor refs ── */
  const sectionRef   = useRef<HTMLElement>(null);
  const labelRef     = useRef<HTMLSpanElement>(null);
  const dividerRef   = useRef<HTMLDivElement>(null);
  const titleRef     = useRef<HTMLHeadingElement>(null);
  const block1Ref    = useRef<HTMLParagraphElement>(null);
  const block2Ref    = useRef<HTMLParagraphElement>(null);
  const block3Ref    = useRef<HTMLParagraphElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={sectionRef}
      id="manifesto"
      className="relative min-h-screen px-6 py-32 md:px-12 lg:px-24 flex flex-col justify-center"
    >
      {/* ── Section label ── */}
      <span
        ref={labelRef}
        className="font-mono text-micro uppercase tracking-widest text-voltage mb-16"
      >
        Manifesto
      </span>

      {/* ── Voltage divider line ── */}
      <div
        ref={dividerRef}
        className="w-16 h-px bg-voltage mb-16"
      />

      {/* ── Section title ── */}
      <h2
        ref={titleRef}
        className="font-display text-display-l text-bone max-w-4xl mb-20"
      >
        Websites should be experiences.
        <br />
        <span className="text-pearl">Not just interfaces.</span>
      </h2>

      {/* ── Text blocks — staggered reveals ── */}
      <div className="max-w-2xl space-y-12">
        <p
          ref={block1Ref}
          className="font-body text-body-l text-pearl leading-relaxed"
        >
          We believe every brand deserves a digital environment that feels as
          intentional as their product. Not a template. Not a page. An experience
          that communicates quality before a single word is read.
        </p>

        <p
          ref={block2Ref}
          className="font-body text-body-l text-pearl leading-relaxed"
        >
          ARGO Studio exists at the intersection of cinematic storytelling and
          precision engineering. We craft immersive web experiences that make
          people feel something — then remember it.
        </p>

        <p
          ref={block3Ref}
          className="font-body text-body-l text-pearl leading-relaxed"
        >
          Our work is for brands that refuse to blend in. Luxury houses,
          visionary startups, architectural firms, fashion labels — anyone
          who understands that presence is not optional.
        </p>
      </div>

      {/* ── Signature / closing accent ── */}
      <div
        ref={signatureRef}
        className="mt-24 flex items-center gap-6"
      >
        <div className="w-8 h-px bg-chrome" />
        <span className="font-mono text-micro uppercase tracking-widest text-smoke">
          Andrea Lo Cascio — Founder
        </span>
      </div>
    </section>
  );
}
