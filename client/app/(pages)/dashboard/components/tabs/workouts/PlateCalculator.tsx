"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, RotateCcw } from "lucide-react";

interface PlateCalculatorProps {
  targetWeight: number;
  unit: "kg" | "lbs";
  barWeight?: number;
  onWeightChange: (weight: number) => void;
}

interface PlateDefinition {
  weight: number;
  color: string;
  textColor: string;
  height: number; // visual height in px
}

const PLATES_KG: PlateDefinition[] = [
  { weight: 25, color: "bg-red-500", textColor: "text-white", height: 64 },
  { weight: 20, color: "bg-blue-500", textColor: "text-white", height: 60 },
  { weight: 15, color: "bg-amber-400", textColor: "text-slate-900", height: 54 },
  { weight: 10, color: "bg-emerald-500", textColor: "text-white", height: 48 },
  { weight: 5, color: "bg-white", textColor: "text-slate-900", height: 40 },
  { weight: 2.5, color: "bg-red-300", textColor: "text-slate-900", height: 34 },
  { weight: 1.25, color: "bg-slate-400", textColor: "text-white", height: 28 },
];

const PLATES_LBS: PlateDefinition[] = [
  { weight: 45, color: "bg-red-500", textColor: "text-white", height: 64 },
  { weight: 35, color: "bg-blue-500", textColor: "text-white", height: 58 },
  { weight: 25, color: "bg-emerald-500", textColor: "text-white", height: 50 },
  { weight: 10, color: "bg-amber-400", textColor: "text-slate-900", height: 42 },
  { weight: 5, color: "bg-white", textColor: "text-slate-900", height: 36 },
  { weight: 2.5, color: "bg-slate-400", textColor: "text-white", height: 30 },
];

const BAR_OPTIONS_KG = [
  { label: "Standard", weight: 20 },
  { label: "Women's", weight: 15 },
  { label: "EZ Bar", weight: 10 },
];

const BAR_OPTIONS_LBS = [
  { label: "Standard", weight: 45 },
  { label: "Women's", weight: 35 },
  { label: "EZ Bar", weight: 25 },
];

function calculatePlatesPerSide(
  targetWeight: number,
  barWeight: number,
  plates: PlateDefinition[]
): PlateDefinition[] {
  const weightPerSide = (targetWeight - barWeight) / 2;
  if (weightPerSide <= 0) return [];

  const result: PlateDefinition[] = [];
  let remaining = weightPerSide;

  for (const plate of plates) {
    while (remaining >= plate.weight - 0.001) {
      result.push(plate);
      remaining -= plate.weight;
    }
  }

  return result;
}

function BarbellDiagram({ platesPerSide }: { platesPerSide: PlateDefinition[] }) {
  const reversed = [...platesPerSide].reverse();

  return (
    <div className="flex items-center justify-center gap-0 py-4 overflow-x-auto">
      {/* Left collar */}
      <div className="w-3 h-5 bg-slate-500 rounded-l-sm flex-shrink-0" />

      {/* Left plates (reversed for visual stacking) */}
      <div className="flex items-center gap-[2px] flex-shrink-0">
        {reversed.map((plate, i) => (
          <motion.div
            key={`left-${i}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`${plate.color} rounded-sm flex items-center justify-center flex-shrink-0`}
            style={{ width: 14, height: plate.height }}
          >
            <span className={`${plate.textColor} text-[7px] font-bold rotate-90 whitespace-nowrap`}>
              {plate.weight}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Bar */}
      <div className="h-3 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-400 rounded-sm flex-shrink-0" style={{ width: 80 }}>
        <div className="h-full flex items-center justify-center">
          <span className="text-[8px] font-bold text-slate-700">BAR</span>
        </div>
      </div>

      {/* Right plates */}
      <div className="flex items-center gap-[2px] flex-shrink-0">
        {platesPerSide.map((plate, i) => (
          <motion.div
            key={`right-${i}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`${plate.color} rounded-sm flex items-center justify-center flex-shrink-0`}
            style={{ width: 14, height: plate.height }}
          >
            <span className={`${plate.textColor} text-[7px] font-bold rotate-90 whitespace-nowrap`}>
              {plate.weight}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Right collar */}
      <div className="w-3 h-5 bg-slate-500 rounded-r-sm flex-shrink-0" />
    </div>
  );
}

export function PlateCalculator({
  targetWeight,
  unit,
  barWeight: initialBarWeight,
  onWeightChange,
}: PlateCalculatorProps) {
  const plates = unit === "kg" ? PLATES_KG : PLATES_LBS;
  const barOptions = unit === "kg" ? BAR_OPTIONS_KG : BAR_OPTIONS_LBS;
  const defaultBarWeight = barOptions[0].weight;
  const [barWeight, setBarWeight] = useState(initialBarWeight || defaultBarWeight);

  const platesPerSide = useMemo(
    () => calculatePlatesPerSide(targetWeight, barWeight, plates),
    [targetWeight, barWeight, plates]
  );

  const actualWeight = useMemo(() => {
    const plateWeight = platesPerSide.reduce((sum, p) => sum + p.weight, 0) * 2;
    return barWeight + plateWeight;
  }, [platesPerSide, barWeight]);

  const weightPerSide = platesPerSide.reduce((sum, p) => sum + p.weight, 0);
  const quickAdds = unit === "kg" ? [2.5, 5, 10, 20] : [5, 10, 25, 45];

  return (
    <div className="space-y-4">
      {/* Weight Input Row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onWeightChange(Math.max(0, targetWeight - (unit === "kg" ? 2.5 : 5)))}
          className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-orange-500/30 transition-all"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
          <input
            type="number"
            value={targetWeight || ""}
            onChange={(e) => onWeightChange(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full text-center text-2xl font-bold text-white bg-slate-900 border border-slate-700 rounded-xl py-2 px-4 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">
            {unit}
          </span>
        </div>
        <button
          onClick={() => onWeightChange(targetWeight + (unit === "kg" ? 2.5 : 5))}
          className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-orange-500/30 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex items-center gap-2 justify-center">
        {quickAdds.map((amount) => (
          <button
            key={amount}
            onClick={() => onWeightChange(targetWeight + amount)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-xs font-medium text-slate-400 hover:text-orange-400 hover:border-orange-500/30 transition-all"
          >
            +{amount}
          </button>
        ))}
        <button
          onClick={() => onWeightChange(barWeight)}
          className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-xs font-medium text-slate-500 hover:text-white transition-all"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Bar Type Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 flex-shrink-0">Bar:</span>
        <div className="flex gap-1.5">
          {barOptions.map((opt) => (
            <button
              key={opt.weight}
              onClick={() => setBarWeight(opt.weight)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                barWeight === opt.weight
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-slate-800/60 text-slate-500 border border-transparent hover:text-white"
              }`}
            >
              {opt.label} ({opt.weight}{unit})
            </button>
          ))}
        </div>
      </div>

      {/* Barbell Diagram */}
      {platesPerSide.length > 0 && (
        <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3">
          <BarbellDiagram platesPerSide={platesPerSide} />
        </div>
      )}

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-lg font-bold text-white">{barWeight}<span className="text-xs text-slate-500 ml-0.5">{unit}</span></p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Bar</p>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-lg font-bold text-orange-400">{weightPerSide}<span className="text-xs text-slate-500 ml-0.5">{unit}</span></p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Each Side</p>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-lg font-bold text-emerald-400">{actualWeight}<span className="text-xs text-slate-500 ml-0.5">{unit}</span></p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
        </div>
      </div>

      {/* Plate List */}
      {platesPerSide.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Per side:</span>
          {platesPerSide.map((plate, i) => (
            <span
              key={i}
              className={`${plate.color} ${plate.textColor} px-2 py-0.5 rounded text-[10px] font-bold`}
            >
              {plate.weight}{unit}
            </span>
          ))}
        </div>
      )}

      {targetWeight > 0 && actualWeight !== targetWeight && (
        <p className="text-[11px] text-amber-400/80 text-center">
          Closest loadable weight: {actualWeight}{unit} (target: {targetWeight}{unit})
        </p>
      )}
    </div>
  );
}
