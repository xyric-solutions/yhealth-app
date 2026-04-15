"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Plus, ArrowDownRight, ArrowUpRight, Camera, X, FileSpreadsheet } from "lucide-react";
import { spring } from "../lib/motion";

const fabVariants: Variants = {
  closed: { rotate: 0 },
  open: { rotate: 45, transition: spring.snappy },
};

const optionVariants: Variants = {
  hidden: { opacity: 0, scale: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...spring.bouncy, delay: i * 0.06 },
  }),
  exit: { opacity: 0, scale: 0, y: 10, transition: { duration: 0.15 } },
};

interface FinanceFABProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
  onScanReceipt: () => void;
  onScanStatement?: () => void;
}

export function FinanceFAB({ onAddExpense, onAddIncome, onScanReceipt, onScanStatement }: FinanceFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    { label: "Add Expense", icon: <ArrowDownRight className="w-4 h-4" />, color: "bg-rose-500/15 text-rose-400 border-rose-500/20", action: onAddExpense, badge: "" },
    { label: "Add Income", icon: <ArrowUpRight className="w-4 h-4" />, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", action: onAddIncome, badge: "" },
    { label: "Scan Receipt", icon: <Camera className="w-4 h-4" />, color: "bg-sky-500/15 text-sky-400 border-sky-500/20", action: onScanReceipt, badge: "AI" },
    { label: "Bank Statement", icon: <FileSpreadsheet className="w-4 h-4" />, color: "bg-violet-500/15 text-violet-400 border-violet-500/20", action: onScanStatement || (() => {}), badge: "AI" },
  ];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Speed Dial Options */}
      <div className="fixed bottom-28 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && options.map((opt, i) => (
            <motion.button
              key={opt.label}
              custom={options.length - 1 - i}
              variants={optionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => { opt.action(); setIsOpen(false); }}
              className={`flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-xl border backdrop-blur-md shadow-lg min-h-[44px] ${opt.color}`}
            >
              {opt.icon}
              <span className="text-sm font-medium whitespace-nowrap">{opt.label}</span>
              {opt.badge && (
                <span className="text-[9px] bg-white/10 text-current px-1.5 py-0.5 rounded-full">{opt.badge}</span>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        variants={fabVariants}
        animate={isOpen ? "open" : "closed"}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-16 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </>
  );
}
