"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useProductTourContext } from "@/app/context/ProductTourContext";
import { useAuth } from "@/app/context/AuthContext";
import { TourOverlay } from "./TourOverlay";
import { TourSpotlight } from "./TourSpotlight";
import { TourTooltip } from "./TourTooltip";
import { TourWelcomeModal } from "./TourWelcomeModal";
import { TourCompletionModal } from "./TourCompletionModal";
import { TourAmbientBackground } from "./TourAmbientBackground";
import { getTargetRect, scrollToTarget } from "./tour-utils";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Root orchestrator for the product tour.
 * Renders via React portal to document.body, ensuring it overlays everything.
 * Manages spotlight positioning, keyboard navigation, focus trapping, and step rendering.
 */
export function ProductTour() {
  const {
    isActive,
    currentStep,
    steps,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isTransitioning,
  } = useProductTourContext();

  const { user } = useAuth();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const tourContainerRef = useRef<HTMLDivElement | null>(null);

  const currentStepConfig = steps[currentStep];
  const isFullscreen = currentStepConfig?.type === "fullscreen";
  const isWelcome = currentStepConfig?.id === "welcome";
  const isCompletion = currentStepConfig?.id === "completion";

  // Set up portal container
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalContainer(document.body);
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Save and restore focus
  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isActive]);

  // RAF loop to track target element position (spotlight steps only)
  const updateTargetRect = useCallback(() => {
    if (!currentStepConfig?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const rect = getTargetRect(currentStepConfig.targetSelector);
    setTargetRect(rect);
  }, [currentStepConfig]);

  useEffect(() => {
    if (!isActive || isFullscreen || isTransitioning) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetRect(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // Initial scroll to target
    if (currentStepConfig?.targetSelector) {
      scrollToTarget(currentStepConfig.targetSelector).then(updateTargetRect);
    }

    // RAF loop for continuous position tracking
    const tick = () => {
      updateTargetRect();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, isFullscreen, isTransitioning, currentStepConfig?.targetSelector, updateTargetRect]);

  const handleNext = useCallback(() => {
    if (isCompletion) {
      completeTour();
    } else {
      nextStep();
    }
  }, [isCompletion, completeTour, nextStep]);

  // Keyboard navigation + focus trap
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          skipTour();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "Enter": {
          // Only trigger next if the focused element is not a button
          const activeEl = document.activeElement as HTMLElement;
          if (activeEl?.tagName !== "BUTTON") {
            e.preventDefault();
            handleNext();
          }
          break;
        }
        case "ArrowLeft":
          e.preventDefault();
          if (currentStep > 0) prevStep();
          break;
        case "Tab": {
          // Focus trap: cycle focus within tour container
          e.preventDefault();
          const container = tourContainerRef.current;
          if (!container) break;

          const focusableElements = Array.from(
            container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
          );
          if (focusableElements.length === 0) break;

          const activeIndex = focusableElements.indexOf(
            document.activeElement as HTMLElement
          );

          if (e.shiftKey) {
            // Shift+Tab: go backwards
            const prevIndex =
              activeIndex <= 0 ? focusableElements.length - 1 : activeIndex - 1;
            focusableElements[prevIndex].focus();
          } else {
            // Tab: go forwards
            const nextIndex =
              activeIndex >= focusableElements.length - 1 ? 0 : activeIndex + 1;
            focusableElements[nextIndex].focus();
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentStep, skipTour, prevStep, handleNext]);

  // Prevent body scroll while tour is active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isActive]);

  // Screen reader live region for step announcements
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (isActive && currentStepConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnnouncement(
        `Tour step ${currentStep + 1} of ${totalSteps}: ${currentStepConfig.title.replace("{firstName}", user?.firstName ?? "there")}`
      );
    }
  }, [isActive, currentStep, totalSteps, currentStepConfig, user?.firstName]);

  if (!isActive || !currentStepConfig || !portalContainer) return null;

  const tourContent = (
    <div
      ref={tourContainerRef}
      className="fixed inset-0 z-[9997]"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
    >
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Ambient background during tour */}
      <TourAmbientBackground visible={isActive} reducedMotion={reducedMotion} />

      {/* Dark overlay with spotlight cutout */}
      <TourOverlay
        targetRect={!isFullscreen ? targetRect : null}
        visible={true}
        reducedMotion={reducedMotion}
      />

      {/* Neon spotlight ring around target */}
      {!isFullscreen && targetRect && (
        <TourSpotlight
          targetRect={targetRect}
          accentColor={currentStepConfig.accentColor}
          visible={!isTransitioning}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Step content */}
      {isWelcome ? (
        <TourWelcomeModal
          step={currentStepConfig}
          onStart={handleNext}
          onSkip={skipTour}
          userName={user?.firstName ?? "there"}
          visible={true}
          reducedMotion={reducedMotion}
        />
      ) : isCompletion ? (
        <TourCompletionModal
          step={currentStepConfig}
          onComplete={completeTour}
          userName={user?.firstName ?? "there"}
          visible={true}
          reducedMotion={reducedMotion}
        />
      ) : (
        <TourTooltip
          step={currentStepConfig}
          targetRect={targetRect}
          onNext={handleNext}
          onPrev={prevStep}
          onSkip={skipTour}
          currentStep={currentStep}
          totalSteps={totalSteps}
          userName={user?.firstName ?? "there"}
          visible={!isTransitioning}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
        />
      )}
    </div>
  );

  return createPortal(tourContent, portalContainer);
}
