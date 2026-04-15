import { TOUR_STEPS, ADMIN_EXTRA_STEPS, TOUR_VERSION } from "../tour-steps";

describe("TOUR_STEPS configuration", () => {
  it("has exactly 8 steps", () => {
    expect(TOUR_STEPS).toHaveLength(8);
  });

  it("starts with a welcome fullscreen step", () => {
    expect(TOUR_STEPS[0].id).toBe("welcome");
    expect(TOUR_STEPS[0].type).toBe("fullscreen");
  });

  it("ends with a completion fullscreen step", () => {
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last.id).toBe("completion");
    expect(last.type).toBe("fullscreen");
  });

  it("has unique IDs for each step", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all spotlight steps have a targetSelector", () => {
    const spotlightSteps = TOUR_STEPS.filter((s) => s.type === "spotlight");
    spotlightSteps.forEach((step) => {
      expect(step.targetSelector).toBeTruthy();
      expect(step.targetSelector).toMatch(/^\[data-tour=/);
    });
  });

  it("all spotlight steps have a navigateTo property", () => {
    const spotlightSteps = TOUR_STEPS.filter((s) => s.type === "spotlight");
    spotlightSteps.forEach((step) => {
      expect(step.navigateTo).toBeTruthy();
    });
  });

  it("fullscreen steps do NOT have targetSelector", () => {
    const fullscreenSteps = TOUR_STEPS.filter((s) => s.type === "fullscreen");
    fullscreenSteps.forEach((step) => {
      expect(step.targetSelector).toBeUndefined();
    });
  });

  it("all steps have required fields: id, type, title, description", () => {
    TOUR_STEPS.forEach((step) => {
      expect(step.id).toBeTruthy();
      expect(step.type).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    });
  });

  it("all steps have an icon", () => {
    TOUR_STEPS.forEach((step) => {
      expect(step.icon).toBeTruthy();
    });
  });

  it("all steps have an accentColor gradient", () => {
    TOUR_STEPS.forEach((step) => {
      expect(step.accentColor).toBeTruthy();
      expect(step.accentColor).toMatch(/^from-/);
    });
  });

  it("welcome step has ctaPrimary and ctaSecondary", () => {
    expect(TOUR_STEPS[0].ctaPrimary).toBe("Start Tour");
    expect(TOUR_STEPS[0].ctaSecondary).toBe("Skip for now");
  });

  it("completion step has ctaPrimary", () => {
    const completion = TOUR_STEPS.find((s) => s.id === "completion");
    expect(completion?.ctaPrimary).toBe("Go to Dashboard");
  });

  it("integrations step navigates to /dashboard?tab=settings", () => {
    const integrations = TOUR_STEPS.find((s) => s.id === "integrations");
    expect(integrations?.navigateTo).toBe("/dashboard?tab=settings");
  });

  it("all non-fullscreen steps have tooltipPosition", () => {
    const spotlightSteps = TOUR_STEPS.filter((s) => s.type === "spotlight");
    spotlightSteps.forEach((step) => {
      expect(step.tooltipPosition).toBeTruthy();
    });
  });

  it("contains expected step IDs in correct order", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(ids).toEqual([
      "welcome",
      "health-dashboard",
      "competitions",
      "ai-coach",
      "gamification",
      "integrations",
      "community",
      "completion",
    ]);
  });
});

describe("ADMIN_EXTRA_STEPS", () => {
  it("has at least one admin step", () => {
    expect(ADMIN_EXTRA_STEPS.length).toBeGreaterThanOrEqual(1);
  });

  it("all admin steps are marked adminOnly", () => {
    ADMIN_EXTRA_STEPS.forEach((step) => {
      expect(step.adminOnly).toBe(true);
    });
  });

  it("admin-panel step has correct configuration", () => {
    const adminPanel = ADMIN_EXTRA_STEPS.find((s) => s.id === "admin-panel");
    expect(adminPanel).toBeDefined();
    expect(adminPanel!.type).toBe("spotlight");
    expect(adminPanel!.targetSelector).toBe('[data-tour="admin-panel"]');
    expect(adminPanel!.icon).toBe("Shield");
  });

  it("admin step IDs do not conflict with main steps", () => {
    const mainIds = new Set(TOUR_STEPS.map((s) => s.id));
    ADMIN_EXTRA_STEPS.forEach((step) => {
      expect(mainIds.has(step.id)).toBe(false);
    });
  });
});

describe("TOUR_VERSION", () => {
  it("is a positive integer", () => {
    expect(TOUR_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(TOUR_VERSION)).toBe(true);
  });
});

describe("step role-based merging", () => {
  it("admin steps should be insertable before completion step", () => {
    const allSteps = [...TOUR_STEPS];
    const completionIndex = allSteps.findIndex((s) => s.id === "completion");
    expect(completionIndex).toBe(TOUR_STEPS.length - 1);

    allSteps.splice(completionIndex, 0, ...ADMIN_EXTRA_STEPS);
    expect(allSteps.length).toBe(TOUR_STEPS.length + ADMIN_EXTRA_STEPS.length);

    // Admin steps should be right before completion
    const newCompletionIndex = allSteps.findIndex((s) => s.id === "completion");
    expect(newCompletionIndex).toBe(allSteps.length - 1);
    expect(allSteps[newCompletionIndex - 1].id).toBe("admin-panel");
  });
});
