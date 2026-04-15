"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";

// User interface matching backend response
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  role: string;
  isEmailVerified: boolean;
  onboardingStatus: string;
  createdAt: string;
  updatedAt: string;
}

// Auth state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  onboardingStatus: string | null;
}

// Auth context value interface
interface AuthContextValue extends AuthState {
  // Actions
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  // Helpers
  getInitials: () => string;
  getDisplayName: () => string;
  isOnboardingComplete: () => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
}

// Create context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Protected routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/onboarding", "/settings", "/profile"];

// Admin routes that require admin role
const ADMIN_ROUTES = ["/admin"];

// Routes that should redirect to dashboard if authenticated
const AUTH_ROUTES = ["/auth/signin", "/auth/signup"];

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  // Memoize router to prevent dependency array changes
  const routerRef = useRef(router);
  routerRef.current = router;

  // Store only user data from API - session data is derived
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);

  // Initialize API client from cookie on mount (for page refreshes)
  useEffect(() => {
    api.initFromCookie();
    
    // Set up token expiration handler - automatically logout on 401
    api.setOnTokenExpired(async () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[AuthContext] Token expired, logging out user");
      }
      
      // Clear token
      api.setAccessToken(null);
      
      // Sign out from NextAuth with error handling
      try {
        await signOut({ 
          redirect: true,
          callbackUrl: "/auth/signin?expired=true"
        });
      } catch (error) {
        // Handle JSON parsing errors or other signOut issues
        console.error("[AuthContext] Error during signOut:", error);
        // Fallback: redirect manually if signOut fails
        if (typeof window !== "undefined") {
          window.location.href = "/auth/signin?expired=true";
        }
      }
    });
    
    // Cleanup: remove callback on unmount
    return () => {
      api.setOnTokenExpired(null);
    };
  }, []);

  // Derive auth state from session (no setState needed)
  // Also synchronously set API token during memo computation
  const authState = useMemo<AuthState>(() => {
    const isLoading = status === "loading";
    const isAuthenticated = status === "authenticated" && !!session;

    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log("[AuthContext] Session state:", {
        status,
        hasSession: !!session,
        sessionUser: session?.user ? { id: session.user.id, email: session.user.email } : null,
        accessToken: session?.accessToken
          ? `${session.accessToken.substring(0, 20)}...`
          : null,
        refreshToken: session?.refreshToken ? "present" : null,
        onboardingStatus: session?.onboardingStatus,
      });
    }

    if (isLoading) {
      return {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        accessToken: null,
        refreshToken: null,
        onboardingStatus: null,
      };
    }

    if (!isAuthenticated || !session) {
      // Clear API token when not authenticated
      api.setAccessToken(null);
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
        refreshToken: null,
        onboardingStatus: null,
      };
    }

    // Set API token synchronously when session is available
    if (session.accessToken) {
      api.setAccessToken(session.accessToken);
    } else {
      // Try to recover token from cookie (set during login via use-auth.ts)
      const hasTokenInCookie = api.hasToken();
      if (hasTokenInCookie) {
        console.log(
          "[AuthContext] Session missing accessToken, but found token in cookie"
        );
      } else {
        console.warn(
          "[AuthContext] Session authenticated but no accessToken found (and none in cookie)!"
        );
      }
    }

    // Use fetched user if available, otherwise create from session
    // IMPORTANT: If fetchedUser is null, we should wait for it to load before determining role
    // For now, use session role if available, otherwise default to "user"
    const user: User = fetchedUser || {
      id: session.user.id,
      email: session.user.email || "",
      firstName: session.user.name?.split(" ")[0] || "",
      lastName: session.user.name?.split(" ").slice(1).join(" ") || "",
      avatarUrl: session.user.image || null,
      dateOfBirth: null,
      gender: null,
      phone: null,
      // Use role from session if available, otherwise default to "user"
      // Note: This is a fallback - the real role should come from fetchedUser
      // The role is now included in NextAuth session via session.user.role
      role: (session.user as { role?: string }).role || "user",
      isEmailVerified: true,
      onboardingStatus: session.onboardingStatus || "pending",
      createdAt: "",
      updatedAt: "",
    };

    // Use session token or fallback to API client token (from cookie)
    const effectiveAccessToken = session.accessToken || api.getAccessToken();

    return {
      user,
      isAuthenticated: true,
      isLoading: false,
      accessToken: effectiveAccessToken,
      refreshToken: session.refreshToken,
      onboardingStatus:
        fetchedUser?.onboardingStatus || session.onboardingStatus,
    };
  }, [status, session, fetchedUser]);

  // Track previous session to detect changes
  const prevSessionIdRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string>(status);

  // Fetch user profile when authenticated - using effect with async callback pattern
  useEffect(() => {
    const currentSessionId = session?.user?.id || null;
    let isMounted = true;

    // Detect logout transition - clear user via microtask to avoid sync setState
    if (
      prevStatusRef.current === "authenticated" &&
      status === "unauthenticated"
    ) {
      prevSessionIdRef.current = null;
      Promise.resolve().then(() => {
        if (isMounted) setFetchedUser(null);
      });
    }
    prevStatusRef.current = status;

    // Only fetch if session changed (new login) and we have a valid token
    if (
      status === "authenticated" &&
      session?.accessToken &&
      currentSessionId !== prevSessionIdRef.current
    ) {
      prevSessionIdRef.current = currentSessionId;

      // Ensure token is set before fetching
      api.setAccessToken(session.accessToken);

      // Async fetch with cleanup check
      const doFetch = async () => {
        try {
          // Backend returns { user: {...} } structure
          const response = await api.get<{ user: User }>("/auth/me");
          if (isMounted && response.success && response.data?.user) {
            setFetchedUser(response.data.user);

            // Auto-check and reschedule workouts in the background (silently)
            // This runs automatically when user opens the app
            // Use dynamic import to avoid blocking initial load
            import('@/src/shared/services')
              .then(({ workoutRescheduleService }) => {
                workoutRescheduleService.autoCheckAndReschedule().catch((err) => {
                  // Silently fail - don't interrupt user experience
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[WorkoutAutoCheck] Background reschedule check completed with error:', err);
                  }
                });
              })
              .catch((importError) => {
                // Silently fail if service can't be imported
                if (process.env.NODE_ENV === 'development') {
                  console.log('[WorkoutAutoCheck] Failed to import service:', importError);
                }
              });
          }
        } catch (error) {
          if (
            isMounted &&
            error instanceof ApiError &&
            error.statusCode === 401
          ) {
            // Token expired or invalid - sign out
            await signOut({ redirect: false });
            setFetchedUser(null);
          } else if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
            // Server unreachable - use session data if available; avoid noisy console
            if (process.env.NODE_ENV === "development") {
              console.warn("[Auth] Server unreachable. Using session data if available.");
            }
          } else {
            console.error("Failed to fetch user profile:", error);
          }
        }
      };
      doFetch();
    }

    return () => {
      isMounted = false;
    };
  }, [status, session?.accessToken, session?.user?.id]);

  // Check if user has a specific role (defined early for use in route protection)
  const hasRole = useCallback(
    (role: string) => {
      if (!authState.user?.role) return false;
      // Case-insensitive role comparison to handle "Admin" vs "admin"
      return authState.user.role.toLowerCase() === role.toLowerCase();
    },
    [authState.user]
  );

  // Check if user is admin
  const isAdmin = useCallback(() => {
    return hasRole("admin");
  }, [hasRole]);

  // Route protection
  // Extract values to ensure stable dependency array
  const isLoading = authState.isLoading;
  const isAuthenticated = authState.isAuthenticated;
  const onboardingStatus = authState.onboardingStatus;

  useEffect(() => {
    // Don't redirect while loading - wait for auth state to be determined
    if (isLoading) return;

    // Don't redirect if we're already on an error page or auth page
    if (pathname.includes("?error=") || pathname.startsWith("/auth/")) {
      return;
    }

    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );
    const isAdminRoute = ADMIN_ROUTES.some((route) =>
      pathname.startsWith(route)
    );
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

    // Redirect to signin if trying to access protected route without auth
    if (isProtectedRoute && !isAuthenticated) {
      const callbackUrl = encodeURIComponent(pathname);
      routerRef.current.push(`/auth/signin?callbackUrl=${callbackUrl}`);
      return;
    }

    // For admin routes, let the admin layout handle the check completely
    // Don't redirect here to avoid conflicts with useAdminAccess hook
    // The useAdminAccess hook in admin/layout.tsx will handle all admin route protection
    if (isAdminRoute) {
      // Only redirect to signin if not authenticated, let useAdminAccess handle role check
      if (!isAuthenticated) {
        const callbackUrl = encodeURIComponent(pathname);
        routerRef.current.push(`/auth/signin?callbackUrl=${callbackUrl}`);
      }
      return;
    }

    // Redirect to dashboard if authenticated and trying to access auth routes
    if (isAuthRoute && isAuthenticated) {
      routerRef.current.push("/dashboard");
      return;
    }

    // Handle onboarding redirect
    if (
      isAuthenticated &&
      onboardingStatus !== "completed" &&
      pathname.startsWith("/dashboard") &&
      !pathname.startsWith("/onboarding")
    ) {
      // Uncomment to enforce onboarding
      // routerRef.current.push("/onboarding");
    }
  }, [
    isLoading,
    isAuthenticated,
    onboardingStatus,
    pathname,
  ]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Call backend logout if needed
      await api.post("/auth/logout", {});
    } catch {
      // Ignore logout errors
    }

    await signOut({ callbackUrl: "/" });
    // State will be automatically derived as unauthenticated via useMemo
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const accessToken = session?.accessToken;
    if (!accessToken) return;

    try {
      // Backend returns { user: {...} } structure
      const response = await api.get<{ user: User }>("/auth/me");
      if (response.success && response.data?.user) {
        setFetchedUser(response.data.user);
      }
    } catch (error) {
      console.error("Failed to refresh user profile:", error);
      if (error instanceof ApiError && error.statusCode === 401) {
        await signOut({ redirect: false });
        setFetchedUser(null);
      }
    }
  }, [session?.accessToken]);

  // Update user locally (optimistic updates)
  const updateUser = useCallback((updates: Partial<User>) => {
    setFetchedUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  // Get user initials
  const getInitials = useCallback(() => {
    if (!authState.user) return "?";
    const first = authState.user.firstName?.[0] || "";
    const last = authState.user.lastName?.[0] || "";
    const initials = (first + last).toUpperCase();
    if (initials) return initials;
    // Fallback to email first character
    return authState.user.email?.[0]?.toUpperCase() || "?";
  }, [authState.user]);

  // Get display name
  const getDisplayName = useCallback(() => {
    if (!authState.user) return "";
    if (authState.user.firstName) {
      return `${authState.user.firstName} ${
        authState.user.lastName || ""
      }`.trim();
    }
    return authState.user.email || "";
  }, [authState.user]);

  // Check if onboarding is complete
  const isOnboardingComplete = useCallback(() => {
    return authState.onboardingStatus === "completed";
  }, [authState.onboardingStatus]);

  const contextValue: AuthContextValue = {
    ...authState,
    logout,
    refreshUser,
    updateUser,
    getInitials,
    getDisplayName,
    isOnboardingComplete,
    hasRole,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { requiredRole?: string }
) {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, isLoading, hasRole } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push("/auth/signin");
      }
      if (options?.requiredRole && !hasRole(options.requiredRole)) {
        router.push("/unauthorized");
      }
    }, [isLoading, isAuthenticated, hasRole, router]);

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

export default AuthContext;
