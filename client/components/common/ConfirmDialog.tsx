/**
 * @file ConfirmDialog Component
 * @description Reusable confirmation dialog using shadcn AlertDialog
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Global state for confirmation dialog
const confirmDialogState: ConfirmDialogState = {
  isOpen: false,
  description: "",
  title: "Confirm",
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "default",
};

let setConfirmDialogState: ((state: ConfirmDialogState) => void) | null = null;

/**
 * ConfirmDialog Provider Component
 * Must be added to the app root to enable confirm dialogs
 */
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>(confirmDialogState);

  // Store setState globally so confirm() function can use it
  useEffect(() => {
    setConfirmDialogState = setState;
    return () => {
      setConfirmDialogState = null;
    };
  }, []);

   
  const handleConfirm = useCallback(() => {
    if (state.onConfirm) {
      state.onConfirm();
    }
    setState((prev) => ({ ...prev, isOpen: false, onConfirm: undefined, onCancel: undefined }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.onConfirm]);

   
  const handleCancel = useCallback(() => {
    if (state.onCancel) {
      state.onCancel();
    }
    setState((prev) => ({ ...prev, isOpen: false, onConfirm: undefined, onCancel: undefined }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.onCancel]);

  return (
    <>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {state.title || "Confirm"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {state.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancel}
              className="border-white/20 hover:bg-white/10 text-white"
            >
              {state.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                state.variant === "destructive"
                  ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                  : "bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-600"
              }
            >
              {state.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Custom confirm function that replaces window.confirm()
 * Returns a Promise<boolean> - true if confirmed, false if cancelled
 */
export function confirm(options: ConfirmDialogOptions | string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!setConfirmDialogState) {
      // If provider not mounted, fallback to browser confirm
      console.warn("ConfirmDialogProvider not found, falling back to window.confirm()");
      const confirmed = window.confirm(
        typeof options === "string" ? options : options.description
      );
      resolve(confirmed);
      return;
    }

    const normalizedOptions: ConfirmDialogOptions =
      typeof options === "string"
        ? { description: options }
        : options;

    setConfirmDialogState({
      isOpen: true,
      title: normalizedOptions.title || "Confirm",
      description: normalizedOptions.description,
      confirmText: normalizedOptions.confirmText || "Confirm",
      cancelText: normalizedOptions.cancelText || "Cancel",
      variant: normalizedOptions.variant || "default",
      onConfirm: () => {
        resolve(true);
      },
      onCancel: () => {
        resolve(false);
      },
    });
  });
}
