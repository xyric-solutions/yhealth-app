"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { BodyPartStatus } from "@shared/types/domain/yoga";

const STATUS_CONFIG = {
  correct: {
    icon: CheckCircle2,
    colour: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    label: "Good",
  },
  needs_adjustment: {
    icon: AlertTriangle,
    colour: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    label: "Adjust",
  },
  incorrect: {
    icon: XCircle,
    colour: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    label: "Fix",
  },
} as const;

interface BodyPartCardProps {
  bodyPart: BodyPartStatus;
  index: number;
}

export default function BodyPartCard({ bodyPart, index }: BodyPartCardProps) {
  const config = STATUS_CONFIG[bodyPart.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className={`flex items-start gap-3 rounded-xl border p-3 backdrop-blur-sm ${config.bg}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.colour}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{bodyPart.part}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.colour} bg-white/5`}
          >
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-white/60">
          {bodyPart.feedback}
        </p>
      </div>
    </motion.div>
  );
}
