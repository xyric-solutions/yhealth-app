"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, MessageSquare } from "lucide-react";

interface Question {
  id: string;
  question: string;
  type: "scale" | "frequency" | "text";
  options?: string[];
  scaleRange?: { min: number; max: number; labels?: string[] };
}

interface CheckInQuestionProps {
  question: Question;
  onRespond: (value: number | string, text?: string) => void;
}

/* ── Scale label colors by value (1-10) ── */
const scaleColor = (v: number, max: number) => {
  const ratio = v / max;
  if (ratio <= 0.3) return { bg: "bg-emerald-500/20", text: "text-emerald-400", ring: "ring-emerald-500/40", activeBg: "bg-emerald-500", activeText: "text-white" };
  if (ratio <= 0.6) return { bg: "bg-amber-500/20", text: "text-amber-400", ring: "ring-amber-500/40", activeBg: "bg-amber-500", activeText: "text-white" };
  return { bg: "bg-rose-500/20", text: "text-rose-400", ring: "ring-rose-500/40", activeBg: "bg-rose-500", activeText: "text-white" };
};

export function CheckInQuestion({ question, onRespond }: CheckInQuestionProps) {
  const [selectedValue, setSelectedValue] = useState<number | string | null>(null);
  const [textInput, setTextInput] = useState("");

  const handleSubmit = () => {
    if (selectedValue !== null) {
      onRespond(selectedValue, textInput.trim() || undefined);
      setSelectedValue(null);
      setTextInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {/* ── Scale Question ── */}
      {question.type === "scale" && question.scaleRange && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-slate-500 px-1">
            <span>{question.scaleRange.labels?.[0] || "Not at all"}</span>
            <span>{question.scaleRange.labels?.[1] || "Extremely"}</span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from(
              { length: question.scaleRange.max - question.scaleRange.min + 1 },
              (_, i) => {
                const value = question.scaleRange!.min + i;
                const isSelected = selectedValue === value;
                const colors = scaleColor(value, question.scaleRange!.max);
                return (
                  <motion.button
                    key={value}
                    onClick={() => setSelectedValue(value)}
                    whileHover={{ scale: 1.08, y: -2 }}
                    whileTap={{ scale: 0.92 }}
                    className={`relative h-11 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      isSelected
                        ? `${colors.activeBg} ${colors.activeText} shadow-lg ring-2 ${colors.ring}`
                        : `bg-white/[0.04] border border-white/[0.06] ${colors.text} hover:${colors.bg} hover:border-white/[0.12]`
                    }`}
                  >
                    {value}
                    {isSelected && (
                      <motion.div
                        layoutId="scaleIndicator"
                        className="absolute inset-0 rounded-lg bg-white/10"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.button>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* ── Frequency Question ── */}
      {question.type === "frequency" && question.options && (
        <div className="space-y-2">
          {question.options.map((option, index) => {
            const isSelected = selectedValue === option;
            return (
              <motion.button
                key={index}
                onClick={() => setSelectedValue(option)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left text-sm transition-all duration-200 ${
                  isSelected
                    ? "bg-pink-500/15 text-pink-300 border border-pink-500/30 ring-1 ring-pink-500/20"
                    : "bg-white/[0.03] text-slate-300 border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1]"
                }`}
              >
                {/* Radio indicator */}
                <div
                  className={`flex-shrink-0 h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                    isSelected
                      ? "border-pink-400 bg-pink-400"
                      : "border-slate-600"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-full w-full rounded-full flex items-center justify-center"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </motion.div>
                  )}
                </div>
                <span className="font-medium">{option}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ── Text Question ── */}
      {question.type === "text" && (
        <div className="space-y-2">
          <textarea
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              setSelectedValue(e.target.value);
            }}
            placeholder="Share your thoughts..."
            rows={4}
            className="w-full p-4 rounded-xl bg-white/[0.03] text-white text-sm placeholder-slate-500 border border-white/[0.06] focus:border-pink-500/40 focus:outline-none focus:ring-2 focus:ring-pink-500/10 resize-none transition-colors"
          />
          <div className="flex justify-end">
            <span className="text-[10px] text-slate-600">
              {textInput.length} / 500
            </span>
          </div>
        </div>
      )}

      {/* ── Optional context for scale / frequency ── */}
      {(question.type === "scale" || question.type === "frequency") && (
        <div className="relative">
          <MessageSquare className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-slate-600" />
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Add context (optional)..."
            rows={2}
            className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.02] text-white text-sm placeholder-slate-600 border border-white/[0.04] focus:border-pink-500/30 focus:outline-none focus:ring-1 focus:ring-pink-500/10 resize-none transition-colors"
          />
        </div>
      )}

      {/* ── Submit ── */}
      <motion.button
        onClick={handleSubmit}
        disabled={selectedValue === null}
        whileHover={selectedValue !== null ? { scale: 1.01, y: -1 } : {}}
        whileTap={selectedValue !== null ? { scale: 0.98 } : {}}
        className={`w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all duration-200 ${
          selectedValue !== null
            ? "bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30"
            : "bg-white/[0.04] text-slate-600 cursor-not-allowed border border-white/[0.04]"
        }`}
      >
        <Send className="h-3.5 w-3.5" />
        Continue
      </motion.button>
    </motion.div>
  );
}
