"use client";

import { useProductTourContext } from "@/app/context/ProductTourContext";

/**
 * Public hook for controlling the product tour from any component.
 *
 * Usage:
 *   const { startTour, resetTour, isActive } = useProductTour();
 *
 *   // Replay tour from help menu
 *   const handleReplay = () => { resetTour(); startTour(); };
 */
export function useProductTour() {
  return useProductTourContext();
}
