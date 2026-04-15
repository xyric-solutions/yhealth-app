"use client";

import { useRef, useCallback, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Apple,
  Brain,
  BookOpen,
  Target,
  Heart,
} from "lucide-react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AIBrainSphere } from "./AIBrainSphere";
import { OrbitalRings } from "./OrbitalRings";
import { OrbitalParticles } from "./OrbitalParticles";
import { EnergyConnections } from "./EnergyConnections";
import * as THREE from "three";

// ─── Life domain data ────────────────────────────────────────────
const lifeDomains = [
  {
    icon: Dumbbell,
    label: "Fitness",
    tagline: "340+ exercises",
    hsl: "30 100% 60%",
    hex: "#f97316",
    startAngle: 0,
  },
  {
    icon: Apple,
    label: "Nutrition",
    tagline: "Smart meal plans",
    hsl: "152 69% 50%",
    hex: "#34d399",
    startAngle: 60,
  },
  {
    icon: Brain,
    label: "Mindfulness",
    tagline: "Guided meditation",
    hsl: "263 70% 58%",
    hex: "#a78bfa",
    startAngle: 120,
  },
  {
    icon: BookOpen,
    label: "Journaling",
    tagline: "AI-powered insights",
    hsl: "38 92% 55%",
    hex: "#f59e0b",
    startAngle: 180,
  },
  {
    icon: Target,
    label: "Habits",
    tagline: "Track & optimize",
    hsl: "190 90% 50%",
    hex: "#22d3ee",
    startAngle: 240,
  },
  {
    icon: Heart,
    label: "Relationships",
    tagline: "Connection health",
    hsl: "350 80% 60%",
    hex: "#fb7185",
    startAngle: 300,
  },
];

const ORBIT_RADIUS_PX = 220;
const CENTER = 290; // center of 580x580 container

// ─── Three.js Scene ──────────────────────────────────────────────
function SceneContent({
  mouse,
  scrollProgress,
  hoverIntensity,
  hoveredIndex,
}: {
  mouse: React.RefObject<{ x: number; y: number }>;
  scrollProgress: React.RefObject<{ current: number }>;
  hoverIntensity: React.RefObject<number>;
  hoveredIndex: React.RefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const smooth = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    if (!groupRef.current || !mouse.current) return;

    const lerp = 1 - Math.exp(-2.5 * delta);
    smooth.current.x += (mouse.current.x - smooth.current.x) * lerp;
    smooth.current.y += (mouse.current.y - smooth.current.y) * lerp;

    groupRef.current.rotation.y = smooth.current.x * 0.12;
    groupRef.current.rotation.x = -smooth.current.y * 0.08;

    // Slow auto-rotation
    groupRef.current.rotation.y += delta * 0.015;
  });

  return (
    <>
      <ambientLight intensity={0.15} />

      <group ref={groupRef}>
        <AIBrainSphere scrollProgress={scrollProgress} hoverIntensity={hoverIntensity} />
        <OrbitalRings scrollProgress={scrollProgress} />
        <OrbitalParticles scrollProgress={scrollProgress} />
        <EnergyConnections scrollProgress={scrollProgress} hoveredIndex={hoveredIndex} />
      </group>

      {/* Postprocessing bloom */}
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function LifeIntelligenceOrb3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const scrollProgressRef = useRef({ current: 0 });
  const hoverIntensityRef = useRef(0);
  const hoveredIndexRef = useRef(-1);
  const orbScaleRef = useRef<HTMLDivElement>(null);
  const [hoveredDomain, setHoveredDomain] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    mouseRef.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.x = 0;
    mouseRef.current.y = 0;
    setHoveredDomain(null);
    hoveredIndexRef.current = -1;
    hoverIntensityRef.current = 0;
  }, []);

  const handleCardHover = useCallback((index: number | null) => {
    setHoveredDomain(index);
    hoveredIndexRef.current = index ?? -1;
    hoverIntensityRef.current = index !== null ? 1 : 0;
  }, []);

  // GSAP scroll-driven animations
  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.to(scrollProgressRef, {
      current: 1,
      ease: "none",
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: 2,
      },
    });

    if (orbScaleRef.current) {
      gsap.fromTo(
        orbScaleRef.current,
        { scale: 0.5, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1.2,
          ease: "back.out(1.4)",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const angle = ((lifeDomains[i].startAngle - 90) * Math.PI) / 180;
      const fromX = Math.cos(angle) * 80;
      const fromY = Math.sin(angle) * 80;

      gsap.fromTo(
        card,
        { x: fromX, y: fromY, opacity: 0, scale: 0.3 },
        {
          x: 0,
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          delay: 0.2 + i * 0.1,
          ease: "back.out(1.6)",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    });
  }, containerRef);

  return (
    <div
      ref={containerRef}
      className="relative w-[580px] h-[580px] mx-auto"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Three.js Canvas with postprocessing */}
      <div ref={orbScaleRef} className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 9], fov: 38 }}
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
          style={{ background: "transparent" }}
        >
          <SceneContent
            mouse={mouseRef}
            scrollProgress={scrollProgressRef}
            hoverIntensity={hoverIntensityRef}
            hoveredIndex={hoveredIndexRef}
          />
        </Canvas>
      </div>

      {/* ── Premium Glassmorphic Pillar Cards ── */}
      {lifeDomains.map((domain, i) => {
        const Icon = domain.icon;
        const angle = ((domain.startAngle - 90) * Math.PI) / 180;
        const x = CENTER + Math.cos(angle) * ORBIT_RADIUS_PX;
        const y = CENTER + Math.sin(angle) * ORBIT_RADIUS_PX;
        const isHovered = hoveredDomain === i;
        const cardSize = 76;

        return (
          <div
            key={domain.label}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="absolute z-10"
            style={{
              left: x - cardSize / 2,
              top: y - cardSize / 2,
              width: cardSize,
              height: cardSize,
            }}
            onMouseEnter={() => handleCardHover(i)}
            onMouseLeave={() => handleCardHover(null)}
          >
            {/* Outer glow aura (always visible, intensifies on hover) */}
            <div
              className="absolute -inset-3 rounded-3xl blur-xl transition-opacity duration-500"
              style={{
                background: `radial-gradient(circle, hsl(${domain.hsl} / ${isHovered ? 0.4 : 0.12}), transparent 70%)`,
                opacity: isHovered ? 1 : 0.6,
              }}
            />

            <motion.div
              className="relative w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl cursor-default overflow-hidden"
              style={{
                background: `linear-gradient(145deg, hsl(${domain.hsl} / ${isHovered ? 0.18 : 0.08}), rgba(255,255,255,0.02))`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid hsl(${domain.hsl} / ${isHovered ? 0.3 : 0.12})`,
                boxShadow: isHovered
                  ? `0 0 30px hsl(${domain.hsl} / 0.3), 0 0 60px hsl(${domain.hsl} / 0.1), 0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`
                  : `0 0 20px hsl(${domain.hsl} / 0.08), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}
              animate={{
                y: [0, i % 2 === 0 ? -4 : 4, 0],
                scale: isHovered ? 1.15 : 1,
              }}
              transition={{
                y: { duration: 4 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 0.3, ease: "easeOut" },
              }}
            >
              {/* Holographic shine overlay */}
              <div
                className="absolute inset-0 rounded-2xl opacity-30"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.03) 100%)",
                }}
              />

              {/* Icon container with inner glow */}
              <div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${domain.hsl} / ${isHovered ? 0.35 : 0.2}), hsl(${domain.hsl} / 0.06))`,
                  boxShadow: isHovered
                    ? `0 0 20px hsl(${domain.hsl} / 0.4), inset 0 0 8px hsl(${domain.hsl} / 0.15)`
                    : `0 0 12px hsl(${domain.hsl} / 0.15)`,
                }}
              >
                <Icon
                  className="w-5 h-5 transition-all duration-300"
                  style={{
                    color: `hsl(${domain.hsl})`,
                    filter: isHovered ? `drop-shadow(0 0 8px hsl(${domain.hsl}))` : "none",
                  }}
                />
              </div>

              <span
                className="text-[10px] font-semibold tracking-wider uppercase transition-colors duration-300"
                style={{ color: isHovered ? `hsl(${domain.hsl})` : "rgba(255,255,255,0.6)" }}
              >
                {domain.label}
              </span>
            </motion.div>

            {/* Floating tooltip on hover */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none z-20"
                  style={{
                    top: cardSize + 8,
                    background: "rgba(10, 12, 20, 0.85)",
                    backdropFilter: "blur(8px)",
                    border: `1px solid hsl(${domain.hsl} / 0.25)`,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 15px hsl(${domain.hsl} / 0.1)`,
                  }}
                >
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: `hsl(${domain.hsl})` }}
                  >
                    {domain.tagline}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
