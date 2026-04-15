import {
  overlayVariants,
  modalVariants,
  tooltipVariants,
  spotlightRingVariants,
  dotVariants,
  tooltipContentVariants,
  tooltipContentItem,
  ambientOrbVariants,
} from "../tour-variants";

describe("tour-variants", () => {
  // ── overlayVariants ──

  describe("overlayVariants", () => {
    it("has hidden, visible, and exit states", () => {
      expect(overlayVariants.hidden).toBeDefined();
      expect(overlayVariants.visible).toBeDefined();
      expect(overlayVariants.exit).toBeDefined();
    });

    it("hidden state has opacity 0", () => {
      expect(overlayVariants.hidden).toEqual({ opacity: 0 });
    });

    it("visible state has opacity 1", () => {
      expect(overlayVariants.visible).toEqual(
        expect.objectContaining({ opacity: 1 })
      );
    });
  });

  // ── modalVariants ──

  describe("modalVariants", () => {
    it("has hidden, visible, and exit states", () => {
      expect(modalVariants.hidden).toBeDefined();
      expect(modalVariants.visible).toBeDefined();
      expect(modalVariants.exit).toBeDefined();
    });

    it("hidden state starts scaled down with offset", () => {
      const hidden = modalVariants.hidden as Record<string, unknown>;
      expect(hidden.opacity).toBe(0);
      expect(hidden.scale).toBe(0.9);
      expect(hidden.y).toBe(30);
    });

    it("visible state is fully shown", () => {
      const visible = modalVariants.visible as Record<string, unknown>;
      expect(visible.opacity).toBe(1);
      expect(visible.scale).toBe(1);
      expect(visible.y).toBe(0);
    });
  });

  // ── tooltipVariants ──

  describe("tooltipVariants", () => {
    it("has hidden, visible, and exit states", () => {
      expect(tooltipVariants.hidden).toBeDefined();
      expect(tooltipVariants.visible).toBeDefined();
      expect(tooltipVariants.exit).toBeDefined();
    });
  });

  // ── spotlightRingVariants ──

  describe("spotlightRingVariants", () => {
    it("has hidden, visible, and exit states", () => {
      expect(spotlightRingVariants.hidden).toBeDefined();
      expect(spotlightRingVariants.visible).toBeDefined();
      expect(spotlightRingVariants.exit).toBeDefined();
    });
  });

  // ── dotVariants (no scale — relies on layout prop) ──

  describe("dotVariants", () => {
    it("has inactive, active, and completed states", () => {
      expect(dotVariants.inactive).toBeDefined();
      expect(dotVariants.active).toBeDefined();
      expect(dotVariants.completed).toBeDefined();
    });

    it("does NOT include scale property (handled by layout prop)", () => {
      const inactive = dotVariants.inactive as Record<string, unknown>;
      const active = dotVariants.active as Record<string, unknown>;
      const completed = dotVariants.completed as Record<string, unknown>;

      expect(inactive.scale).toBeUndefined();
      expect(active.scale).toBeUndefined();
      expect(completed.scale).toBeUndefined();
    });

    it("active state has opacity 1", () => {
      const active = dotVariants.active as Record<string, unknown>;
      expect(active.opacity).toBe(1);
    });

    it("inactive state has low opacity", () => {
      const inactive = dotVariants.inactive as Record<string, unknown>;
      expect(inactive.opacity).toBe(0.3);
    });

    it("completed state has medium opacity", () => {
      const completed = dotVariants.completed as Record<string, unknown>;
      expect(completed.opacity).toBe(0.7);
    });
  });

  // ── tooltipContentVariants ──

  describe("tooltipContentVariants", () => {
    it("has hidden and visible states", () => {
      expect(tooltipContentVariants.hidden).toBeDefined();
      expect(tooltipContentVariants.visible).toBeDefined();
    });

    it("visible state uses stagger children", () => {
      const visible = tooltipContentVariants.visible as Record<string, unknown>;
      const transition = visible.transition as Record<string, unknown>;
      expect(transition.staggerChildren).toBeDefined();
      expect(transition.staggerChildren).toBeGreaterThan(0);
    });
  });

  // ── tooltipContentItem ──

  describe("tooltipContentItem", () => {
    it("has hidden and visible states", () => {
      expect(tooltipContentItem.hidden).toBeDefined();
      expect(tooltipContentItem.visible).toBeDefined();
    });
  });

  // ── ambientOrbVariants ──

  describe("ambientOrbVariants", () => {
    it("has hidden, visible, and exit states", () => {
      expect(ambientOrbVariants.hidden).toBeDefined();
      expect(ambientOrbVariants.visible).toBeDefined();
      expect(ambientOrbVariants.exit).toBeDefined();
    });

    it("visible state has low opacity (subtle effect)", () => {
      const visible = ambientOrbVariants.visible as Record<string, unknown>;
      expect(visible.opacity).toBeLessThanOrEqual(0.3);
    });
  });
});
