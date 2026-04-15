"use client";

import { motion } from "framer-motion";
import {
  Trophy,
  Target,
  CheckCircle2,
  Flame,
  Clock,
  RefreshCw,
  Settings,
  Users,
  Link2,
  Bot,
  PartyPopper,
  AlertTriangle,
  Lightbulb,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NotificationEvent } from "@/lib/socket-client";

// Type-to-config map (matches NotificationsPageContent)
const NOTIFICATION_CONFIG: Record<
  string,
  { icon: LucideIcon; gradient: string; borderColor: string }
> = {
  achievement: {
    icon: Trophy,
    gradient: "from-amber-500 to-orange-500",
    borderColor: "border-amber-500/50",
  },
  goal_progress: {
    icon: Target,
    gradient: "from-blue-500 to-cyan-500",
    borderColor: "border-blue-500/50",
  },
  goal_completed: {
    icon: CheckCircle2,
    gradient: "from-emerald-500 to-green-500",
    borderColor: "border-emerald-500/50",
  },
  streak: {
    icon: Flame,
    gradient: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/50",
  },
  reminder: {
    icon: Clock,
    gradient: "from-purple-500 to-violet-500",
    borderColor: "border-purple-500/50",
  },
  plan_update: {
    icon: RefreshCw,
    gradient: "from-cyan-500 to-blue-500",
    borderColor: "border-cyan-500/50",
  },
  system: {
    icon: Settings,
    gradient: "from-slate-500 to-gray-500",
    borderColor: "border-slate-500/50",
  },
  social: {
    icon: Users,
    gradient: "from-pink-500 to-rose-500",
    borderColor: "border-pink-500/50",
  },
  integration: {
    icon: Link2,
    gradient: "from-indigo-500 to-purple-500",
    borderColor: "border-indigo-500/50",
  },
  coaching: {
    icon: Bot,
    gradient: "from-teal-500 to-cyan-500",
    borderColor: "border-teal-500/50",
  },
  celebration: {
    icon: PartyPopper,
    gradient: "from-yellow-500 to-amber-500",
    borderColor: "border-yellow-500/50",
  },
  warning: {
    icon: AlertTriangle,
    gradient: "from-red-500 to-rose-500",
    borderColor: "border-red-500/50",
  },
  tip: {
    icon: Lightbulb,
    gradient: "from-green-500 to-emerald-500",
    borderColor: "border-green-500/50",
  },
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-amber-500",
  normal: "border-l-cyan-500/30",
  low: "border-l-slate-600",
};

interface NotificationToastProps {
  notification: NotificationEvent;
  onDismiss: () => void;
  onClick?: () => void;
}

export function NotificationToast({
  notification,
  onDismiss,
  onClick,
}: NotificationToastProps) {
  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.system;
  const Icon = config.icon;
  const borderLeft = PRIORITY_BORDER[notification.priority] || PRIORITY_BORDER.normal;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      className={`
        relative flex items-start gap-3 p-4 pr-10
        bg-slate-900/95 backdrop-blur-xl
        border border-white/10 border-l-[3px] ${borderLeft}
        rounded-2xl shadow-2xl shadow-black/30
        cursor-pointer hover:bg-slate-800/95 transition-colors
        max-w-[380px] w-full
      `}
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}
      >
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {notification.title}
        </p>
        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-slate-500" />
      </button>
    </motion.div>
  );
}

// Export config for reuse in NotificationDropdown
export { NOTIFICATION_CONFIG, PRIORITY_BORDER };
