"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Upload, X, Loader2, CheckCircle2, AlertCircle,
  FileText, Sparkles, Receipt, ImageIcon, RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  FINANCE_CATEGORY_ICONS,
  FINANCE_CATEGORY_LABELS,
} from "@shared/types/domain/finance";
import type { FinanceCategory } from "@shared/types/domain/finance";
import { spring } from "../lib/motion";

interface ExtractedReceipt {
  vendor: string;
  date: string;
  total: number;
  currency: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  category: FinanceCategory;
  paymentMethod: string;
  taxAmount: number | null;
  confidence: number;
  error?: string;
  message?: string;
}

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (data: { amount: number; title: string; category: FinanceCategory; transactionDate: string }) => void;
}

type ScanState = "upload" | "scanning" | "result" | "error";

export function ReceiptScanModal({ isOpen, onClose, onAddTransaction }: ReceiptScanModalProps) {
  const [state, setState] = useState<ScanState>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ExtractedReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState("upload");
    setImagePreview(null);
    setReceipt(null);
    setErrorMessage("");
    setIsDragging(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processImage = useCallback(async (base64: string) => {
    setState("scanning");
    try {
      const res = await api.post<{ receipt: ExtractedReceipt }>("/finance/receipts/scan", {
        imageBase64: base64,
      });

      if (res.success && res.data?.receipt) {
        const r = res.data.receipt;
        if (r.error) {
          setErrorMessage(r.message || "Could not read receipt");
          setState("error");
        } else {
          setReceipt(r);
          setState("result");
        }
      } else {
        setErrorMessage("Failed to scan receipt");
        setState("error");
      }
    } catch {
      setErrorMessage("Failed to connect to scanner. Please try again.");
      setState("error");
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);
      processImage(base64);
    };
    reader.readAsDataURL(file);
  }, [processImage]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleAddTransaction = () => {
    if (!receipt) return;
    onAddTransaction({
      amount: receipt.total,
      title: receipt.vendor || "Receipt purchase",
      category: receipt.category as FinanceCategory || "other",
      transactionDate: receipt.date || new Date().toISOString().split("T")[0],
    });
    handleClose();
  };

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
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0a101f] border border-white/[0.08] shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/[0.06] bg-[#0a101f]/95 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15">
                <Receipt className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Scan Receipt</h3>
                <p className="text-xs text-slate-500">AI-powered receipt extraction</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5">
            {/* Upload State */}
            {state === "upload" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Drag & Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-sky-400 bg-sky-500/5 scale-[1.02]"
                      : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <motion.div
                    animate={isDragging ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/15 flex items-center justify-center">
                      <Upload className="w-7 h-7 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {isDragging ? "Drop your receipt here" : "Drag & drop receipt image"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">or click to browse files</p>
                    </div>
                  </motion.div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>

                {/* Camera Button */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/15 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo with Camera
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />

                {/* Tip */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-400/80 leading-relaxed">
                    For best results, ensure the receipt is flat, well-lit, and the text is clearly visible.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Scanning State */}
            {state === "scanning" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 flex flex-col items-center gap-5"
              >
                {imagePreview && (
                  <div className="w-40 h-48 rounded-xl overflow-hidden border border-white/[0.06] relative">
                    <img src={imagePreview} alt="Receipt" className="w-full h-full object-cover" />
                    {/* Scan line animation */}
                    <motion.div
                      animate={{ y: ["-100%", "200%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent"
                    />
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-8 w-8 text-sky-400" />
                  </motion.div>
                  <p className="text-sm font-medium text-white">Analyzing receipt...</p>
                  <p className="text-xs text-slate-500">Extracting items, amounts & category</p>
                </div>
              </motion.div>
            )}

            {/* Result State */}
            {state === "result" && receipt && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Confidence Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">Receipt extracted</span>
                  </div>
                  <span className="text-[10px] text-slate-500 px-2 py-1 rounded-full bg-white/[0.04]">
                    {receipt.confidence}% confidence
                  </span>
                </div>

                {/* Extracted Data */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                  {/* Vendor & Total */}
                  <div className="p-4 border-b border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">Vendor</p>
                        <p className="text-lg font-semibold text-white">{receipt.vendor || "Unknown"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-2xl font-bold text-emerald-400 font-mono">
                          ${receipt.total?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Category & Date */}
                  <div className="p-4 flex items-center gap-3 border-b border-white/[0.04]">
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Category</p>
                      <p className="text-sm text-white mt-0.5">
                        {FINANCE_CATEGORY_ICONS[receipt.category as FinanceCategory] || "📋"}{" "}
                        {FINANCE_CATEGORY_LABELS[receipt.category as FinanceCategory] || receipt.category}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Date</p>
                      <p className="text-sm text-white mt-0.5">{receipt.date || "Today"}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Payment</p>
                      <p className="text-sm text-white mt-0.5 capitalize">{receipt.paymentMethod || "Unknown"}</p>
                    </div>
                  </div>

                  {/* Items */}
                  {receipt.items && receipt.items.length > 0 && (
                    <div className="p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                        Items ({receipt.items.length})
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {receipt.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 truncate flex-1">
                              {item.quantity > 1 && <span className="text-slate-500">{item.quantity}x </span>}
                              {item.name}
                            </span>
                            <span className="text-white font-mono ml-3">${item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {receipt.taxAmount != null && receipt.taxAmount > 0 && (
                        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-white/[0.04]">
                          <span className="text-slate-500">Tax</span>
                          <span className="text-slate-400 font-mono">${receipt.taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={reset}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Scan Another
                  </button>
                  <button
                    onClick={handleAddTransaction}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Add as Expense
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error State */}
            {state === "error" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 flex flex-col items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-rose-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Couldn't read receipt</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">{errorMessage}</p>
                </div>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
