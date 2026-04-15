import type { TooltipPlacement, TooltipPosition } from "./types";

const VIEWPORT_PADDING = 16;
const TOOLTIP_GAP = 16;

/**
 * Get the bounding rect of a tour target element.
 * Returns null if the element is not found.
 */
export function getTargetRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

/**
 * Smoothly scroll an element into the center of the viewport.
 * Returns a promise that resolves after scroll + settling time.
 */
export function scrollToTarget(selector: string): Promise<void> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (!el) {
      resolve();
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    // Wait for scroll to complete + a settling buffer
    setTimeout(resolve, 600);
  });
}

/**
 * Calculate optimal tooltip position relative to a target element.
 * Tries the preferred placement first, then flips if there's not enough space.
 */
export function calculateTooltipPosition(
  targetRect: DOMRect,
  tooltipSize: { width: number; height: number },
  preferred: TooltipPlacement | "auto"
): TooltipPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Available space in each direction
  const space = {
    top: targetRect.top,
    bottom: vh - targetRect.bottom,
    left: targetRect.left,
    right: vw - targetRect.right,
  };

  // Determine placement
  let placement: TooltipPlacement;

  if (preferred === "auto") {
    // Priority: bottom > top > right > left
    if (space.bottom >= tooltipSize.height + TOOLTIP_GAP + VIEWPORT_PADDING) {
      placement = "bottom";
    } else if (space.top >= tooltipSize.height + TOOLTIP_GAP + VIEWPORT_PADDING) {
      placement = "top";
    } else if (space.right >= tooltipSize.width + TOOLTIP_GAP + VIEWPORT_PADDING) {
      placement = "right";
    } else {
      placement = "left";
    }
  } else {
    placement = preferred;

    // Flip if preferred side doesn't have enough space
    if (
      placement === "bottom" &&
      space.bottom < tooltipSize.height + TOOLTIP_GAP + VIEWPORT_PADDING
    ) {
      placement = "top";
    } else if (
      placement === "top" &&
      space.top < tooltipSize.height + TOOLTIP_GAP + VIEWPORT_PADDING
    ) {
      placement = "bottom";
    } else if (
      placement === "right" &&
      space.right < tooltipSize.width + TOOLTIP_GAP + VIEWPORT_PADDING
    ) {
      placement = "left";
    } else if (
      placement === "left" &&
      space.left < tooltipSize.width + TOOLTIP_GAP + VIEWPORT_PADDING
    ) {
      placement = "right";
    }
  }

  let x: number;
  let y: number;

  switch (placement) {
    case "bottom":
      x = targetRect.left + targetRect.width / 2 - tooltipSize.width / 2;
      y = targetRect.bottom + TOOLTIP_GAP;
      break;
    case "top":
      x = targetRect.left + targetRect.width / 2 - tooltipSize.width / 2;
      y = targetRect.top - tooltipSize.height - TOOLTIP_GAP;
      break;
    case "right":
      x = targetRect.right + TOOLTIP_GAP;
      y = targetRect.top + targetRect.height / 2 - tooltipSize.height / 2;
      break;
    case "left":
      x = targetRect.left - tooltipSize.width - TOOLTIP_GAP;
      y = targetRect.top + targetRect.height / 2 - tooltipSize.height / 2;
      break;
  }

  // Clamp to viewport
  x = Math.max(
    VIEWPORT_PADDING,
    Math.min(x, vw - tooltipSize.width - VIEWPORT_PADDING)
  );
  y = Math.max(
    VIEWPORT_PADDING,
    Math.min(y, vh - tooltipSize.height - VIEWPORT_PADDING)
  );

  return { x, y, placement };
}

/**
 * Check if an element is within the visible viewport area.
 */
export function isElementInViewport(rect: DOMRect): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

/**
 * Interpolate template strings like {firstName} with provided values.
 */
export function interpolateText(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
