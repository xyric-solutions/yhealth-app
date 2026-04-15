"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sliders,
  Bell,
  MessageSquare,
  Volume2,
  Zap,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Moon,
  Smartphone,
  Mail,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { LanguageSelector } from "@/components/common/language-selector";
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";

// API Response Types (matching backend)
interface APIPreferences {
  id: string;
  userId: string;
  notifications: {
    channels: Record<string, boolean>;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    frequency: {
      maxPerDay: number;
      maxPerWeek: number;
    };
    types: Record<string, boolean>;
  };
  coaching: {
    style: string;
    intensity: string;
    preferredChannel: string;
    checkInFrequency: string;
    preferredCheckInTime: string;
    timezone: string;
    aiPersonality: {
      useEmojis: boolean;
      formalityLevel: string;
      encouragementLevel: string;
    };
    focusAreas: string[];
  };
  display: {
    units: {
      weight: string;
      height: string;
      distance: string;
      temperature: string;
    };
    dateFormat: string;
    timeFormat: string;
    language: string;
    theme: string;
  };
  privacy: {
    shareProgressWithCoach: boolean;
    allowAnonymousDataForResearch: boolean;
    showInLeaderboards: boolean;
    profileVisibility: string;
  };
  integrations: {
    autoSyncEnabled: boolean;
    syncOnWifiOnly: boolean;
    backgroundSyncEnabled: boolean;
    dataRetentionDays: number;
  };
}

// Local state for UI (simplified)
interface LocalPreferences {
  coaching: {
    style: string;
    intensity: string;
    preferredChannel: string;
    checkInFrequency: string;
  };
  notifications: {
    activityReminders: boolean;
    progressUpdates: boolean;
    motivationalMessages: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
  display: {
    language: string;
  };
}

const coachingStyles = [
  { id: "supportive", label: "Supportive", desc: "Encouraging and gentle guidance" },
  { id: "direct", label: "Direct", desc: "Straightforward and to the point" },
  { id: "analytical", label: "Analytical", desc: "Data-driven insights" },
  { id: "motivational", label: "Motivational", desc: "High energy and inspiring" },
];

const intensityLevels = [
  { id: "light", label: "Gentle", desc: "Light nudges and reminders" },
  { id: "moderate", label: "Moderate", desc: "Balanced approach" },
  { id: "intensive", label: "Intensive", desc: "Frequent check-ins" },
];

const channelOptions = [
  { id: "push", label: "App Only", icon: <Smartphone className="w-4 h-4" /> },
  { id: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  { id: "whatsapp", label: "Both", icon: <Bell className="w-4 h-4" /> },
];

const frequencyOptions = [
  { id: "daily", label: "Daily" },
  { id: "every_other_day", label: "Twice Daily" },
  { id: "weekly", label: "Weekly" },
];

// Transform API response to local state
function apiToLocal(apiPrefs: APIPreferences): LocalPreferences {
  return {
    coaching: {
      style: apiPrefs.coaching?.style || "supportive",
      intensity: apiPrefs.coaching?.intensity || "moderate",
      preferredChannel: apiPrefs.coaching?.preferredChannel || "push",
      checkInFrequency: apiPrefs.coaching?.checkInFrequency || "daily",
    },
    notifications: {
      activityReminders: apiPrefs.notifications?.types?.activityReminders ?? true,
      progressUpdates: apiPrefs.notifications?.types?.progressUpdates ?? true,
      motivationalMessages: apiPrefs.notifications?.types?.motivationalMessages ?? true,
      quietHoursEnabled: apiPrefs.notifications?.quietHours?.enabled ?? false,
      quietHoursStart: apiPrefs.notifications?.quietHours?.start || "22:00",
      quietHoursEnd: apiPrefs.notifications?.quietHours?.end || "07:00",
    },
    display: {
      language: apiPrefs.display?.language || "en-US",
    },
  };
}

// Transform local state to API format for saving
function localToApi(local: LocalPreferences) {
  return {
    coaching: {
      style: local.coaching.style,
      intensity: local.coaching.intensity,
      preferredChannel: local.coaching.preferredChannel,
      checkInFrequency: local.coaching.checkInFrequency,
    },
    notifications: {
      types: {
        activityReminders: local.notifications.activityReminders,
        progressUpdates: local.notifications.progressUpdates,
        motivationalMessages: local.notifications.motivationalMessages,
      },
      quietHours: {
        enabled: local.notifications.quietHoursEnabled,
        start: local.notifications.quietHoursStart,
        end: local.notifications.quietHoursEnd,
      },
    },
    display: {
      language: local.display.language,
    },
  };
}

export function PreferencesTab() {
  const { selectedLanguage, setSelectedLanguage } = useVoiceAssistant();
  
  const [preferences, setPreferences] = useState<LocalPreferences>({
    coaching: {
      style: "supportive",
      intensity: "moderate",
      preferredChannel: "push",
      checkInFrequency: "daily",
    },
    notifications: {
      activityReminders: true,
      progressUpdates: true,
      motivationalMessages: true,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    },
    display: {
      language: selectedLanguage,
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{ preferences: APIPreferences }>("/preferences");
      if (response.success && response.data?.preferences) {
        const localPrefs = apiToLocal(response.data.preferences);
        setPreferences(localPrefs);
      }
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
      // Use defaults if fetch fails
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch once on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Sync language from preferences → context (one-way, only on preferences load)
  const langSyncedRef = useRef(false);
  useEffect(() => {
    if (!langSyncedRef.current && preferences.display.language) {
      setSelectedLanguage(preferences.display.language);
      langSyncedRef.current = true;
    }
  }, [preferences.display.language, setSelectedLanguage]);

  // Sync language from context → preferences when user changes it externally
  useEffect(() => {
    if (langSyncedRef.current && selectedLanguage && preferences.display.language !== selectedLanguage) {
      setPreferences(prev => ({
        ...prev,
        display: { ...prev.display, language: selectedLanguage },
      }));
      setHasChanges(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]);

  const savePreferences = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const apiData = localToApi(preferences);

      // Use PUT to update all preferences at once
      await api.put("/preferences", apiData);

      setSaveSuccess(true);
      setHasChanges(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save preferences:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to save preferences. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateCoaching = (field: keyof LocalPreferences["coaching"], value: string) => {
    setPreferences((prev) => ({
      ...prev,
      coaching: { ...prev.coaching, [field]: value },
    }));
    setHasChanges(true);
  };

  const updateNotifications = (
    field: keyof LocalPreferences["notifications"],
    value: boolean | string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value },
    }));
    setHasChanges(true);
  };

  const updateDisplay = (field: keyof LocalPreferences["display"], value: string) => {
    setPreferences((prev) => ({
      ...prev,
      display: { ...prev.display, [field]: value },
    }));
    setHasChanges(true);
    
    // Sync with voice assistant context
    if (field === "language") {
      setSelectedLanguage(value);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-40 bg-white/10 rounded-lg" />
            <div className="h-4 w-56 bg-white/5 rounded-lg mt-2" />
          </div>
          <div className="h-10 w-32 bg-white/10 rounded-xl" />
        </div>

        {/* Cards grid skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Coaching Style card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-white/10 rounded" />
              <div className="h-5 w-28 bg-white/10 rounded-lg" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-3 w-44 bg-white/5 rounded mt-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Coaching Intensity card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-white/10 rounded" />
              <div className="h-5 w-36 bg-white/10 rounded-lg" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="h-4 w-20 bg-white/10 rounded" />
                  <div className="h-3 w-40 bg-white/5 rounded mt-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Communication Channel card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-white/10 rounded" />
              <div className="h-5 w-44 bg-white/10 rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="w-4 h-4 bg-white/10 rounded mx-auto mb-2" />
                  <div className="h-3 w-12 bg-white/10 rounded mx-auto" />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="h-3 w-28 bg-white/5 rounded mb-2" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-1 h-10 bg-white/5 rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          {/* Notifications card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-white/10 rounded" />
              <div className="h-5 w-28 bg-white/10 rounded-lg" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-48 bg-white/5 rounded mt-1" />
                  </div>
                  <div className="w-12 h-6 bg-white/10 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Display & Language card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-white/10 rounded" />
              <div className="h-5 w-36 bg-white/10 rounded-lg" />
            </div>
            <div className="h-12 w-full bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-pink-400" />
            Preferences
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Customize your coaching experience
          </p>
        </div>

        <button
          onClick={savePreferences}
          disabled={isSaving || !hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-all cursor-pointer ${
            hasChanges
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-90"
              : "bg-slate-700 text-slate-400"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Changes"}
        </button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </motion.div>
      )}

      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <p className="text-green-400">Preferences saved successfully!</p>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Coaching Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Coaching Style</h3>
          </div>

          <div className="space-y-3">
            {coachingStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => updateCoaching("style", style.id)}
                className={`w-full p-4 rounded-xl text-left transition-all cursor-pointer ${
                  preferences.coaching.style === style.id
                    ? "bg-purple-500/20 border border-purple-500/30"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{style.label}</p>
                    <p className="text-sm text-slate-400">{style.desc}</p>
                  </div>
                  {preferences.coaching.style === style.id && (
                    <CheckCircle2 className="w-5 h-5 text-purple-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Coaching Intensity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">Coaching Intensity</h3>
          </div>

          <div className="space-y-3">
            {intensityLevels.map((level) => (
              <button
                key={level.id}
                onClick={() => updateCoaching("intensity", level.id)}
                className={`w-full p-4 rounded-xl text-left transition-all cursor-pointer ${
                  preferences.coaching.intensity === level.id
                    ? "bg-amber-500/20 border border-amber-500/30"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{level.label}</p>
                    <p className="text-sm text-slate-400">{level.desc}</p>
                  </div>
                  {preferences.coaching.intensity === level.id && (
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Communication Channel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white">Communication Channel</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {channelOptions.map((channel) => (
              <button
                key={channel.id}
                onClick={() => updateCoaching("preferredChannel", channel.id)}
                className={`p-4 rounded-xl text-center transition-all cursor-pointer ${
                  preferences.coaching.preferredChannel === channel.id
                    ? "bg-cyan-500/20 border border-cyan-500/30"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
              >
                <div
                  className={`mx-auto mb-2 ${
                    preferences.coaching.preferredChannel === channel.id
                      ? "text-cyan-400"
                      : "text-slate-400"
                  }`}
                >
                  {channel.icon}
                </div>
                <p className="text-sm font-medium text-white">{channel.label}</p>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-sm text-slate-400 mb-2 block">Check-in Frequency</label>
            <div className="flex gap-2">
              {frequencyOptions.map((freq) => (
                <button
                  key={freq.id}
                  onClick={() => updateCoaching("checkInFrequency", freq.id)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    preferences.coaching.checkInFrequency === freq.id
                      ? "bg-cyan-500 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">Notifications</h3>
          </div>

          <div className="space-y-4">
            {[
              {
                key: "activityReminders" as const,
                label: "Activity Reminders",
                desc: "Get reminded about scheduled activities",
              },
              {
                key: "progressUpdates" as const,
                label: "Progress Updates",
                desc: "Weekly summaries and milestone alerts",
              },
              {
                key: "motivationalMessages" as const,
                label: "Motivational Messages",
                desc: "Daily inspiration and encouragement",
              },
            ].map((setting) => (
              <div
                key={setting.key}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5"
              >
                <div>
                  <p className="font-medium text-white">{setting.label}</p>
                  <p className="text-xs text-slate-400">{setting.desc}</p>
                </div>
                <button
                  onClick={() =>
                    updateNotifications(
                      setting.key,
                      !preferences.notifications[setting.key]
                    )
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                    preferences.notifications[setting.key]
                      ? "bg-green-500"
                      : "bg-slate-600"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences.notifications[setting.key]
                        ? "translate-x-7"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}

            {/* Quiet Hours */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium text-white">Quiet Hours</span>
                </div>
                <button
                  onClick={() =>
                    updateNotifications(
                      "quietHoursEnabled",
                      !preferences.notifications.quietHoursEnabled
                    )
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                    preferences.notifications.quietHoursEnabled
                      ? "bg-indigo-500"
                      : "bg-slate-600"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences.notifications.quietHoursEnabled
                        ? "translate-x-7"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {preferences.notifications.quietHoursEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="grid grid-cols-2 gap-3"
                >
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">From</label>
                    <input
                      type="time"
                      value={preferences.notifications.quietHoursStart}
                      onChange={(e) =>
                        updateNotifications("quietHoursStart", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">To</label>
                    <input
                      type="time"
                      value={preferences.notifications.quietHoursEnd}
                      onChange={(e) =>
                        updateNotifications("quietHoursEnd", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Display Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5 "
        >
          <div className="flex items-center gap-2 mb-4">
            <Moon className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Display & Language</h3>
          </div>

          <div className="space-y-4 z-50">
            <LanguageSelector
              selectedLanguage={preferences.display.language}
              onLanguageChange={(lang) => updateDisplay("language", lang)}
              compact={false}
              showPreview={true}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
