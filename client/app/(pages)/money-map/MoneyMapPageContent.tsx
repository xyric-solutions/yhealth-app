"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Wallet,
  Target,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ArrowUpRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { api } from "@/lib/api-client";
import { FinanceFAB } from "./components/FinanceFAB";
import { ReceiptScanModal } from "./components/ReceiptScanModal";
import { StatementScanModal } from "./components/StatementScanModal";
import {
  OverviewSkeleton,
  TransactionsSkeleton,
  AnalyticsSkeleton,
  BudgetsSkeleton,
  GoalsSkeleton,
} from "./components/FinanceSkeletons";
import type {
  TransactionSummary,
  MonthlySummary,
  CategoryBreakdownItem,
  SpendingTrend,
  FinanceTransaction,
  FinanceBudget,
  FinanceSavingGoal,
  FinanceAIInsight,
  BudgetAlert,
} from "@shared/types/domain/finance";
import { OverviewSection } from "./components/OverviewSection";
import { TransactionsSection } from "./components/TransactionsSection";
import { AnalyticsSection } from "./components/AnalyticsSection";
import { BudgetsSection } from "./components/BudgetsSection";
import { GoalsSection } from "./components/GoalsSection";

type MoneyMapTab = "overview" | "transactions" | "analytics" | "budgets" | "goals" | "insights";

const tabs: { id: MoneyMapTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "transactions", label: "Transactions", icon: <Receipt className="w-4 h-4" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "budgets", label: "Budgets", icon: <Wallet className="w-4 h-4" /> },
  { id: "goals", label: "Goals", icon: <Target className="w-4 h-4" /> },
  { id: "insights", label: "AI Insights", icon: <Sparkles className="w-4 h-4" /> },
];

export default function MoneyMapPageContent() {
  const [activeTab, setActiveTab] = useState<MoneyMapTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [showReceiptScan, setShowReceiptScan] = useState(false);
  const [showStatementScan, setShowStatementScan] = useState(false);

  // Data state
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [goals, setGoals] = useState<FinanceSavingGoal[]>([]);
  const [insights, setInsights] = useState<FinanceAIInsight[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [comparison, setComparison] = useState<{ current: MonthlySummary; previous: MonthlySummary } | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get<TransactionSummary>("/finance/transactions/summary"),
        api.get<MonthlySummary>("/finance/analytics/monthly"),
        api.get<CategoryBreakdownItem[]>("/finance/analytics/categories"),
        api.get<SpendingTrend[]>("/finance/analytics/trends"),
        api.get<{ transactions: FinanceTransaction[]; total: number }>("/finance/transactions", { params: { limit: 50 } }),
        api.get<FinanceBudget[]>("/finance/budgets"),
        api.get<FinanceSavingGoal[]>("/finance/goals"),
        api.get<FinanceAIInsight[]>("/finance/ai/insights"),
        api.get<BudgetAlert[]>("/finance/budgets/alerts"),
        api.get<{ current: MonthlySummary; previous: MonthlySummary }>("/finance/analytics/comparison"),
      ]);

      if (results[0].status === "fulfilled" && results[0].value.data) setSummary(results[0].value.data);
      if (results[1].status === "fulfilled" && results[1].value.data) setMonthlySummary(results[1].value.data);
      if (results[2].status === "fulfilled" && results[2].value.data) setCategoryBreakdown(results[2].value.data);
      if (results[3].status === "fulfilled" && results[3].value.data) setTrends(results[3].value.data);
      if (results[4].status === "fulfilled" && results[4].value.data) {
        const txData = results[4].value.data as any;
        setTransactions(txData.transactions || []);
        setTransactionTotal(txData.total || 0);
      }
      if (results[5].status === "fulfilled" && results[5].value.data) setBudgets(results[5].value.data);
      if (results[6].status === "fulfilled" && results[6].value.data) setGoals(results[6].value.data);
      if (results[7].status === "fulfilled" && results[7].value.data) setInsights(results[7].value.data);
      if (results[8].status === "fulfilled" && results[8].value.data) setBudgetAlerts(results[8].value.data);
      if (results[9].status === "fulfilled" && results[9].value.data) setComparison(results[9].value.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDismissInsight = useCallback(async (id: string) => {
    await api.post(`/finance/ai/insights/${id}/dismiss`);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const renderContent = () => {
    if (isLoading) {
      switch (activeTab) {
        case "overview": return <OverviewSkeleton />;
        case "transactions": return <TransactionsSkeleton />;
        case "analytics": return <AnalyticsSkeleton />;
        case "budgets": return <BudgetsSkeleton />;
        case "goals": return <GoalsSkeleton />;
        default: return <OverviewSkeleton />;
      }
    }

    switch (activeTab) {
      case "overview":
        return (
          <OverviewSection
            summary={summary}
            monthlySummary={monthlySummary}
            budgetAlerts={budgetAlerts}
            recentTransactions={transactions}
            budgets={budgets}
            goals={goals}
            categoryBreakdown={categoryBreakdown}
            trends={trends}
            insights={insights}
            comparison={comparison}
            onDismissInsight={handleDismissInsight}
            onViewAllTransactions={() => setActiveTab("transactions")}
          />
        );
      case "transactions":
        return (
          <TransactionsSection
            transactions={transactions}
            total={transactionTotal}
            onRefresh={fetchData}
          />
        );
      case "analytics":
        return (
          <AnalyticsSection
            categoryBreakdown={categoryBreakdown}
            trends={trends}
            comparison={comparison}
            budgetAlerts={budgetAlerts}
            transactions={transactions}
            totalExpense={summary?.totalExpense || 0}
            totalIncome={summary?.totalIncome || 0}
            savingsRate={summary && summary.totalIncome > 0 ? Math.round(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100) : 0}
            financeScore={Math.min(100, Math.round(
              ((summary && summary.totalIncome > 0 && summary.totalIncome > summary.totalExpense) ? 40 : 0) +
              (budgetAlerts.length === 0 ? 25 : Math.max(0, 25 - budgetAlerts.length * 8)) +
              (goals.length > 0 ? 15 : 0) + 20
            ))}
          />
        );
      case "budgets":
        return <BudgetsSection budgets={budgets} onRefresh={fetchData} />;
      case "goals":
        return <GoalsSection goals={goals} onRefresh={fetchData} />;
      case "insights":
        return <InsightsView insights={insights} onDismiss={handleDismissInsight} />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-syne)]">
            Money Map
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Smart finance tracking & AI-powered insights
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500/15 text-emerald-400 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <FinanceFAB
        onAddExpense={() => setActiveTab("transactions")}
        onAddIncome={() => setActiveTab("transactions")}
        onScanReceipt={() => setShowReceiptScan(true)}
        onScanStatement={() => setShowStatementScan(true)}
      />

      <ReceiptScanModal
        isOpen={showReceiptScan}
        onClose={() => setShowReceiptScan(false)}
        onAddTransaction={async (data) => {
          try {
            await api.post("/finance/transactions", {
              amount: data.amount,
              transactionType: "expense",
              category: data.category,
              title: data.title,
              transactionDate: data.transactionDate,
            });
            fetchData();
          } catch { /* silent */ }
        }}
      />

      <StatementScanModal
        isOpen={showStatementScan}
        onClose={() => setShowStatementScan(false)}
        onImport={() => fetchData()}
      />
    </DashboardLayout>
  );
}

// ============================================
// AI INSIGHTS + CHAT VIEW
// ============================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/** Convert markdown in AI responses to styled HTML */
function formatAIMessage(content: string): string {
  let html = content
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    // Italic: *text*
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="text-emerald-300/80">$1</em>')
    // Numbered lists: 1. text
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="flex gap-2 items-start ml-1"><span class="text-emerald-400 font-mono text-xs mt-0.5 shrink-0">$1.</span><span>$2</span></li>')
    // Bullet lists: - text
    .replace(/^[-•]\s+(.+)$/gm, '<li class="flex gap-2 items-start ml-1"><span class="text-emerald-400 mt-1 shrink-0">•</span><span>$1</span></li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul class="space-y-1.5 my-2">$1</ul>')
    // Dollar amounts: $123.45 or $1,234
    .replace(/\$[\d,]+\.?\d*/g, '<span class="text-emerald-400 font-mono font-semibold">$&</span>')
    // Percentages: 85%
    .replace(/(\d+\.?\d*)%/g, '<span class="text-amber-400 font-mono font-semibold">$1%</span>')
    // Paragraphs: double newline
    .replace(/\n\n/g, '</p><p class="mt-3">')
    // Single newlines within paragraphs
    .replace(/\n/g, "<br />");

  return `<p>${html}</p>`;
}

const QUICK_PROMPTS = [
  { emoji: "📊", text: "How am I doing this month?" },
  { emoji: "💡", text: "How can I save more?" },
  { emoji: "🔍", text: "Where am I spending the most?" },
  { emoji: "🎯", text: "Am I on track with my budget?" },
  { emoji: "📈", text: "Predict my end-of-month spending" },
  { emoji: "✂️", text: "What expenses can I cut?" },
];

function InsightsView({ insights, onDismiss }: {
  insights: FinanceAIInsight[];
  onDismiss: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await api.post<{ reply: string }>("/finance/ai/coach", { message: text.trim() });
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.data?.reply || "I couldn't generate a response. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

      {/* LEFT: AI Chat (3 cols) */}
      <div className="lg:col-span-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex flex-col" style={{ minHeight: "520px", maxHeight: "600px" }}>

        {/* Chat Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center"
          >
            <Sparkles className="w-4.5 h-4.5 text-violet-400" />
          </motion.div>
          <div>
            <h3 className="text-sm font-semibold text-white">Finance AI Coach</h3>
            <p className="text-[10px] text-slate-500">Ask anything about your finances</p>
          </div>
          {isLoading && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="ml-auto text-[10px] text-violet-400 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Thinking...
            </motion.div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4"
              >
                <Sparkles className="w-8 h-8 text-violet-400/60" />
              </motion.div>
              <p className="text-sm text-slate-300 font-medium mb-1">Ask me anything about your finances</p>
              <p className="text-xs text-slate-500 mb-5 max-w-xs">I can analyze your spending, suggest savings, forecast expenses, and help you plan budgets.</p>

              {/* Quick Prompts */}
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {QUICK_PROMPTS.map((prompt) => (
                  <motion.button
                    key={prompt.text}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(prompt.text)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:border-violet-500/30 hover:bg-violet-500/5 transition-all min-h-[44px]"
                  >
                    <span>{prompt.emoji}</span> {prompt.text}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-emerald-500/15 border border-emerald-500/20 text-white"
                      : "bg-white/[0.04] border border-white/[0.06] text-slate-300"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div
                        className="text-sm leading-relaxed prose-finance"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatAIMessage(msg.content)) }}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <p className={`text-[9px] mt-1.5 ${msg.role === "user" ? "text-emerald-400/40" : "text-slate-600"}`}>
                      {msg.timestamp.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-2">
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-violet-400" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-violet-400" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-violet-400" />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 py-3 border-t border-white/[0.05]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              disabled={isLoading}
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 disabled:opacity-50 transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 hover:bg-violet-500/25 disabled:opacity-30 transition-all"
            >
              <ArrowUpRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* RIGHT: Insights Cards (2 cols) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white">Active Insights</h3>
          {insights.length > 0 && (
            <span className="text-[10px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded-full font-mono">{insights.length}</span>
          )}
        </div>

        {insights.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-8 text-center">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-xs text-slate-400">No active insights</p>
            <p className="text-[10px] text-slate-600 mt-1">Insights are auto-generated based on your spending patterns</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, i) => {
              const typeConfig: Record<string, { color: string; bg: string }> = {
                pattern: { color: "text-violet-400", bg: "bg-violet-500/[0.06] border-violet-500/15" },
                alert: { color: "text-rose-400", bg: "bg-rose-500/[0.06] border-rose-500/15" },
                suggestion: { color: "text-emerald-400", bg: "bg-emerald-500/[0.06] border-emerald-500/15" },
                forecast: { color: "text-sky-400", bg: "bg-sky-500/[0.06] border-sky-500/15" },
              };
              const cfg = typeConfig[insight.insightType] || typeConfig.suggestion;

              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`rounded-xl border p-4 ${cfg.bg}`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                      {insight.insightType}
                    </span>
                    <button
                      onClick={() => onDismiss(insight.id)}
                      className="p-0.5 text-slate-600 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="text-xs font-semibold text-white mb-1">{insight.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{insight.body}</p>
                  {insight.savingsPotential && insight.savingsPotential > 0 && (
                    <div className="mt-2 text-[11px] text-emerald-400 font-medium font-mono">
                      Save ${insight.savingsPotential.toFixed(2)}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Quick Prompt Buttons (for when chat is already started) */}
        {messages.length > 0 && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Quick Ask</p>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.slice(0, 4).map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => sendMessage(prompt.text)}
                  disabled={isLoading}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 transition-all min-h-[44px]"
                >
                  <span>{prompt.emoji}</span> {prompt.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
