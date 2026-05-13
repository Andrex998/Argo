'use client';

import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

/**
 * Post-processing pipeline for ARGO ImmersiveScene
 *
 * Pipeline order (matters — non-commutative):
 * 1. Bloom — picks up voltage glow, makes light feel emissive
 * 2. ChromaticAberration — subtle edge fringing, cinematic feel
 * 3. Noise — film grain, breaks digital flatness
 * 4. Vignette — focuses attention, premium framing
 *
 * Performance: each pass costs ~0.3ms on M1, ~1ms on mobile.
 * Total budget: ~4ms = still under 16ms frame budget (60fps).
 */

export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.8}
      />
      <ChromaticAberration
        offset={new THREE.Vector2(0.0008, 0.0008)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise
        premultiply
        blendFunction={BlendFunction.OVERLAY}
        opacity={0.04}
      />
      <Vignette
        offset={0.4}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
