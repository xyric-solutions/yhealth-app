"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Shield,
  Flame,
  Zap,
  Heart,
  Target,
  Moon,
  Coins,
  Users,
  Snowflake,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api-client";

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CONDITION_TYPES = [
  { id: "missed_activity", label: "Missed Activity", icon: Flame, desc: "Triggered when you miss workouts or activities", color: "#f97316" },
  { id: "calorie_exceeded", label: "Calorie Exceeded", icon: Zap, desc: "Triggered when you exceed calorie limits", color: "#eab308" },
  { id: "streak_break", label: "Streak Break", icon: Heart, desc: "Triggered when your streak drops", color: "#ef4444" },
  { id: "missed_goal", label: "Missed Goal", icon: Target, desc: "Triggered when goal progress stalls", color: "#06b6d4" },
  { id: "sleep_deficit", label: "Sleep Deficit", icon: Moon, desc: "Triggered when sleep is below threshold", color: "#8b5cf6" },
] as const;

const PENALTY_TYPES = [
  { id: "donation", label: "Donation Pledge", icon: Coins, desc: "Pledge to donate to charity", color: "#f59e0b" },
  { id: "xp_loss", label: "XP Deduction", icon: Zap, desc: "Lose experience points", color: "#a78bfa" },
  { id: "social_alert", label: "Social Alert", icon: Users, desc: "Notify your accountability partners", color: "#06b6d4" },
  { id: "streak_freeze_loss", label: "Streak Freeze Loss", icon: Snowflake, desc: "Lose a streak freeze", color: "#38bdf8" },
] as const;

interface FormData {
  title: string;
  description: string;
  conditionType: string;
  conditionValue: string;
  conditionWindowDays: string;
  penaltyType: string;
  penaltyAmount: string;
  startDate: string;
  endDate: string;
  gracePeriodHours: string;
  autoRenew: boolean;
}

const initialForm: FormData = {
  title: "",
  description: "",
  conditionType: "",
  conditionValue: "",
  conditionWindowDays: "1",
  penaltyType: "",
  penaltyAmount: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  gracePeriodHours: "0",
  autoRenew: false,
};

export function CreateContractModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateContractModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 3;

  const reset = () => {
    setStep(1);
    setForm(initialForm);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const update = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const canProceed = () => {
    if (step === 1) return form.title.length >= 3 && form.conditionType;
    if (step === 2) return form.penaltyType;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        condition_type: form.conditionType,
        condition_value: form.conditionValue ? Number(form.conditionValue) : undefined,
        condition_window_days: Number(form.conditionWindowDays) || 1,
        penalty_type: form.penaltyType,
        penalty_amount: form.penaltyAmount ? Number(form.penaltyAmount) : undefined,
        start_date: form.startDate,
        end_date: form.endDate,
        grace_period_hours: Number(form.gracePeriodHours) || 0,
        auto_renew: form.autoRenew,
      };

      const res = await api.post("/contracts", body);
      if (res.success) {
        // Auto-sign the contract
        const contract = (res.data as { contract: { id: string } }).contract;
        await api.post(`/contracts/${contract.id}/sign`, { confirm: true });
        handleClose();
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        onClick={handleClose}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-lg rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #0d1117 0%, #0a0e13 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">New Contract</h2>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">
                  Step {step} of {totalSteps}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-6 pb-4">
            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                animate={{ width: `${(step / totalSteps) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-4 min-h-[320px] max-h-[55vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Contract Title *
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => update("title", e.target.value)}
                      placeholder="e.g. Daily Workout Commitment"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-600
                        focus:outline-none focus:border-emerald-500/40 transition-colors text-[15px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Condition Type *
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {CONDITION_TYPES.map((ct) => {
                        const Icon = ct.icon;
                        const selected = form.conditionType === ct.id;
                        return (
                          <button
                            key={ct.id}
                            onClick={() => update("conditionType", ct.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                              selected
                                ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                                : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]"
                            }`}
                          >
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${ct.color}15` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: ct.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-white">{ct.label}</p>
                              <p className="text-[11px] text-zinc-500 truncate">{ct.desc}</p>
                            </div>
                            {selected && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Threshold Value
                    </label>
                    <input
                      type="number"
                      value={form.conditionValue}
                      onChange={(e) => update("conditionValue", e.target.value)}
                      placeholder="e.g. 1 (minimum sessions)"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-600
                        focus:outline-none focus:border-emerald-500/40 transition-colors text-[15px]"
                    />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Penalty Type *
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {PENALTY_TYPES.map((pt) => {
                        const Icon = pt.icon;
                        const selected = form.penaltyType === pt.id;
                        return (
                          <button
                            key={pt.id}
                            onClick={() => update("penaltyType", pt.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                              selected
                                ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                                : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]"
                            }`}
                          >
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${pt.color}15` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: pt.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-white">{pt.label}</p>
                              <p className="text-[11px] text-zinc-500 truncate">{pt.desc}</p>
                            </div>
                            {selected && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(form.penaltyType === "donation" || form.penaltyType === "xp_loss") && (
                    <div>
                      <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Penalty Amount
                      </label>
                      <input
                        type="number"
                        value={form.penaltyAmount}
                        onChange={(e) => update("penaltyAmount", e.target.value)}
                        placeholder={form.penaltyType === "donation" ? "e.g. 500 PKR" : "e.g. 50 XP"}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-600
                          focus:outline-none focus:border-emerald-500/40 transition-colors text-[15px]"
                      />
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => update("startDate", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white
                          focus:outline-none focus:border-emerald-500/40 transition-colors text-[14px]
                          [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => update("endDate", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white
                          focus:outline-none focus:border-emerald-500/40 transition-colors text-[14px]
                          [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Grace Period (hours)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="48"
                      value={form.gracePeriodHours}
                      onChange={(e) => update("gracePeriodHours", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-600
                        focus:outline-none focus:border-emerald-500/40 transition-colors text-[15px]"
                    />
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Extra time before a violation is confirmed (0 = immediate)
                    </p>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      rows={2}
                      placeholder="Why this contract matters to you..."
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-600
                        focus:outline-none focus:border-emerald-500/40 transition-colors text-[15px] resize-none"
                    />
                  </div>

                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.autoRenew}
                      onChange={(e) => update("autoRenew", e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    <div>
                      <p className="text-[13px] text-white font-medium">Auto-renew</p>
                      <p className="text-[11px] text-zinc-500">
                        Automatically create a new contract when this one ends
                      </p>
                    </div>
                  </label>

                  {/* Signing confirmation */}
                  <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span className="text-[12px] font-semibold text-emerald-400 uppercase tracking-wider">
                        Ready to Commit
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-400 leading-relaxed">
                      By creating this contract, you commit to the conditions above.
                      Violations will trigger the selected penalty automatically.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error */}
          {error && (
            <div className="px-6 pb-3">
              <p className="text-[13px] text-rose-400 bg-rose-500/10 px-4 py-2 rounded-xl">
                {error}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.05]">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : handleClose())}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              {step > 1 ? "Back" : "Cancel"}
            </button>

            {step < totalSteps ? (
              <button
                onClick={() => canProceed() && setStep(step + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold
                  bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold
                  bg-gradient-to-r from-emerald-500 to-cyan-500 text-white
                  hover:from-emerald-400 hover:to-cyan-400
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer
                  shadow-[0_0_20px_-4px_rgba(52,211,153,0.3)]"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                Sign & Activate
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
