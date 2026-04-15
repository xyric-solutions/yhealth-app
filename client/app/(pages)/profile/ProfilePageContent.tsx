"use client";

import { useSyncExternalStore, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Edit3,
  Settings,
  Shield,
  Bell,

  Activity,
  Heart,
  Trophy,
  Flame,
  Target,
  Sparkles,
  BadgeCheck,
  TrendingUp,
  Award,
  Star,
  Crown,
  Clock,
  BarChart3,
  Users,
  Dumbbell,
  Apple,
  Moon,
  Droplets,
  ArrowUpRight,
  MoreHorizontal,
  ArrowLeft,
  Brain,
  Zap,
  Footprints,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";
import { MainLayout } from "@/components/layout";
import apiClient from "@/lib/api-client";

// Types for API responses (matching actual server response shapes)
interface DashboardStats {
  streak: {
    current: number;
    longest: number;
    lastActivityDate: string | null;
  };
  weekProgress: {
    rate: number;
    change: number;
    completed: number;
    total: number;
  };
  summary: {
    totalActivitiesCompleted: number;
    activeGoals: number;
  };
}

interface HealthMetricsResponse {
  metrics: {
    calories: { value: number | null; target: number; unit: string; source: string | null };
    water: { value: number | null; target: number; unit: string; source: string | null };
    sleep: { value: string | null; target: string; quality: number | null; source: string | null };
    heartRate: { value: number | null; unit: string; resting: number | null; source: string | null };
    steps: { value: number | null; target: number; unit: string; source: string | null };
  };
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  completedAt: string;
  duration: number | null;
  pillar: string;
  source: string;
}

interface GoalItem {
  id: string;
  status: string;
  title?: string;
  category?: string;
  targetValue?: number;
  currentValue?: number;
  isPrimary?: boolean;
}

interface GoalsStats {
  total: number;
  completed: number;
  active: number;
}

interface WhoopSummary {
  recovery: number | null;
  strain: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  hrv: number | null;
  restingHR: number | null;
}

// Default stats when no data available
const defaultStats = {
  daysStreak: 0,
  longestStreak: 0,
  totalWorkouts: 0,
  caloriesBurned: 0,
  goalsCompleted: 0,
  totalGoals: 0,
  activeGoals: 0,
  weeklyProgress: 0,
  weeklyCompleted: 0,
  weeklyTotal: 0,
  healthScore: 0,
  waterGlasses: 0,
  sleepHours: 0,
  sleepQuality: 0,
  restingHR: 0,
  steps: 0,
};

// Achievement interface matching API response
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Emoji string
  category: 'streak' | 'milestone' | 'special' | 'challenge' | 'pillar';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  progressPercentage: number;
  unlockedAt?: Date | string;
}

// Rarity to gradient color mapping
const rarityGradients: Record<string, string> = {
  common: "from-gray-400 to-gray-500",
  rare: "from-blue-400 to-blue-500",
  epic: "from-purple-500 to-violet-500",
  legendary: "from-amber-500 to-orange-500",
};

// Activity type to icon/color mapping
const activityTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  workout: { icon: Dumbbell, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  meal: { icon: Apple, color: "text-green-500", bgColor: "bg-green-500/10" },
  sleep: { icon: Moon, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  water: { icon: Droplets, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  mindfulness: { icon: Brain, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  habit: { icon: Target, color: "text-amber-500", bgColor: "bg-amber-500/10" },
};

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

// Quick actions
const quickActions = [
  {
    icon: Edit3,
    label: "Edit Profile",
    href: "/profile/edit",
    color: "text-primary",
    bgColor: "bg-primary/10",
    gradient: "from-primary to-purple-500",
  },
  {
    icon: Settings,
    label: "Settings",
    href: "/settings",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Shield,
    label: "Privacy",
    href: "/settings/privacy",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    gradient: "from-emerald-500 to-green-500",
  },
  {
    icon: Bell,
    label: "Notifications",
    href: "/settings/notifications",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    gradient: "from-blue-500 to-cyan-500",
  },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100 },
  },
};

function ProfileSkeleton() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-8 max-w-8xl">
          <div className="relative mb-8">
            <Skeleton className="h-64 w-full rounded-3xl" />
            <div className="absolute -bottom-16 left-8 flex items-end gap-6">
              <Skeleton className="h-36 w-36 rounded-full" />
              <div className="mb-4 space-y-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
          <div className="pt-20 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// Hydration-safe hook
const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

// Circular Progress Component
function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#circleGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient
            id="circleGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  suffix: string;
  gradient: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="relative group cursor-pointer"
    >
      <div
        className={cn(
          "absolute -inset-0.5 bg-gradient-to-r rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-all duration-500",
          gradient
        )}
      />
      <Card className="relative h-full border-0 bg-card/80 backdrop-blur-xl overflow-hidden">
        <div
          className={cn(
            "absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 -translate-y-6 translate-x-6 rounded-full blur-2xl",
            gradient
          )}
        />
        <CardContent className="p-5">
          <div
            className={cn(
              "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg",
              gradient
            )}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {label}
              </p>
              <span className="text-xs text-muted-foreground">{suffix}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ProfilePageContent() {
  const { user, isLoading, getInitials, getDisplayName } = useAuth();
  const isHydrated = useHydrated();
  const router = useRouter();

  // State for dynamic data
  const [stats, setStats] = useState(defaultStats);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [goalsStats, setGoalsStats] = useState<GoalsStats>({ total: 0, completed: 0, active: 0 });
  const [whoopData, setWhoopData] = useState<WhoopSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [achievementLevel, setAchievementLevel] = useState<{ level: number; totalXP: number; levelName: string } | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);

  // Fetch achievements separately
  const fetchAchievements = useCallback(async () => {
    if (!user) return;

    setAchievementsLoading(true);
    setAchievementsError(null);
    try {
      const res = await apiClient.get<{ achievements: Achievement[]; summary: unknown; stats: unknown }>('/achievements');
      // Handle response structure: ApiResponse wraps data in { success, data: { achievements, summary, stats } }
      if (res.data?.achievements && Array.isArray(res.data.achievements)) {
        setAchievements(res.data.achievements);
      } else {
        // No achievements found or invalid structure
        setAchievements([]);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
      setAchievementsError('Failed to load achievements. Please try again later.');
      // Set empty array on error to prevent UI issues
      setAchievements([]);
    } finally {
      setAchievementsLoading(false);
    }
  }, [user]);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      // Fetch all data in parallel — note: apiClient.get returns ApiResponse<T> = { success, data: T }
      const [dashboardRes, healthRes, activityRes, goalsRes, achievementsRes, whoopRes] = await Promise.all([
        apiClient.get<DashboardStats>('/stats/dashboard').catch((err) => {
          console.error('Error fetching dashboard stats:', err);
          return null;
        }),
        apiClient.get<HealthMetricsResponse>('/stats/health-metrics').catch((err) => {
          console.error('Error fetching health metrics:', err);
          return null;
        }),
        apiClient.get<{ activities: RecentActivity[] }>('/activity/recent?limit=6').catch((err) => {
          console.error('Error fetching recent activities:', err);
          return null;
        }),
        apiClient.get<{ goals: GoalItem[] }>('/assessment/goals').catch((err) => {
          console.error('Error fetching goals:', err);
          return null;
        }),
        apiClient.get<{ level: number; totalXP: number; totalUnlocked: number; totalAchievements: number; currentStreak: number; longestStreak: number }>('/achievements/summary').catch((err) => {
          console.error('Error fetching achievements summary:', err);
          return null;
        }),
        apiClient.get<{ currentRecovery: { score: number; hrv: number; rhr: number } | null; currentSleep: { duration: number; quality: number; efficiency: number } | null; todayStrain: { score: number; calories?: number } | null }>('/whoop/analytics/overview').catch(() => {
          // WHOOP may not be connected — silently fail
          return null;
        }),
      ]);

      // Process dashboard stats — data is directly on .data (not .data.data)
      if (dashboardRes?.data) {
        const data = dashboardRes.data;
        setStats(prev => ({
          ...prev,
          daysStreak: data.streak?.current || 0,
          longestStreak: data.streak?.longest || 0,
          totalWorkouts: data.summary?.totalActivitiesCompleted || 0,
          activeGoals: data.summary?.activeGoals || 0,
          weeklyProgress: Math.round(data.weekProgress?.rate || 0),
          weeklyCompleted: data.weekProgress?.completed || 0,
          weeklyTotal: data.weekProgress?.total || 0,
        }));
      }

      // Process health metrics — server sends { metrics: { calories: { value, target }, ... } }
      if (healthRes?.data) {
        const m = (healthRes.data as HealthMetricsResponse).metrics || healthRes.data;
        const caloriesVal = typeof m.calories?.value === 'number' ? m.calories.value : 0;
        const waterVal = typeof m.water?.value === 'number' ? m.water.value : 0;
        const sleepVal = m.sleep?.value ? parseFloat(m.sleep.value) : 0;
        const sleepQual = typeof m.sleep?.quality === 'number' ? m.sleep.quality : 0;
        const hrVal = typeof m.heartRate?.value === 'number' ? m.heartRate.value : (typeof m.heartRate?.resting === 'number' ? m.heartRate.resting : 0);
        const stepsVal = typeof m.steps?.value === 'number' ? m.steps.value : 0;

        setStats(prev => ({
          ...prev,
          caloriesBurned: caloriesVal,
          waterGlasses: waterVal,
          sleepHours: sleepVal,
          sleepQuality: sleepQual,
          restingHR: hrVal,
          steps: stepsVal,
          healthScore: calculateHealthScore(caloriesVal, waterVal, sleepVal, sleepQual),
        }));
      }

      // Process recent activities — server sends { activities: [...] }
      if (activityRes?.data?.activities) {
        setRecentActivities(activityRes.data.activities);
      } else {
        setRecentActivities([]);
      }

      // Process goals — server sends { goals: [...] }
      if (goalsRes?.data?.goals) {
        const goalsArray = goalsRes.data.goals;
        const completedGoals = goalsArray.filter((g) => g.status === 'completed').length;
        const activeGoals = goalsArray.filter((g) => g.status === 'active').length;

        setGoalsStats({
          total: goalsArray.length,
          completed: completedGoals,
          active: activeGoals,
        });

        setStats(prev => ({
          ...prev,
          goalsCompleted: completedGoals,
          totalGoals: goalsArray.length,
        }));
      } else {
        setGoalsStats({ total: 0, completed: 0, active: 0 });
      }

      // Process achievements summary — server sends { level, totalXP, ... } directly
      if (achievementsRes?.data) {
        const ad = achievementsRes.data;
        const level = ad.level || 1;
        const levelName = level < 5 ? "Beginner" : level < 10 ? "Explorer" : level < 20 ? "Achiever" : level < 50 ? "Champion" : "Legend";
        setAchievementLevel({
          level,
          totalXP: ad.totalXP || 0,
          levelName,
        });
      }

      // Process WHOOP data
      if (whoopRes?.data) {
        const w = whoopRes.data;
        setWhoopData({
          recovery: w.currentRecovery?.score ?? null,
          strain: w.todayStrain?.score ?? null,
          sleepHours: w.currentSleep?.duration ? +(w.currentSleep.duration / 60).toFixed(1) : null,
          sleepQuality: w.currentSleep?.quality ?? w.currentSleep?.efficiency ?? null,
          hrv: w.currentRecovery?.hrv ?? null,
          restingHR: w.currentRecovery?.rhr ?? null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  // Calculate health score from metrics
  function calculateHealthScore(calories: number, water: number, sleepHours: number, sleepQuality: number): number {
    let score = 50; // Base score

    if (calories > 0) score += 10;
    if (calories > 200) score += 10;

    if (water >= 4) score += 10;
    if (water >= 8) score += 5;

    if (sleepHours >= 7) score += 10;
    if (sleepQuality >= 70) score += 5;

    return Math.min(100, score);
  }

  // Fetch stats on mount and when user changes
  useEffect(() => {
    if (user && isHydrated) {
      fetchStats();
      fetchAchievements();
    }
  }, [user, isHydrated, fetchStats, fetchAchievements]);

  if (!isHydrated || isLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <div className="w-20 h-20  mx-auto rounded-full bg-muted/50 flex items-center justify-center">
              <User className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Please sign in to view your profile.
            </p>
            <Button asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatGender = (gender: string | null) => {
    if (!gender) return "Not set";
    return gender.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/10">
        {/* Ambient Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-gradient-to-br from-blue-500/15 to-cyan-500/15 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-pink-500/15 to-rose-500/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative container mx-auto px-4 py-8 max-w-8xl">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-4"
          >
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm">Back</span>
            </button>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Hero Section */}
            <motion.div variants={itemVariants} className="relative">
              {/* Cover */}
              <div className="relative h-56 md:h-72 rounded-[2rem] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-500 to-pink-500" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.1),transparent_50%)]" />

                {/* Animated decorative elements */}
                <motion.div
                  animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute top-8 right-12 w-32 h-32 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20"
                />
                <motion.div
                  animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute bottom-12 right-40 w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute top-16 right-56 w-10 h-10 rounded-full bg-white/20"
                />
                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute bottom-8 left-12 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-white/80 text-sm font-medium">
                    Health Score: {stats.healthScore}
                  </span>
                </motion.div>

                {/* Edit Button */}
                <div className="absolute top-6 right-6">
                  <Button
                    asChild
                    size="sm"
                    className="bg-white/15 backdrop-blur-md hover:bg-white/25 text-white border border-white/20 shadow-lg"
                  >
                    <Link href="/profile/edit">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Profile Info Overlay */}
              <div className="absolute -bottom-20 left-6 md:left-10 right-6 md:right-10">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
                  {/* Avatar */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="relative"
                  >
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-full blur-sm opacity-75" />
                    <Avatar className="relative h-32 w-32 md:h-40 md:w-40 ring-4 ring-background shadow-2xl">
                      <AvatarImage
                        src={user.avatarUrl || undefined}
                        alt={getDisplayName()}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white font-bold text-4xl">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    {user.isEmailVerified && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                        className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-4 border-background"
                      >
                        <BadgeCheck className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Name & Info */}
                  <div className="flex-1 pb-2">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl md:text-3xl font-bold">
                          {getDisplayName()}
                        </h1>
                        {(user.role === 'admin' || user.role === 'doctor') && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">
                            <Crown className="w-3 h-3 mr-1" />
                            Pro
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Member since {memberSince}
                      </p>
                    </motion.div>
                  </div>

                  {/* Quick Stats Pills - Desktop */}
                  <div className="hidden md:flex items-center gap-3 pb-2">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border shadow-lg"
                    >
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold">
                        {stats.daysStreak}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        day streak
                      </span>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border shadow-lg"
                    >
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold">
                        {stats.goalsCompleted}/{stats.totalGoals}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        goals
                      </span>
                    </motion.div>
                    {achievementLevel && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm border border-amber-500/30 shadow-lg"
                      >
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-amber-300">
                          Level {achievementLevel.level}
                        </span>
                        <span className="text-amber-400/70 text-sm">
                          {achievementLevel.levelName}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Content Grid */}
            <div className="pt-24 md:pt-28">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column - Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Stats Cards */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100 }}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Your Statistics
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                      >
                        View All
                        <ArrowUpRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    {statsLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-32 rounded-2xl" />
                        ))}
                      </div>
                    ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard
                        icon={Flame}
                        label="Streak"
                        value={stats.daysStreak}
                        suffix="days"
                        gradient="from-orange-500 to-red-500"
                      />
                      <StatCard
                        icon={Activity}
                        label="Workouts"
                        value={stats.totalWorkouts}
                        suffix="total"
                        gradient="from-cyan-500 to-blue-500"
                      />
                      <StatCard
                        icon={Heart}
                        label="Calories"
                        value={stats.caloriesBurned.toLocaleString()}
                        suffix="kcal"
                        gradient="from-pink-500 to-rose-500"
                      />
                      <StatCard
                        icon={Trophy}
                        label="Goals"
                        value={stats.goalsCompleted}
                        suffix="achieved"
                        gradient="from-amber-500 to-yellow-500"
                      />
                    </div>
                    )}

                    {/* Health Metrics Row */}
                    {!statsLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <StatCard
                        icon={Moon}
                        label="Sleep"
                        value={stats.sleepHours > 0 ? stats.sleepHours.toFixed(1) : "—"}
                        suffix="hours"
                        gradient="from-purple-500 to-indigo-500"
                      />
                      <StatCard
                        icon={Droplets}
                        label="Water"
                        value={stats.waterGlasses > 0 ? stats.waterGlasses : "—"}
                        suffix="glasses"
                        gradient="from-sky-500 to-cyan-500"
                      />
                      <StatCard
                        icon={Footprints}
                        label="Steps"
                        value={stats.steps > 0 ? stats.steps.toLocaleString() : "—"}
                        suffix="today"
                        gradient="from-emerald-500 to-teal-500"
                      />
                      <StatCard
                        icon={Heart}
                        label="Heart Rate"
                        value={stats.restingHR > 0 ? stats.restingHR : "—"}
                        suffix="bpm"
                        gradient="from-red-500 to-pink-500"
                      />
                    </div>
                    )}
                  </motion.div>

                  {/* Personal Information */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.1 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-lg font-semibold flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            Personal Information
                          </h2>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/profile/edit" className="text-primary">
                              <Edit3 className="w-4 h-4 mr-1" />
                              Edit
                            </Link>
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Email */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/10"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20">
                              <Mail className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Email
                              </p>
                              <p className="font-medium truncate">
                                {user.email}
                              </p>
                            </div>
                            {user.isEmailVerified && (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                <BadgeCheck className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </motion.div>

                          {/* Phone */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/10"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                              <Phone className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Phone
                              </p>
                              <p className="font-medium">
                                {user.phone || "Not added"}
                              </p>
                            </div>
                          </motion.div>

                          {/* Date of Birth */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                              <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Date of Birth
                              </p>
                              <p className="font-medium">
                                {formatDate(user.dateOfBirth)}
                              </p>
                            </div>
                          </motion.div>

                          {/* Gender */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/5 to-rose-500/5 border border-pink-500/10"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                Gender
                              </p>
                              <p className="font-medium">
                                {formatGender(user.gender)}
                              </p>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>

                  {/* Achievements */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.2 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Award className="w-5 h-5 text-primary" />
                            Achievements
                          </h2>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            asChild
                          >
                            <Link href="/achievements">
                              View All
                              <ArrowUpRight className="w-4 h-4 ml-1" />
                            </Link>
                          </Button>
                        </div>

                        {achievementsLoading ? (
                          <div className="flex gap-4 overflow-x-auto pb-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Skeleton key={i} className="h-24 w-24 rounded-2xl flex-shrink-0" />
                            ))}
                          </div>
                        ) : achievementsError ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{achievementsError}</p>
                          </div>
                        ) : achievements.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No achievements yet</p>
                            <p className="text-xs">Start completing activities to unlock achievements!</p>
                          </div>
                        ) : (
                          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {achievements.map((achievement, index) => {
                              const gradient = rarityGradients[achievement.rarity] || rarityGradients.common;
                              return (
                                <motion.div
                                  key={achievement.id}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.05 * index }}
                                  whileHover={{ scale: 1.05, y: -5 }}
                                  className={cn(
                                    "flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer",
                                    achievement.unlocked
                                      ? "bg-gradient-to-b from-muted/50 to-transparent"
                                      : "bg-muted/20 opacity-60"
                                  )}
                                  title={achievement.description}
                                >
                                  <div
                                    className={cn(
                                      "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg text-2xl",
                                      gradient,
                                      !achievement.unlocked && "grayscale opacity-50"
                                    )}
                                  >
                                    {achievement.icon}
                                  </div>
                                  <div className="text-center space-y-1">
                                    <span className="text-xs font-medium text-center whitespace-nowrap block">
                                      {achievement.title}
                                    </span>
                                    {!achievement.unlocked && achievement.progressPercentage > 0 && (
                                      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${achievement.progressPercentage}%` }}
                                          transition={{ delay: 0.1 * index, duration: 0.5 }}
                                          className="h-full bg-primary"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                </div>

                {/* Right Column - Sidebar */}
                <div className="space-y-6">
                  {/* Weekly Progress */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          Weekly Progress
                        </h2>

                        <div className="flex justify-center mb-6">
                          <CircularProgress
                            value={stats.weeklyProgress}
                            size={140}
                            strokeWidth={10}
                          >
                            <div className="text-center">
                              <p className="text-3xl font-bold">
                                {stats.weeklyProgress}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Complete
                              </p>
                            </div>
                          </CircularProgress>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Goals Progress
                            </span>
                            <span className="text-sm font-medium">
                              {stats.goalsCompleted}/{stats.totalGoals}
                            </span>
                          </div>
                          <Progress
                            value={
                              stats.totalGoals > 0
                                ? (stats.goalsCompleted / stats.totalGoals) * 100
                                : 0
                            }
                            className="h-2"
                          />
                        </div>
                      </div>
                    </Card>
                  </motion.div>

                  {/* Goals Summary */}
                  {goalsStats.total > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.1 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                          <Target className="w-5 h-5 text-primary" />
                          Goals Overview
                        </h2>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center p-3 rounded-xl bg-gradient-to-b from-emerald-500/10 to-transparent">
                            <p className="text-2xl font-bold text-emerald-400">{goalsStats.completed}</p>
                            <p className="text-xs text-muted-foreground">Done</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-gradient-to-b from-blue-500/10 to-transparent">
                            <p className="text-2xl font-bold text-blue-400">{goalsStats.active}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-gradient-to-b from-purple-500/10 to-transparent">
                            <p className="text-2xl font-bold text-purple-400">{goalsStats.total}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                        </div>

                        {goalsStats.total > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Completion</span>
                              <span className="font-medium">{Math.round((goalsStats.completed / goalsStats.total) * 100)}%</span>
                            </div>
                            <Progress value={(goalsStats.completed / goalsStats.total) * 100} className="h-2" />
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                  )}

                  {/* Health Vitals (WHOOP + Metrics) */}
                  {whoopData && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.15 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-5">
                          <Zap className="w-5 h-5 text-primary" />
                          Health Vitals
                        </h2>

                        <div className="space-y-4">
                          {/* Recovery */}
                          {whoopData.recovery !== null && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/5 border border-emerald-500/10">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                                  <Activity className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium">Recovery</span>
                              </div>
                              <div className="text-right">
                                <span className={cn("text-lg font-bold", whoopData.recovery >= 67 ? "text-emerald-400" : whoopData.recovery >= 34 ? "text-amber-400" : "text-red-400")}>{whoopData.recovery}%</span>
                              </div>
                            </div>
                          )}

                          {/* Strain */}
                          {whoopData.strain !== null && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/5 border border-blue-500/10">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                                  <Zap className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium">Strain</span>
                              </div>
                              <span className="text-lg font-bold">{whoopData.strain.toFixed(1)}</span>
                            </div>
                          )}

                          {/* Sleep */}
                          {whoopData.sleepHours !== null && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-violet-500/5 border border-purple-500/10">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                                  <Moon className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium">Sleep</span>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold">{whoopData.sleepHours}h</span>
                                {whoopData.sleepQuality !== null && (
                                  <span className="text-xs text-muted-foreground ml-1">({whoopData.sleepQuality}%)</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* HRV */}
                          {whoopData.hrv !== null && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-teal-500/5 border border-cyan-500/10">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                                  <TrendingUp className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium">HRV</span>
                              </div>
                              <span className="text-lg font-bold">{Math.round(whoopData.hrv)} <span className="text-xs text-muted-foreground">ms</span></span>
                            </div>
                          )}

                          {/* Resting HR */}
                          {whoopData.restingHR !== null && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-rose-500/10 to-pink-500/5 border border-rose-500/10">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                                  <Heart className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium">Resting HR</span>
                              </div>
                              <span className="text-lg font-bold">{Math.round(whoopData.restingHR)} <span className="text-xs text-muted-foreground">bpm</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                  )}

                  {/* Recent Activity */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.2 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            Recent Activity
                          </h2>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {recentActivities.length > 0 ? (
                            recentActivities.map((activity, index) => {
                              const config = activityTypeConfig[activity.type] || activityTypeConfig.habit;
                              const IconComponent = config.icon;
                              return (
                                <motion.div
                                  key={activity.id || index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 * index }}
                                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                                >
                                  <div
                                    className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center",
                                      config.bgColor
                                    )}
                                  >
                                    <IconComponent
                                      className={cn("w-5 h-5", config.color)}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">
                                      {activity.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatRelativeTime(activity.completedAt)}
                                    </p>
                                  </div>
                                </motion.div>
                              );
                            })
                          ) : (
                            <div className="text-center py-6 text-muted-foreground">
                              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No recent activity</p>
                              <p className="text-xs">Start logging your workouts, meals, and habits!</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.25 }}>
                    <Card className="border-0 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="p-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                          <Target className="w-5 h-5 text-primary" />
                          Quick Actions
                        </h2>

                        <div className="grid grid-cols-2 gap-3">
                          {quickActions.map((action, _index) => (
                            <motion.div
                              key={action.label}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Link
                                href={action.href}
                                className={cn(
                                  "flex flex-col items-center gap-2 p-4 rounded-2xl",
                                  "bg-gradient-to-br from-muted/50 to-transparent",
                                  "hover:from-muted hover:to-muted/50",
                                  "transition-all duration-300 group"
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                                    "bg-gradient-to-br group-hover:shadow-lg",
                                    `${action.gradient} group-hover:shadow-${
                                      action.color.split("-")[1]
                                    }-500/20`
                                  )}
                                >
                                  <action.icon className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-sm font-medium">
                                  {action.label}
                                </span>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
