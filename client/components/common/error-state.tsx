"use client";

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message to display */
  message: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Retry button text */
  retryText?: string;
  /** Back callback */
  onBack?: () => void;
  /** Back button text */
  backText?: string;
  /** Visual variant */
  variant?: "dark" | "light";
  /** Whether to show full screen */
  fullScreen?: boolean;
  /** Icon to display (default: AlertCircle) */
  icon?: React.ReactNode;
  /** Custom className for the container */
  className?: string;
}

const variantClasses = {
  dark: {
    bg: "bg-slate-950",
    iconBg: "bg-red-500/20",
    iconColor: "text-red-400",
    title: "text-white",
    message: "text-slate-400",
    button: "bg-slate-800 text-white hover:bg-slate-700",
    buttonSecondary: "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50",
  },
  light: {
    bg: "bg-white",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    title: "text-slate-900",
    message: "text-slate-600",
    button: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    buttonSecondary: "bg-slate-50 text-slate-600 hover:bg-slate-100",
  },
};

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryText = "Try Again",
  onBack,
  backText = "Go Back",
  variant = "dark",
  fullScreen = true,
  icon,
  className,
}: ErrorStateProps) {
  const classes = variantClasses[variant];

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4",
        fullScreen && "min-h-screen",
        classes.bg,
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div
          className={cn(
            "w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center",
            classes.iconBg
          )}
        >
          {icon || (
            <AlertCircle className={cn("w-10 h-10", classes.iconColor)} />
          )}
        </div>

        <h1 className={cn("text-2xl font-bold mb-3", classes.title)}>
          {title}
        </h1>

        <p className={cn("mb-8", classes.message)}>{message}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onBack && (
            <Button
              onClick={onBack}
              variant="ghost"
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors",
                classes.buttonSecondary
              )}
            >
              <ArrowLeft className="w-5 h-5" />
              {backText}
            </Button>
          )}

          {onRetry && (
            <Button
              onClick={onRetry}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors",
                classes.button
              )}
            >
              <RefreshCw className="w-5 h-5" />
              {retryText}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default ErrorState;
