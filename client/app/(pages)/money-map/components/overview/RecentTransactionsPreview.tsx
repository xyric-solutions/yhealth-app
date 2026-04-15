"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Receipt } from "lucide-react";
import type { FinanceTransaction } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";
import {
  formatCurrency,
  staggerContainer,
  fadeSlideUp,
} from "../../lib/motion";

interface RecentTransactionsPreviewProps {
  transactions: FinanceTransaction[];
  onViewAll: () => void;
}

const emptyVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RecentTransactionsPreview({
  transactions,
  onViewAll,
}: RecentTransactionsPreviewProps) {
  const recent = transactions.slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-wide text-white/60 uppercase">
          Recent Transactions
        </h3>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {recent.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-1"
        >
          {recent.map((tx) => {
            const isIncome = tx.transactionType === "income";

            return (
              <motion.div
                key={tx.id}
                variants={fadeSlideUp}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                {/* Category emoji (animated) */}
                <motion.div
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-base"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {FINANCE_CATEGORY_ICONS[tx.category]}
                </motion.div>

                {/* Title + category */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/80">
                    {tx.title}
                  </p>
                  <p className="text-xs text-white/30">
                    {FINANCE_CATEGORY_LABELS[tx.category]}
                  </p>
                </div>

                {/* Date */}
                <span className="shrink-0 text-xs text-white/25">
                  {formatDate(tx.transactionDate)}
                </span>

                {/* Amount */}
                <span
                  className={`shrink-0 font-mono text-sm font-semibold ${
                    isIncome ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isIncome ? "+" : "-"}
                  {formatCurrency(tx.amount)}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div
          variants={emptyVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center justify-center py-10 text-center"
        >
          <Receipt className="mb-3 h-10 w-10 text-white/10" />
          <p className="text-sm text-white/30">No transactions yet</p>
          <p className="mt-1 text-xs text-white/20">
            Add your first transaction to get started
          </p>
        </motion.div>
      )}
    </div>
  );
}
