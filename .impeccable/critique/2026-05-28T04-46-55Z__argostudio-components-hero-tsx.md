---
target: argostudio/components/Hero.tsx
total_score: 28
p0_count: 2
p1_count: 2
timestamp: 2026-05-28T04-46-55Z
slug: argostudio-components-hero-tsx
---
# Critique — Hero (argostudio/components/Hero.tsx)

## Design Health Score

| #  | Heuristic | Score | Key Issue |
|----|-----------|-------|-----------|
| 1  | Visibility of System Status | 3 | Lenis smoothness + scroll indicator; nothing communicates the 200% pin duration. |
| 2  | Match System / Real World | 3 | "Start a project" / "Our manifesto" unambiguous; no jargon. |
| 3  | User Control and Freedom | 2 | Hero pinned +=200%, no skip-intro, brand statement fades to opacity 0 before slow reader finishes. |
| 4  | Consistency and Standards | 3 | System internally coherent; eyebrow pattern over-applied. |
| 5  | Error Prevention | 3 | n/a — hero has no failure modes. |
| 6  | Recognition Rather Than Recall | 3 | Logo + eyebrow + headline carry brand name three times; over-served. |
| 7  | Flexibility and Efficiency | 2 | No keyboard skip. Dead anchor #work. Pinned scroll forces every visitor through same timeline. |
| 8  | Aesthetic and Minimalist Design | 3 | Bones are 4-quality. Hero is 3 due to three competing CTAs + stock scroll cliché. |
| 9  | Error Recovery | 3 | n/a. |
| 10 | Help and Documentation | 3 | n/a. |
| **Total** | | **28 / 40** | **Strong system, cluttered hero composition.** |

## Anti-Patterns Verdict

**LLM assessment.** Not AI-slop overall. The system has a real POV (mass + voltage), a non-template signature (camera fly-through), and a vocabulary that no current Awwwards finalist ships. Drift toward template appears in three secondary moves layered atop the distinctive shell: the "ARGO Studio" eyebrow label, the "Scroll" indicator with animated pulse, and the dual-CTA pairing. Each is individually defensible; together they re-introduce 70% of the SaaS-hero grammar.

**Deterministic scan.** detect.mjs --json on Hero.tsx returns []. Re-run on full components/ directory: also [], exit 0. Twenty-seven deterministic rules match nothing. Clean at the pattern-matching layer.

**Visual overlays.** Not produced. No browser automation in this session.

## Overall Impression

This hero is 8 seconds of monumental architecture wrapped in 4 seconds of agency-template scaffolding. The monolith, the spatial penetration, the typographic ambition, the void as material — all operate at a tier that 95% of cinematic-studio sites cannot reach. Sitting on top of it: a mono-caps eyebrow saying the brand name underneath the header that already shows it, a "Scroll" affordance with pulsing label, two CTAs in the hero plus a third pill in the header, and a "we don't / we do" rhetorical frame whose opening word is the studio-cliché pronoun.

Biggest opportunity: subtraction, not addition.

## What's Working

- **Spatial penetration concept.** Camera flying through the glass monolith with text fading as the glass crosses the lens is genuinely non-replicable. The execution problem is timing, not idea.
- **Mass+voltage palette discipline.** Bone on Obsidian with a single voltage accent on "presence" is the clearest typographic verdict in the composition. The One Voice Rule is held here.
- **System-command CTA pattern.** Typography-only border-bottom command line instead of rounded button is structural. Keep.

## Priority Issues

### [P0] Eyebrow "ARGO Studio" is brand-mark triple-redundancy and template grammar.
- **Why**: Header already renders "ARGO" as logo. Headline IS brand declaration. Eyebrow adds nothing semantically and reproduces the SaaS hero pattern (eyebrow + headline + sub). DESIGN.md names the pattern for section eyebrows (Services, Manifesto), not hero. Hero should not need an eyebrow because it IS the apex.
- **Fix**: Delete the eyebrow span. Header logotype + Display-XL headline are sufficient.
- **Command**: /impeccable distill

### [P0] Three CTAs in viewport 1 break The One Voice Rule.
- **Why**: Header pill says "Get in touch." Hero says "Start a project" and "Our manifesto." Three voltage-eligible attention magnets in the same fold. "Get in touch" and "Start a project" are paraphrases. For a reputation-driven JTBD, one CTA carries more confidence than three.
- **Fix**: Remove Header pill, keep only "Start a project" in hero, demote "Our manifesto" to Header nav link.
- **Command**: /impeccable quieter

### [P1] "Scroll" indicator with animated line + pulsing label is canonical Awwwards cliché.
- **Why**: A studio opening with "We build presence" should never instruct the visitor to scroll. The opacity yoyo pulse is the second-order cliché atop the first.
- **Fix**: Delete it. If a cue is needed, static 1px voltage hairline at bottom-center. Better: trust the audience.
- **Command**: /impeccable distill

### [P1] Spatial penetration kills the brand statement before it lands.
- **Why**: Headline fades to opacity 0 the instant the user starts scrolling. The most monumental sentence in the system is the most fragile element in its presentation. No read-time guard.
- **Fix**: Hold opacity 1 for first ~25% of pinned scroll, fade 25→60%, fully out by 70%. One-line change in the scrollTl.
- **Command**: /impeccable animate

### [P2] "We don't build pages. We build presence." opens with studio-cliché pronoun.
- **Why**: Construction is strong (verdict voice). Opening pronoun "We" is the agency-2018 register PRODUCT.md anti-refs. "We craft experiences" is one synonym away.
- **Fix** (try): "Not pages. Presence." Or single-word hero "Presence." with voltage period.
- **Command**: /impeccable clarify or /impeccable bolder

### [P2] Dead anchor #work in Header.
- **Why**: Header includes <a href="#work">Work</a> but no Work section exists. Broken navigation contract in viewport 1.
- **Fix**: Either ship Showcase section now, or remove the link.
- **Command**: /impeccable harden

## Persona Red Flags

**Mara (Studio Founder / Awwwards Juror)**. Scans for craft signal in 8 seconds. Spatial penetration is strong, but headline fades before she gets a verbal anchor. Eyebrow "ARGO Studio" registers as agency-template grammar in the first 2 seconds.

**Theo (Senior FE Eng / Linear power user)**. Hits Cmd+F or Tab. No keyboard skip. 200% pin traps him under animation. Dead #work anchor flips his mental model from "promising studio" to "still under construction."

**Andrea (Studio Owner)**. The design system explicitly bans repeated mono-caps section labels as scaffolding (intent: section grammar), yet the live hero ships an eyebrow over the apex headline. PRODUCT.md anti-refs ban "we craft experiences" / "we are passionate", yet the headline opens with "We". The system documents a stronger position than the hero honors.

## Minor Observations

- mt-20 md:mt-24 between sub and CTAs makes composition slightly top-heavy on 1440-tall displays.
- .voltage-halo defined in globals.css but not mounted in layout.tsx. Same for .cinematic-vignette. Dead tokens.
- Header pill uses rounded-full while every other elevated surface uses rounded-argo-lg (16px). Acceptable as the one exception but undocumented in DESIGN.md as a rule.

## Questions to Consider

- What would the hero look like with zero CTAs, deferring to scroll as the only invitation?
- What does this hero say with one word? Is "Presence." bolder than "We don't build pages. We build presence."?
- Is the "Scroll" affordance there for the user, or because the designer was uncomfortable with stillness?
