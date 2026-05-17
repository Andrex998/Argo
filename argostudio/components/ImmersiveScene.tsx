'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import Monolith from './scene/Monolith';
import Effects from './scene/Effects';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSceneStore } from '@/stores/sceneStore';

/**
 * VoltageLight — voltage point light with organic intensity pulse.
 * Lives inside Canvas so useFrame is available.
 * Base intensity lowered (0.8 vs 1.5): energy refracts inside the glass,
 * not flooding the scene from outside.
 */
function VoltageLight() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    lightRef.current.intensity = 0.8 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
  });

  return (
    <pointLight
      ref={lightRef}
      position={[-2.5, 1.2, 0.8]}
      color="#3B8EFF"
      intensity={0.8}
      distance={5}
      decay={2}
    />
  );
}

function SceneBinder({
  monolithRef,
}: {
  monolithRef: React.MutableRefObject<THREE.Group | null>;
}) {
  const { camera } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const setCameraRef = useSceneStore((s) => s.setCameraRef);
  const setMonolithRef = useSceneStore((s) => s.setMonolithRef);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      cameraRef.current = camera;
      setCameraRef(cameraRef);
    }
    setMonolithRef(monolithRef);
  }, [camera, monolithRef, setCameraRef, setMonolithRef]);

  return null;
}

export default function ImmersiveScene() {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const monolithRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (prefersReduced || !mounted) {
    return null;
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 32 }}
      dpr={[1, typeof window !== 'undefined' && window.innerWidth < 768 ? 1.5 : 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'transparent',
      }}
    >
      <Suspense fallback={null}>
        <Environment preset="night" />

        {/* Voltage rim light — pulsing, energy-trapped feel */}
        <VoltageLight />

        {/* Subtle warm fill from below — barely perceptible */}
        <pointLight
          position={[2, -1, 2]}
          color="#ffffff"
          intensity={0.25}
        />

        <Monolith ref={monolithRef} />
        <Effects />
        <SceneBinder monolithRef={monolithRef} />
      </Suspense>
    </Canvas>
  );
}
