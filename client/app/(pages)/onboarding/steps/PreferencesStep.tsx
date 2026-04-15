"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  Bell,
  Clock,
  Mail,
  MessageSquare,
  Moon,
  Sun,
} from "lucide-react";
import Image from "next/image";
import { useOnboarding } from "@/src/features/onboarding/context/OnboardingContext";
import type { Preferences } from "@/src/types";
import { StepNavigation } from "../components/StepNavigation";

const ICON_BASE = "/Onboardingicons";

interface StyleOption {
  id: Preferences["coachingStyle"];
  iconSrc: string;
  title: string;
  description: string;
}

interface IntensityOption {
  id: Preferences["coachingIntensity"];
  title: string;
  description: string;
  checkIns: string;
}

const coachingStyles: StyleOption[] = [
  {
    id: "supportive",
    iconSrc: `${ICON_BASE}/Manage Health.svg`,
    title: "Supportive",
    description: "Empathetic, encouraging, celebrates your wins.",
  },
  {
    id: "direct",
    iconSrc: `${ICON_BASE}/Optimize Health.svg`,
    title: "Direct",
    description: "Clear feedback, firm, expectations, keep you accountable.",
  },
  {
    id: "analytical",
    iconSrc: `${ICON_BASE}/Frame-5.svg`,
    title: "Analytical",
    description: "Data-driven focuses on metrics and evidence",
  },
  {
    id: "motivational",
    iconSrc: `${ICON_BASE}/Boost Energy.svg`,
    title: "Motivational",
    description: "Energetic, inspiring, pushes you to go further",
  },
];

const intensityLevels: IntensityOption[] = [
  {
    id: "light",
    title: "Light Touch",
    description: "Weekly check-ins with occasional reminders",
    checkIns: "2-3x/week",
  },
  {
    id: "moderate",
    title: "Balanced",
    description: "Daily nudges with flexibility",
    checkIns: "5-7x/week",
  },
  {
    id: "intensive",
    title: "High Engagement",
    description: "Frequently check-ins and detailed tracking",
    checkIns: "10-14x/week",
  },
];

const channelOptions: { id: string; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "push", label: "Push Notifications", icon: <Bell className="w-5 h-5 sm:w-6 sm:h-6" />, color: "text-amber-400" },
  { id: "email", label: "Email", icon: <Mail className="w-5 h-5 sm:w-6 sm:h-6" />, color: "text-red-400" },
  { id: "whatsapp", label: "Whatsapp", icon: <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, color: "text-emerald-400" },
  { id: "sms", label: "SMS", icon: <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />, color: "text-orange-400" },
];

export function PreferencesStep() {
  const { preferences, updatePreferences, nextStep, prevStep } = useOnboarding();

  const [quietHoursEnabled] = useState(preferences.quietHours.enabled);

  const handleStyleSelect = (style: Preferences["coachingStyle"]) => {
    updatePreferences({ coachingStyle: style });
  };

  const handleIntensitySelect = (intensity: Preferences["coachingIntensity"]) => {
    updatePreferences({ coachingIntensity: intensity });
  };

  const handleChannelSelect = (channel: Preferences["preferredChannel"]) => {
    updatePreferences({ preferredChannel: channel });
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      {/* Header — no icon, clean text */}
      <motion.div
        className="text-center mb-8 sm:mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-2 sm:mb-3">
          Personalize your experience
        </h1>
        <p className="text-[rgba(239,237,253,0.6)] text-sm sm:text-base max-w-xl mx-auto">
          Customize how your AI coach communicates with you for the best experience.
        </p>
      </motion.div>

      {/* ─── Coaching Style ─── */}
      <motion.section
        className="mb-8 sm:mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Coaching Style
        </h2>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {coachingStyles.map((style) => {
            const isSelected = preferences.coachingStyle === style.id;

            return (
              <motion.button
                key={style.id}
                onClick={() => handleStyleSelect(style.id)}
                className={`
                  flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left
                  transition-all duration-200 border
                  ${isSelected
                    ? "border-emerald-600 border-[1.5px]"
                    : "bg-[#02000f] border-white/[0.24] hover:border-white/40"
                  }
                `}
                style={isSelected ? { backgroundImage: "linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)" } : undefined}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="shrink-0 w-9 h-9 sm:w-11 sm:h-11 relative">
                  <Image src={style.iconSrc} alt={style.title} fill className="object-contain" />
                </div>
                <div className="min-w-0">
                  <h3 className={`font-semibold text-sm sm:text-base ${isSelected ? "text-white" : "text-slate-200"}`}>
                    {style.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[rgba(239,237,253,0.5)] leading-snug mt-0.5">
                    {style.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ─── Engagement Level ─── */}
      <motion.section
        className="mb-8 sm:mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Engagement Level
        </h2>

        <div className="space-y-2 sm:space-y-3">
          {intensityLevels.map((level) => {
            const isSelected = preferences.coachingIntensity === level.id;

            return (
              <motion.button
                key={level.id}
                onClick={() => handleIntensitySelect(level.id)}
                className={`
                  w-full flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left
                  transition-all duration-200 border
                  ${isSelected
                    ? "border-emerald-600 border-[1.5px]"
                    : "bg-[#02000f] border-white/[0.24] hover:border-white/40"
                  }
                `}
                style={isSelected ? { backgroundImage: "linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)" } : undefined}
                whileTap={{ scale: 0.98 }}
              >
                <div>
                  <h3 className={`font-semibold text-sm sm:text-base ${isSelected ? "text-white" : "text-slate-200"}`}>
                    {level.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[rgba(239,237,253,0.5)] mt-0.5">
                    {level.description}
                  </p>
                </div>
                <span
                  className={`
                    shrink-0 ml-3 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-medium
                    ${isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-500"}
                  `}
                >
                  {level.checkIns}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ─── Preferred Channel ─── */}
      <motion.section
        className="mb-8 sm:mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-slate-400">✦</span> Preferred Channel
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {channelOptions.map((channel) => {
            const isSelected = preferences.preferredChannel === channel.id;

            return (
              <motion.button
                key={channel.id}
                onClick={() => handleChannelSelect(channel.id as Preferences["preferredChannel"])}
                className={`
                  flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl
                  transition-all duration-200 border
                  ${isSelected
                    ? "border-emerald-600 border-[1.5px]"
                    : "bg-[#02000f] border-white/[0.24] hover:border-white/40"
                  }
                `}
                style={isSelected ? { backgroundImage: "linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)" } : undefined}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={isSelected ? channel.color : "text-slate-400"}>
                  {channel.icon}
                </div>
                <span className={`text-xs sm:text-sm font-medium ${isSelected ? "text-white" : "text-slate-400"}`}>
                  {channel.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ─── Quiet Hours ─── */}
      <motion.section
        className="mb-8 sm:mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Moon className="w-4 h-4 text-slate-400" />
          Quiet Hours
        </h2>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* From */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl bg-[#02000f] border border-white/[0.24]">
            <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
            <input
              type="time"
              value={preferences.quietHours.start}
              onChange={(e) =>
                updatePreferences({
                  quietHours: { ...preferences.quietHours, start: e.target.value },
                })
              }
              className="flex-1 bg-transparent text-white text-sm sm:text-base border-none outline-none min-w-0"
            />
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          </div>

          {/* To */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl bg-[#02000f] border border-white/[0.24]">
            <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="time"
              value={preferences.quietHours.end}
              onChange={(e) =>
                updatePreferences({
                  quietHours: { ...preferences.quietHours, end: e.target.value },
                })
              }
              className="flex-1 bg-transparent text-white text-sm sm:text-base border-none outline-none min-w-0"
            />
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          </div>
        </div>
      </motion.section>

      {/* ─── Preferred Check-in Time ─── */}
      <motion.section
        className="mb-8 sm:mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Preferred Check-in Time
        </h2>

        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl bg-[#02000f] border border-white/[0.24]">
          <input
            type="time"
            value={preferences.preferredCheckInTime}
            onChange={(e) => updatePreferences({ preferredCheckInTime: e.target.value })}
            className="flex-1 bg-transparent text-white text-sm sm:text-base border-none outline-none min-w-0"
          />
          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
        </div>
      </motion.section>

      {/* Navigation — sky-600 CTA */}
      <StepNavigation
        onBack={prevStep}
        onNext={nextStep}
        nextLabel="Generate my plan"
      />
    </div>
  );
}
