import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const DOMAIN_ANGLES = [0, 60, 120, 180, 240, 300];
const DOMAIN_COLORS = [
  "#f97316", // Fitness - orange
  "#34d399", // Nutrition - emerald
  "#a78bfa", // Mindfulness - violet
  "#f59e0b", // Journaling - amber
  "#22d3ee", // Habits - cyan
  "#fb7185", // Relationships - rose
];

const ORBIT_RADIUS = 3.2;
const SPARK_COUNT = 3; // sparks per connection line

interface EnergyConnectionsProps {
  scrollProgress: React.RefObject<{ current: number }>;
  hoveredIndex: React.RefObject<number>;
}

export function EnergyConnections({ scrollProgress: _scrollProgress, hoveredIndex }: EnergyConnectionsProps) {
  const sparksRef = useRef<THREE.Group>(null);

  const nodePositions = useMemo(() => {
    return DOMAIN_ANGLES.map((angle) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return new THREE.Vector3(
        Math.cos(rad) * ORBIT_RADIUS,
        Math.sin(rad) * ORBIT_RADIUS,
        0
      );
    });
  }, []);

  // Create curved connection lines (quadratic bezier for energy arc feel)
  const lineObjects = useMemo(() => {
    return nodePositions.map((endPos, i) => {
      const start = new THREE.Vector3(0, 0, 0);
      const mid = endPos.clone().multiplyScalar(0.5);
      mid.z = 0.3 * (i % 2 === 0 ? 1 : -1); // slight Z curve for depth

      const curve = new THREE.QuadraticBezierCurve3(start, mid, endPos);
      const points = curve.getPoints(40);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: DOMAIN_COLORS[i],
        transparent: true,
        opacity: 0.12,
        dashSize: 0.12,
        gapSize: 0.08,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      return line;
    });
  }, [nodePositions]);

  // Multiple sparks per line
  useFrame((state) => {
    if (!sparksRef.current) return;
    const t = state.clock.getElapsedTime();
    const hi = hoveredIndex.current ?? -1;

    sparksRef.current.children.forEach((spark, idx) => {
      const lineIdx = Math.floor(idx / SPARK_COUNT);
      const sparkIdx = idx % SPARK_COUNT;

      const speed = 0.25 + sparkIdx * 0.15;
      const offset = sparkIdx * 0.33;
      const progress = (t * speed + offset + lineIdx * 0.2) % 1;
      const pos = nodePositions[lineIdx];

      // Lerp along the curved path
      const midZ = 0.3 * (lineIdx % 2 === 0 ? 1 : -1);
      const p = progress;
      const ip = 1 - p;
      spark.position.x = ip * ip * 0 + 2 * ip * p * pos.x * 0.5 + p * p * pos.x;
      spark.position.y = ip * ip * 0 + 2 * ip * p * pos.y * 0.5 + p * p * pos.y;
      spark.position.z = ip * ip * 0 + 2 * ip * p * midZ + p * p * 0;

      // Fade and scale
      const fade = Math.sin(progress * Math.PI);
      const isHovered = hi === lineIdx;
      const targetOpacity = fade * (isHovered ? 1.0 : 0.6);
      const targetScale = isHovered ? 1.5 : 1.0;

      const mat = (spark as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * 0.1;
      const s = spark.scale.x + (targetScale - spark.scale.x) * 0.1;
      spark.scale.setScalar(s);
    });

    // Update line opacity on hover
    lineObjects.forEach((lineObj, i) => {
      const mat = lineObj.material as THREE.LineDashedMaterial;
      const target = hi === i ? 0.35 : 0.12;
      mat.opacity += (target - mat.opacity) * 0.08;
    });
  });

  return (
    <group>
      {/* Curved connecting lines */}
      {lineObjects.map((lineObj, i) => (
        <primitive key={`line-${i}`} object={lineObj} />
      ))}

      {/* Multiple traveling energy sparks per line */}
      <group ref={sparksRef}>
        {DOMAIN_COLORS.flatMap((color, lineIdx) =>
          Array.from({ length: SPARK_COUNT }, (_, sparkIdx) => (
            <mesh key={`spark-${lineIdx}-${sparkIdx}`}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.6}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))
        )}
      </group>

      {/* Node glow points at pillar positions */}
      {nodePositions.map((pos, i) => (
        <mesh key={`node-${i}`} position={pos}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial
            color={DOMAIN_COLORS[i]}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
