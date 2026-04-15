"use client";

import { ReactNode, useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DashboardSidebar, MobileBottomNav } from "@/app/(pages)/dashboard/components";
import { useSubscriptionAccessOptional } from "@/app/context/SubscriptionAccessContext";
import { SubscriptionPaywallOverlay } from "@/components/subscription/SubscriptionGate";
import { DashboardHeader } from "./DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab?: string;
  className?: string;
}

export function DashboardLayout({
  children,
  activeTab,
  className = "",
}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasAccess, isLoading } = useSubscriptionAccessOptional();
  const locked = !isLoading && !hasAccess;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine active tab from pathname if not provided
  const getActiveTab = (): string => {
    if (activeTab) return activeTab;
    
    // Extract tab from pathname
    if (pathname === "/dashboard") {
      // Check for dashboard tabs from URL search params (client-side only)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        return tab || "overview";
      }
      return "overview";
    }
    if (pathname === "/whoop") return "whoop";
    if (pathname === "/goals") return "goals";
    if (pathname === "/workouts") return "workouts";
    if (pathname === "/exercises" || pathname.startsWith("/exercises")) return "exercises";
    if (pathname === "/nutrition") return "nutrition";
    if (pathname === "/progress") return "progress";
    // Check activity-status before activity to avoid false matches
    if (pathname === "/activity-status" || pathname.startsWith("/activity-status")) return "activity-status";
    if (pathname === "/activity" || pathname.startsWith("/activity")) return "activity";
    if (pathname === "/achievements") return "achievements";
    if (pathname.startsWith("/competitions")) return "competitions";
    if (pathname.startsWith("/leaderboard")) return "leaderboard";
    if (pathname === "/ai-coach") return "ai-coach";
    if (pathname === "/chat") return "chat";
    if (pathname === "/notifications") return "notifications";
    if (pathname === "/settings") return "settings";
    if (pathname === "/profile") return "profile";
    
    return "overview";
  };

  const handleTabChange = useCallback(
    (tab: string) => {
      // Handle navigation for different tab types
      if (tab.startsWith("/")) {
        router.push(tab);
      } else if (tab === "overview") {
        router.push("/dashboard");
      } else if (["workouts", "exercises", "nutrition", "progress", "activity", "achievements", "leaderboard", "competitions"].includes(tab)) {
        // Navigate to separate pages for these tabs
        router.push(`/${tab}`);
      } else {
        // Fallback to query param for remaining tabs
        router.push(`/dashboard?tab=${tab}`);
      }
    },
    [router]
  );

  return (
    <div className={`min-h-screen bg-slate-950 ${className}`}>
      {/* Sidebar - Desktop (blurred/disabled when locked) */}
      <div className={`hidden md:block transition-all duration-300 ${locked ? 'pointer-events-none select-none opacity-60' : ''}`}>
        <div className={locked ? 'blur-[2px]' : ''}>
          <DashboardSidebar
            activeTab={getActiveTab()}
            onTabChange={handleTabChange}
            onCollapsedChange={setSidebarCollapsed}
            disabled={locked}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation (disabled when locked) */}
      <div className={`md:hidden transition-all duration-300 ${locked ? 'pointer-events-none select-none opacity-60' : ''}`}>
        <div className={locked ? 'blur-[2px]' : ''}>
          <MobileBottomNav
            activeTab={getActiveTab()}
            onTabChange={handleTabChange}
            disabled={locked}
          />
        </div>
      </div>

      {/* Main Content (blurred when locked, overlay on top) */}
      <div className={`${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'} min-h-screen pb-20 md:pb-0 overflow-x-hidden transition-all duration-300 ${locked ? 'pointer-events-none select-none' : ''}`}>
        <div className={locked ? 'blur-md' : ''}>
          <DashboardHeader />
          {children}
        </div>
      </div>

      {/* Paywall overlay when subscription required */}
      {locked && <SubscriptionPaywallOverlay />}
    </div>
  );
}

export default DashboardLayout;

