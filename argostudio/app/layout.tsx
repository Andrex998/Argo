import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import dynamic from 'next/dynamic';
import './globals.css';

/* ── Fonts ──────────────────────────────────── */
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

/* ── 3D Scene — dynamic import, SSR off (Three.js requires browser) ── */
const ImmersiveScene = dynamic(() => import('@/components/ImmersiveScene'), {
  ssr: false,
});

/* ── Metadata ───────────────────────────────── */
export const metadata: Metadata = {
  title: 'ARGO Studio — Cinematic web experiences for future-forward brands',
  description:
    'Immersive cinematic web experiences for luxury brands, hospitality, fashion, real estate, and premium startups.',
  metadataBase: new URL('https://argostudio.com'),
  openGraph: {
    title: 'ARGO Studio',
    description: 'Cinematic web experiences for future-forward brands.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

/* ── Root Layout ────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="relative min-h-screen bg-void text-bone font-body antialiased overflow-x-hidden">

        {/* ── Three.js Canvas layer ──
            ImmersiveScene mounts here. -z-10 + pointer-events-none. */}
        <div
          id="argo-canvas-layer"
          aria-hidden="true"
          className="fixed top-0 left-0 w-full h-screen -z-10 pointer-events-none"
        >
          <ImmersiveScene />
        </div>

        {/* ── Voltage halo — the "Energy" tension, behind content ── */}
        <div className="voltage-halo" aria-hidden="true" />

        {/* ── Content layer ── */}
        <main className="relative z-0">
          {children}
        </main>

        {/* ── Cinematic vignette — letterbox framing, atop content ── */}
        <div className="cinematic-vignette" aria-hidden="true" />

        {/* ── Noise / Grain overlay — atop everything for film depth ── */}
        <div className="noise-overlay" aria-hidden="true" />

      </body>
    </html>
  );
}
