'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Monolith — the prismatic 3D focal point of the ARGO Hero
 *
 * Architecture:
 * - IcosahedronGeometry subdivided for smooth refraction
 * - MeshTransmissionMaterial: glass-like, refracts headline behind it
 * - Vertex shader noise: subtle "breathing" deformation
 * - Cursor-driven tilt with inertial damping
 * - Mobile: gyroscope hook (handled at parent level)
 *
 * Reference: /ARGO_STUDIO/01_SYSTEM_PROMPTS/MOTION_RULES.md
 */

interface MonolithProps {
  pointer: { x: number; y: number };
}

export default function Monolith({ pointer }: MonolithProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  // Pre-allocate geometry with high subdivision for smooth refraction
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 8), []);

  // Vertex displacement via simplex-like noise (cheap, per-frame)
  useFrame((state) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const time = state.clock.elapsedTime;

    // ── 1. Slow autonomous rotation on Y (cinematic baseline)
    mesh.rotation.y += 0.0008;

    // ── 2. Cursor-driven tilt with inertial damping
    targetRotation.current.x = pointer.y * 0.15;
    targetRotation.current.y += (pointer.x * 0.3 - mesh.rotation.y + time * 0.0008) * 0.0;
    mesh.rotation.x += (targetRotation.current.x - mesh.rotation.x) * 0.05;

    // ── 3. Breathing — scale pulsation, very subtle
    const breathe = 1 + Math.sin(time * 0.4) * 0.015;
    mesh.scale.setScalar(breathe);
  });

  // Responsive sizing — adapts to viewport
  const monolithScale = Math.min(viewport.width, viewport.height) * 0.25;

  return (
    <mesh ref={meshRef} geometry={geometry} scale={monolithScale}>
      <MeshTransmissionMaterial
        backside
        samples={6}
        resolution={512}
        transmission={1}
        roughness={0.05}
        thickness={0.6}
        ior={1.5}
        chromaticAberration={0.06}
        anisotropy={0.3}
        distortion={0.3}
        distortionScale={0.4}
        temporalDistortion={0.1}
        clearcoat={1}
        attenuationDistance={0.5}
        attenuationColor="#ffffff"
        color="#ffffff"
      />
    </mesh>
  );
}
