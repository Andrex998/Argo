---
name: ARGO Studio
description: Cinematic web experiences for future-forward brands. The design system for a studio that operates one tier above the saturated cinematic-agency layer.
colors:
  void: "#000000"
  obsidian: "#050507"
  graphite: "#0E0E11"
  bone: "#F5F5F7"
  pearl: "#D4D4D8"
  smoke: "#9CA3AF"
  ash: "#52525B"
  chrome: "#C7C9CC"
  mercury: "#A1A4A8"
  voltage: "#3B8EFF"
  plasma: "#0066FF"
  deep-blue: "#0033CC"
typography:
  display-xl:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(64px, 12vw, 160px)"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  display-l:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(48px, 8vw, 112px)"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  display-m:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(40px, 6vw, 80px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
  heading-l:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.5vw, 44px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading-m:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(22px, 2.5vw, 32px)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body-l:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body-m:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  micro:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  argo-sm: "4px"
  argo-md: "8px"
  argo-lg: "16px"
  argo-xl: "24px"
  argo-2xl: "32px"
spacing:
  section-y: "8rem"
  section-x-lg: "6rem"
components:
  cta-system:
    typography: "{typography.micro}"
    textColor: "{colors.pearl}"
    padding: "0 0 4px 0"
  cta-system-hover:
    textColor: "{colors.voltage}"
  card-glass:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.bone}"
    rounded: "{rounded.argo-lg}"
    padding: "32px"
  nav-link:
    typography: "{typography.micro}"
    textColor: "{colors.pearl}"
  nav-link-hover:
    textColor: "{colors.voltage}"
---

# Design System: ARGO Studio

## 1. Overview

**Creative North Star: "Apparition in the Void."**

The system is built around two opposing physical forces: **mass** (the deep void, the monumental headline, the refractive glass monolith) and **voltage** (a single electric blue, used as a verdict rather than a decoration). Nothing else is allowed on screen. Every component, every spacing decision, every easing curve serves one of those two forces or it gets cut. The result is meant to feel less like a website and more like architecture arriving in the room — gravitationally heavy, slightly impossible, calm.

The palette is **all black, with one signal blue**. The typography is **all Geist**, ranging from 12px monospace labels (data tags, system commands) to 160px display weight (declarations of identity). There are no decorative gradients, no secondary accent hues, no warm fills. The page is closer to a film leader card or a Bottega Veneta product page than to a contemporary SaaS site.

This system explicitly rejects the saturated cinematic-agency layer: no purple-to-blue gradients, no hero metrics, no identical card grids with rounded-icon tiles above headings, no SaaS-cream backgrounds, no "we craft experiences" boilerplate. If a casual viewer can name the template within 5 seconds, the project has failed.

**Key Characteristics:**
- One accent. One voice. One verdict per viewport.
- Negative space is the primary material. Three-quarters of any frame is void.
- Type carries the brand louder than color does.
- Glass and refraction stand in for shadow and elevation.
- Motion is gravitational, never bouncy.

## 2. Colors: The Void and the Signal

A two-tension palette. Eight blacks-and-greys carry every surface and every text role; one voltage blue carries every moment of emphasis. There is no third color.

### Primary

- **Voltage** (`#3B8EFF`): the single accent of the system. Used for headline punctuation (`We build presence.`), focus rings, link hover, the eyebrow label above every section, the section-anchor light inside the 3D scene. Voltage never appears as a fill on large surfaces; it appears as a 1-line verdict, a pulse, or a 1px border.
- **Plasma** (`#0066FF`): solid CTA fill. Reserved for the future primary action button if one is ever introduced; not currently in use across the site (system-command links carry the CTA role instead). Hold in reserve.
- **Deep Blue** (`#0033CC`): pressed-state companion to Plasma. Hold in reserve.

### Neutral — Backgrounds

- **Void** (`#000000`): true black. The background of the Hero section and any frame that wants the maximum sense of mass. Used sparingly precisely because absolute black is heavy.
- **Obsidian** (`#050507`): primary surface (≈99% of the screen across the site). Slightly warmer than pure black; reads as black to the eye but breathes.
- **Graphite** (`#0E0E11`): elevated surfaces, base color underneath every glass panel.

### Neutral — Foregrounds

- **Bone** (`#F5F5F7`): primary text. Every heading, every body paragraph by default. Never `#fff` — bone is slightly off-white on purpose, to read calm rather than clinical.
- **Pearl** (`#D4D4D8`): secondary text, sub-headings, the "Cinematic web experiences..." line under the hero, navigation links at rest.
- **Smoke** (`#9CA3AF`): tertiary text, captions, meta, the scroll-indicator label, the index number on each service card, the bottom-of-card description text.
- **Ash** (`#52525B`): disabled / placeholder. Currently used only in latent states.

### Neutral — Chrome

- **Chrome** (`#C7C9CC`): premium accents, dividers in long-form text. Currently rare; used only when a divider must read as "engineered metal" rather than "design afterthought".
- **Mercury** (`#A1A4A8`): subtle borders, UI ornaments. Currently unused; reserved.

### Named Rules

**The One Voice Rule.** Voltage (`#3B8EFF`) covers ≤10% of any visible viewport area at rest. Its rarity is the entire mechanism by which it carries weight. Two voltage moments per viewport, never three. If a third voltage element wants to enter, demote it to Pearl or Smoke.

**The No-Pure-White Rule.** `#FFFFFF` is forbidden as a text or surface color. Use Bone (`#F5F5F7`). The 1.8% reduction in luminance is what separates "calm presence" from "operating-room glare."

**The No-Pure-Black-Except-The-Void Rule.** `#000000` is reserved for the Void itself (the Hero background, the canvas behind the 3D layer). Every other "black" surface is Obsidian (`#050507`). Pure black absorbs all neighboring color and flattens the depth of the surrounding palette.

**The No-Gradient Rule.** Background gradients between brand colors are prohibited. The single permitted use of `background-image: linear-gradient` is the cinematic vignette and the noise overlay, both of which are non-color gradients (void-to-transparent, neutral-to-transparent). Voltage-to-Plasma gradients on text or surfaces are the signature of every SaaS template and are banned by reflex.

## 3. Typography

**Display & Body Font:** Geist (Vercel), loaded via `next/font/google` and exposed as `--font-geist-sans`.
**Mono / Label Font:** Geist Mono, exposed as `--font-geist-mono`.

**Character:** A single typeface family carries the entire system from 12px system labels to 160px declarations. The choice is intentional: Geist is mechanical enough to label a service grid and humane enough to land a manifesto. Pairing it with Geist Mono for the monospace tier produces visual unity at every scale, which is the typographic equivalent of one-color confidence.

### Hierarchy

- **Display XL** (Geist 500, `clamp(64px, 12vw, 160px)`, lineHeight 0.95, letterSpacing -0.04em): the Hero headline ("We don't build pages. We build presence."). Reserved exclusively for one-time declarations of identity. There is at most one display-xl element per page.
- **Display L** (Geist 500, `clamp(48px, 8vw, 112px)`, lineHeight 0.95, letterSpacing -0.04em): section titles ("What we engineer.", manifesto title). One per section.
- **Display M** (Geist 500, `clamp(40px, 6vw, 80px)`, lineHeight 1, letterSpacing -0.02em): the Footer monolithic line. Smaller scale for closing statements.
- **Heading L** (Geist 500, `clamp(28px, 3.5vw, 44px)`, lineHeight 1.1, letterSpacing -0.02em): currently held in reserve for future Showcase / Case Study sections.
- **Heading M** (Geist 500, `clamp(22px, 2.5vw, 32px)`, lineHeight 1.15, letterSpacing -0.02em): service card titles, manifesto body large text. The "carrier" weight for content-dense areas.
- **Heading S** (Geist 500, `clamp(18px, 2vw, 22px)`, lineHeight 1.2, letterSpacing -0.01em): the Header logotype.
- **Body L** (Geist 400, 18px, lineHeight 1.5): hero subtitle, primary body copy.
- **Body M** (Geist 400, 16px, lineHeight 1.5): service card description text, default paragraph.
- **Micro** (Geist Mono 400, 12px, lineHeight 1.3, letterSpacing 0.08em, uppercase): every section eyebrow ("Services", "Manifesto"), every navigation link, every system-command CTA, every footer link, every service card index number. The "data tag" voice of the system.

### Named Rules

**The -0.04em Rule.** Every Display tier uses `letterSpacing: -0.04em` (or -0.02em from Display M down). This is not optional. Standard tracking on a display headline reads as "Inter on a SaaS landing page"; tight negative tracking is what makes Geist behave like Söhne or NB Architekt. If the tracking ever drifts to 0, the type loses its monumentality.

**The All-Caps-Mono Rule.** Every label, eyebrow, nav link, and CTA across the entire site is `font-mono uppercase tracking-[0.16em]` at 12px (Micro). This rule unifies the system: if it is metadata, it speaks in caps mono; if it is content, it speaks in Geist sans. No exceptions, no third voice.

**The One-Display-Per-Section Rule.** A section may have one Display-tier element (xl, l, or m). The second monumental headline within the same scroll-frame breaks the gravitational pacing and makes both elements feel smaller, not larger.

**The Editorial Line-Length Rule.** Body copy never exceeds the equivalent of `max-w-md` (28rem) or `max-w-prose`. The hero sub ("Cinematic web experiences for future-forward brands") is intentionally 4 words wide because density is what separates manifesto voice from blog voice.

## 4. Elevation

**Flat by reflex. Refractive by signature.**

The system rejects traditional `box-shadow` for depth. Surfaces sit at one of two altitudes: directly on the void, or floated as a glass plane. Depth is conveyed through **transmission, refraction, and tonal layering**, not through cast shadows.

### Tonal Layering

The neutral background ramp is the primary depth tool: Void → Obsidian (+5 luminance) → Graphite (+9 luminance) → Bone (≈97 luminance). A surface at Graphite reads as "elevated above Obsidian" by purely tonal means.

### Glass System

The single material vocabulary for elevated surfaces. Three controlled tiers, never improvised:

- **`glass-subtle`** (`bg-white/[0.03] border border-white/[0.06] backdrop-blur-glass`): the Header pill ("Start a project"), the lightest possible lift.
- **`glass-default`** (`bg-white/[0.05] border border-white/[0.08] backdrop-blur-glass`): every Service card. The "carrier" tier.
- **`glass-prominent`** (`bg-white/[0.08] border border-white/[0.12] backdrop-blur-glass`): held in reserve for future call-out blocks. Currently unused.

`backdrop-blur-glass` is fixed at 24px across all three.

### Voltage Glow (the only "shadow")

The system permits **one** non-material shadow vocabulary, and it is energetic, not gravitational:

- **`shadow-glow-subtle`** (`0 0 24px rgba(59, 142, 255, 0.15)`): service card on hover.
- **`shadow-glow-medium`** (`0 0 48px rgba(59, 142, 255, 0.25)`): held in reserve for primary CTA hover state.
- **`shadow-glow-strong`** (`0 0 96px rgba(59, 142, 255, 0.40)`): held in reserve for any future hero-action peak moment.
- **`shadow-glow-inner`** (`inset 0 0 24px rgba(59, 142, 255, 0.10)`): held in reserve for inputs / focused states.

### Named Rules

**The No-Shadow-Without-Voltage Rule.** If a shadow is dark (rgba black, gray), it is not allowed. Depth comes from tonal layering and glass refraction, never from drop-shadow. The only legal `box-shadow` values in the system contain the voltage RGB triplet (59, 142, 255) — every shadow in this system is light, not darkness.

**The Two-Glows-Per-Viewport Rule.** At most two `shadow-glow-*` instances may be visible at the same time. The whole point of the voltage signal is that it is rare; three or more glows collapse into "particle field" and break the spell.

## 5. Components

### System-Command CTA (signature pattern)

The site's primary call-to-action pattern. **Not a button.** A typography-only invitation that behaves like a command-line entry.

- **Shape:** none. No rounded corners, no background fill, no enclosing rectangle.
- **Type:** Micro (Geist Mono 12px, uppercase, tracking 0.08em–0.18em).
- **Color at rest:** Pearl text, `border-bottom: 1px solid rgba(255,255,255,0.10)`, 4px bottom padding.
- **Color on hover:** Voltage text, voltage-tinted underline (`rgba(59,142,255,0.50)`), 700ms `ease-silk` transition.
- **Secondary variant:** Smoke text, `border-bottom: 1px solid rgba(255,255,255,0.06)`. Hover → Pearl + `rgba(255,255,255,0.20)`.
- **Used for:** "Start a project", "Our manifesto", every footer link, every navigation entry.

### Header Pill (rare exception)

The single conventionally-shaped CTA on the site, intentionally restrained.

- **Shape:** `rounded-full`, glass-subtle, 20px / 10px padding.
- **Type:** Micro (mono, uppercase), text-bone.
- **Hover:** `shadow-glow-subtle` (voltage glow), 300ms `ease-silk`.
- **Used for:** "Start a project" in the persistent header nav.

### Service Card (signature pattern)

- **Shape:** `rounded-argo-lg` (16px). Sharper than the SaaS-default 24px+, softer than brutalist 0px.
- **Background:** `glass-default` over a Graphite base.
- **Border:** `border border-white/[0.08]` at rest; `border-voltage/20` on hover.
- **Internal padding:** 32px (`p-8`) on all sides. Generous.
- **Internal hierarchy:** Index number (Smoke, Micro mono, top-left) ↔ stroke icon (Pearl, transitioning to Voltage on hover, top-right) → 40px vertical gap → Heading M title (Bone) → 16px gap → Body M description (Smoke).
- **Hover state:** `-translate-y-1` (4px lift), border darkens to voltage/20, `shadow-glow-subtle` activates, icon recolors to Voltage. Transition: 600ms `ease-smooth-out`.
- **Icon language:** all icons are inline SVG, 24×24, `stroke-width: 1.5`, `stroke-linecap: round`, `stroke-linejoin: round`. No fills. No emoji. No raster icons. **No icon-on-tile-with-background** — the icon sits naked against the glass surface.

### Navigation Link

- **Type:** Micro (Geist Mono, uppercase, tracking-widest).
- **At rest:** Pearl.
- **Hover:** Voltage, 300ms `ease-silk`.
- **Active section indicator:** held in reserve (TBD; the system does not currently use one).

### Section Eyebrow (signature pattern)

The label above every section title.

- **Type:** Micro (Geist Mono, uppercase, tracking 0.16em).
- **Color:** Voltage.
- **Spacing below:** 32px (`mt-8`) before the section title.
- **Examples:** "Services", "Manifesto".

### The Monolith (signature 3D component)

The central object of the Hero scene. Documented as a component because it functions as the brand mark in motion.

- **Geometry:** `THREE.IcosahedronGeometry(1, 8)` — 8 subdivisions, near-spherical but faceted enough to refract light unevenly.
- **Material:** `MeshTransmissionMaterial`, samples 4, resolution 256, transmission 1, roughness 0.15, thickness 0.8, ior 1.35, chromaticAberration 0.04, attenuation color `#a8c8ff`.
- **Lighting:** **No HDRI environment.** Only three custom point lights — a pulsing voltage rim from the left, a deep-blue counter-rim from the right-back, a cold floor bounce from below.
- **Motion at rest:** auto-rotation (Y axis, 0.0015 rad/frame), micro-drift (sinusoidal Y, amplitude 0.05u, period ~15s), lazy parallax tracking the cursor with 0.05 damping, subtle breathing (1% scale oscillation).
- **Motion on scroll:** camera flies forward `z: 4 → -2`, passing through the glass; the monolith scales `1 → 1.08`; hero text fades to 0 opacity.

### Named Rules

**The No-Button-Frame Rule.** Buttons with `rounded-md` rectangles and background fills are forbidden in body content. The only acceptable enclosed CTA is the Header Pill, and only because it lives at the top-right of the viewport where convention is appropriate. Inside content, every CTA is a system-command line.

**The No-Icon-Tile Rule.** Icons must never sit inside a `rounded-md` colored tile (the SaaS-card signature). They sit naked against the surface, monochrome at rest, voltage on interaction.

## 6. Do's and Don'ts

### Do:

- **Do** treat Voltage (`#3B8EFF`) as a verdict, not a decoration. One use per viewport, two maximum.
- **Do** anchor every section in negative space. Three-quarters of any frame should be void; copy lives in the upper third, the lower two-thirds breathe.
- **Do** use Micro (Geist Mono 12px, uppercase, tracking 0.16em) for every label, eyebrow, nav link, and CTA. The all-caps-mono register is the system's metadata voice.
- **Do** keep display-tier headlines at `letterSpacing: -0.04em` and `lineHeight: 0.95`. The tracking is the brand.
- **Do** use the cinematic easing curves for every motion (`cinematic`, `smooth-out`, `silk`, `inertial`). The fixed duration scale (`micro / fast / base / medium / slow / epic`) is non-negotiable.
- **Do** respect `prefers-reduced-motion`: GSAP timelines short-circuit, Lenis disables, the 3D scene returns null.
- **Do** keep all elevated surfaces in the three-tier glass system (`glass-subtle / default / prominent`).
- **Do** use Bone (`#F5F5F7`) for primary text and Obsidian (`#050507`) for surfaces. Never pure black, never pure white.

### Don't:

- **Don't** introduce purple-to-blue gradients, hero metrics, or rounded-icon-tiles-above-headings. Those are the SaaS-cinematic template the site exists to escape.
- **Don't** build identical card grids with icon + heading + text repeated endlessly without internal variation. Service cards earn their grid by varying iconography, copy density, and hover treatment.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent. Side-stripe borders are banned by reflex.
- **Don't** apply `background-clip: text` to a gradient. Gradient text is decorative-by-default and is forbidden across the system.
- **Don't** use glassmorphism decoratively. Glass appears only on the three approved tiers and only on surfaces that genuinely lift above the void.
- **Don't** use the `<Environment preset="..." />` helper in any 3D scene. HDRI presets reflect natural landscapes onto the glass and override `MeshTransmissionMaterial`; only custom point lights are allowed.
- **Don't** wrap copy in containers wider than `max-w-md` (28rem) for body text or `max-w-3xl` for section headers. The editorial line-length rule is what keeps the system from drifting into blog voice.
- **Don't** use `#FFFFFF` or `#000000` for anything except the absolute Void surface. Use Bone and Obsidian.
- **Don't** add bouncy or elastic easings. Motion in this system is gravitational; springs are banned except for the single `spring` token, which is held in reserve and unused at present.
- **Don't** use em dashes (—) in copy. Use commas, colons, semicolons, periods, or parentheses.
- **Don't** write "we craft experiences", "we are passionate", "the future is now", or any voiceover-tier marketing copy. The studio describes work, never performance.
- **Don't** ship a section that could still work with a different studio's logo on it. Every section must contain at least one decision a template can't replicate.
