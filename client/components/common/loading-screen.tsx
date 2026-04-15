"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface LoadingScreenProps {
  /** Loading message to display */
  message?: string;
  /** Visual variant */
  variant?: "dark" | "light" | "transparent";
  /** Size of the loading indicator */
  size?: "sm" | "md" | "lg";
  /** Whether to show full screen overlay */
  fullScreen?: boolean;
  /** Custom className for the container */
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "w-12 h-12",
    icon: "w-6 h-6",
    blur: "-inset-1.5 rounded-2xl",
  },
  md: {
    container: "w-16 h-16",
    icon: "w-8 h-8",
    blur: "-inset-2 rounded-3xl",
  },
  lg: {
    container: "w-20 h-20",
    icon: "w-10 h-10",
    blur: "-inset-3 rounded-[1.5rem]",
  },
};

const variantClasses = {
  dark: "bg-slate-950",
  light: "bg-white",
  transparent: "bg-transparent",
};

const textVariantClasses = {
  dark: "text-slate-400",
  light: "text-slate-600",
  transparent: "text-slate-400",
};

export function LoadingScreen({
  message = "Loading...",
  variant = "dark",
  size = "md",
  fullScreen = true,
  className,
}: LoadingScreenProps) {
  const sizeClass = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6",
        fullScreen && "min-h-screen px-4",
        variantClasses[variant],
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <motion.div
            className={cn("flex items-center justify-center", sizeClass.container)}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/logo1.png"
              alt="Balencia"
              width={size === "lg" ? 64 : size === "md" ? 48 : 36}
              height={size === "lg" ? 64 : size === "md" ? 48 : 36}
              className="object-contain"
              priority
            />
          </motion.div>
          <motion.div
            className={cn(
              "absolute bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 blur-xl",
              sizeClass.blur
            )}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        {message && (
          <p className={cn("text-center", textVariantClasses[variant])}>
            {message}
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default LoadingScreen;
