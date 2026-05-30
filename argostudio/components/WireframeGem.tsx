'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

// ── Types ──────────────────────────────────────────────────────────────────────

interface WireframeGemProps {
  size?: number;
  color?: string;
  speed?: number;
  initialAngle?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ── Geometry ───────────────────────────────────────────────────────────────────

// Elongated octahedron (crystal/gem proportions)
// Indices: 0=apex, 1=nadir, 2=A, 3=B, 4=C, 5=D
const BASE_VERTICES: [number, number, number][] = [
  [ 0,   -1.4,  0  ], // 0 apex
  [ 0,    1.4,  0  ], // 1 nadir
  [ 0.8,  0,    0.5], // 2 A
  [-0.8,  0,    0.5], // 3 B
  [ 0.8,  0,   -0.5], // 4 C
  [-0.8,  0,   -0.5], // 5 D
];

const EDGES: [number, number][] = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 4], [4, 5], [5, 3], [3, 2],
];

// ── 3D Math ────────────────────────────────────────────────────────────────────

function rotateY(v: [number, number, number], angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    v[0] * cos + v[2] * sin,
    v[1],
    -v[0] * sin + v[2] * cos,
  ];
}

function rotateX(v: [number, number, number], angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    v[0],
    v[1] * cos - v[2] * sin,
    v[1] * sin + v[2] * cos,
  ];
}

function project(v: [number, number, number], size: number): [number, number, number] {
  const d = 4;
  const scale = d / (d + v[2]);
  return [
    v[0] * scale * size * 0.38 + size / 2,
    v[1] * scale * size * 0.38 + size / 2,
    v[2], // preserve Z for depth sorting
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function WireframeGem({
  size = 200,
  color = '#61FFA7',
  speed = 0.007,
  initialAngle = 0,
  className,
  style,
}: WireframeGemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef  = useRef({ y: initialAngle });
  const floatRef  = useRef<gsap.core.Tween | null>(null);

  // Fixed X tilt (~0.25 rad) applied every frame
  const TILT_X = 0.25;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // ── GSAP ticker: rotate + draw ─────────────────────────────────────────
    const ticker = () => {
      angleRef.current.y += speed;

      ctx.clearRect(0, 0, size, size);

      // Transform all vertices
      const projected = BASE_VERTICES.map((v) => {
        const ry = rotateY(v, angleRef.current.y);
        const rx = rotateX(ry, TILT_X);
        return project(rx, size);
      });

      // Build edge list with average Z for painter's algorithm
      const sortedEdges = EDGES.map(([a, b]) => {
        const za = projected[a][2];
        const zb = projected[b][2];
        return { a, b, avgZ: (za + zb) / 2 };
      }).sort((e1, e2) => e1.avgZ - e2.avgZ); // back-to-front (back drawn first)

      // Draw edges
      for (const edge of sortedEdges) {
        const [ax, ay] = projected[edge.a];
        const [bx, by] = projected[edge.b];

        // Map avgZ from [-1, 1] → alpha and lineWidth
        // z near -1 = far back → dim; z near +1 = front → bright
        const t = (edge.avgZ + 1) / 2; // 0..1
        const alpha     = 0.15 + t * (0.9 - 0.15); // 0.15 → 0.9
        const lineWidth = 0.6  + t * (1.0 - 0.6);  // 0.6  → 1.0

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth   = lineWidth;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    gsap.ticker.add(ticker);

    // ── GSAP floating tween ────────────────────────────────────────────────
    const floatDuration = 3 + Math.random() * 2;
    floatRef.current = gsap.to(canvas, {
      y: 12,
      duration: floatDuration,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });

    // Initial float position: start from -12 so the animation centres correctly
    gsap.set(canvas, { y: -12 });

    return () => {
      gsap.ticker.remove(ticker);
      floatRef.current?.kill();
    };
  }, [size, color, speed, initialAngle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        display: 'block',
        ...style,
      }}
    />
  );
}
