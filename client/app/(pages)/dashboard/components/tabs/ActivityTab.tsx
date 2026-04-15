"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Dumbbell,
  Utensils,
  Moon,
  Brain,
  Heart,
  Zap,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flame,
  TrendingUp,
  BarChart3,
  AlertCircle,
  RotateCcw,
  Timer,
  Target,
  Sparkles,
  Play,
  Check,
  X,
  Filter,
  ArrowUp,
  ArrowDown,
  Droplets,
  Footprints,
  CalendarRange,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Types
interface ActivityLog {
  id: string;
  type: string;
  title: string;
  description: string;
  completedAt: string;
  duration: number | null;
  pillar: string;
  source: "activity" | "health_data";
  metrics?: Record<string, unknown>;
}

interface ActivityStats {
  activitiesThisPeriod: number;
  activitiesChange: number;
  caloriesBurned: number;
  caloriesChange: number;
  activeTime: number;
  activeTimeChange: number;
  completionRate: number;
  completionRateChange: number;
  period: string;
  startDate: string;
  endDate: string;
}

interface ActivityBreakdown {
  type: string;
  activityType: string;
  label: string;
  pillar: string;
  count: number;
  total: number;
  completionRate: number;
  duration: number;
  expected: number;
}

interface CalendarDay {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  isToday: boolean;
  activities: {
    total: number;
    completed: number;
    completionRate: number;
  };
  healthLogs: number;
  duration: number;
  hasActivity: boolean;
}

const activityIcons: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-4 h-4" />,
  meal: <Utensils className="w-4 h-4" />,
  sleep: <Moon className="w-4 h-4" />,
  mindfulness: <Brain className="w-4 h-4" />,
  recovery: <Heart className="w-4 h-4" />,
  habit: <Zap className="w-4 h-4" />,
  check_in: <Heart className="w-4 h-4" />,
  water: <Droplets className="w-4 h-4" />,
  steps: <Footprints className="w-4 h-4" />,
};

const activityColors: Record<string, { gradient: string; bg: string; text: string }> = {
  workout: { gradient: "from-orange-500 to-red-500", bg: "bg-orange-500/20", text: "text-orange-400" },
  meal: { gradient: "from-green-500 to-emerald-500", bg: "bg-green-500/20", text: "text-green-400" },
  sleep: { gradient: "from-indigo-500 to-purple-500", bg: "bg-indigo-500/20", text: "text-indigo-400" },
  mindfulness: { gradient: "from-cyan-500 to-blue-500", bg: "bg-cyan-500/20", text: "text-cyan-400" },
  recovery: { gradient: "from-emerald-500 to-teal-500", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  habit: { gradient: "from-yellow-500 to-amber-500", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  check_in: { gradient: "from-pink-500 to-rose-500", bg: "bg-pink-500/20", text: "text-pink-400" },
  water: { gradient: "from-blue-400 to-cyan-500", bg: "bg-blue-500/20", text: "text-blue-400" },
  steps: { gradient: "from-teal-500 to-green-500", bg: "bg-teal-500/20", text: "text-teal-400" },
};

const pillarColors: Record<string, { gradient: string; bg: string; text: string }> = {
  fitness: { gradient: "from-orange-500 to-red-500", bg: "bg-orange-500/10", text: "text-orange-400" },
  nutrition: { gradient: "from-green-500 to-emerald-500", bg: "bg-green-500/10", text: "text-green-400" },
  wellbeing: { gradient: "from-purple-500 to-indigo-500", bg: "bg-purple-500/10", text: "text-purple-400" },
};

// Filter options
const activityFilterOptions = [
  { value: "all", label: "All Activities", icon: Activity },
  { value: "workout", label: "Workouts", icon: Dumbbell },
  { value: "meal", label: "Meals", icon: Utensils },
  { value: "sleep", label: "Sleep", icon: Moon },
  { value: "mindfulness", label: "Mindfulness", icon: Brain },
  { value: "recovery", label: "Recovery", icon: Heart },
  { value: "water", label: "Hydration", icon: Droplets },
  { value: "steps", label: "Steps", icon: Footprints },
];

const pillarFilterOptions = [
  { value: "all", label: "All Pillars" },
  { value: "fitness", label: "Fitness", color: "orange" },
  { value: "nutrition", label: "Nutrition", color: "green" },
  { value: "wellbeing", label: "Wellbeing", color: "purple" },
];

// Skeleton Loading Component
function ActivitySkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
      {/* Date nav skeleton */}
      <div className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
      {/* Chart skeleton */}
      <div className="h-48 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
      {/* Grid skeleton */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse">
          <div className="p-5 border-b border-white/[0.06]">
            <div className="h-5 w-32 rounded bg-white/[0.06]" />
          </div>
          <div className="p-5 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse">
          <div className="p-5 border-b border-white/[0.06]">
            <div className="h-5 w-40 rounded bg-white/[0.06]" />
          </div>
          <div className="p-5 space-y-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06]" />
                <div className="flex-1">
                  <div className="h-3 w-full rounded bg-white/[0.06] mb-2" />
                  <div className="h-2 rounded-full bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats Card Component
function StatsCard({
  icon,
  label,
  value,
  unit,
  change,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  color: string;
  delay: number;
}) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={`relative p-5 rounded-2xl bg-gradient-to-br ${color} border border-white/[0.06] overflow-hidden group cursor-pointer`}
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <motion.div
            className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {icon}
          </motion.div>

          {change !== undefined && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.2 }}
              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}
            >
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(change)}%
            </motion.div>
          )}
        </div>

        <motion.p
          className="text-3xl font-bold text-white flex items-baseline gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.1 }}
        >
          {value}
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </motion.p>
        <p className="text-sm text-slate-400 mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

// Calendar Day Component
function CalendarDayCard({
  day,
  index,
  onClick,
}: {
  day: CalendarDay;
  index: number;
  onClick: () => void;
}) {
  const totalActivities = day.activities.completed + day.healthLogs;
  const maxDots = 5;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 * index }}
      onClick={onClick}
      className={`relative text-center p-3 rounded-xl transition-all cursor-pointer ${
        day.isToday
          ? "bg-gradient-to-br from-sky-500/20 to-sky-600/20 border-2 border-sky-500/40 shadow-lg shadow-sky-500/10"
          : day.hasActivity
          ? "bg-white/5 hover:bg-white/10 border border-white/10"
          : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <p className="text-xs text-slate-500 mb-1 font-medium">{day.dayOfWeek}</p>
      <p
        className={`text-lg font-semibold mb-2 ${
          day.isToday ? "text-sky-400" : day.hasActivity ? "text-white" : "text-slate-500"
        }`}
      >
        {day.dayNumber}
      </p>

      {/* Activity dots */}
      <div className="flex justify-center gap-1 min-h-[8px]">
        {totalActivities > 0 ? (
          Array.from({ length: Math.min(totalActivities, maxDots) }, (_, j) => (
            <motion.div
              key={j}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05 * index + 0.05 * j }}
              className={`w-1.5 h-1.5 rounded-full ${
                j < day.activities.completed ? "bg-sky-500" : "bg-cyan-500"
              }`}
            />
          ))
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
        )}
        {totalActivities > maxDots && (
          <span className="text-[10px] text-slate-500 ml-0.5">+{totalActivities - maxDots}</span>
        )}
      </div>

      {/* Completion ring for days with activities */}
      {day.activities.total > 0 && (
        <motion.div
          className="absolute -top-1 -right-1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.05 * index + 0.2 }}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              day.activities.completionRate === 100
                ? "bg-sky-500 text-white"
                : day.activities.completionRate >= 50
                ? "bg-yellow-500 text-white"
                : "bg-slate-600 text-slate-300"
            }`}
          >
            {day.activities.completionRate === 100 ? (
              <Check className="w-3 h-3" />
            ) : (
              `${day.activities.completionRate}%`
            )}
          </div>
        </motion.div>
      )}
    </motion.button>
  );
}

// Activity Feed Item Component
function ActivityFeedItem({ activity, index }: { activity: ActivityLog; index: number }) {
  const colors = activityColors[activity.type] || activityColors.habit;
  const icon = activityIcons[activity.type] || <Activity className="w-4 h-4" />;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Handle invalid dates
    if (isNaN(date.getTime())) {
      return "Unknown";
    }

    // Handle future dates (server time mismatch)
    if (diffMs < 0) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="group p-4 hover:bg-white/5 transition-all rounded-xl cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Icon with animated gradient border */}
        <div className="relative">
          <motion.div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white shadow-lg`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {icon}
          </motion.div>
          {/* Pulse ring on hover */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-white group-hover:text-sky-400 transition-colors">
                {activity.title}
              </h4>
              <p className="text-sm text-slate-400 line-clamp-1">{activity.description}</p>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05 * index + 0.2, type: "spring" }}
            >
              <CheckCircle2 className="w-5 h-5 text-sky-400 flex-shrink-0" />
            </motion.div>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {formatTime(activity.completedAt)}
            </span>
            {activity.duration && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Timer className="w-3 h-3" />
                {activity.duration} min
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-medium ${pillarColors[activity.pillar]?.bg || "bg-slate-500/20"} ${pillarColors[activity.pillar]?.text || "text-slate-400"}`}
            >
              {activity.pillar}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Breakdown Progress Bar Component
function BreakdownItem({
  item,
  index,
  maxCount,
}: {
  item: ActivityBreakdown;
  index: number;
  maxCount: number;
}) {
  const colors = activityColors[item.type] || activityColors.habit;
  const icon = activityIcons[item.type] || <Activity className="w-4 h-4" />;
  const progressPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className="group"
    >
      <div className="flex items-center gap-4">
        <motion.div
          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white`}
          whileHover={{ scale: 1.1 }}
        >
          {icon}
        </motion.div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-white">{item.label}</span>
            <span className="text-sm text-slate-400">
              {item.count}
              {item.expected > 0 && (
                <span className="text-slate-600">/{item.expected}</span>
              )}
            </span>
          </div>

          <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${colors.gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, delay: 0.2 + 0.1 * index, ease: "easeOut" }}
            />
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 1.5,
                delay: 0.8 + 0.1 * index,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Empty State Component
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {icon}
      </motion.div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-xs">{description}</p>
    </motion.div>
  );
}

// Activity Trend Chart Component (SVG area chart)
function ActivityTrendChart({ calendarDays }: { calendarDays: CalendarDay[] }) {
  if (calendarDays.length === 0) return null;

  const width = 700;
  const height = 200;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const dataPoints = calendarDays.map((day) => day.activities.completed);
  const maxVal = Math.max(...dataPoints, 1);

  const points = dataPoints.map((val, i) => {
    const x = paddingX + (i / Math.max(dataPoints.length - 1, 1)) * chartWidth;
    const y = paddingY + chartHeight - (val / maxVal) * chartHeight;
    return { x, y, val };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${paddingX},${paddingY + chartHeight} ${linePoints} ${points[points.length - 1]?.x ?? paddingX + chartWidth},${paddingY + chartHeight}`;

  const gradientId = "trendGradient";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl bg-[#0F1419] border border-white/[0.06] p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-sky-400" />
          Activity Trends
        </h3>
        <span className="text-xs text-slate-500">
          {calendarDays.length} days
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(14, 165, 233)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(14, 165, 233)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingY + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line
                x1={paddingX}
                y1={y}
                x2={paddingX + chartWidth}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 8}
                y={y + 4}
                textAnchor="end"
                fill="rgba(148,163,184,0.6)"
                fontSize="10"
              >
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        {/* Day labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={paddingY + chartHeight + 18}
            textAnchor="middle"
            fill="rgba(148,163,184,0.6)"
            fontSize="10"
          >
            {calendarDays[i]?.dayOfWeek?.slice(0, 2) ?? ""}
          </text>
        ))}

        {/* Area fill */}
        <motion.polygon
          points={areaPoints}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Line */}
        <motion.polyline
          points={linePoints}
          fill="none"
          stroke="rgb(14, 165, 233)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
        />

        {/* Data point dots */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#0F1419"
            stroke="rgb(14, 165, 233)"
            strokeWidth="2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.08, type: "spring", stiffness: 300 }}
          />
        ))}

        {/* Value labels on dots */}
        {points.map((p, i) => (
          p.val > 0 && (
            <motion.text
              key={`label-${i}`}
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fill="rgb(14, 165, 233)"
              fontSize="11"
              fontWeight="600"
              initial={{ opacity: 0, y: p.y }}
              animate={{ opacity: 1, y: p.y - 12 }}
              transition={{ delay: 0.5 + i * 0.08 }}
            >
              {p.val}
            </motion.text>
          )
        ))}
      </svg>
    </motion.div>
  );
}

export function ActivityTab() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "custom">("week");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom date range state
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Filter states
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");

  // Data states
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [breakdown, setBreakdown] = useState<ActivityBreakdown[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  // Check if filters are active
  const hasActiveFilters = activityFilter !== "all" || pillarFilter !== "all";

  // Client-side filtered activities
  const filteredActivities = useMemo(() => {
    return recentActivities.filter((a) => {
      if (activityFilter !== "all" && a.type !== activityFilter) return false;
      if (pillarFilter !== "all" && a.pillar !== pillarFilter) return false;
      return true;
    });
  }, [recentActivities, activityFilter, pillarFilter]);

  // Clear all filters
  const clearFilters = () => {
    setActivityFilter("all");
    setPillarFilter("all");
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Format dates for API
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      const weekStr = weekStart.toISOString().split("T")[0];

      // Build filter params
      const filterParams = new URLSearchParams();
      if (activityFilter !== "all") filterParams.set("type", activityFilter);
      if (pillarFilter !== "all") filterParams.set("pillar", pillarFilter);
      const filterQuery = filterParams.toString() ? `&${filterParams.toString()}` : "";

      // Determine period param: for custom mode, pass date range
      const isCustomReady = viewMode === "custom" && customStart && customEnd;
      const periodParam = viewMode === "custom" ? "custom" : viewMode;
      const customDateQuery = isCustomReady
        ? `&startDate=${customStart}&endDate=${customEnd}`
        : "";

      // Fetch all data in parallel
      const [statsRes, activitiesRes, breakdownRes, calendarRes] = await Promise.all([
        api.get<{ stats: ActivityStats }>(`/activity/stats?period=${periodParam}${customDateQuery}`),
        api.get<{ activities: ActivityLog[] }>(`/activity/recent?limit=15${filterQuery}${customDateQuery}`),
        api.get<{ breakdown: ActivityBreakdown[] }>(`/activity/breakdown?period=${periodParam}${customDateQuery}`),
        api.get<{ days: CalendarDay[] }>(`/activity/calendar?week=${weekStr}`),
      ]);

      if (statsRes.data) setStats(statsRes.data.stats);
      if (activitiesRes.data) setRecentActivities(activitiesRes.data.activities);
      if (breakdownRes.data) setBreakdown(breakdownRes.data.breakdown);
      if (calendarRes.data) setCalendarDays(calendarRes.data.days);
    } catch (err) {
      console.error("Failed to fetch activity data:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load activity data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, viewMode, activityFilter, pillarFilter, customStart, customEnd]);

  useEffect(() => {
    // For custom mode, only fetch when both dates are provided
    if (viewMode === "custom" && (!customStart || !customEnd)) return;
    fetchData();
  }, [fetchData, viewMode, customStart, customEnd]);

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  const getDateRangeLabel = () => {
    if (viewMode === "custom") {
      if (customStart && customEnd) {
        const start = new Date(customStart + "T00:00:00");
        const end = new Date(customEnd + "T00:00:00");
        return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      }
      return "Select date range";
    }
    if (viewMode === "day") {
      return selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } else if (viewMode === "week") {
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else {
      return selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Loading state - skeleton
  if (isLoading) {
    return <ActivitySkeleton />;
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </motion.div>
    );
  }

  const maxBreakdownCount = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      {/* 1. Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<Activity className="w-5 h-5 text-amber-400" />}
          label="Activities This Week"
          value={stats?.activitiesThisPeriod || 0}
          change={stats?.activitiesChange}
          color="from-amber-500/10 to-sky-500/10"
          delay={0}
        />
        <StatsCard
          icon={<Flame className="w-5 h-5 text-orange-400" />}
          label="Calories Burned"
          value={stats?.caloriesBurned?.toLocaleString() || 0}
          unit="kcal"
          change={stats?.caloriesChange}
          color="from-orange-500/10 to-red-500/10"
          delay={0.1}
        />
        <StatsCard
          icon={<Timer className="w-5 h-5 text-sky-400" />}
          label="Active Time"
          value={formatDuration(stats?.activeTime || 0)}
          change={stats?.activeTimeChange}
          color="from-sky-500/10 to-blue-500/10"
          delay={0.2}
        />
        <StatsCard
          icon={<Target className="w-5 h-5 text-purple-400" />}
          label="Completion Rate"
          value={stats?.completionRate || 0}
          unit="%"
          change={stats?.completionRateChange}
          color="from-purple-500/10 to-indigo-500/10"
          delay={0.3}
        />
      </div>

      {/* 2. Date Navigation + View Mode Toggle + Custom Date Range */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {viewMode !== "custom" && (
              <button
                onClick={() => navigateDate("prev")}
                className="p-2.5 rounded-xl bg-white/5 border border-white/[0.06] hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </button>
            )}
            <motion.span
              key={viewMode === "custom" ? `custom-${customStart}-${customEnd}` : selectedDate.toISOString()}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-medium text-white min-w-[200px] text-center"
            >
              {getDateRangeLabel()}
            </motion.span>
            {viewMode !== "custom" && (
              <button
                onClick={() => navigateDate("next")}
                className="p-2.5 rounded-xl bg-white/5 border border-white/[0.06] hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
              >
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/[0.06]">
            {(["day", "week", "month", "custom"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  viewMode === mode
                    ? "bg-gradient-to-r from-amber-600 to-sky-600 text-white shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {mode === "custom" ? "Custom" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range picker */}
        {viewMode === "custom" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-[#0F1419] border border-white/[0.06]"
          >
            <CalendarRange className="w-5 h-5 text-amber-400 hidden sm:block" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <label htmlFor="custom-start" className="text-sm text-slate-400 whitespace-nowrap">
                  From
                </label>
                <input
                  id="custom-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="custom-end" className="text-sm text-slate-400 whitespace-nowrap">
                  To
                </label>
                <input
                  id="custom-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 [color-scheme:dark]"
                />
              </div>
              <button
                onClick={fetchData}
                disabled={!customStart || !customEnd}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  customStart && customEnd
                    ? "bg-gradient-to-r from-amber-600 to-sky-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
                    : "bg-white/5 text-slate-500 cursor-not-allowed"
                )}
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* 3. Activity Trend Chart */}
      <ActivityTrendChart calendarDays={calendarDays} />

      {/* 4. Week View Calendar */}
      {viewMode === "week" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-[#0F1419] border border-white/[0.06] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-400" />
              Weekly Overview
            </h3>
            <motion.div
              className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 text-xs font-medium"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              {calendarDays.filter((d) => d.hasActivity).length}/{calendarDays.length} days active
            </motion.div>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {calendarDays.length > 0 ? (
              calendarDays.map((day, i) => (
                <CalendarDayCard
                  key={day.date}
                  day={day}
                  index={i}
                  onClick={() => {
                    setSelectedDate(new Date(day.date));
                    setViewMode("day");
                  }}
                />
              ))
            ) : (
              // Placeholder for week days
              Array.from({ length: 7 }, (_, i) => {
                const date = new Date(selectedDate);
                date.setDate(date.getDate() - date.getDay() + i);
                return (
                  <div
                    key={i}
                    className="text-center p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <p className="text-xs text-slate-500 mb-1">
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p className="text-lg font-semibold text-slate-500">{date.getDate()}</p>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      {/* 5. 2-col grid: Recent Activities + Activity Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-[#0F1419] border border-white/[0.06] overflow-hidden"
        >
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-400" />
              Recent Activities
            </h3>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer",
                    hasActiveFilters
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                      : "bg-white/5 border-white/[0.06] hover:bg-white/10 text-slate-400"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">
                    {hasActiveFilters
                      ? `${activityFilter !== "all" ? activityFilterOptions.find((o) => o.value === activityFilter)?.label : ""}${activityFilter !== "all" && pillarFilter !== "all" ? " \u2022 " : ""}${pillarFilter !== "all" ? pillarFilterOptions.find((o) => o.value === pillarFilter)?.label : ""}`
                      : "Filter"}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-white/10">
                <DropdownMenuLabel className="text-slate-400">Activity Type</DropdownMenuLabel>
                {activityFilterOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setActivityFilter(option.value)}
                      className={cn(
                        "cursor-pointer flex items-center gap-2",
                        activityFilter === option.value && "bg-amber-500/20 text-amber-400"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {option.label}
                      {activityFilter === option.value && <Check className="w-4 h-4 ml-auto" />}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuLabel className="text-slate-400">Pillar</DropdownMenuLabel>
                {pillarFilterOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setPillarFilter(option.value)}
                    className={cn(
                      "cursor-pointer",
                      pillarFilter === option.value && "bg-amber-500/20 text-amber-400"
                    )}
                  >
                    {option.label}
                    {pillarFilter === option.value && <Check className="w-4 h-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      onClick={clearFilters}
                      className="cursor-pointer text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear Filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters Indicator */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]"
            >
              <span className="text-xs text-slate-500">Filters:</span>
              {activityFilter !== "all" && (
                <button
                  onClick={() => setActivityFilter("all")}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs cursor-pointer hover:bg-amber-500/30 transition-colors"
                >
                  {activityFilterOptions.find((o) => o.value === activityFilter)?.label}
                  <X className="w-3 h-3" />
                </button>
              )}
              {pillarFilter !== "all" && (
                <button
                  onClick={() => setPillarFilter("all")}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs cursor-pointer hover:bg-purple-500/30 transition-colors"
                >
                  {pillarFilterOptions.find((o) => o.value === pillarFilter)?.label}
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-slate-500 hover:text-slate-400 cursor-pointer"
              >
                Clear all
              </button>
            </motion.div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            {filteredActivities.length > 0 ? (
              <div className="divide-y divide-white/5">
                {filteredActivities.map((activity, index) => (
                  <ActivityFeedItem key={activity.id} activity={activity} index={index} />
                ))}
              </div>
            ) : hasActiveFilters ? (
              <EmptyState
                icon={<Filter className="w-8 h-8 text-slate-600" />}
                title="No Matching Activities"
                description="No activities match the current filters. Try adjusting your filters or clear them to see all activities."
              />
            ) : (
              <EmptyState
                icon={<Activity className="w-8 h-8 text-slate-600" />}
                title="No Activities Yet"
                description="Start tracking your workouts, meals, and wellness activities to see them here."
              />
            )}
          </div>
        </motion.div>

        {/* Activity Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-[#0F1419] border border-white/[0.06] p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sky-400" />
              Activity Breakdown
            </h3>
            <span className="text-xs text-slate-500 capitalize">{viewMode} view</span>
          </div>

          {breakdown.length > 0 ? (
            <div className="space-y-5">
              {breakdown.slice(0, 6).map((item, i) => (
                <BreakdownItem key={item.activityType} item={item} index={i} maxCount={maxBreakdownCount} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 className="w-8 h-8 text-slate-600" />}
              title="No Breakdown Data"
              description="Complete some activities to see your progress breakdown."
            />
          )}

          {breakdown.length > 6 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              View All ({breakdown.length} categories)
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* 6. Streak Motivation Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600/20 to-sky-600/20 border border-white/[0.06] p-6"
      >
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute w-96 h-96 rounded-full bg-amber-500/10 blur-3xl"
            animate={{
              x: ["-50%", "100%"],
              y: ["-20%", "20%"],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-sky-500 flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Flame className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold text-white">Keep Your Streak Going!</h3>
              <p className="text-sm text-slate-300">
                Complete at least one activity today to maintain your progress.
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 text-white font-medium shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Log Activity
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
