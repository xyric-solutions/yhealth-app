"use client";

import { motion, AnimatePresence } from "framer-motion";
import { overlayVariants } from "./tour-variants";

interface TourOverlayProps {
  /** Bounding rect of the spotlighted element, or null for fullscreen overlay */
  targetRect: DOMRect | null;
  /** Padding around the spotlight cutout */
  padding?: number;
  /** Border radius of the spotlight cutout */
  borderRadius?: number;
  /** Whether the overlay is visible */
  visible: boolean;
  /** Whether to skip animations (reduced motion) */
  reducedMotion?: boolean;
  /** Click handler for the overlay backdrop */
  onClick?: () => void;
}

/**
 * Full-screen dark overlay with an animated SVG mask cutout
 * that spotlights a target element.
 */
export function TourOverlay({
  targetRect,
  padding = 12,
  borderRadius = 20,
  visible,
  reducedMotion = false,
  onClick,
}: TourOverlayProps) {
  const cutout = targetRect
    ? {
        x: targetRect.x - padding,
        y: targetRect.y - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9998]"
          variants={reducedMotion ? undefined : overlayVariants}
          initial={reducedMotion ? { opacity: 1 } : "hidden"}
          animate={reducedMotion ? { opacity: 1 } : "visible"}
          exit={reducedMotion ? { opacity: 0 } : "exit"}
          onClick={onClick}
          aria-hidden="true"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id="tour-spotlight-mask">
                {/* White = visible (the dark overlay) */}
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Black = transparent (the spotlight cutout) */}
                {cutout && (
                  <rect
                    x={cutout.x}
                    y={cutout.y}
                    width={cutout.width}
                    height={cutout.height}
                    rx={borderRadius}
                    ry={borderRadius}
                    fill="black"
                    style={{
                      transition: reducedMotion
                        ? "none"
                        : "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.75)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
