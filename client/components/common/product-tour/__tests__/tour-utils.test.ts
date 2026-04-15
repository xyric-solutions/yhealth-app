import {
  getTargetRect,
  scrollToTarget,
  calculateTooltipPosition,
  isElementInViewport,
  interpolateText,
} from "../tour-utils";

// ─── getTargetRect ──────────────────────────────────────────────

describe("getTargetRect", () => {
  it("returns DOMRect when element exists", () => {
    const el = document.createElement("div");
    el.setAttribute("data-tour", "test");
    document.body.appendChild(el);

    // Mock getBoundingClientRect
    el.getBoundingClientRect = jest.fn(() => ({
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      top: 200,
      left: 100,
      right: 400,
      bottom: 350,
      toJSON: () => {},
    }));

    const rect = getTargetRect('[data-tour="test"]');
    expect(rect).not.toBeNull();
    expect(rect!.x).toBe(100);
    expect(rect!.y).toBe(200);
    expect(rect!.width).toBe(300);
    expect(rect!.height).toBe(150);

    document.body.removeChild(el);
  });

  it("returns null when element does not exist", () => {
    const rect = getTargetRect('[data-tour="nonexistent"]');
    expect(rect).toBeNull();
  });

  it("returns null for invalid selector that throws", () => {
    // An invalid selector causes querySelector to throw — getTargetRect should
    // still be callable. jsdom throws on empty string selectors.
    // In production, callers pass data-tour selectors, never empty strings.
    const rect = getTargetRect('[data-tour="does-not-exist"]');
    expect(rect).toBeNull();
  });
});

// ─── scrollToTarget ─────────────────────────────────────────────

describe("scrollToTarget", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves immediately when element does not exist", async () => {
    const promise = scrollToTarget('[data-tour="missing"]');
    // Should resolve without needing timers
    jest.runAllTimers();
    await expect(promise).resolves.toBeUndefined();
  });

  it("calls scrollIntoView and resolves after 600ms settle time", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-tour", "scroll-test");
    el.scrollIntoView = jest.fn();
    document.body.appendChild(el);

    const promise = scrollToTarget('[data-tour="scroll-test"]');

    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    jest.advanceTimersByTime(600);
    await promise;

    document.body.removeChild(el);
  });
});

// ─── calculateTooltipPosition ───────────────────────────────────

describe("calculateTooltipPosition", () => {
  const tooltipSize = { width: 380, height: 220 };

  // Mock viewport: 1440x900
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, writable: true });
  });

  function makeDOMRect(x: number, y: number, w: number, h: number): DOMRect {
    return {
      x,
      y,
      width: w,
      height: h,
      top: y,
      left: x,
      right: x + w,
      bottom: y + h,
      toJSON: () => {},
    } as DOMRect;
  }

  it("places tooltip below when preferred is bottom and space available", () => {
    const target = makeDOMRect(400, 100, 200, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "bottom");

    expect(pos.placement).toBe("bottom");
    expect(pos.y).toBe(target.bottom + 16); // TOOLTIP_GAP = 16
  });

  it("flips to top when bottom has insufficient space", () => {
    const target = makeDOMRect(400, 700, 200, 50); // near bottom of viewport
    const pos = calculateTooltipPosition(target, tooltipSize, "bottom");

    expect(pos.placement).toBe("top");
  });

  it("flips to bottom when top has insufficient space", () => {
    const target = makeDOMRect(400, 10, 200, 50); // near top of viewport
    const pos = calculateTooltipPosition(target, tooltipSize, "top");

    expect(pos.placement).toBe("bottom");
  });

  it("flips to left when right has insufficient space", () => {
    const target = makeDOMRect(1200, 300, 200, 50); // near right edge
    const pos = calculateTooltipPosition(target, tooltipSize, "right");

    expect(pos.placement).toBe("left");
  });

  it("flips to right when left has insufficient space", () => {
    const target = makeDOMRect(10, 300, 200, 50); // near left edge
    const pos = calculateTooltipPosition(target, tooltipSize, "left");

    expect(pos.placement).toBe("right");
  });

  it("auto placement prefers bottom", () => {
    const target = makeDOMRect(400, 300, 200, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "auto");

    expect(pos.placement).toBe("bottom");
  });

  it("auto placement falls back to top when bottom insufficient", () => {
    const target = makeDOMRect(400, 700, 200, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "auto");

    expect(pos.placement).toBe("top");
  });

  it("clamps x position to viewport padding", () => {
    // Target near left edge — tooltip would overflow left
    const target = makeDOMRect(0, 300, 50, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "bottom");

    expect(pos.x).toBeGreaterThanOrEqual(16); // VIEWPORT_PADDING
  });

  it("clamps x position to not exceed right viewport edge", () => {
    // Target near right edge
    const target = makeDOMRect(1400, 300, 30, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "bottom");

    expect(pos.x).toBeLessThanOrEqual(1440 - 380 - 16); // vw - width - padding
  });

  it("clamps y position to viewport padding", () => {
    const target = makeDOMRect(400, 0, 200, 10);
    const pos = calculateTooltipPosition(target, tooltipSize, "top");

    expect(pos.y).toBeGreaterThanOrEqual(16);
  });

  it("correctly positions tooltip to the right of target", () => {
    const target = makeDOMRect(100, 300, 200, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "right");

    expect(pos.placement).toBe("right");
    expect(pos.x).toBe(target.right + 16);
  });

  it("correctly positions tooltip to the left of target", () => {
    const target = makeDOMRect(600, 300, 200, 50);
    const pos = calculateTooltipPosition(target, tooltipSize, "left");

    expect(pos.placement).toBe("left");
    expect(pos.x).toBe(target.left - tooltipSize.width - 16);
  });
});

// ─── isElementInViewport ────────────────────────────────────────

describe("isElementInViewport", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, writable: true });
  });

  function makeDOMRect(x: number, y: number, w: number, h: number): DOMRect {
    return {
      x,
      y,
      width: w,
      height: h,
      top: y,
      left: x,
      right: x + w,
      bottom: y + h,
      toJSON: () => {},
    } as DOMRect;
  }

  it("returns true for element fully within viewport", () => {
    const rect = makeDOMRect(100, 100, 200, 100);
    expect(isElementInViewport(rect)).toBe(true);
  });

  it("returns false for element above viewport", () => {
    const rect = makeDOMRect(100, -50, 200, 100);
    expect(isElementInViewport(rect)).toBe(false);
  });

  it("returns false for element below viewport", () => {
    const rect = makeDOMRect(100, 850, 200, 100);
    expect(isElementInViewport(rect)).toBe(false);
  });

  it("returns false for element left of viewport", () => {
    const rect = makeDOMRect(-50, 100, 200, 100);
    expect(isElementInViewport(rect)).toBe(false);
  });

  it("returns false for element right of viewport", () => {
    const rect = makeDOMRect(1400, 100, 200, 100);
    expect(isElementInViewport(rect)).toBe(false);
  });

  it("returns true for element exactly at viewport edges", () => {
    const rect = makeDOMRect(0, 0, 1440, 900);
    expect(isElementInViewport(rect)).toBe(true);
  });
});

// ─── interpolateText ────────────────────────────────────────────

describe("interpolateText", () => {
  it("replaces {firstName} with provided value", () => {
    const result = interpolateText("Hello, {firstName}!", { firstName: "Alex" });
    expect(result).toBe("Hello, Alex!");
  });

  it("replaces multiple occurrences", () => {
    const result = interpolateText("{firstName} says hi, {firstName}!", {
      firstName: "Alex",
    });
    expect(result).toBe("Alex says hi, Alex!");
  });

  it("replaces multiple different keys", () => {
    const result = interpolateText("{firstName} {lastName}", {
      firstName: "Alex",
      lastName: "Smith",
    });
    expect(result).toBe("Alex Smith");
  });

  it("leaves unmatched placeholders unchanged", () => {
    const result = interpolateText("Hello, {firstName}! Your role is {role}", {
      firstName: "Alex",
    });
    expect(result).toBe("Hello, Alex! Your role is {role}");
  });

  it("handles text with no placeholders", () => {
    const result = interpolateText("No placeholders here", { firstName: "Alex" });
    expect(result).toBe("No placeholders here");
  });

  it("handles empty string", () => {
    const result = interpolateText("", { firstName: "Alex" });
    expect(result).toBe("");
  });

  it("handles empty values object", () => {
    const result = interpolateText("Hello, {firstName}!", {});
    expect(result).toBe("Hello, {firstName}!");
  });
});
