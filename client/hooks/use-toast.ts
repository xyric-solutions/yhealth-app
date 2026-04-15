"use client";

import toast from "react-hot-toast";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

export function useToast() {
  return {
    toast: (options: ToastOptions | string) => {
      if (typeof options === "string") {
        return toast(options);
      }
      
      const message = options.description || options.title || "";
      const isError = options.variant === "destructive";
      const isSuccess = options.variant === "success";
      
      if (isError) {
        return toast.error(message);
      } else if (isSuccess) {
        return toast.success(message);
      } else {
        return toast(message);
      }
    },
  };
}

