"use client";

import { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { LenisProvider } from "@/components/providers/LenisProvider";

interface MainLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  headerVariant?: "default" | "transparent" | "solid";
  className?: string;
}

export function MainLayout({
  children,
  showHeader = true,
  showFooter = true,
  className = "",
}: MainLayoutProps) {
  return (
    <LenisProvider>
      <div className={`min-h-screen flex flex-col ${className}`}>
        {showHeader && <Header />}
        <main className="flex-1 mt-14">{children}</main>
        {showFooter && <Footer />}
      </div>
    </LenisProvider>
  );
}

export default MainLayout;
