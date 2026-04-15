"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Play,
  Pause,

  Calendar,
  Bell,
  BellOff,
  Loader2,

  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  voiceScheduleService,
  type VoiceOption,
  type VoiceId,
  type AICallFrequency,
  type VoiceSchedulePreferences,

  getShortDayName,
  formatScheduleTime as formatTime,
  getSpeechPaceLabel,
} from "@/src/shared/services/voice-schedule.service";
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";
import type { VoiceGender } from "@/src/shared/services/tts.service";
import { toast } from "react-hot-toast";

export function VoiceCustomizationPanel() {
  const { voiceGender, setVoiceGender } = useVoiceAssistant();
  const [preferences, setPreferences] = useState<VoiceSchedulePreferences | null>(null);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'voice' | 'schedule' | null>('voice');
  const [playingVoice, setPlayingVoice] = useState<VoiceId | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [prefsResponse, voicesResponse] = await Promise.all([
        voiceScheduleService.getPreferences(),
        voiceScheduleService.getVoiceOptions(),
      ]);

      if (prefsResponse.success && prefsResponse.data) {
        setPreferences(prefsResponse.data);
      }

      if (voicesResponse.success && voicesResponse.data) {
        setVoiceOptions(voicesResponse.data.voices);
      }
    } catch (err: unknown) {
      console.error("Failed to load voice settings:", err);
      setError((err instanceof Error ? err.message : null) || "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSelect = async (voiceId: VoiceId) => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const response = await voiceScheduleService.updateVoiceSettings({ voiceId });
      if (response.success && response.data) {
        setPreferences({ ...preferences, ...response.data });
        toast.success("Voice updated");
      }
    } catch (_err) {
      toast.error("Failed to update voice");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaceChange = async (pace: number) => {
    if (!preferences) return;

    // Update locally first for responsiveness
    setPreferences({ ...preferences, speechPace: pace });

    try {
      await voiceScheduleService.updateVoiceSettings({ speechPace: pace });
    } catch (_err) {
      toast.error("Failed to update speech pace");
    }
  };

  const handleQuietHoursToggle = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const response = await voiceScheduleService.updateScheduleSettings({
        quietHoursEnabled: !preferences.quietHoursEnabled,
      });
      if (response.success && response.data) {
        setPreferences({ ...preferences, ...response.data });
      }
    } catch (_err) {
      toast.error("Failed to update quiet hours");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuietHoursChange = async (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    if (!preferences) return;

    setPreferences({ ...preferences, [field]: value });

    try {
      await voiceScheduleService.updateScheduleSettings({ [field]: value });
    } catch (_err) {
      toast.error("Failed to update quiet hours");
    }
  };

  const handleDndDayToggle = async (day: number) => {
    if (!preferences) return;

    const newDays = preferences.dndDays.includes(day)
      ? preferences.dndDays.filter(d => d !== day)
      : [...preferences.dndDays, day];

    setPreferences({ ...preferences, dndDays: newDays });

    try {
      await voiceScheduleService.updateScheduleSettings({ dndDays: newDays });
    } catch (_err) {
      toast.error("Failed to update DND days");
    }
  };

  const handleFrequencyChange = async (frequency: AICallFrequency) => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const response = await voiceScheduleService.updateScheduleSettings({
        aiCallFrequency: frequency,
      });
      if (response.success && response.data) {
        setPreferences({ ...preferences, ...response.data });
        toast.success("AI call frequency updated");
      }
    } catch (_err) {
      toast.error("Failed to update frequency");
    } finally {
      setIsSaving(false);
    }
  };

  const playVoicePreview = (voiceId: VoiceId) => {
    // TODO: Implement actual voice preview playback
    setPlayingVoice(voiceId);
    setTimeout(() => setPlayingVoice(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-slate-400">{error || "Failed to load settings"}</p>
      </div>
    );
  }

  const frequencyOptions: { id: AICallFrequency; label: string; description: string }[] = [
    { id: 'off', label: 'Off', description: 'AI will never call you' },
    { id: 'minimal', label: 'Minimal', description: '1-2 calls per week' },
    { id: 'moderate', label: 'Moderate', description: '3-4 calls per week' },
    { id: 'proactive', label: 'Proactive', description: '5-7 calls per week' },
  ];

  return (
    <div className="space-y-4">
      {/* Voice Selection Section */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'voice' ? null : 'voice')}
          className="w-full p-4 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-purple-400" />
            <div className="text-left">
              <h4 className="text-sm font-medium text-white">Voice Settings</h4>
              <p className="text-xs text-slate-400">
                {voiceOptions.find(v => v.id === preferences.voiceId)?.name || 'Alloy'} • {getSpeechPaceLabel(preferences.speechPace)}
              </p>
            </div>
          </div>
          {expandedSection === 'voice' ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'voice' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Voice Gender */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Voice Gender</p>
                  <div className="flex gap-2">
                    {([
                      { id: 'female' as VoiceGender, label: 'Female', icon: '♀' },
                      { id: 'male' as VoiceGender, label: 'Male', icon: '♂' },
                    ]).map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setVoiceGender(option.id);
                          toast.success(`Voice set to ${option.label}`);
                        }}
                        className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                          voiceGender === option.id
                            ? "bg-purple-500/20 border-2 border-purple-500/50"
                            : "bg-white/5 border-2 border-transparent hover:border-white/20"
                        }`}
                      >
                        <span className="text-lg">{option.icon}</span>
                        <span className="text-sm font-medium text-white">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Applies to Google Cloud TTS and browser voice fallback
                  </p>
                </div>

                {/* Voice Options */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Select Voice</p>
                  <div className="grid grid-cols-2 gap-2">
                    {voiceOptions.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => handleVoiceSelect(voice.id)}
                        disabled={isSaving}
                        className={`p-3 rounded-lg text-left transition-all ${
                          preferences.voiceId === voice.id
                            ? "bg-purple-500/20 border-2 border-purple-500/50"
                            : "bg-white/5 border-2 border-transparent hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{voice.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoicePreview(voice.id);
                            }}
                            className="p-1 rounded hover:bg-white/10"
                          >
                            {playingVoice === voice.id ? (
                              <Pause className="w-3 h-3 text-purple-400" />
                            ) : (
                              <Play className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">{voice.tone}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speech Pace */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Speech Pace</p>
                    <span className="text-xs text-purple-400">{getSpeechPaceLabel(preferences.speechPace)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={preferences.speechPace}
                    onChange={(e) => handlePaceChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Slow</span>
                    <span>Normal</span>
                    <span>Fast</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Schedule Section */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'schedule' ? null : 'schedule')}
          className="w-full p-4 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div className="text-left">
              <h4 className="text-sm font-medium text-white">Schedule Settings</h4>
              <p className="text-xs text-slate-400">
                {preferences.quietHoursEnabled ? `Quiet ${formatTime(preferences.quietHoursStart)} - ${formatTime(preferences.quietHoursEnd)}` : 'No quiet hours'} • {frequencyOptions.find(f => f.id === preferences.aiCallFrequency)?.label}
              </p>
            </div>
          </div>
          {expandedSection === 'schedule' ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'schedule' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Quiet Hours */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {preferences.quietHoursEnabled ? (
                        <BellOff className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Bell className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm text-white">Quiet Hours</span>
                    </div>
                    <button
                      onClick={handleQuietHoursToggle}
                      disabled={isSaving}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        preferences.quietHoursEnabled ? "bg-blue-500" : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          preferences.quietHoursEnabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {preferences.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">From</label>
                        <input
                          type="time"
                          value={preferences.quietHoursStart}
                          onChange={(e) => handleQuietHoursChange('quietHoursStart', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">To</label>
                        <input
                          type="time"
                          value={preferences.quietHoursEnd}
                          onChange={(e) => handleQuietHoursChange('quietHoursEnd', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* DND Days */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Do Not Disturb Days</p>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <button
                        key={day}
                        onClick={() => handleDndDayToggle(day)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          preferences.dndDays.includes(day)
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-white/5 text-slate-400 hover:bg-white/10"
                        }`}
                      >
                        {getShortDayName(day)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Call Frequency */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">AI Call Frequency</p>
                  <div className="grid grid-cols-2 gap-2">
                    {frequencyOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleFrequencyChange(option.id)}
                        disabled={isSaving}
                        className={`p-3 rounded-lg text-left transition-all ${
                          preferences.aiCallFrequency === option.id
                            ? "bg-blue-500/20 border-2 border-blue-500/50"
                            : "bg-white/5 border-2 border-transparent hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-medium text-white">{option.label}</p>
                        <p className="text-xs text-slate-400">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default VoiceCustomizationPanel;

