'use client';

import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Monolith — clean Group/Mesh separation:
 *   - Outer <group> = GSAP territory (scroll-driven scale)
 *   - Inner <mesh> = useFrame territory (breathing + rotation + base scale)
 */

interface MonolithProps {
  pointer: { x: number; y: number };
}

const Monolith = forwardRef<THREE.Group, MonolithProps>(function Monolith(
  { pointer },
  ref
) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const { size, viewport } = useThree();

  useImperativeHandle(ref, () => groupRef.current as THREE.Group, []);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 8), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const time = state.clock.elapsedTime;

    mesh.rotation.y += 0.0015;

    targetRotation.current.x = pointer.y * 0.08;
    targetRotation.current.y = pointer.x * 0.08;
    mesh.rotation.x += (targetRotation.current.x - mesh.rotation.x) * 0.03;

    const isMobile = size.width < 768;
    const isTablet = size.width >= 768 && size.width < 1024;
    const baseSize = isMobile
      ? Math.min(viewport.width, viewport.height) * 0.18
      : isTablet
      ? Math.min(viewport.width, viewport.height) * 0.22
      : Math.min(viewport.width, viewport.height) * 0.28;

    const breathe = 1 + Math.sin(time * 0.3) * 0.01;
    mesh.scale.setScalar(baseSize * breathe);
  });

  return (
    <group ref={groupRef} position={[0, -0.3, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <MeshTransmissionMaterial
          backside
          samples={4}
          resolution={256}
          transmission={1}
          roughness={0.15}
          thickness={0.5}
          ior={1.3}
          chromaticAberration={0.03}
          anisotropy={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          attenuationDistance={0.8}
          attenuationColor="#ffffff"
          color="#ffffff"
        />
      </mesh>
    </group>
  );
});

export default Monolith;
