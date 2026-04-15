"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Zap, GripVertical } from "lucide-react";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

const BEFORE_AFTER_IMAGE = "/beforeafter.png";

export function BeforeAfterSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragPosition, setDragPosition] = useState(50);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDragPosition(Number(e.target.value));
  };

  return (
    <GSAPScrollReveal
      as="section"
      direction="scale"
      distance={60}
      start="top 85%"
      className="relative py-16 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Dynamic background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.12} blur={100} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6">
          See the Transformation in Real Time
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-16">
          Drag the slider to witness the difference between scattered self-management and an AI-driven wellness system that works with your body, not against it.
        </p>

        <div
          ref={containerRef}
          className="relative w-full max-w-4xl mx-auto rounded-2xl overflow-hidden bg-muted/20 border border-white/10 shadow-2xl shadow-black/20 ring-1 ring-white/5"
          style={{
            aspectRatio: "4/3",
            minHeight: 280,
          }}
        >
          {/* Full image */}
          <div className="absolute inset-0 w-full h-full" style={{ minHeight: 280 }}>
            <Image
              src={BEFORE_AFTER_IMAGE}
              alt="Before and after transformation with Balencia"
              fill
              className="object-cover object-center select-none"
              sizes="(max-width: 640px) 100vw, (max-width: 896px) 100vw, 896px"
              priority
              unoptimized={false}
            />
          </div>

          {/* Clipped overlay */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ clipPath: `inset(0 0 0 ${dragPosition}%)`, minHeight: 280 }}
          >
            <Image
              src={BEFORE_AFTER_IMAGE}
              alt=""
              fill
              className="object-cover object-center select-none"
              sizes="(max-width: 640px) 100vw, (max-width: 896px) 100vw, 896px"
              priority={false}
              aria-hidden
              unoptimized={false}
            />
          </div>

          {/* Center marker */}
          {Math.abs(dragPosition - 50) > 4 && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center pointer-events-none z-10 bg-black/30 border-2 border-dashed border-white/50"
              aria-hidden
            >
              <GripVertical className="w-4 h-4 text-white/90" strokeWidth={2} />
            </div>
          )}

          {/* Slider track and handle */}
          <div
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-20"
            aria-hidden
          >
            <div
              className="absolute top-0 bottom-0 w-1 min-w-[2px] max-w-[4px] rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary))]"
              style={{
                left: `${dragPosition}%`,
                transform: "translateX(-50%)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.4), 0 0 16px hsl(var(--primary) / 0.8)",
              }}
            />
            <motion.div
              className="absolute top-1/2 w-14 h-14 rounded-full flex items-center justify-center cursor-ew-resize pointer-events-auto border-[3px] border-white bg-primary shadow-xl"
              style={{
                left: `${dragPosition}%`,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.2), 0 4px 20px rgba(0,0,0,0.35), 0 0 28px hsl(var(--primary) / 0.5)",
              }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Zap className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </motion.div>
          </div>

          {/* Invisible range input */}
          <input
            type="range"
            min={0}
            max={100}
            value={dragPosition}
            onChange={handleSlider}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
            aria-label="Compare before and after"
          />

          {/* Labels overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none z-[2]">
            <span className="rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
              Before
            </span>
            <span className="rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
              After
            </span>
          </div>
        </div>
      </div>
    </GSAPScrollReveal>
  );
}
