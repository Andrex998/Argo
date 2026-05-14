'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import Monolith from './scene/Monolith';
import Effects from './scene/Effects';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSceneStore } from '@/stores/sceneStore';

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
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const targetPointer = useRef({ x: 0, y: 0 });
  const monolithRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    setMounted(true);

    const handlePointerMove = (event: PointerEvent) => {
      targetPointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetPointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    let rafId: number;
    const tick = () => {
      setPointer((prev) => ({
        x: prev.x + (targetPointer.current.x - prev.x) * 0.03,
        y: prev.y + (targetPointer.current.y - prev.y) * 0.03,
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
        <pointLight
          position={[-2.5, 1.2, 0.8]}
          color="#3B8EFF"
          intensity={1.5}
          distance={5}
          decay={2}
        />
        <pointLight
          position={[2, -1, 2]}
          color="#ffffff"
          intensity={0.4}
        />
        <Monolith pointer={pointer} ref={monolithRef} />
        <Effects />
        <SceneBinder monolithRef={monolithRef} />
      </Suspense>
    </Canvas>
  );
}
