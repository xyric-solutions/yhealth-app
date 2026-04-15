"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

interface UseAdminAccessReturn {
  isAdmin: boolean;
  isLoading: boolean;
  hasAccess: boolean;
  redirect: () => void;
}

/**
 * Custom hook for admin access validation
 * Checks authentication and admin role
 * Handles loading and error states
 */
export function useAdminAccess(): UseAdminAccessReturn {
  const { user, isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate isAdmin based on user data
  const isAdmin = user ? hasRole("admin") : false;
  const hasAccess = isAuthenticated && user && isAdmin;

  // Derive isChecking from dependencies instead of setting it in effect
  const isChecking = useMemo(() => {
    // Still checking if auth is loading
    if (authLoading) return true;
    
    // Still checking if user data hasn't loaded yet
    if (isAuthenticated && !user) return true;
    
    // Not checking if we're on error/auth pages
    if (pathname.includes("?error=") || pathname.startsWith("/auth/")) return false;
    
    // If user role is "user" (default), might still be loading from API
    if (user?.role === "user" && isAuthenticated) return true;
    
    return false;
  }, [authLoading, isAuthenticated, user, pathname]);

  useEffect(() => {
    // Reset redirect flag when pathname changes
    if (pathname && !pathname.includes("?error=")) {
      hasRedirectedRef.current = false;
    }

    // Don't redirect if we're already on an error page or auth page
    if (pathname.includes("?error=") || pathname.startsWith("/auth/")) {
      return;
    }

    // Prevent redirect loops
    if (hasRedirectedRef.current) {
      return;
    }

    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      // Only redirect if not already on signin page
      if (!pathname.startsWith("/auth/signin")) {
        hasRedirectedRef.current = true;
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    // Wait for user data to be loaded before checking role
    // IMPORTANT: We need to wait for fetchedUser to be loaded from API
    // because the session fallback defaults role to "user"
    if (!user) {
      return;
    }

    // Additional check: if user role is "user" (default fallback), 
    // it might mean fetchedUser hasn't loaded yet
    // Give it a moment for the API fetch to complete before redirecting
    if (user.role === "user" && isAuthenticated && !hasRedirectedRef.current) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Wait a bit for user data to load from API
      // This handles race condition where session exists but API fetch is in progress
      timeoutRef.current = setTimeout(() => {
        // Re-check after timeout
        const userIsAdmin = hasRole("admin");
        if (!userIsAdmin && !pathname.startsWith("/dashboard")) {
          hasRedirectedRef.current = true;
          router.push("/dashboard?error=unauthorized");
        }
      }, 1500); // Wait 1.5 seconds for user data to load
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }

    // Now check if user has admin role
    const userIsAdmin = hasRole("admin");
    if (!userIsAdmin) {
      // Only redirect if not already on dashboard and haven't redirected yet
      if (!pathname.startsWith("/dashboard") && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push("/dashboard?error=unauthorized");
      }
      return;
    }

    // User is authenticated and is admin - allow access
    // No action needed, access is granted
  }, [authLoading, isAuthenticated, user, hasRole, router, pathname]);

  const redirect = useCallback(() => {
    if (!isAuthenticated) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
    } else if (!isAdmin) {
      router.push("/dashboard?error=unauthorized");
    }
  }, [isAuthenticated, isAdmin, router, pathname]);

  return {
    isAdmin: isAdmin || false,
    isLoading: authLoading || isChecking,
    hasAccess: hasAccess || false,
    redirect,
  };
}

