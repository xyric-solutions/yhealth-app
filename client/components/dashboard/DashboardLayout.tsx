"use client";

import { ReactNode, useState, useEffect } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({
  children,
  className,
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <DashboardSidebar
        onToggle={setSidebarCollapsed}
      />
      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
          !isMobile && "lg:ml-[280px]",
          !isMobile && sidebarCollapsed && "lg:ml-[80px]"
        )}
      >
        <DashboardHeader />
        <main
          className={cn(
            "flex-1 overflow-y-auto bg-slate-950",
            "p-4 lg:p-6",
            className
          )}
        >
          <div className="mx-auto max-w-8xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

