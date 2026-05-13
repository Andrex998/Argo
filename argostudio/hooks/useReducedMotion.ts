'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true if the user has requested reduced motion.
 * Use this to short-circuit complex animations, parallax, autoplay.
 *
 * Usage:
 *   const prefersReduced = useReducedMotion();
 *   if (prefersReduced) return <StaticHero />;
 *
 * Reference: /ARGO_STUDIO/01_SYSTEM_PROMPTS/MOTION_RULES.md §8
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
}
