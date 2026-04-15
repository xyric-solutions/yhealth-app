"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2, Info, CheckCircle, X, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmVariant = "danger" | "warning" | "info" | "success";

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  icon?: ReactNode;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const variantConfig: Record<
  ConfirmVariant,
  {
    iconBg: string;
    iconColor: string;
    ringColor: string;
    confirmClass: string;
    DefaultIcon: typeof Trash2;
  }
> = {
  danger: {
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    ringColor: "ring-red-500/20",
    confirmClass:
      "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20",
    DefaultIcon: Trash2,
  },
  warning: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    ringColor: "ring-amber-500/20",
    confirmClass:
      "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20",
    DefaultIcon: AlertTriangle,
  },
  info: {
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
    ringColor: "ring-sky-500/20",
    confirmClass:
      "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20",
    DefaultIcon: Info,
  },
  success: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    ringColor: "ring-emerald-500/20",
    confirmClass:
      "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
    DefaultIcon: CheckCircle,
  },
};

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  icon,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const config = variantConfig[variant];
  const IconComponent = config.DefaultIcon;

  const handleCancel = () => {
    if (isLoading) return;
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (isLoading) return;
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <AlertDialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-700/60 rounded-2xl shadow-2xl shadow-black/40 p-0 max-w-md overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="absolute right-4 top-4 z-10 text-slate-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pb-0">
          <AlertDialogHeader className="items-center text-center sm:text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl ring-4 mx-auto mb-2",
                config.iconBg,
                config.ringColor
              )}
            >
              {icon || <IconComponent className={cn("h-7 w-7", config.iconColor)} />}
            </motion.div>

            <AlertDialogTitle className="text-xl font-bold text-white mt-3">
              {title}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-sm text-slate-400 leading-relaxed mt-2 max-w-[320px] mx-auto">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        {/* Footer with subtle separator */}
        <AlertDialogFooter className="flex-row gap-3 p-6 pt-5 sm:justify-center">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 h-11 bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white rounded-xl transition-all"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "flex-1 h-11 rounded-xl font-semibold transition-all duration-200",
              !isLoading && "hover:scale-[1.02] active:scale-[0.98]",
              config.confirmClass
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
