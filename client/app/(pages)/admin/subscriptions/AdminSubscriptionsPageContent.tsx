'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Users,
  RefreshCw,
  Inbox,
  Sparkles,
  Download,
  DollarSign,
  TrendingUp,
  FileText,
  Settings,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/app/context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { RevenueMetricCard } from '@/components/admin/RevenueMetricCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  amount_cents: number;
  currency: string;
  interval: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  plan_name?: string;
  plan_slug?: string;
  plan_amount_cents?: number;
  plan_currency?: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
  invoice_url?: string | null;
}

const planFormDefault = {
  name: '',
  slug: '',
  description: '',
  amount_cents: '',
  currency: 'USD',
  interval: 'month' as 'month' | 'year',
  features: [] as string[],
  is_active: true,
  sort_order: '0',
};

export default function AdminSubscriptionsPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansTotal, setPlansTotal] = useState(0);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansPage, setPlansPage] = useState(1);
  const [plansActiveFilter, setPlansActiveFilter] = useState<boolean | undefined>(undefined);

  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsPage, setSubsPage] = useState(1);
  const [subsStatusFilter, setSubsStatusFilter] = useState('');
  const [subsPlanFilter, setSubsPlanFilter] = useState('');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(planFormDefault);
  const [planSaving, setPlanSaving] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);

  // Revenue analytics
  const [revenuePeriod, setRevenuePeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'lifetime'>('month');
  const [revenueStats, setRevenueStats] = useState<{
    total: number;
    period: string;
    breakdown: Array<{ date: string; revenue: number; subscriptions: number }>;
    byPlan: Array<{ planName: string; revenue: number; subscriptions: number }>;
  } | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Edit subscription
  const [editSubModalOpen, setEditSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<UserSubscription | null>(null);
  const [subForm, setSubForm] = useState({
    status: '',
    current_period_start: '',
    current_period_end: '',
    cancel_at_period_end: false,
  });
  const [subSaving, setSubSaving] = useState(false);

  // Invoice generation
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceSub, setInvoiceSub] = useState<UserSubscription | null>(null);
  const [invoiceData, setInvoiceData] = useState<{
    subscriptionId: string;
    invoiceNumber: string;
    date: string;
    customer: { name: string; email: string };
    plan: { name: string; amount: number; currency: string };
    period: { start: string | null; end: string | null };
    total: number;
  } | null>(null);
  const [, setInvoiceGenerating] = useState(false);

  // Revenue expectation
  const [expectationModalOpen, setExpectationModalOpen] = useState(false);
  const [revenueExpectations, setRevenueExpectations] = useState({
    week: 0,
    month: 0,
    quarter: 0,
    year: 0,
    lifetime: 0,
  });

  // Multiple selection
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const params = new URLSearchParams({ page: String(plansPage), limit: '20' });
      if (plansActiveFilter !== undefined) params.set('is_active', plansActiveFilter ? 'true' : 'false');
      const res = await api.get<{ plans: SubscriptionPlan[]; total: number }>(
        `/admin/subscriptions/plans?${params.toString()}`
      );
      const data = res.data as { plans: SubscriptionPlan[]; total: number } | undefined;
      setPlans(data?.plans ?? []);
      setPlansTotal(data?.total ?? res.meta?.total ?? 0);
    } catch {
      setPlans([]);
      setPlansTotal(0);
    } finally {
      setPlansLoading(false);
    }
  }, [plansPage, plansActiveFilter]);

  const fetchSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(subsPage), limit: '20' });
      if (subsStatusFilter) params.set('status', subsStatusFilter);
      if (subsPlanFilter) params.set('planId', subsPlanFilter);
      const res = await api.get<{ subscriptions: UserSubscription[]; total: number }>(
        `/admin/subscriptions/subscriptions?${params.toString()}`
      );
      const data = res.data as { subscriptions: UserSubscription[]; total: number } | undefined;
      setSubscriptions(data?.subscriptions ?? []);
      setSubsTotal(data?.total ?? res.meta?.total ?? 0);
    } catch {
      setSubscriptions([]);
      setSubsTotal(0);
    } finally {
      setSubsLoading(false);
    }
  }, [subsPage, subsStatusFilter, subsPlanFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const fetchRevenueStats = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await api.get<{
        total: number;
        period: string;
        breakdown: Array<{ date: string; revenue: number; subscriptions: number }>;
        byPlan: Array<{ planName: string; revenue: number; subscriptions: number }>;
      }>(`/admin/subscriptions/revenue?period=${revenuePeriod}`);
      if (res.success && res.data) {
        setRevenueStats(res.data);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load revenue stats');
    } finally {
      setRevenueLoading(false);
    }
  }, [revenuePeriod]);

  useEffect(() => {
    fetchRevenueStats();
  }, [fetchRevenueStats]);

  const openEditSubscription = (sub: UserSubscription) => {
    setEditingSub(sub);
    setSubForm({
      status: sub.status,
      current_period_start: sub.current_period_start ? format(new Date(sub.current_period_start), 'yyyy-MM-dd') : '',
      current_period_end: sub.current_period_end ? format(new Date(sub.current_period_end), 'yyyy-MM-dd') : '',
      cancel_at_period_end: sub.cancel_at_period_end,
    });
    setEditSubModalOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!editingSub) return;
    setSubSaving(true);
    try {
      await api.patch(`/admin/subscriptions/subscriptions/${editingSub.id}`, subForm);
      toast.success('Subscription updated');
      setEditSubModalOpen(false);
      fetchSubscriptions();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update subscription');
    } finally {
      setSubSaving(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSubscription = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/subscriptions/subscriptions/${deleteTargetId}`);
      toast.success('Subscription deleted');
      setSelectedSubscriptions((prev) => {
        const next = new Set(prev);
        next.delete(deleteTargetId);
        return next;
      });
      fetchSubscriptions();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete subscription');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedSubscriptions.size === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedSubscriptions.size === 0) return;
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedSubscriptions).map((id) =>
        api.delete(`/admin/subscriptions/subscriptions/${id}`).catch((err) => {
          console.error(`Failed to delete subscription ${id}:`, err);
          return null;
        })
      );
      await Promise.all(deletePromises);
      toast.success(`Deleted ${selectedSubscriptions.size} subscription(s)`);
      setSelectedSubscriptions(new Set());
      fetchSubscriptions();
    } catch (_err) {
      toast.error('Failed to delete some subscriptions');
    } finally {
      setIsDeleting(false);
      setBulkDeleteConfirmOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedSubscriptions.size === subscriptions.length) {
      setSelectedSubscriptions(new Set());
    } else {
      setSelectedSubscriptions(new Set(subscriptions.map((sub) => sub.id)));
    }
  };

  const handleSelectSubscription = (id: string) => {
    setSelectedSubscriptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    if (subscriptions.length === 0) {
      toast.error('No subscriptions to export');
      return;
    }

    const headers = [
      'User Name',
      'Email',
      'Plan Name',
      'Amount',
      'Currency',
      'Status',
      'Period Start',
      'Period End',
      'Cancel at Period End',
      'Created At',
    ];

    const rows = subscriptions.map((sub) => [
      displayName(sub),
      sub.user_email || '',
      sub.plan_name || sub.plan_slug || '',
      sub.plan_amount_cents ? (sub.plan_amount_cents / 100).toFixed(2) : '',
      (sub.plan_currency || 'USD').toUpperCase(),
      sub.status,
      sub.current_period_start ? format(new Date(sub.current_period_start), 'yyyy-MM-dd') : '',
      sub.current_period_end ? format(new Date(sub.current_period_end), 'yyyy-MM-dd') : '',
      sub.cancel_at_period_end ? 'Yes' : 'No',
      sub.created_at ? format(new Date(sub.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `subscriptions-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Subscriptions exported to CSV');
  };

  const handleGenerateInvoice = async (sub: UserSubscription) => {
    setInvoiceSub(sub);
    setInvoiceGenerating(true);
    try {
      const res = await api.post<{
        subscriptionId: string;
        invoiceNumber: string;
        date: string;
        customer: { name: string; email: string };
        plan: { name: string; amount: number; currency: string };
        period: { start: string | null; end: string | null };
        total: number;
      }>('/admin/subscriptions/invoice', { subscriptionId: sub.id });
      if (res.success && res.data) {
        setInvoiceData(res.data);
        setInvoiceModalOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to generate invoice');
    } finally {
      setInvoiceGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoiceData || !invoiceSub) return;

    // Dynamically import jsPDF
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Brand colors (typed as tuples for spread operator)
    const primaryColor: [number, number, number] = [16, 185, 129]; // emerald-500
    const secondaryColor: [number, number, number] = [59, 130, 246]; // blue-500
    const darkColor: [number, number, number] = [15, 23, 42]; // slate-900
    const lightColor: [number, number, number] = [241, 245, 249]; // slate-100
    const textColor: [number, number, number] = [51, 65, 85]; // slate-700
    
    let yPos = 0;

    // ============================================
    // HEADER WITH BRANDING
    // ============================================
    // Gradient header background (simulated with rectangle)
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Decorative accent line
    doc.setFillColor(...secondaryColor);
    doc.rect(0, 48, pageWidth, 2, 'F');
    
    // Company logo placeholder (circle with text)
    doc.setFillColor(255, 255, 255);
    doc.circle(25, 25, 12, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('yH', 25, 28, { align: 'center' });
    
    // Company name and tagline
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Balencia', 50, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Your Health, Your Future', 50, 28);
    
    // Contact info in header (right side)
    doc.setFontSize(8);
    doc.text('support@balencia.app', pageWidth - 20, 20, { align: 'right' });
    doc.text('www.balencia.app', pageWidth - 20, 26, { align: 'right' });
    doc.text('+1 (555) 123-4567', pageWidth - 20, 32, { align: 'right' });
    
    yPos = 60;

    // ============================================
    // INVOICE TITLE SECTION
    // ============================================
    doc.setTextColor(...darkColor);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    // Invoice number and date box
    doc.setFillColor(...lightColor);
    // Use regular rect if roundedRect is not available
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).roundedRect(20, yPos - 8, pageWidth - 40, 20, 3, 3, 'F');
    } catch {
      doc.rect(20, yPos - 8, pageWidth - 40, 20, 'F');
    }
    
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Invoice Number:', 25, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.invoiceNumber, 25, yPos + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Date:', pageWidth - 25, yPos, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(format(new Date(invoiceData.date), 'PP'), pageWidth - 25, yPos + 6, { align: 'right' });
    
    yPos += 25;

    // ============================================
    // BILL TO SECTION
    // ============================================
    // Green accent line above "Bill To:"
    doc.setFillColor(...primaryColor);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).roundedRect(20, yPos - 2, 85, 2.5, 1.5, 1.5, 'F');
    } catch {
      doc.rect(20, yPos - 2, 85, 2.5, 'F');
    }
    
    // "Bill To:" label
    doc.setTextColor(...darkColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 20, yPos + 4);
    yPos += 10;
    
    // Customer name
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceData.customer.name, 20, yPos);
    yPos += 6;
    
    // Customer email
    doc.setFontSize(10);
    doc.text(invoiceData.customer.email, 20, yPos);
    yPos += 20;

    // ============================================
    // PLAN DETAILS TABLE
    // ============================================
    // Table header
    doc.setFillColor(...primaryColor);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).roundedRect(20, yPos - 5, pageWidth - 40, 12, 2, 2, 'F');
    } catch {
      doc.rect(20, yPos - 5, pageWidth - 40, 12, 'F');
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 25, yPos + 2);
    doc.text('Amount', pageWidth - 25, yPos + 2, { align: 'right' });
    
    yPos += 12;
    
    // Table content
    doc.setFillColor(255, 255, 255);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).roundedRect(20, yPos - 8, pageWidth - 40, 30, 2, 2, 'F');
    } catch {
      doc.rect(20, yPos - 8, pageWidth - 40, 30, 'F');
    }
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).roundedRect(20, yPos - 8, pageWidth - 40, 30, 2, 2, 'S');
    } catch {
      doc.rect(20, yPos - 8, pageWidth - 40, 30, 'S');
    }
    
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Plan name
    doc.setFont('helvetica', 'bold');
    doc.text('Subscription Plan:', 25, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceData.plan.name, 25, yPos + 6);
    
    // Period
    if (invoiceData.period.start && invoiceData.period.end) {
      doc.text(
        `Period: ${format(new Date(invoiceData.period.start), 'PP')} - ${format(new Date(invoiceData.period.end), 'PP')}`,
        25,
        yPos + 12
      );
    }
    
    // Amount
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${invoiceData.plan.currency} ${invoiceData.total.toFixed(2)}`,
      pageWidth - 25,
      yPos + 6,
      { align: 'right' }
    );
    
    yPos += 35;

    // ============================================
    // TOTAL SECTION
    // ============================================
    // Total box with gradient effect (simulated)
    doc.setFillColor(...secondaryColor);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).roundedRect(pageWidth - 90, yPos - 5, 70, 20, 3, 3, 'F');
    } catch {
      doc.rect(pageWidth - 90, yPos - 5, 70, 20, 'F');
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Amount', pageWidth - 85, yPos + 3);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${invoiceData.plan.currency} ${invoiceData.total.toFixed(2)}`,
      pageWidth - 85,
      yPos + 12
    );
    
    yPos += 30;

    // ============================================
    // NOTES SECTION (if space allows)
    // ============================================
    if (yPos < pageHeight - 60) {
      doc.setFillColor(...lightColor);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).roundedRect(20, yPos - 5, pageWidth - 40, 25, 2, 2, 'F');
      } catch {
        doc.rect(20, yPos - 5, pageWidth - 40, 25, 'F');
      }
      
      doc.setTextColor(...textColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Terms:', 25, yPos + 3);
      doc.setFont('helvetica', 'normal');
      doc.text('Payment is due upon receipt. Thank you for your business!', 25, yPos + 9, {
        maxWidth: pageWidth - 50,
      });
    }

    // ============================================
    // FOOTER
    // ============================================
    const footerY = pageHeight - 40;
    
    // Footer background
    doc.setFillColor(...darkColor);
    doc.rect(0, footerY, pageWidth, 40, 'F');
    
    // Decorative accent line
    doc.setFillColor(...primaryColor);
    doc.rect(0, footerY, pageWidth, 2, 'F');
    
    // Company info in footer
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Balencia Inc.', 20, footerY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('123 Health Street, Suite 100', 20, footerY + 16);
    doc.text('San Francisco, CA 94102, USA', 20, footerY + 22);
    
    // Contact info
    doc.text('Email: support@balencia.app', pageWidth / 2, footerY + 10);
    doc.text('Phone: +1 (555) 123-4567', pageWidth / 2, footerY + 16);
    doc.text('Website: www.balencia.app', pageWidth / 2, footerY + 22);
    
    // Legal text
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      'This is a computer-generated invoice. No signature required.',
      pageWidth / 2,
      footerY + 30,
      { align: 'center' }
    );
    doc.text(
      '© 2026 Balencia Inc. All rights reserved.',
      pageWidth / 2,
      footerY + 35,
      { align: 'center' }
    );

    // ============================================
    // DECORATIVE ELEMENTS
    // ============================================
    // Corner decorations
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    // Top-left corner
    doc.line(0, 0, 15, 0);
    doc.line(0, 0, 0, 15);
    // Top-right corner
    doc.line(pageWidth - 15, 0, pageWidth, 0);
    doc.line(pageWidth, 0, pageWidth, 15);

    doc.save(`invoice-${invoiceData.invoiceNumber}.pdf`);
    toast.success('Invoice downloaded successfully');
  };

  const openCreatePlan = () => {
    setEditingPlanId(null);
    setPlanForm(planFormDefault);
    setPlanModalOpen(true);
  };

  const openEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? '',
      amount_cents: String(plan.amount_cents),
      currency: plan.currency?.toUpperCase() ?? 'USD',
      interval: plan.interval as 'month' | 'year',
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      is_active: plan.is_active,
      sort_order: String(plan.sort_order ?? 0),
    });
    setPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim() || !planForm.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    const amount = parseInt(planForm.amount_cents, 10);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Amount must be a non-negative number');
      return;
    }
    setPlanSaving(true);
    try {
      const payload = {
        name: planForm.name.trim(),
        slug: planForm.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        description: planForm.description.trim() || null,
        amount_cents: amount,
        currency: planForm.currency,
        interval: planForm.interval,
        features: planForm.features.filter(Boolean),
        is_active: planForm.is_active,
        sort_order: parseInt(planForm.sort_order, 10) || 0,
      };
      if (editingPlanId) {
        await api.patch(`/admin/subscriptions/plans/${editingPlanId}`, payload);
        toast.success('Plan updated');
      } else {
        await api.post('/admin/subscriptions/plans', payload);
        toast.success('Plan created');
      }
      setPlanModalOpen(false);
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan, isActive: boolean) => {
    setTogglingPlanId(plan.id);
    try {
      await api.patch(`/admin/subscriptions/plans/${plan.id}`, { is_active: isActive });
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, is_active: isActive } : p)));
      toast.success(isActive ? 'Plan activated' : 'Plan deactivated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update plan');
    } finally {
      setTogglingPlanId(null);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Deactivate this plan? It will be hidden from new subscribers.')) return;
    try {
      await api.delete(`/admin/subscriptions/plans/${id}`);
      toast.success('Plan deactivated');
      fetchPlans();
    } catch {
      toast.error('Failed to deactivate plan');
    }
  };

  const displayName = (sub: UserSubscription) => {
    if (sub.user_first_name || sub.user_last_name) {
      return [sub.user_first_name, sub.user_last_name].filter(Boolean).join(' ') || sub.user_email || '—';
    }
    return sub.user_email || '—';
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="relative min-h-screen space-y-8 pb-4">
      {/* Subtle background pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgb(15_23_42/0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgb(15_23_42/0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Hero — animated gradient + floating orbs */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-600 p-8 shadow-2xl shadow-emerald-500/10 md:p-10"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-100" />
        <motion.div
          className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/15 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-md ring-1 ring-white/30"
          >
            <CreditCard className="h-7 w-7 text-white" />
          </motion.div>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold tracking-tight text-white drop-shadow-sm md:text-3xl"
            >
              Subscriptions
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-1 text-sm text-white/90"
            >
              Manage plans and view customer subscriptions
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Revenue Analytics — 3D Cards */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40 shadow-xl shadow-black/5 backdrop-blur-xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            Revenue Analytics
          </h2>
          <div className="flex items-center gap-2">
            <Select value={revenuePeriod} onValueChange={(v) => setRevenuePeriod(v as typeof revenuePeriod)}>
              <SelectTrigger className="w-32 border-slate-600 bg-slate-800/80 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setExpectationModalOpen(true)}
              className="border-slate-600"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {revenueLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-700/50 animate-pulse" />
            ))}
          </div>
        ) : revenueStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" style={{ perspective: '1000px' }}>
            <RevenueMetricCard
              title="Total Revenue"
              value={revenueStats.total}
              icon={DollarSign}
              color="text-emerald-400"
              bgColor="bg-emerald-500/10"
              period={revenuePeriod.charAt(0).toUpperCase() + revenuePeriod.slice(1)}
              delay={0.1}
            />
            <RevenueMetricCard
              title="Active Subscriptions"
              value={revenueStats.breakdown.reduce((sum, item) => sum + item.subscriptions, 0)}
              icon={Users}
              color="text-blue-400"
              bgColor="bg-blue-500/10"
              period={revenuePeriod.charAt(0).toUpperCase() + revenuePeriod.slice(1)}
              delay={0.15}
              prefix=""
              suffix=""
            />
            <RevenueMetricCard
              title="Average Revenue"
              value={
                revenueStats.breakdown.length > 0
                  ? revenueStats.total / revenueStats.breakdown.length
                  : 0
              }
              icon={TrendingUp}
              color="text-purple-400"
              bgColor="bg-purple-500/10"
              period={revenuePeriod.charAt(0).toUpperCase() + revenuePeriod.slice(1)}
              delay={0.2}
            />
            <RevenueMetricCard
              title="Plans Active"
              value={revenueStats.byPlan.length}
              icon={CreditCard}
              color="text-amber-400"
              bgColor="bg-amber-500/10"
              period={revenuePeriod.charAt(0).toUpperCase() + revenuePeriod.slice(1)}
              delay={0.25}
              prefix=""
              suffix=""
            />
            <RevenueMetricCard
              title="Growth Rate"
              value={0} // Calculate from previous period
              icon={TrendingUp}
              color="text-cyan-400"
              bgColor="bg-cyan-500/10"
              period={revenuePeriod.charAt(0).toUpperCase() + revenuePeriod.slice(1)}
              delay={0.3}
              prefix=""
              suffix="%"
            />
          </div>
        ) : null}
      </motion.section>

      {/* Plans — glass card + staggered table */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40 shadow-xl shadow-black/5 backdrop-blur-xl"
      >
        <div className="border-b border-slate-700/60 bg-slate-800/30 px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Plans</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={plansActiveFilter === undefined ? 'all' : plansActiveFilter ? 'true' : 'false'}
                onValueChange={(v) => setPlansActiveFilter(v === 'all' ? undefined : v === 'true')}
              >
                <SelectTrigger className="w-30 border-slate-600 bg-slate-800/80 text-white transition-colors hover:border-slate-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={openCreatePlan}
                  className="bg-emerald-600 font-medium shadow-lg shadow-emerald-500/25 transition-colors hover:bg-emerald-500 hover:shadow-emerald-500/30"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Plan
                </Button>
              </motion.div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchPlans}
                disabled={plansLoading}
                className="border-slate-600 transition-transform hover:border-slate-500 hover:bg-slate-700/50 data-[state=disabled]:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${plansLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {plansLoading ? (
            <div className="space-y-2 p-6">
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  className="h-12 w-full rounded-lg bg-slate-700/50"
                />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-16 text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50"
              >
                <Sparkles className="h-8 w-8 text-slate-500" />
              </motion.div>
              <p className="text-slate-400">No plans yet</p>
              <p className="text-sm text-slate-500">Create your first plan to get started</p>
              <Button onClick={openCreatePlan} variant="outline" className="border-slate-600">
                <Plus className="mr-2 h-4 w-4" />
                Create Plan
              </Button>
            </motion.div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/60 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Slug</TableHead>
                  <TableHead className="text-slate-400">Amount</TableHead>
                  <TableHead className="text-slate-400">Interval</TableHead>
                  <TableHead className="text-slate-400">Stripe Price ID</TableHead>
                  <TableHead className="text-slate-400">Active</TableHead>
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {plans.map((plan, index) => (
                    <motion.tr
                      key={plan.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                      layout
                      className="group border-b border-slate-700/50 transition-colors hover:bg-slate-700/30"
                    >
                      <TableCell className="font-medium text-white">{plan.name}</TableCell>
                      <TableCell className="text-slate-300">{plan.slug}</TableCell>
                      <TableCell className="text-slate-300">
                        {(plan.amount_cents / 100).toFixed(2)} {plan.currency?.toUpperCase()}
                      </TableCell>
                      <TableCell className="text-slate-300">{plan.interval}</TableCell>
                      <TableCell className="max-w-35 truncate font-mono text-xs text-slate-400">
                        {plan.stripe_price_id || '—'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={(checked) => handleToggleActive(plan, !!checked)}
                          disabled={togglingPlanId === plan.id}
                          className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-600"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditPlan(plan)}
                            className="text-slate-400 hover:bg-slate-600/50 hover:text-white"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePlan(plan.id)}
                            className="text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </div>
        {plansTotal > 20 && (
          <div className="flex items-center justify-between border-t border-slate-700/60 px-5 py-4">
            <p className="text-sm text-slate-400">Total: {plansTotal} plans</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={plansPage <= 1}
                onClick={() => setPlansPage((p) => p - 1)}
                className="border-slate-600"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={plansPage * 20 >= plansTotal}
                onClick={() => setPlansPage((p) => p + 1)}
                className="border-slate-600"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </motion.section>

      {/* Customer Subscriptions — glass card */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40 shadow-xl shadow-black/5 backdrop-blur-xl"
      >
        <div className="border-b border-slate-700/60 bg-slate-800/30 px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Users className="h-5 w-5 text-emerald-400" />
              Customer Subscriptions
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {selectedSubscriptions.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5"
                >
                  <span className="text-sm text-emerald-400 font-medium">
                    {selectedSubscriptions.size} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                </motion.div>
              )}
              <Select value={subsStatusFilter || 'all'} onValueChange={(v) => setSubsStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-32 border-slate-600 bg-slate-800/80 text-white transition-colors hover:border-slate-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subsPlanFilter || 'all'} onValueChange={(v) => setSubsPlanFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-35 border-slate-600 bg-slate-800/80 text-white transition-colors hover:border-slate-500">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchSubscriptions}
                disabled={subsLoading}
                className="border-slate-600 transition-transform hover:border-slate-500 hover:bg-slate-700/50"
              >
                <RefreshCw className={`h-4 w-4 ${subsLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="border-slate-600 text-slate-300 hover:bg-slate-700/50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
          {selectedSubscriptions.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-2"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-7 text-xs text-slate-400 hover:text-white"
              >
                {selectedSubscriptions.size === subscriptions.length ? 'Deselect All' : 'Select All'}
              </Button>
            </motion.div>
          )}
        </div>
        <div className="overflow-x-auto">
          {subsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-slate-500 mb-3" />
              <p className="text-slate-400">No subscriptions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSubscriptions.size === subscriptions.length && subscriptions.length > 0}
                      onCheckedChange={handleSelectAll}
                      className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-600"
                    />
                  </TableHead>
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Plan</TableHead>
                  <TableHead className="text-slate-400">Amount</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Period Start</TableHead>
                  <TableHead className="text-slate-400">Period End</TableHead>
                  <TableHead className="text-slate-400">Cancel at period end</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub, index) => (
                  <motion.tr
                    key={sub.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.25 }}
                    className={`group border-b border-slate-700/50 transition-colors hover:bg-slate-700/30 ${
                      selectedSubscriptions.has(sub.id) ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedSubscriptions.has(sub.id)}
                        onCheckedChange={() => handleSelectSubscription(sub.id)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-600"
                      />
                    </TableCell>
                    <TableCell className="text-white">
                      <div>
                        <span className="font-medium">{displayName(sub)}</span>
                        {sub.user_email && (
                          <div className="text-xs text-slate-500">{sub.user_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{sub.plan_name || sub.plan_slug || '—'}</TableCell>
                    <TableCell className="text-slate-300">
                      {sub.plan_amount_cents != null
                        ? `${(sub.plan_amount_cents / 100).toFixed(2)} ${(sub.plan_currency || 'USD').toUpperCase()}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sub.status === 'active' ? 'default' : 'secondary'}
                        className={
                          sub.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
                        }
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {sub.current_period_start ? format(new Date(sub.current_period_start), 'PP') : '—'}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {sub.current_period_end ? format(new Date(sub.current_period_end), 'PP') : '—'}
                    </TableCell>
                    <TableCell className="text-slate-400">{sub.cancel_at_period_end ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {sub.created_at ? format(new Date(sub.created_at), 'PP') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-slate-900 border-slate-700/60 shadow-xl rounded-xl p-1"
                        >
                          <DropdownMenuItem
                            onClick={() => openEditSubscription(sub)}
                            className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleGenerateInvoice(sub)}
                            className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Generate Invoice
                          </DropdownMenuItem>
                          {sub.invoice_url && (
                            <DropdownMenuItem
                              onClick={() => window.open(sub.invoice_url!, '_blank')}
                              className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteSubscription(sub.id)}
                            className="text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {subsTotal > 20 && (
          <div className="flex items-center justify-between border-t border-slate-700/60 px-5 py-4">
            <p className="text-sm text-slate-400">Total: {subsTotal} subscriptions</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={subsPage <= 1} onClick={() => setSubsPage((p) => p - 1)} className="border-slate-600">
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={subsPage * 20 >= subsTotal} onClick={() => setSubsPage((p) => p + 1)} className="border-slate-600">
                Next
              </Button>
            </div>
          </div>
        )}
      </motion.section>

      {/* Plan Create/Edit Modal — animated */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="max-w-2xl border-slate-700 bg-slate-900 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-slate-300">Name</Label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-slate-800 border-slate-600"
                placeholder="e.g., Pro Plan"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Slug</Label>
              <Input
                value={planForm.slug}
                onChange={(e) => setPlanForm((f) => ({ ...f, slug: e.target.value }))}
                className="bg-slate-800 border-slate-600"
                placeholder="e.g., pro-plan"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Description</Label>
              <Input
                value={planForm.description}
                onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-slate-800 border-slate-600"
                placeholder="Plan description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-300">Amount (cents)</Label>
                <Input
                  type="number"
                  value={planForm.amount_cents}
                  onChange={(e) => setPlanForm((f) => ({ ...f, amount_cents: e.target.value }))}
                  className="bg-slate-800 border-slate-600"
                  placeholder="999"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Currency</Label>
                <Select value={planForm.currency} onValueChange={(v) => setPlanForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-300">Interval</Label>
                <Select value={planForm.interval} onValueChange={(v) => setPlanForm((f) => ({ ...f, interval: v as 'month' | 'year' }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Sort Order</Label>
                <Input
                  type="number"
                  value={planForm.sort_order}
                  onChange={(e) => setPlanForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="bg-slate-800 border-slate-600"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={planForm.is_active}
                onCheckedChange={(checked) => setPlanForm((f) => ({ ...f, is_active: checked }))}
                className="data-[state=checked]:bg-emerald-500"
              />
              <Label className="text-slate-300">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPlanModalOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={handleSavePlan} disabled={planSaving} className="bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:bg-emerald-500">
                {planSaving ? 'Saving…' : editingPlanId ? 'Update' : 'Create'}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Modal */}
      <Dialog open={editSubModalOpen} onOpenChange={setEditSubModalOpen}>
        <DialogContent className="max-w-lg border-slate-700 bg-slate-900 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-slate-300">Status</Label>
              <Select value={subForm.status} onValueChange={(v) => setSubForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-300">Period Start</Label>
                <Input
                  type="date"
                  value={subForm.current_period_start}
                  onChange={(e) => setSubForm((f) => ({ ...f, current_period_start: e.target.value }))}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Period End</Label>
                <Input
                  type="date"
                  value={subForm.current_period_end}
                  onChange={(e) => setSubForm((f) => ({ ...f, current_period_end: e.target.value }))}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={subForm.cancel_at_period_end}
                onCheckedChange={(checked) => setSubForm((f) => ({ ...f, cancel_at_period_end: checked }))}
                className="data-[state=checked]:bg-emerald-500"
              />
              <Label className="text-slate-300">Cancel at period end</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSubModalOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleSaveSubscription} disabled={subSaving} className="bg-emerald-600 hover:bg-emerald-500">
              {subSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Modal */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="max-w-2xl border-slate-700 bg-slate-900 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          {invoiceData && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 mb-1">Invoice Number</p>
                    <p className="font-medium">{invoiceData.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Date</p>
                    <p className="font-medium">{format(new Date(invoiceData.date), 'PP')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Customer</p>
                    <p className="font-medium">{invoiceData.customer.name}</p>
                    <p className="text-slate-500 text-xs">{invoiceData.customer.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Plan</p>
                    <p className="font-medium">{invoiceData.plan.name}</p>
                  </div>
                  {invoiceData.period.start && invoiceData.period.end && (
                    <div className="col-span-2">
                      <p className="text-slate-400 mb-1">Period</p>
                      <p className="font-medium">
                        {format(new Date(invoiceData.period.start), 'PP')} - {format(new Date(invoiceData.period.end), 'PP')}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-slate-700 pt-4">
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-semibold">Total</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {invoiceData.plan.currency} {invoiceData.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceModalOpen(false)} className="border-slate-600">
              Close
            </Button>
            <Button onClick={handleDownloadPDF} disabled={!invoiceData} className="bg-emerald-600 hover:bg-emerald-500">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revenue Expectations Modal */}
      <Dialog open={expectationModalOpen} onOpenChange={setExpectationModalOpen}>
        <DialogContent className="max-w-lg border-slate-700 bg-slate-900 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>Set Revenue Expectations</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {(['week', 'month', 'quarter', 'year', 'lifetime'] as const).map((period) => (
              <div key={period} className="grid gap-2">
                <Label className="text-slate-300 capitalize">{period}</Label>
                <Input
                  type="number"
                  value={revenueExpectations[period] || ''}
                  onChange={(e) =>
                    setRevenueExpectations((prev) => ({
                      ...prev,
                      [period]: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="bg-slate-800 border-slate-600"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpectationModalOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Save expectations (you can add API call here)
                toast.success('Revenue expectations saved');
                setExpectationModalOpen(false);
              }}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subscription Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Subscription
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete this subscription? This action cannot be undone. The subscription will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSubscription}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Multiple Subscriptions
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete {selectedSubscriptions.size} subscription(s)? This action cannot be undone. All selected subscriptions will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {isDeleting ? 'Deleting...' : `Delete ${selectedSubscriptions.size} Subscription(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
