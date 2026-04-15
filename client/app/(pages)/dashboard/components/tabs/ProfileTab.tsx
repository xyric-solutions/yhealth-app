"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  User,

  Phone,
  Calendar,

  Edit3,
  Camera,
  Trophy,
  Target,
  Flame,
  TrendingUp,
  Heart,
  Star,
  Award,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { api } from "@/lib/api-client";

export function ProfileTab() {
  const { user, getInitials, getDisplayName } = useAuth();
  const [achievementLevel, setAchievementLevel] = useState<{ level: number; totalXP: number; levelName: string } | null>(null);
  const [loadingLevel, setLoadingLevel] = useState(true);

  const fetchAchievementLevel = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ level: number; totalXP: number }>("/achievements/summary");
      if (res.success && res.data) {
        const level = res.data.level || 1;
        const levelName = level < 5 ? "Beginner" : level < 10 ? "Explorer" : level < 20 ? "Achiever" : level < 50 ? "Champion" : "Legend";
        setAchievementLevel({
          level,
          totalXP: res.data.totalXP || 0,
          levelName,
        });
      }
    } catch (err) {
      console.error("Failed to fetch achievement level:", err);
    } finally {
      setLoadingLevel(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAchievementLevel();
  }, [fetchAchievementLevel]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">Please sign in to view your profile</p>
      </div>
    );
  }

  const stats = [
    { label: "Goals", value: "5", icon: <Target className="w-4 h-4" />, color: "text-cyan-400" },
    { label: "Streak", value: "12", icon: <Flame className="w-4 h-4" />, color: "text-orange-400" },
    { label: "Achievements", value: "8", icon: <Trophy className="w-4 h-4" />, color: "text-amber-400" },
    { label: "Progress", value: "78%", icon: <TrendingUp className="w-4 h-4" />, color: "text-green-400" },
  ];

  const recentAchievements = [
    { icon: "🏃", title: "First Steps", date: "Jan 15" },
    { icon: "🔥", title: "Week Warrior", date: "Jan 22" },
    { icon: "💪", title: "Consistency", date: "Feb 1" },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-blue-500/20 border border-white/10 overflow-hidden"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-lg">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={getDisplayName()}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  getInitials()
                )}
              </div>
              <Link
                href="/profile/edit"
                className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <Camera className="w-5 h-5" />
              </Link>
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {getDisplayName()}
              </h1>
              <p className="text-slate-400 mb-4">{user.email}</p>

              <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                {user.dateOfBirth && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-sm text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(user.dateOfBirth).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
                {user.phone && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-sm text-slate-300">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {user.phone}
                  </span>
                )}
                {loadingLevel ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-sm text-green-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : achievementLevel ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-sm text-amber-400 border border-amber-500/30">
                    <Star className="w-4 h-4" />
                    Level {achievementLevel.level} ({achievementLevel.levelName})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-sm text-green-400">
                    <Star className="w-4 h-4" />
                    Level 1
                  </span>
                )}
              </div>
            </div>

            {/* Edit Button */}
            <Link
              href="/profile/edit"
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center"
          >
            <div className={`inline-flex p-2 rounded-lg bg-white/5 mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-slate-400">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Personal Information</h3>
            </div>
            <Link
              href="/profile/edit"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Edit
            </Link>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">First Name</span>
              <span className="text-white">{user.firstName || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Last Name</span>
              <span className="text-white">{user.lastName || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Phone</span>
              <span className="text-white">{user.phone || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Gender</span>
              <span className="text-white capitalize">{user.gender?.replace("_", " ") || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Date of Birth</span>
              <span className="text-white">
                {user.dateOfBirth
                  ? new Date(user.dateOfBirth).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Recent Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Recent Achievements</h3>
            </div>
            <button className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {recentAchievements.map((achievement, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/5"
              >
                <span className="text-2xl">{achievement.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-white">{achievement.title}</p>
                  <p className="text-xs text-slate-400">{achievement.date}</p>
                </div>
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Health Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-400" />
              <h3 className="font-semibold text-white">Health Profile</h3>
            </div>
            <Link
              href="/onboarding"
              className="text-sm text-rose-400 hover:text-rose-300"
            >
              Update
            </Link>
          </div>

          <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Primary Goal", value: "Weight Loss", icon: "🎯" },
              { label: "Activity Level", value: "Moderate", icon: "🏃" },
              { label: "Diet Preference", value: "Balanced", icon: "🥗" },
              { label: "Sleep Goal", value: "8 hours", icon: "😴" },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 text-center">
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className="font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
