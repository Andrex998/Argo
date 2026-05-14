'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface MonolithProps {
  pointer: { x: number; y: number };
}

export default function Monolith({ pointer }: MonolithProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 8), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const time = state.clock.elapsedTime;
    const { viewport } = state;

    // ── 1. Imperceptibly slow rotation — feels like planetary mass
    mesh.rotation.y += 0.0015;

    // ── 2. Cursor-driven tilt with inertial damping (factor 0.05)
    const targetX = pointer.y * 0.12;
    mesh.rotation.x += (targetX - mesh.rotation.x) * 0.05;

    // ── 3. Breathing — fixes the scale override bug:
    //    scale.setScalar must include the responsive base scale,
    //    otherwise it resets to 1 and ignores viewport sizing.
    const baseScale = Math.min(viewport.width, viewport.height) * 0.26;
    const breathe = 1 + Math.sin(time * 0.4) * 0.012;
    mesh.scale.setScalar(baseScale * breathe);
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      {/*
       * MeshTransmissionMaterial — Gemini-calibrated for premium glass
       * without mobile artifacting:
       *   resolution 256   → halves render-target cost, kills noise on mobile
       *   ior 1.3          → softer refraction, less distortion at edges
       *   thickness 0.5    → credible depth without extreme bending
       *   roughness 0.15   → slight frosting keeps the premium feel
       *   chromaticAberration 0.03 → subtle prismatic split, not aggressive
       *   samples 4        → down from 6; imperceptible quality loss on glass
       *   Removed: distortion / temporalDistortion — primary mobile artifact sources
       */}
      <MeshTransmissionMaterial
        backside
        samples={4}
        resolution={256}
        transmission={1}
        roughness={0.15}
        thickness={0.5}
        ior={1.3}
        chromaticAberration={0.03}
        anisotropy={0.3}
        clearcoat={1}
        attenuationDistance={0.6}
        attenuationColor="#ffffff"
        color="#ffffff"
      />
    </mesh>
  );
}
