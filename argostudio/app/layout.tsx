import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
import CinematicSequenceLoader from '@/components/CinematicSequenceLoader';
import './globals.css';

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="relative min-h-screen bg-void text-bone font-body antialiased overflow-x-hidden">
        {/* Cinematic frame sequence — fixed canvas, z-index: -10 */}
        <CinematicSequenceLoader />

        {/* Voltage halo — radial signal behind the sequence (z-index: -5) */}
        <div className="voltage-halo" aria-hidden="true" />

        {/* Cinematic vignette — letterbox-grade framing (z-index: 1) */}
        <div className="cinematic-vignette" aria-hidden="true" />

        {/* Noise grain — top of stack (z-index: 9999) */}
        <div className="noise-overlay" aria-hidden="true" />

        <SmoothScrollProvider>
          <main className="relative z-0">{children}</main>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
