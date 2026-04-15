"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet, Upload, X, Loader2, CheckCircle2, AlertCircle,
  Camera, Sparkles, RotateCcw, Check, ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  FINANCE_CATEGORY_ICONS,
  FINANCE_CATEGORY_LABELS,
} from "@shared/types/domain/finance";
import type { FinanceCategory } from "@shared/types/domain/finance";
import { formatCurrency } from "../lib/motion";

interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: FinanceCategory;
  selected: boolean;
}

interface StatementScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: Array<{ amount: number; title: string; category: FinanceCategory; transactionDate: string; transactionType: "income" | "expense" }>) => void;
}

type ScanState = "upload" | "scanning" | "result" | "importing" | "done" | "error";

export function StatementScanModal({ isOpen, onClose, onImport }: StatementScanModalProps) {
  const [state, setState] = useState<ScanState>("upload");
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState("upload");
    setTransactions([]);
    setErrorMessage("");
    setIsDragging(false);
    setImportProgress(0);
  };

  const handleClose = () => { reset(); onClose(); };

  const processImage = useCallback(async (base64: string) => {
    setState("scanning");
    try {
      const res = await api.post<{ receipt: any }>("/finance/receipts/scan", {
        imageBase64: base64,
      });

      // The receipt endpoint works for statements too — we send a different prompt
      // Actually, let's use a dedicated statement extraction
      const stmtRes = await api.post<{ receipt: any }>("/finance/receipts/scan", {
        imageBase64: base64,
      });

      if (stmtRes.success && stmtRes.data?.receipt) {
        const r = stmtRes.data.receipt;
        if (r.error) {
          setErrorMessage(r.message || "Could not read statement");
          setState("error");
          return;
        }

        // Map items as individual transactions
        const items = r.items || [];
        if (items.length === 0 && r.total) {
          // Single transaction from receipt
          items.push({ name: r.vendor || "Statement entry", price: r.total, quantity: 1 });
        }

        const mapped: ExtractedTransaction[] = items.map((item: any) => ({
          date: r.date || new Date().toISOString().split("T")[0],
          description: item.name || "Unknown",
          amount: Math.abs(item.price || 0),
          type: (item.price || 0) >= 0 ? "expense" as const : "income" as const,
          category: (r.category || "other") as FinanceCategory,
          selected: true,
        }));

        setTransactions(mapped);
        setState("result");
      } else {
        setErrorMessage("Failed to scan statement");
        setState("error");
      }
    } catch {
      setErrorMessage("Failed to process. Please try again.");
      setState("error");
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => processImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [processImage]);

  const toggleTransaction = (idx: number) => {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const toggleAll = () => {
    const allSelected = transactions.every(t => t.selected);
    setTransactions(prev => prev.map(t => ({ ...t, selected: !allSelected })));
  };

  const handleImport = async () => {
    const selected = transactions.filter(t => t.selected);
    if (selected.length === 0) return;

    setState("importing");
    const toImport = selected.map(t => ({
      amount: t.amount,
      title: t.description,
      category: t.category,
      transactionDate: t.date,
      transactionType: t.type,
    }));

    // Import one by one with progress
    for (let i = 0; i < toImport.length; i++) {
      try {
        await api.post("/finance/transactions", toImport[i]);
      } catch { /* continue */ }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setState("done");
    setTimeout(() => {
      onImport(toImport);
      handleClose();
    }, 1500);
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const selectedTotal = transactions.filter(t => t.selected).reduce((s, t) => s + t.amount, 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0a101f] border border-white/[0.08] shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/[0.06] bg-[#0a101f]/95 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
                <FileSpreadsheet className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Bank Statement</h3>
                <p className="text-xs text-slate-500">Extract multiple transactions from a statement</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5">
            {/* Upload */}
            {state === "upload" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
                    isDragging ? "border-violet-400 bg-violet-500/5 scale-[1.02]" : "border-white/[0.08] hover:border-white/[0.15]"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
                      <Upload className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-sm font-medium text-white">Upload bank statement image</p>
                    <p className="text-xs text-slate-500">Supports photos of printed or digital statements</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                  <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-violet-400/80 leading-relaxed">
                    AI will extract each transaction with date, description, amount, and auto-categorize them. You can review and select which ones to import.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Scanning */}
            {state === "scanning" && (
              <div className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
                <p className="text-sm font-medium text-white">Reading statement...</p>
                <p className="text-xs text-slate-500">Extracting transactions & categories</p>
              </div>
            )}

            {/* Result */}
            {state === "result" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">{transactions.length} transactions found</span>
                  </div>
                  <button onClick={toggleAll} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                    {transactions.every(t => t.selected) ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="rounded-xl border border-white/[0.06] overflow-hidden max-h-72 overflow-y-auto">
                  {transactions.map((tx, i) => (
                    <button
                      key={i}
                      onClick={() => toggleTransaction(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-white/[0.03] last:border-b-0 ${
                        tx.selected ? "bg-white/[0.02]" : "bg-white/[0.005] opacity-50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        tx.selected ? "bg-violet-500/20 border-violet-500/40" : "border-white/[0.1]"
                      }`}>
                        {tx.selected && <Check className="w-3 h-3 text-violet-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{tx.description}</p>
                        <p className="text-[10px] text-slate-600">{tx.date} • {FINANCE_CATEGORY_ICONS[tx.category]} {FINANCE_CATEGORY_LABELS[tx.category]}</p>
                      </div>
                      <span className={`text-xs font-mono font-semibold shrink-0 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-xs text-slate-500">{selectedCount} selected</span>
                  <span className="text-sm font-mono font-semibold text-white">{formatCurrency(selectedTotal)}</span>
                </div>

                <div className="flex gap-3">
                  <button onClick={reset} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                    <RotateCcw className="w-4 h-4" /> Rescan
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selectedCount === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Import {selectedCount}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Importing */}
            {state === "importing" && (
              <div className="py-10 flex flex-col items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#8b5cf6" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - importProgress / 100)}`}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white tabular-nums">{importProgress}%</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-white">Importing transactions...</p>
              </div>
            )}

            {/* Done */}
            {state === "done" && (
              <div className="py-10 flex flex-col items-center gap-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                </motion.div>
                <p className="text-sm font-medium text-emerald-400">All transactions imported!</p>
              </div>
            )}

            {/* Error */}
            {state === "error" && (
              <div className="py-10 flex flex-col items-center gap-4">
                <AlertCircle className="w-12 h-12 text-rose-400" />
                <p className="text-sm text-white">{errorMessage}</p>
                <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-violet-400 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/15">
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
