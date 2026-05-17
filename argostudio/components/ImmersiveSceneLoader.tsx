'use client';

import dynamic from 'next/dynamic';

const ImmersiveScene = dynamic(() => import('@/components/ImmersiveScene'), {
  ssr: false,
});

export default function ImmersiveSceneLoader() {
  return <ImmersiveScene />;
}
