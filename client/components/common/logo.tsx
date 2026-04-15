"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: "w-8 h-8", img: 32, text: "text-xl" },
    md: { icon: "w-10 h-10", img: 40, text: "text-2xl" },
    lg: { icon: "w-14 h-14", img: 56, text: "text-3xl" },
  };

  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <div className={cn("relative flex items-center justify-center", sizes[size].icon)}>
        <Image
          src="/logo1.png"
          alt="Balencia Logo"
          width={sizes[size].img}
          height={sizes[size].img}
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight gradient-text",
            sizes[size].text
          )}
        >
          Balencia
        </span>
      )}
    </Link>
  );
}
