'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import Monolith from './scene/Monolith';
import Effects from './scene/Effects';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * ImmersiveScene — Three.js Canvas wrapper for the ARGO 3D layer
 *
 * Mounts into #argo-canvas-layer (defined in app/layout.tsx).
 * Configuration:
 *   - frameloop="demand" → renders only when state changes (battery-friendly)
 *   - dpr adaptive: [1, 1.5] mobile, [1, 2] desktop
 *   - HDR environment preset for credible reflections
 *   - Pointer tracking at window level (canvas is pointer-events-none)
 *   - Reduced motion: skips entire scene, renders nothing
 *
 * Reference: PALETTE_AND_TYPE.md, MOTION_RULES.md
 */

export default function ImmersiveScene() {
  const prefersReduced = useReducedMotion();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const targetPointer = useRef({ x: 0, y: 0 });

  /* ── Pointer tracking with inertial damping ── */
  useEffect(() => {
    setMounted(true);

    const handlePointerMove = (event: PointerEvent) => {
      // Normalize to [-1, 1] range
      targetPointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetPointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    // Smooth pointer interpolation at 60fps
    let rafId: number;
    const tick = () => {
      setPointer((prev) => ({
        x: prev.x + (targetPointer.current.x - prev.x) * 0.05,
        y: prev.y + (targetPointer.current.y - prev.y) * 0.05,
      }));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  /* ── Reduced motion: render nothing ── */
  if (prefersReduced || !mounted) {
    return null;
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 35 }}
      dpr={[1, typeof window !== 'undefined' && window.innerWidth < 768 ? 1.5 : 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      frameloop="always"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <Suspense fallback={null}>
        {/* HDR environment for credible glass refraction */}
        <Environment preset="night" />

        {/*
         * Ambient fill — near-zero, just enough to prevent total black
         * on the unlit face without lifting the void atmosphere.
         */}
        <ambientLight intensity={0.04} />

        {/*
         * Voltage rim light — grazes the edge of the glass from the
         * upper-left, not washing the scene. Rule: signal, not flood.
         *   position  [−2.5, 1.2, 0.8] = left rim, slightly behind
         *   intensity 1.5               = visible but not dominant
         *   distance  5                 = falls off before reaching DOM
         */}
        <pointLight
          position={[-2.5, 1.2, 0.8]}
          color="#3B8EFF"
          intensity={1.5}
          distance={5}
        />

        {/* The monolith — refracts everything behind */}
        <Monolith pointer={pointer} />

        {/* Post-processing pipeline */}
        <Effects />
      </Suspense>
    </Canvas>
  );
}
