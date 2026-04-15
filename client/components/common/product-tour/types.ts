/** Configuration for a single tour step */
export interface TourStepConfig {
  /** Unique step identifier */
  id: string;
  /** Fullscreen modal or element spotlight */
  type: "fullscreen" | "spotlight";
  /** Step heading (supports {firstName} interpolation) */
  title: string;
  /** Step body text (supports {firstName} interpolation) */
  description: string;
  /** CSS selector for spotlight target element (e.g., [data-tour="health-dashboard"]) */
  targetSelector?: string;
  /** Fallback positioning when target element is not found */
  targetFallback?: "center";
  /** Preferred tooltip placement relative to target */
  tooltipPosition?: TooltipPlacement | "auto";
  /** Lucide icon name string */
  icon?: string;
  /** Tailwind gradient class for accent (e.g., "from-cyan-500 to-teal-500") */
  accentColor?: string;
  /** Primary CTA button text (defaults to "Next") */
  ctaPrimary?: string;
  /** Secondary CTA button text (defaults to "Back") */
  ctaSecondary?: string;
  /** Route to navigate to before showing this step */
  navigateTo?: string;
  /** If true, only shown to admin users */
  adminOnly?: boolean;
}

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

/** Calculated position for tooltip */
export interface TooltipPosition {
  x: number;
  y: number;
  placement: TooltipPlacement;
}

/** Tour state stored in context */
export interface TourState {
  isActive: boolean;
  currentStep: number;
  hasCompletedTour: boolean;
  hasSkippedTour: boolean;
  isTransitioning: boolean;
}

/** Tour context value exposed to consumers */
export interface ProductTourContextValue extends TourState {
  /** Resolved steps for the current user's role */
  steps: TourStepConfig[];
  /** Total number of steps after role filtering */
  totalSteps: number;
  /** Begin tour from step 0 */
  startTour: () => void;
  /** Advance to next step */
  nextStep: () => void;
  /** Go back one step */
  prevStep: () => void;
  /** Skip and mark as seen */
  skipTour: () => void;
  /** Mark complete (final step) */
  completeTour: () => void;
  /** Re-enable tour (for Help menu) */
  resetTour: () => void;
  /** Jump to specific step */
  goToStep: (index: number) => void;
}

/** localStorage schema for tour persistence */
export interface TourStorageData {
  completed: boolean;
  skipped: boolean;
  completedAt: string | null;
  lastStepSeen: number;
  version: number;
}
