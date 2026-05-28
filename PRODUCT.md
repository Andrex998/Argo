# Product

## Register

brand

## Users

Designer, developer, and studio peers actively scouting the upper edge of the craft. They arrive from Awwwards, FWA, Twitter/X threads, Are.na boards, or word of mouth between studios. Context is curiosity, not need: they have a project running, a moodboard open, and 30 seconds to decide whether ARGO joins the reference list or gets closed. They are not buyers in the conventional sense; they are amplifiers. If the site lands, it becomes a citation, a referral, a status marker shared in private design Slacks. The site converts on reputation, not on form submissions.

## Product Purpose

ARGO Studio's own presence on the web. The site exists to demonstrate, without claim, that ARGO operates one tier above the saturated cinematic-agency layer. It does not sell. It does not pitch. It proves that the studio's craft is non-replicable by anyone running the standard SaaS-cinematic preset. Success is measured in unsolicited share, in being the site other studios send to their juniors as a benchmark, and in inbound from brands that recognize the level on sight.

## Brand Personality

**Monumentale · Chirurgico · Magnetico.**

Voice: calm, low, declarative. No hype, no exclamation, no "we craft experiences." Sentences land like a verdict, not a pitch. The studio behaves like a piece of architecture rather than a service vendor.

Emotional goal: the first 8 seconds should feel like an *apparition* — something arrived, gravitationally heavy, slightly impossible. The visitor exhales rather than scrolls.

## Anti-references

**The site fails the moment it resembles any of the following:**

- **The SaaS-cinematic template.** Purple-to-blue gradients, hero metric, identical card grids with rounded-square icon tiles above headings, "Trusted by" logo row, gray text on colored card. The Linear/Vercel clone visible on every Awwwards finalist.
- **Generic agency 2018.** Parallax stock photography, "we are passionate creatives", scroll-jacked team grid, case-study tile farms, About Us novel.
- **Web3 / crypto cyberpunk.** Neon-on-black with glitch effects, particle fields, "the future is now" copy, terminal aesthetics worn as costume.
- **Cliché Italian studio.** Helvetica + black-and-white photography + "we craft experiences with passion" + Swiss-grid pastiche done badly.

If a casual viewer can name the template within 5 seconds, the project has failed.

## Design Principles

1. **Show, don't tell.** The craft is the proof. We never claim "premium" or "cinematic"; the site demonstrates both or it dies. Copy describes work, never performance.

2. **Silence before signal.** Negative space is the primary material. Every element must earn its real estate against the void. If something can be deleted without loss, it must be deleted.

3. **Mass and voltage.** Two tensions per viewport, no more: gravitational mass (the monolith, monumental typography, deep blacks) and electrical signal (the voltage blue, ≤10% of the surface, used as a verdict not a decoration). Never let a third visual force enter the frame.

4. **Inevitability over decision.** Nothing should feel "designed" — everything should feel *arrived*. Easings carry weight (cinematic / smooth-out / inertial), never bounce. Motion is choreography, not garnish. If an animation could be removed without changing the meaning, it shouldn't be there.

5. **Anti-template by reflex.** If the page would still work with another studio's logo on it, it isn't ARGO. Every section must contain at least one decision a template can't replicate: the spatial penetration scroll, the trapped-energy lighting, the system-command CTA, the editorial vertical rhythm.

## Accessibility & Inclusion

WCAG 2.2 **AA** baseline across the entire site.

- All text contrast ≥ 4.5:1 (bone/pearl on void/obsidian verified).
- `prefers-reduced-motion` already respected in Hero, Manifesto, and Services (GSAP timelines short-circuit to static reveal; Lenis smooth-scroll disables).
- `:focus-visible` outline in voltage blue, 2px / 4px offset.
- 3D layer is purely decorative (`aria-hidden="true"` on the canvas wrapper); content remains fully readable and operable without WebGL.
- Keyboard navigation: every interactive element reachable in document order, system-command CTAs use semantic `<a>` with visible focus state.

AAA contrast is not a target — voltage as primary signal would have to be sacrificed, and it carries too much of the brand identity to compromise.
