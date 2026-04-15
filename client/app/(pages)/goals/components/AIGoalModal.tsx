"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Loader2,

  RotateCcw,
  AlertCircle,
  Lightbulb,

  Save,
} from "lucide-react";
import { aiCoachService, type AICoachGoalCategory } from "@/src/shared/services/ai-coach.service";

interface AIGeneratedGoal {
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  durationWeeks: number;
  motivation: string;
  milestones?: Array<{
    title: string;
    targetValue: number;
    weekNumber: number;
  }>;
}

interface AIGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (goal: AIGeneratedGoal & { category: string; pillar: string; isPrimary: boolean }) => void;
  isLoading?: boolean;
}

export function AIGoalModal({ isOpen, onClose, onAccept, isLoading: externalLoading }: AIGoalModalProps) {
  const [step, setStep] = useState<"input" | "generating" | "preview">("input");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_generatedGoal, setGeneratedGoal] = useState<AIGeneratedGoal | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [editingGoal, setEditingGoal] = useState<AIGeneratedGoal | null>(null);

  const categories = [
    { key: "weight_loss", label: "Weight Loss", icon: "📉" },
    { key: "muscle_building", label: "Build Muscle", icon: "💪" },
    { key: "sleep_improvement", label: "Better Sleep", icon: "🌙" },
    { key: "stress_wellness", label: "Stress Management", icon: "🧠" },
    { key: "energy_productivity", label: "More Energy", icon: "⚡" },
    { key: "nutrition", label: "Nutrition", icon: "🥗" },
    { key: "fitness", label: "Fitness", icon: "🏋️" },
    { key: "habit_building", label: "Build Habits", icon: "🔥" },
  ];

  const handleGenerate = async () => {
    if (!description.trim() || !category) {
      setError("Please provide a description and select a category");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep("generating");

    try {
      const _pillar = ["nutrition", "weight_loss"].includes(category)
        ? "nutrition"
        : ["sleep_improvement", "stress_wellness"].includes(category)
        ? "wellbeing"
        : "fitness";

      const result = await aiCoachService.generateGoals({
        goalCategory: category as AICoachGoalCategory,
        assessmentResponses: [],
        bodyStats: {},
        customGoalText: description,
      });

      if (result.goals && result.goals.length > 0) {
        const goal = result.goals[0];
        
        // Calculate durationWeeks with fallback
        const durationWeeks = goal.timeline?.durationWeeks || 
                             (goal.timeline?.startDate && goal.timeline?.targetDate 
                               ? Math.ceil((new Date(goal.timeline.targetDate).getTime() - new Date(goal.timeline.startDate).getTime()) / (1000 * 60 * 60 * 24 * 7))
                               : 12); // Default to 12 weeks if no timeline info
        
        const generated: AIGeneratedGoal = {
          title: goal.title || "New Goal",
          description: goal.description || "",
          targetValue: goal.targetValue ?? 0,
          targetUnit: goal.targetUnit || "",
          durationWeeks: durationWeeks,
          motivation: goal.motivation || "",
          milestones: goal.milestones?.map((m, i) => ({
            title: m.description || `Week ${m.week || i + 1}`,
            targetValue: m.target ?? 0,
            weekNumber: m.week || i + 1,
          })),
        };
        setGeneratedGoal(generated);
        setEditingGoal(generated);
        setAiReasoning(result.reasoning || "");
        setStep("preview");
      } else {
        setError("Failed to generate goal. Please try again.");
        setStep("input");
      }
    } catch (err) {
      console.error("AI generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate goal");
      setStep("input");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setStep("input");
    setGeneratedGoal(null);
    setEditingGoal(null);
    setAiReasoning("");
  };

  const handleAccept = () => {
    if (!editingGoal || !category) return;

    const pillar = ["nutrition", "weight_loss"].includes(category)
      ? "nutrition"
      : ["sleep_improvement", "stress_wellness"].includes(category)
      ? "wellbeing"
      : "fitness";

    onAccept({
      ...editingGoal,
      category,
      pillar,
      isPrimary: false,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setStep("input");
      setDescription("");
      setCategory("");
      setError(null);
      setGeneratedGoal(null);
      setEditingGoal(null);
      setAiReasoning("");
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Create Goal with AI</h3>
                  <p className="text-sm text-slate-400">
                    {step === "input" && "Describe what you want to achieve"}
                    {step === "generating" && "AI is generating your goal..."}
                    {step === "preview" && "Review and customize your goal"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {step === "input" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    What goal would you like to achieve?
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., I want to lose 15 pounds in the next 3 months to feel more confident and healthy..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Be specific about your goal, timeline, and why it matters to you
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setCategory(cat.key)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                          category === cat.key
                            ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-2xl mb-1">{cat.icon}</div>
                        <p className="text-xs font-medium text-white">{cat.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!description.trim() || !category || isGenerating}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Goal
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === "generating" && (
              <div className="py-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center"
                >
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </motion.div>
                <p className="text-lg font-medium text-white mb-2">AI is crafting your goal...</p>
                <p className="text-sm text-slate-400">This may take a few seconds</p>
              </div>
            )}

            {step === "preview" && editingGoal && (
              <div className="space-y-6">
                {aiReasoning && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-300">AI Reasoning</span>
                    </div>
                    <p className="text-sm text-slate-300">{aiReasoning}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Goal Title
                    </label>
                    <input
                      type="text"
                      value={editingGoal.title}
                      onChange={(e) =>
                        setEditingGoal({ ...editingGoal, title: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editingGoal.description}
                      onChange={(e) =>
                        setEditingGoal({ ...editingGoal, description: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Target Value
                      </label>
                      <input
                        type="number"
                        value={editingGoal.targetValue}
                        onChange={(e) =>
                          setEditingGoal({
                            ...editingGoal,
                            targetValue: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={editingGoal.targetUnit}
                        onChange={(e) =>
                          setEditingGoal({ ...editingGoal, targetUnit: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Duration (Weeks)
                      </label>
                      <input
                        type="number"
                        value={editingGoal.durationWeeks}
                        onChange={(e) =>
                          setEditingGoal({
                            ...editingGoal,
                            durationWeeks: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Motivation
                    </label>
                    <textarea
                      value={editingGoal.motivation}
                      onChange={(e) =>
                        setEditingGoal({ ...editingGoal, motivation: e.target.value })
                      }
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={handleRegenerate}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Regenerate
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={externalLoading || !editingGoal.title.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {externalLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Create Goal
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

