/**
 * ARGO Studio — Cinematic easing curves
 * Source of truth for all JS-driven motion (Framer Motion, GSAP).
 * Tailwind CSS transitions reference these via tailwind.config.ts.
 *
 * Rule: NEVER use default `ease`, `linear`, or `ease-in-out` from Tailwind/CSS.
 * Reference: /ARGO_STUDIO/01_SYSTEM_PROMPTS/MOTION_RULES.md
 */

export const easings = {
  // Standard cinematici
  smooth:    [0.25, 0.1, 0.25, 1.0],  // entrata/uscita generica
  smoothOut: [0.16, 1, 0.3, 1],        // expo-out, decelerazione naturale
  smoothIn:  [0.7, 0, 0.84, 0],        // expo-in, accelerazione drammatica

  // Cinematici premium
  cinematic: [0.6, 0.05, 0.01, 0.95],  // entrata "movie-grade"
  silk:      [0.4, 0, 0.2, 1],         // tactile, premium hover
  inertial:  [0.05, 0.7, 0.1, 1.0],    // fisica realistica

  // Eccezioni controllate
  spring:    [0.34, 1.56, 0.64, 1],    // overshoot leggero (uso raro)
} as const;

export type EasingKey = keyof typeof easings;
export type EasingValue = (typeof easings)[EasingKey];
