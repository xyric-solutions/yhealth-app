import { act, renderHook } from "@testing-library/react";
import { ProductTourProvider, useProductTourContext } from "@/app/context/ProductTourContext";
import { TOUR_STEPS, ADMIN_EXTRA_STEPS, TOUR_VERSION } from "../tour-steps";

// Mock AuthContext
const mockUser = {
  id: "1",
  firstName: "Alex",
  lastName: "Smith",
  email: "alex@test.com",
  role: "user",
  onboardingStatus: "completed",
};

const mockAuthContext = {
  user: mockUser,
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  isAdmin: () => false,
  hasRole: () => false,
};

jest.mock("@/app/context/AuthContext", () => ({
  useAuth: () => mockAuthContext,
}));

// Mock api client
jest.mock("@/lib/api-client", () => ({
  api: {
    patch: jest.fn().mockResolvedValue({}),
  },
}));

// Mock next/navigation (augmenting jest.setup defaults)
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

const STORAGE_KEY = "balencia_product_tour";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ProductTourProvider>{children}</ProductTourProvider>;
}

describe("ProductTourContext", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthContext.user = { ...mockUser };
    mockAuthContext.isLoading = false;
    mockAuthContext.isAuthenticated = true;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Context access ──

  it("throws when used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    expect(() => {
      renderHook(() => useProductTourContext());
    }).toThrow("useProductTourContext must be used within a ProductTourProvider");

    consoleSpy.mockRestore();
  });

  it("provides initial state", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    expect(result.current.isActive).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.hasCompletedTour).toBe(false);
    expect(result.current.hasSkippedTour).toBe(false);
    expect(result.current.isTransitioning).toBe(false);
  });

  // ── Step resolution ──

  it("provides standard steps for regular users", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    expect(result.current.steps).toHaveLength(TOUR_STEPS.length);
    expect(result.current.totalSteps).toBe(TOUR_STEPS.length);
  });

  it("includes admin steps for admin users", () => {
    mockAuthContext.user = { ...mockUser, role: "admin" };

    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    expect(result.current.steps).toHaveLength(
      TOUR_STEPS.length + ADMIN_EXTRA_STEPS.length
    );
  });

  it("inserts admin steps before completion step", () => {
    mockAuthContext.user = { ...mockUser, role: "admin" };

    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    const lastStep = result.current.steps[result.current.steps.length - 1];
    expect(lastStep.id).toBe("completion");

    const secondToLast = result.current.steps[result.current.steps.length - 2];
    expect(secondToLast.id).toBe("admin-panel");
  });

  // ── Tour actions ──

  it("startTour activates the tour", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.currentStep).toBe(0);
  });

  it("nextStep advances the step counter", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.nextStep();
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.isTransitioning).toBe(true);

    // Transition clears after 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isTransitioning).toBe(false);
  });

  it("nextStep does not go beyond last step", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    // Advance to last step
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      act(() => {
        result.current.nextStep();
        jest.advanceTimersByTime(500);
      });
    }

    // Should stay at last step
    expect(result.current.currentStep).toBeLessThanOrEqual(TOUR_STEPS.length - 1);
  });

  it("prevStep goes back one step", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.nextStep();
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.nextStep();
      jest.advanceTimersByTime(500);
    });

    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.prevStep();
      jest.advanceTimersByTime(500);
    });

    expect(result.current.currentStep).toBe(1);
  });

  it("prevStep does not go below 0", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.prevStep();
      jest.advanceTimersByTime(500);
    });

    expect(result.current.currentStep).toBe(0);
  });

  it("skipTour deactivates tour and persists to localStorage", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.nextStep();
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.skipTour();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.hasSkippedTour).toBe(true);
    expect(result.current.hasCompletedTour).toBe(false);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.skipped).toBe(true);
    expect(stored.completed).toBe(false);
    expect(stored.version).toBe(TOUR_VERSION);
  });

  it("completeTour deactivates and persists completed status", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.completeTour();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.hasCompletedTour).toBe(true);
    expect(result.current.hasSkippedTour).toBe(false);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.completed).toBe(true);
    expect(stored.completedAt).toBeTruthy();
    expect(stored.version).toBe(TOUR_VERSION);
  });

  it("completeTour syncs to backend", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api } = require("@/lib/api-client");
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.completeTour();
    });

    expect(api.patch).toHaveBeenCalledWith("/preferences/tour-status", {
      completed: true,
    });
  });

  it("skipTour syncs to backend", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api } = require("@/lib/api-client");
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.skipTour();
    });

    expect(api.patch).toHaveBeenCalledWith("/preferences/tour-status", {
      completed: false,
    });
  });

  it("resetTour clears localStorage and state", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    // Complete the tour first
    act(() => {
      result.current.startTour();
    });
    act(() => {
      result.current.completeTour();
    });

    expect(result.current.hasCompletedTour).toBe(true);

    act(() => {
      result.current.resetTour();
    });

    expect(result.current.hasCompletedTour).toBe(false);
    expect(result.current.hasSkippedTour).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("goToStep jumps to a specific step index", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.goToStep(5);
    });

    expect(result.current.currentStep).toBe(5);
    expect(result.current.isTransitioning).toBe(true);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isTransitioning).toBe(false);
  });

  it("goToStep ignores out-of-bounds index", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.goToStep(100);
    });

    expect(result.current.currentStep).toBe(0); // unchanged

    act(() => {
      result.current.goToStep(-1);
    });

    expect(result.current.currentStep).toBe(0); // unchanged
  });

  // ── localStorage persistence ──

  it("loads completed state from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: true,
        skipped: false,
        completedAt: "2024-01-01T00:00:00.000Z",
        lastStepSeen: 7,
        version: TOUR_VERSION,
      })
    );

    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    expect(result.current.hasCompletedTour).toBe(true);
    expect(result.current.hasSkippedTour).toBe(false);
  });

  it("loads skipped state from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: false,
        skipped: true,
        completedAt: null,
        lastStepSeen: 3,
        version: TOUR_VERSION,
      })
    );

    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    expect(result.current.hasCompletedTour).toBe(false);
    expect(result.current.hasSkippedTour).toBe(true);
  });

  it("ignores stored data from old version", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: true,
        skipped: false,
        completedAt: "2024-01-01T00:00:00.000Z",
        lastStepSeen: 7,
        version: TOUR_VERSION - 1, // Old version
      })
    );

    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    // Should treat as fresh (not completed)
    expect(result.current.hasCompletedTour).toBe(false);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json");

    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    // Should start fresh
    expect(result.current.hasCompletedTour).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  // ── Transition guard ──

  it("blocks nextStep during transition", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    act(() => {
      result.current.nextStep(); // triggers transition
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.isTransitioning).toBe(true);

    // Try another nextStep while transitioning
    act(() => {
      result.current.nextStep();
    });

    // Should still be at step 1 (blocked)
    expect(result.current.currentStep).toBe(1);
  });

  it("blocks prevStep during transition", () => {
    const { result } = renderHook(() => useProductTourContext(), { wrapper });

    act(() => {
      result.current.startTour();
    });

    // Go to step 3
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.nextStep();
        jest.advanceTimersByTime(500);
      });
    }

    act(() => {
      result.current.prevStep(); // triggers transition
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.isTransitioning).toBe(true);

    act(() => {
      result.current.prevStep(); // should be blocked
    });

    expect(result.current.currentStep).toBe(2);
  });
});
