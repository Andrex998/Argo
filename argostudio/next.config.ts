import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'gsap',
      '@react-three/fiber',
      '@react-three/drei',
    ],
  },
};

export default nextConfig;
