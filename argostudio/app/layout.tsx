import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import dynamic from 'next/dynamic';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
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

const ImmersiveScene = dynamic(() => import('@/components/ImmersiveScene'), {
  ssr: false,
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
        <div
          id="argo-canvas-layer"
          aria-hidden="true"
          className="fixed top-0 left-0 w-full h-screen -z-10 pointer-events-none"
        >
          <ImmersiveScene />
        </div>

        <div className="noise-overlay" aria-hidden="true" />

        <SmoothScrollProvider>
          <main className="relative z-0">{children}</main>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
