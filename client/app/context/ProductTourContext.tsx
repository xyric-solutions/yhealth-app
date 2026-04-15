"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { api } from "@/lib/api-client";
import {
  TOUR_STEPS,
  ADMIN_EXTRA_STEPS,
  TOUR_VERSION,
} from "@/components/common/product-tour/tour-steps";
import type {
  ProductTourContextValue,
  TourState,
  TourStorageData,
} from "@/components/common/product-tour/types";

const STORAGE_KEY = "balencia_product_tour";

function getStoredTourData(): TourStorageData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistTourData(data: TourStorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail if storage is full
  }
}

const ProductTourContext = createContext<ProductTourContextValue | undefined>(
  undefined
);

interface ProductTourProviderProps {
  children: ReactNode;
}

export function ProductTourProvider({ children }: ProductTourProviderProps) {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const autoTriggeredRef = useRef(false);

  // Resolve steps based on user role
  const steps = useMemo(() => {
    const isAdmin = user?.role?.toLowerCase() === "admin";
    const allSteps = [...TOUR_STEPS];

    if (isAdmin) {
      const completionIndex = allSteps.findIndex((s) => s.id === "completion");
      if (completionIndex !== -1) {
        allSteps.splice(completionIndex, 0, ...ADMIN_EXTRA_STEPS);
      }
    }

    return allSteps;
  }, [user?.role]);

  // Initialize state from localStorage
  const [state, setState] = useState<TourState>(() => {
    const stored = getStoredTourData();
    const isCurrentVersion = stored?.version === TOUR_VERSION;

    return {
      isActive: false,
      currentStep: 0,
      hasCompletedTour: isCurrentVersion ? (stored?.completed ?? false) : false,
      hasSkippedTour: isCurrentVersion ? (stored?.skipped ?? false) : false,
      isTransitioning: false,
    };
  });

  // Backend sync (fire-and-forget)
  const syncToBackend = useCallback(async (completed: boolean) => {
    try {
      await api.patch("/preferences/tour-status", { completed });
    } catch {
      // Non-critical — localStorage is source of truth for UX
    }
  }, []);

  const startTour = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: true,
      currentStep: 0,
      isTransitioning: false,
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (prev.isTransitioning) return prev;
      if (prev.currentStep >= steps.length - 1) return prev;
      return {
        ...prev,
        currentStep: prev.currentStep + 1,
        isTransitioning: true,
      };
    });
    // Clear transitioning after animation settles
    setTimeout(() => {
      setState((prev) => ({ ...prev, isTransitioning: false }));
    }, 500);
  }, [steps.length]);

  const prevStep = useCallback(() => {
    setState((prev) => {
      if (prev.isTransitioning) return prev;
      if (prev.currentStep <= 0) return prev;
      return {
        ...prev,
        currentStep: prev.currentStep - 1,
        isTransitioning: true,
      };
    });
    setTimeout(() => {
      setState((prev) => ({ ...prev, isTransitioning: false }));
    }, 500);
  }, []);

  const completeTour = useCallback(() => {
    const data: TourStorageData = {
      completed: true,
      skipped: false,
      completedAt: new Date().toISOString(),
      lastStepSeen: steps.length - 1,
      version: TOUR_VERSION,
    };
    persistTourData(data);
    syncToBackend(true);

    setState((prev) => ({
      ...prev,
      isActive: false,
      hasCompletedTour: true,
      hasSkippedTour: false,
      currentStep: 0,
    }));
  }, [steps.length, syncToBackend]);

  const skipTour = useCallback(() => {
    const data: TourStorageData = {
      completed: false,
      skipped: true,
      completedAt: null,
      lastStepSeen: state.currentStep,
      version: TOUR_VERSION,
    };
    persistTourData(data);
    syncToBackend(false);

    setState((prev) => ({
      ...prev,
      isActive: false,
      hasCompletedTour: false,
      hasSkippedTour: true,
      currentStep: 0,
    }));
  }, [state.currentStep, syncToBackend]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState((prev) => ({
      ...prev,
      hasCompletedTour: false,
      hasSkippedTour: false,
      currentStep: 0,
    }));
    autoTriggeredRef.current = false;
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      setState((prev) => ({
        ...prev,
        currentStep: index,
        isTransitioning: true,
      }));
      setTimeout(() => {
        setState((prev) => ({ ...prev, isTransitioning: false }));
      }, 500);
    },
    [steps.length]
  );

  // Auto-trigger on first dashboard visit after onboarding
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (state.hasCompletedTour || state.hasSkippedTour) return;
    if (state.isActive) return;
    if (autoTriggeredRef.current) return;

    const isOnDashboard =
      pathname === "/dashboard" || pathname?.startsWith("/dashboard");
    const isOnboardingComplete = user.onboardingStatus === "completed";

    if (isOnDashboard && isOnboardingComplete) {
      // Delay to let dashboard render first
      const timer = setTimeout(() => {
        autoTriggeredRef.current = true;
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    authLoading,
    isAuthenticated,
    user,
    pathname,
    state.hasCompletedTour,
    state.hasSkippedTour,
    state.isActive,
    startTour,
  ]);

  // Handle navigation for steps that require a specific route
  useEffect(() => {
    if (!state.isActive) return;
    const step = steps[state.currentStep];
    if (!step?.navigateTo) return;

    // Compare base path (navigateTo may include query params like ?tab=settings)
    const targetUrl = new URL(step.navigateTo, window.location.origin);
    const currentUrl = new URL(window.location.href);

    const needsNavigation =
      targetUrl.pathname !== currentUrl.pathname ||
      targetUrl.search !== currentUrl.search;

    if (needsNavigation) {
      router.push(step.navigateTo);
    }
  }, [state.isActive, state.currentStep, steps, pathname, router]);

  const value = useMemo<ProductTourContextValue>(
    () => ({
      ...state,
      steps,
      totalSteps: steps.length,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      resetTour,
      goToStep,
    }),
    [
      state,
      steps,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
      resetTour,
      goToStep,
    ]
  );

  return (
    <ProductTourContext.Provider value={value}>
      {children}
    </ProductTourContext.Provider>
  );
}

export function useProductTourContext(): ProductTourContextValue {
  const context = useContext(ProductTourContext);
  if (!context) {
    throw new Error(
      "useProductTourContext must be used within a ProductTourProvider"
    );
  }
  return context;
}
