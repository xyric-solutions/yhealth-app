"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Check, X, Tag } from "lucide-react";
import type { NutritionLabelData } from "./types";

interface NutritionLabelResultProps {
  data: NutritionLabelData;
  onAddToMeal: (data: NutritionLabelData, servings: number) => void;
  onDismiss: () => void;
}

export default function NutritionLabelResult({
  data,
  onAddToMeal,
  onDismiss,
}: NutritionLabelResultProps) {
  const [servings, setServings] = useState(1);

  const multiply = (val: number | null) =>
    val !== null ? Math.round(val * servings * 10) / 10 : null;

  const n = data.nutrients;

  const rows: Array<{ label: string; value: number | null; unit: string; bold?: boolean; indent?: boolean }> = [
    { label: "Calories", value: multiply(n.calories), unit: "kcal", bold: true },
    { label: "Total Fat", value: multiply(n.totalFat), unit: "g", bold: true },
    { label: "Saturated Fat", value: multiply(n.saturatedFat), unit: "g", indent: true },
    { label: "Trans Fat", value: multiply(n.transFat), unit: "g", indent: true },
    { label: "Cholesterol", value: multiply(n.cholesterol), unit: "mg", bold: true },
    { label: "Sodium", value: multiply(n.sodium), unit: "mg", bold: true },
    { label: "Total Carbs", value: multiply(n.totalCarbs), unit: "g", bold: true },
    { label: "Dietary Fiber", value: multiply(n.dietaryFiber), unit: "g", indent: true },
    { label: "Total Sugars", value: multiply(n.totalSugars), unit: "g", indent: true },
    { label: "Protein", value: multiply(n.protein), unit: "g", bold: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-slate-800/80 border border-emerald-500/30 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">
            Nutrition Label Scanned
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Product name & serving */}
        {data.productName && (
          <p className="text-white font-medium text-sm">{data.productName}</p>
        )}
        {data.servingSize && (
          <p className="text-slate-400 text-xs">
            Serving size: {data.servingSize}
            {data.servingsPerContainer
              ? ` · ${data.servingsPerContainer} servings/container`
              : ""}
          </p>
        )}

        {/* Serving multiplier */}
        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-300">Servings</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings((s) => Math.max(0.5, s - 0.5))}
              className="w-7 h-7 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors"
            >
              <Minus className="w-3.5 h-3.5 text-white" />
            </button>
            <span className="text-white font-semibold text-sm min-w-[2.5rem] text-center">
              {servings}x
            </span>
            <button
              onClick={() => setServings((s) => s + 0.5)}
              className="w-7 h-7 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Nutrition facts table */}
        <div className="border border-slate-600 rounded-lg overflow-hidden">
          <div className="bg-slate-700/50 px-3 py-1.5">
            <span className="text-xs font-semibold text-slate-300">
              Nutrition Facts{servings !== 1 ? ` (×${servings})` : ""}
            </span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {rows.map(
              (row) =>
                row.value !== null && (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between px-3 py-1.5 ${
                      row.indent ? "pl-6" : ""
                    }`}
                  >
                    <span
                      className={`text-xs ${
                        row.bold
                          ? "font-semibold text-slate-200"
                          : "text-slate-400"
                      }`}
                    >
                      {row.label}
                    </span>
                    <span
                      className={`text-xs ${
                        row.bold
                          ? "font-semibold text-white"
                          : "text-slate-300"
                      }`}
                    >
                      {row.value}
                      {row.unit}
                    </span>
                  </div>
                )
            )}
          </div>
        </div>

        {/* Add to Meal button */}
        <button
          onClick={() => onAddToMeal(data, servings)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all text-sm"
        >
          <Check className="w-4 h-4" />
          Add to Meal ({servings} serving{servings !== 1 ? "s" : ""})
        </button>
      </div>
    </motion.div>
  );
}
