'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Monolith from './scene/Monolith';
import Effects from './scene/Effects';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSceneStore } from '@/stores/sceneStore';

function VoltageLight() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    lightRef.current.intensity = 2.2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.3;
  });

  return (
    <pointLight
      ref={lightRef}
      position={[-2.5, 1.2, 0.8]}
      color="#3B8EFF"
      intensity={2.2}
      distance={6}
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
        {/* No HDRI — only custom lights touch the glass */}
        <ambientLight intensity={0.03} color="#04040e" />

        {/* Voltage rim — left, pulsing */}
        <VoltageLight />

        {/* Counter-rim — right-back, deep blue: catches opposite glass edge */}
        <pointLight
          position={[3.5, 0.5, -2.5]}
          color="#0a1840"
          intensity={0.6}
          distance={9}
          decay={2}
        />

        {/* Cold floor bounce — barely visible, defines bottom geometry */}
        <pointLight
          position={[0, -3, 1.5]}
          color="#060612"
          intensity={0.2}
          distance={6}
          decay={2}
        />

        <Monolith ref={monolithRef} />
        <Effects />
        <SceneBinder monolithRef={monolithRef} />
      </Suspense>
    </Canvas>
  );
}
