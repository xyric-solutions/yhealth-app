import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 400;

// Domain colors for particle palette
const PALETTE = [
  new THREE.Color("#00c0d9"), // teal
  new THREE.Color("#7346c2"), // violet
  new THREE.Color("#d99a00"), // amber
  new THREE.Color("#00e5ff"), // bright cyan
  new THREE.Color("#a78bfa"), // soft violet
  new THREE.Color("#f97316"), // orange
];

interface OrbitalParticlesProps {
  scrollProgress: React.RefObject<{ current: number }>;
}

export function OrbitalParticles({ scrollProgress }: OrbitalParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  /* eslint-disable react-hooks/purity -- particle positions are randomized once on mount via useMemo */
  const { positions, colors, speeds, offsets, radii } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const spd = new Float32Array(PARTICLE_COUNT);
    const off = new Float32Array(PARTICLE_COUNT);
    const rad = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 3.0;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      spd[i] = 0.05 + Math.random() * 0.2;
      off[i] = Math.random() * Math.PI * 2;
      rad[i] = r;
    }

    return { positions: pos, colors: col, speeds: spd, offsets: off, radii: rad };
  }, []);
  /* eslint-enable react-hooks/purity */

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    const sp = scrollProgress.current?.current ?? 0;
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;

    // Scroll-driven speed boost
    const speedMultiplier = 1 + sp * 0.3;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const r = radii[i];
      const theta = offsets[i] + t * speeds[i] * speedMultiplier;
      const phi = Math.acos(positions[i3 + 2] / r);

      // Radial breathing
      const breathe = r + Math.sin(t * 0.3 + offsets[i]) * 0.12;

      posArray[i3] = breathe * Math.sin(phi) * Math.cos(theta);
      posArray[i3 + 1] = breathe * Math.sin(phi) * Math.sin(theta);
      posArray[i3 + 2] = breathe * Math.cos(phi);
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y = t * 0.015;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions.slice(), 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
