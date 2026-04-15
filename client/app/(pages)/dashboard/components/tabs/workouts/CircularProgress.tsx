"use client";

import { motion } from "framer-motion";

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  labelSize?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

// Get color based on percentage (red → orange → yellow → lime → green → cyan → blue)
function getProgressColor(percentage: number): { stroke: string; bg: string; text: string } {
  if (percentage === 0) return { stroke: "#ef4444", bg: "#ef444420", text: "text-red-400" };
  if (percentage <= 15) return { stroke: "#f97316", bg: "#f9731620", text: "text-orange-400" };
  if (percentage <= 30) return { stroke: "#fb923c", bg: "#fb923c20", text: "text-orange-300" };
  if (percentage <= 45) return { stroke: "#facc15", bg: "#facc1520", text: "text-yellow-400" };
  if (percentage <= 60) return { stroke: "#a3e635", bg: "#a3e63520", text: "text-lime-400" };
  if (percentage <= 75) return { stroke: "#22c55e", bg: "#22c55e20", text: "text-green-400" };
  if (percentage <= 90) return { stroke: "#14b8a6", bg: "#14b8a620", text: "text-teal-400" };
  if (percentage < 100) return { stroke: "#06b6d4", bg: "#06b6d420", text: "text-cyan-400" };
  return { stroke: "#22c55e", bg: "#22c55e20", text: "text-green-400" };
}

export function CircularProgress({
  percentage,
  size = 60,
  strokeWidth = 6,
  showLabel = true,
  labelSize = "md",
  animated = true,
  className = "",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const colors = getProgressColor(percentage);

  const labelSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.bg}
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: animated ? offset : offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            filter: `drop-shadow(0 0 6px ${colors.stroke}40)`,
          }}
        />
      </svg>

      {/* Percentage label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${labelSizes[labelSize]} ${colors.text}`}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

// Mini version for calendar cells
interface MiniProgressProps {
  percentage: number;
  size?: number;
}

export function MiniCircularProgress({ percentage, size = 28 }: MiniProgressProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const colors = getProgressColor(percentage);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.bg}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <span className={`absolute text-[8px] font-bold ${colors.text}`}>
        {Math.round(percentage)}
      </span>
    </div>
  );
}

// Daily progress card with detailed info
interface DailyProgressCardProps {
  dayName: string;
  date: string;
  workoutName?: string;
  exercisesCompleted: number;
  exercisesTotal: number;
  duration?: number;
  calories?: number;
  isToday?: boolean;
  isCompleted?: boolean;
  onClick?: () => void;
}

export function DailyProgressCard({
  dayName,
  date,
  workoutName,
  exercisesCompleted,
  exercisesTotal,
  duration,
  calories,
  isToday = false,
  isCompleted = false,
  onClick,
}: DailyProgressCardProps) {
  const percentage = exercisesTotal > 0 ? (exercisesCompleted / exercisesTotal) * 100 : 0;
  const colors = getProgressColor(percentage);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer
        ${isToday 
          ? "bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20" 
          : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50"
        }
        ${isCompleted ? "opacity-90" : ""}
      `}
    >
      {/* Today badge */}
      {isToday && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
          TODAY
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Circular Progress */}
        <CircularProgress
          percentage={percentage}
          size={70}
          strokeWidth={7}
          labelSize="md"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">
              {dayName}
            </h4>
            <span className="text-xs text-slate-500">{date}</span>
          </div>
          
          {workoutName ? (
            <>
              <p className={`text-sm font-medium ${colors.text} truncate mb-2`}>
                {workoutName}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{exercisesCompleted}/{exercisesTotal} exercises</span>
                {duration && <span>• {duration} min</span>}
                {calories && <span>• {calories} cal</span>}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Rest Day</p>
          )}
        </div>

        {/* Completion indicator */}
        {isCompleted && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Weekly progress overview
interface WeeklyProgressOverviewProps {
  weekNumber: number;
  daysProgress: Array<{
    day: string;
    percentage: number;
    isCompleted: boolean;
  }>;
  overallPercentage: number;
}

export function WeeklyProgressOverview({
  weekNumber,
  daysProgress,
  overallPercentage,
}: WeeklyProgressOverviewProps) {

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Week {weekNumber} Progress</h3>
          <p className="text-sm text-slate-400">Daily completion breakdown</p>
        </div>
        <CircularProgress
          percentage={overallPercentage}
          size={80}
          strokeWidth={8}
          labelSize="lg"
        />
      </div>

      {/* Daily progress bars */}
      <div className="grid grid-cols-7 gap-2">
        {daysProgress.map((day, index) => {
          return (
            <div key={index} className="text-center">
              <div className="text-xs text-slate-500 mb-2">{day.day}</div>
              <MiniCircularProgress percentage={day.percentage} size={36} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Donut chart for legend with multiple segments
interface DonutSegment {
  percentage: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export function DonutChart({
  segments,
  size = 140,
  strokeWidth = 14,
  centerLabel = "Satisfied",
  centerSubLabel = "Progress",
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Calculate offsets for each segment
  let accumulatedOffset = 0;
  const segmentArcs = segments.map((seg) => {
    const segLength = (seg.percentage / 100) * circumference;
    const gap = 4; // small gap between segments
    const arc = {
      ...seg,
      dashArray: `${Math.max(segLength - gap, 0)} ${circumference - Math.max(segLength - gap, 0)}`,
      dashOffset: -accumulatedOffset,
    };
    accumulatedOffset += segLength;
    return arc;
  });

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        {/* Segment arcs */}
        {segmentArcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            style={{ filter: `drop-shadow(0 0 4px ${arc.color}30)` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-slate-400">{centerSubLabel}</span>
        <span className="text-base font-bold text-white">{centerLabel}</span>
      </div>
    </div>
  );
}

export default CircularProgress;

