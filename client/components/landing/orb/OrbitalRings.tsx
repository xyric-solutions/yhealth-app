import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scannerFragmentShader, scannerVertexShader } from "./orb-shaders";

interface OrbitalRingsProps {
  scrollProgress: React.RefObject<{ current: number }>;
}

// ── Scanner Ring (shader-based with sweep) ──────────────────────
function ScannerRing({
  radius,
  color,
  speed,
  tilt,
}: {
  radius: number;
  color: string;
  speed: number;
  tilt: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRadius: { value: radius },
      uColor: { value: new THREE.Color(color) },
    }),
    [radius, color]
  );

  useFrame((state) => {
    // eslint-disable-next-line react-hooks/immutability -- Three.js uniforms must be mutated in useFrame
    uniforms.uTime.value = state.clock.getElapsedTime() * speed;
    if (ref.current) {
      ref.current.rotation.z += 0.001 * speed;
    }
  });

  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.015, 8, 128]} />
      <shaderMaterial
        vertexShader={scannerVertexShader}
        fragmentShader={scannerFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── HUD Arc Segment ─────────────────────────────────────────────
function HUDArc({
  radius,
  arcLength,
  startAngle: _startAngle,
  color,
  rotationSpeed,
  tilt,
}: {
  radius: number;
  arcLength: number;
  startAngle: number;
  color: string;
  rotationSpeed: number;
  tilt: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.z += delta * rotationSpeed;
    }
  });

  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.008, 4, 64, arcLength]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function OrbitalRings({ scrollProgress }: OrbitalRingsProps) {
  const outerRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const sp = scrollProgress.current?.current ?? 0;

    if (outerRef.current) {
      outerRef.current.rotation.y += delta * 0.03;
      outerRef.current.rotation.y += sp * 0.002;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * 0.05;
    }
  });

  return (
    <group>
      {/* ── Primary scanner rings with sweep ── */}
      <group ref={outerRef}>
        <ScannerRing
          radius={3.4}
          color="#00c0d9"
          speed={1.0}
          tilt={[Math.PI * 0.06, 0, 0]}
        />
        <ScannerRing
          radius={2.6}
          color="#7346c2"
          speed={0.7}
          tilt={[Math.PI * -0.04, Math.PI * 0.08, 0]}
        />
      </group>

      <group ref={innerRef}>
        <ScannerRing
          radius={1.8}
          color="#00c0d9"
          speed={1.3}
          tilt={[Math.PI * 0.1, Math.PI * -0.04, 0]}
        />
      </group>

      {/* ── Faint static reference rings ── */}
      <mesh rotation={[Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[3.38, 3.42, 128]} />
        <meshBasicMaterial
          color="#00c0d9"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[4.0, 4.02, 128]} />
        <meshBasicMaterial
          color="#00c0d9"
          transparent
          opacity={0.03}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── HUD arc segments (rotating sci-fi arcs) ── */}
      <HUDArc radius={3.8} arcLength={0.8} startAngle={0} color="#00d4ee" rotationSpeed={0.08} tilt={[0.1, 0, 0]} />
      <HUDArc radius={3.8} arcLength={0.5} startAngle={2.5} color="#7346c2" rotationSpeed={0.08} tilt={[0.1, 0, 0]} />
      <HUDArc radius={4.2} arcLength={1.2} startAngle={0} color="#00c0d9" rotationSpeed={-0.04} tilt={[-0.05, 0.1, 0]} />
      <HUDArc radius={4.2} arcLength={0.4} startAngle={3.5} color="#a78bfa" rotationSpeed={-0.04} tilt={[-0.05, 0.1, 0]} />

      {/* ── Innermost radar grid ring ── */}
      <mesh rotation={[Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[1.3, 1.32, 64]} />
        <meshBasicMaterial
          color="#00c0d9"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
