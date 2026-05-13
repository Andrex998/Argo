/**
 * ARGO Studio — Fixed duration scale (in seconds, for JS animations)
 * Tailwind utility version (in ms) lives in tailwind.config.ts.
 *
 * Rule: never use arbitrary duration values. Always reference these tokens.
 * Reference: /ARGO_STUDIO/01_SYSTEM_PROMPTS/MOTION_RULES.md
 */

export const durations = {
  micro:  0.15, // hover state, tap feedback
  fast:   0.3,  // small transitions
  base:   0.6,  // standard reveal, fade
  medium: 0.9,  // section entrance
  slow:   1.4,  // hero reveal, cinematic moments
  epic:   2.4,  // intro sequences only — never exceed
} as const;

export type DurationKey = keyof typeof durations;
export type DurationValue = (typeof durations)[DurationKey];
