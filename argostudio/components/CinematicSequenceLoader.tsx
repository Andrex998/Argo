'use client';

import dynamic from 'next/dynamic';

const CinematicSequence = dynamic(
  () => import('@/components/CinematicSequence'),
  { ssr: false }
);

export default function CinematicSequenceLoader() {
  return <CinematicSequence />;
}
