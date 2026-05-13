# ARGO Studio — V1

> Cinematic web experiences for future-forward brands.

The flagship/manifesto website for ARGO Studio.

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **Framework:** Next.js 15 (App Router) · React 19 · TypeScript 5
- **Styling:** Tailwind CSS v4 · Geist (display, body, mono)
- **Motion:** Framer Motion · GSAP + ScrollTrigger · Lenis (to be added)
- **3D:** Three.js + React Three Fiber + Drei (to be added)

## Project structure

```
argostudio/
├── app/
│   ├── globals.css      # Tailwind import + global primitives
│   ├── layout.tsx       # Root layout, Geist fonts, Three.js canvas layer
│   └── page.tsx         # Homepage with Hero scaffold
├── components/
│   ├── Header.tsx       # Fixed nav with glass CTA
│   └── Footer.tsx       # Editorial outro
├── motion/
│   ├── easings.ts       # Cinematic cubic-beziers
│   └── durations.ts     # Fixed duration scale
├── hooks/
│   └── useReducedMotion.ts
├── tailwind.config.ts   # Design System tokens (LOCKED v1.0)
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

## Design System

All visual tokens are defined in `tailwind.config.ts`. Use the utility classes directly:

```tsx
<div className="bg-obsidian text-bone font-display text-display-l shadow-glow-medium">
```

For complete token documentation see `/ARGO_STUDIO/03_BRANDING/PALETTE_AND_TYPE.md` in the team Drive.

## Motion principles

See `/ARGO_STUDIO/01_SYSTEM_PROMPTS/MOTION_RULES.md`. Never use Tailwind's default easings — always reference `ease-cinematic`, `ease-silk`, `ease-smooth-out`, or `ease-inertial`.

## Team

- **Andrea Lo Cascio** — Founder & Creative Director
- **Claude** — Lead UI/React Developer & Motion Engineer
- **ChatGPT** — Strategy & Copy
- **Gemini** — Research & Inspiration

## Next blocks

1. Manifesto section
2. Services grid with hover micro-interactions
3. Interactive 3D scene (Gemini + Claude collab)
4. Showcase carousel
5. Lenis smooth scroll integration
6. ScrollTrigger storytelling sequences

## License

© 2026 ARGO Studio. All rights reserved.
