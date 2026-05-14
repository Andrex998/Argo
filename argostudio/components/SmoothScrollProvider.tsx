'use client';

import { ReactNode, useEffect } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { useLenis } from '@/hooks/useLenis';
import { easings } from '@/motion/easings';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase);
}

/**
 * SmoothScrollProvider:
 *   1. Initializes Lenis smooth scroll
 *   2. Registers ARGO easings as named CustomEase tokens for GSAP
 */

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useLenis();

  useEffect(() => {
    CustomEase.create('cinematic', easings.cinematic.join(','));
    CustomEase.create('silk', easings.silk.join(','));
    CustomEase.create('smoothOut', easings.smoothOut.join(','));
    CustomEase.create('inertial', easings.inertial.join(','));
  }, []);

  return <>{children}</>;
}
