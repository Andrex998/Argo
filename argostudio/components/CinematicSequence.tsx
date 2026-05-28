'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const MAX_FRAMES = 100;

function frameSrc(index: number): string {
  return `/assets/sequence/frame_${String(index + 1).padStart(3, '0')}.webp`;
}

// Pure cover-fit draw — no closure, no stale refs.
function drawFrame(
  canvas: HTMLCanvasElement,
  images: (HTMLImageElement | null)[],
  n: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const idx = Math.round(Math.max(0, Math.min(n, images.length - 1)));
  const img = images[idx];

  if (img && img.complete && img.naturalWidth > 0) {
    const { width, height } = canvas;
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const x = (width  - img.naturalWidth  * scale) / 2;
    const y = (height - img.naturalHeight * scale) / 2;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
  } else {
    // Placeholder: obsidian void until frames arrive
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

export default function CinematicSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const frameRef  = useRef({ n: 0 });

  // Keep canvas pixel dimensions in sync with the viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(canvas, imagesRef.current, frameRef.current.n);
    };

    syncSize();
    window.addEventListener('resize', syncSize, { passive: true });
    return () => window.removeEventListener('resize', syncSize);
  }, []);

  // Preload all frames — first frame painted immediately on arrival
  useEffect(() => {
    const imgs: (HTMLImageElement | null)[] = new Array(MAX_FRAMES).fill(null);
    imagesRef.current = imgs;

    for (let i = 0; i < MAX_FRAMES; i++) {
      const img = new Image();
      img.src = frameSrc(i);
      img.onload = () => {
        imgs[i] = img;
        if (i === 0 && canvasRef.current) {
          drawFrame(canvasRef.current, imagesRef.current, 0);
        }
      };
    }
  }, []);

  // Scroll scrub: full-page scroll position → frame index
  useGSAP(() => {
    gsap.to(frameRef.current, {
      n: MAX_FRAMES - 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: () => {
          if (canvasRef.current) {
            drawFrame(canvasRef.current, imagesRef.current, frameRef.current.n);
          }
        },
      },
    });
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -10,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
