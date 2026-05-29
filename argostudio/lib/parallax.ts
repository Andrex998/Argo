import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Attaches a scrub-bound vertical parallax to `target` relative to `trigger`.
 *
 * yDelta > 0 → element appears CLOSER (moves up faster than scroll).
 * yDelta < 0 → element appears FARTHER  (moves up slower than scroll).
 *
 * Call inside a useGSAP scope so cleanup is automatic.
 */
export function parallaxLayer(
  trigger: HTMLElement | null,
  target: HTMLElement | null,
  yDelta: number
): void {
  if (!trigger || !target) return;

  gsap.set(target, { willChange: 'transform' });

  gsap.to(target, {
    y: yDelta,
    ease: 'none',
    scrollTrigger: {
      trigger,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
}
