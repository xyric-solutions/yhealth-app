"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertCircle, X } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: "success" | "info" | "warning";
  buttonText?: string;
}

const variantConfig = {
  success: {
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/20",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700",
    borderColor: "border-emerald-500/30",
  },
  info: {
    icon: Info,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/20",
    buttonBg: "bg-blue-600 hover:bg-blue-700",
    borderColor: "border-blue-500/30",
  },
  warning: {
    icon: AlertCircle,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/20",
    buttonBg: "bg-amber-600 hover:bg-amber-700",
    borderColor: "border-amber-500/30",
  },
};

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = "info",
  buttonText = "OK",
}: AlertModalProps) {
  if (typeof window === "undefined") return null;

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border ${config.borderColor} rounded-2xl shadow-2xl z-[10000] p-6`}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>

            {/* Icon and Content */}
            <div className="flex items-start gap-4 mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}
              >
                <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
              </motion.div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-end">
              <motion.button
                onClick={onClose}
                className={`px-6 py-2.5 rounded-lg ${config.buttonBg} text-white font-medium transition-all shadow-lg flex items-center justify-center gap-2`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {buttonText}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

