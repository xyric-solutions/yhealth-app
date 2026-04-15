"use client";

import { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminPreloader } from "@/components/admin/AdminPreloader";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { useAuth } from "@/app/context/AuthContext";

interface AdminLayoutClientProps {
  children: ReactNode;
}

export default function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const { isLoading, hasAccess } = useAdminAccess();
  const { user, isAuthenticated } = useAuth();

  // Show loading while checking access
  if (isLoading) {
    return <AdminPreloader text="Verifying admin access" />;
  }

  // If user is authenticated but doesn't have access, show error
  // Don't redirect here - let useAdminAccess handle redirects to avoid loops
  if (isAuthenticated && user && !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">
            You don&apos;t have permission to access this page.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Your role: {user.role || "unknown"}
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, useAdminAccess will handle redirect
  if (!isAuthenticated) {
    return <AdminPreloader text="Redirecting to sign in" />;
  }

  // User is authenticated and has access
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}
