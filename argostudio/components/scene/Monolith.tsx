'use client';

import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Monolith — Group/Mesh separation:
 *   - Outer <group> = GSAP territory (scroll-driven scale) + micro-drift
 *   - Inner <mesh>  = useFrame territory (breathing + auto-rotation + parallax)
 *
 * pointer prop removed: rotation now reads state.pointer directly,
 * giving heavier damping (0.05) and the "lazy look" effect.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const Monolith = forwardRef<THREE.Group, {}>(function Monolith(
  _,
  ref
) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.Mesh>(null);
  const { size, viewport } = useThree();

  useImperativeHandle(ref, () => groupRef.current as THREE.Group, []);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 8), []);

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current) return;
    const mesh  = meshRef.current;
    const group = groupRef.current;
    const time  = state.clock.elapsedTime;

    // ── Micro-drift: slow, heavy float (planetary mass feel)
    group.position.y = -0.6 + Math.sin(time * 0.4) * 0.05;

    // ── Auto-rotation
    mesh.rotation.y += 0.0015;

    // ── Slow parallax: lazily tracks cursor with heavy damping
    mesh.rotation.x += (state.pointer.y * 0.15 - mesh.rotation.x) * 0.05;

    // ── Responsive base scale + subtle breathing (smaller for negative space)
    const isMobile  = size.width < 768;
    const isTablet  = size.width >= 768 && size.width < 1024;
    const baseSize  = isMobile
      ? Math.min(viewport.width, viewport.height) * 0.14
      : isTablet
      ? Math.min(viewport.width, viewport.height) * 0.18
      : Math.min(viewport.width, viewport.height) * 0.22;

    const breathe = 1 + Math.sin(time * 0.3) * 0.01;
    mesh.scale.setScalar(baseSize * breathe);
  });

  return (
    <group ref={groupRef} position={[0, -0.6, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        {/*
         * Increased thickness 0.5 → 0.8: light refracts inside the glass
         * instead of glowing outside. The energy is trapped.
         */}
        <MeshTransmissionMaterial
          backside
          samples={4}
          resolution={256}
          transmission={1}
          roughness={0.15}
          thickness={0.8}
          ior={1.35}
          chromaticAberration={0.04}
          anisotropy={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          attenuationDistance={0.6}
          attenuationColor="#a8c8ff"
          color="#ffffff"
        />
      </mesh>
    </group>
  );
});

export default Monolith;
