'use client';

import { create } from 'zustand';
import type { MutableRefObject } from 'react';
import type * as THREE from 'three';

/**
 * sceneStore — bridges R3F internal scene refs to external GSAP timelines.
 */

type CameraRef = MutableRefObject<THREE.PerspectiveCamera | null>;
type GroupRef = MutableRefObject<THREE.Group | null>;

interface SceneState {
  cameraRef: CameraRef | null;
  monolithRef: GroupRef | null;
  setCameraRef: (ref: CameraRef) => void;
  setMonolithRef: (ref: GroupRef) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  cameraRef: null,
  monolithRef: null,
  setCameraRef: (ref) => set({ cameraRef: ref }),
  setMonolithRef: (ref) => set({ monolithRef: ref }),
}));
