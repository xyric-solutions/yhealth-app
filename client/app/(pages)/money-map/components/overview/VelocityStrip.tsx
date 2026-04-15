"use client";

import { motion, type Variants } from "framer-motion";
import { Zap, CalendarDays, TrendingUp, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCountUp,
  formatCurrency,
  staggerContainer,
  fadeSlideUp,
} from "../../lib/motion";
import { SparkLine } from "../charts/SparkLine";

interface VelocityStripProps {
  dailyAvg: number;
  weekTotal: number;
  monthForecast: number;
  todaySpend: number;
  recentDays: number[];
}

interface KpiCardData {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
  sparkData: number[];
}

const cardHoverVariants: Variants = {
  rest: { y: 0, boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
  hover: {
    y: -4,
    boxShadow: "0 8px 24px -4px rgba(5, 150, 105, 0.15)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
};

function KpiCard({ icon: Icon, label, value, color, sparkData }: KpiCardData) {
  const displayed = useCountUp(value);

  return (
    <motion.div
      variants={fadeSlideUp}
      whileHover="hover"
      initial="rest"
      animate="rest"
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 group"
    >
      <motion.div
        variants={cardHoverVariants}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}15` }}
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </motion.div>
          <SparkLine
            data={sparkData}
            color={color}
            height={24}
            width={56}
          />
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
            {label}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-white">
            {formatCurrency(displayed)}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function VelocityStrip({
  dailyAvg,
  weekTotal,
  monthForecast,
  todaySpend,
  recentDays,
}: VelocityStripProps) {
  const last7 = recentDays.slice(-7);
  const cards: KpiCardData[] = [
    {
      icon: Zap,
      label: "Today",
      value: todaySpend,
      color: "#f43f5e",
      sparkData: last7,
    },
    {
      icon: CalendarDays,
      label: "This Week",
      value: weekTotal,
      color: "#0284c7",
      sparkData: last7,
    },
    {
      icon: TrendingUp,
      label: "Avg / Day",
      value: dailyAvg,
      color: "#f59e0b",
      sparkData: last7,
    },
    {
      icon: Target,
      label: "Forecast",
      value: monthForecast,
      color: "#8b5cf6",
      sparkData: last7,
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </motion.div>
  );
}
