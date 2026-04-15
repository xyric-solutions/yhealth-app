import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  coreVertexShader,
  coreFragmentShader,
  glowVertexShader,
  glowFragmentShader,
} from "./orb-shaders";

interface AIBrainSphereProps {
  scrollProgress: React.RefObject<{ current: number }>;
  hoverIntensity: React.RefObject<number>;
}

export function AIBrainSphere({ scrollProgress, hoverIntensity }: AIBrainSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const glowRef2 = useRef<THREE.Mesh>(null);

  const coreUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScrollProgress: { value: 0 },
      uHoverIntensity: { value: 0 },
    }),
    []
  );

  const glowUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHoverIntensity: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const sp = scrollProgress.current?.current ?? 0;
    const hi = hoverIntensity.current ?? 0;

    // eslint-disable-next-line react-hooks/immutability -- Three.js uniforms must be mutated in useFrame
    coreUniforms.uTime.value = t;
    coreUniforms.uScrollProgress.value = sp;
    coreUniforms.uHoverIntensity.value = hi;
    // eslint-disable-next-line react-hooks/immutability
    glowUniforms.uTime.value = t;
    glowUniforms.uHoverIntensity.value = hi;

    // Organic breathing scale
    if (meshRef.current) {
      const breathe = 1 + Math.sin(t * 0.4) * 0.025 + Math.sin(t * 0.7) * 0.01;
      meshRef.current.scale.setScalar(breathe);
    }

    // Glow shell subtle counter-rotation
    if (glowRef.current) {
      glowRef.current.rotation.y = t * 0.03;
      glowRef.current.rotation.x = Math.sin(t * 0.2) * 0.05;
    }
    if (glowRef2.current) {
      glowRef2.current.rotation.y = -t * 0.02;
    }
  });

  return (
    <group>
      {/* Core energy sphere — high-detail icosahedron with Perlin displacement */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 5]} />
        <shaderMaterial
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
          uniforms={coreUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Primary outer glow aura */}
      <mesh ref={glowRef} scale={1.5}>
        <icosahedronGeometry args={[1, 3]} />
        <shaderMaterial
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Secondary diffused glow — larger, softer */}
      <mesh ref={glowRef2} scale={2.0}>
        <icosahedronGeometry args={[1, 2]} />
        <shaderMaterial
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner illumination */}
      <pointLight color="#00d4ee" intensity={3} distance={10} decay={2} />
      <pointLight color="#7346c2" intensity={1} distance={6} decay={2} position={[0, 1, 0]} />
    </group>
  );
}
