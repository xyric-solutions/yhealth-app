'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, CheckCircle2, Archive, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import type { Plan, PlanStatus, PlansResponse } from './types';
import { filterTabs } from './constants';
import { SuccessToast } from './SuccessToast';
import { TodayActivitiesSection } from './TodayActivitiesSection';
import { StatsCard } from './StatsCard';
import { PlanCard } from './PlanCard';
import { EmptyState } from './EmptyState';
import { CreatePlanModal } from './CreatePlanModal';

export function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<PlansResponse['stats']>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PlanStatus | 'all'>('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (activeFilter !== 'all') {
        params.status = activeFilter;
      }

      const response = await api.get<PlansResponse>('/plans', { params });

      if (response.success && response.data) {
        setPlans(response.data.plans || []);
        setStats(response.data.stats);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load plans');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Update plan status
  const handleStatusChange = async (planId: string, newStatus: PlanStatus) => {
    setIsUpdating(true);

    try {
      await api.patch(`/plans/${planId}`, { status: newStatus });
      await fetchPlans();
      setSuccessMessage(`Plan ${newStatus === 'completed' ? 'completed' : 'updated'} successfully!`);
    } catch (err) {
      console.error('Failed to update plan status:', err);
      setError('Failed to update plan');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete plan
  const handleDelete = async (planId: string) => {
    setIsUpdating(true);

    try {
      await api.delete(`/plans/${planId}`);
      await fetchPlans();
      setSuccessMessage('Plan deleted successfully!');
    } catch (err) {
      console.error('Failed to delete plan:', err);
      setError('Failed to delete plan');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleActivityComplete = (message: string) => {
    setSuccessMessage(message);
  };

  const handlePlanCreated = () => {
    fetchPlans();
    setSuccessMessage('Plan created successfully! Start completing your tasks.');
  };

  // Filter plans based on active filter
  const filteredPlans =
    activeFilter === 'all' ? plans : plans.filter((p) => p.status === activeFilter);

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      <SuccessToast
        message={successMessage || ''}
        isVisible={!!successMessage}
        onClose={() => setSuccessMessage(null)}
      />

      {/* Today's Activities */}
      <TodayActivitiesSection onActivityComplete={handleActivityComplete} />

      {/* Stats Overview */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatsCard
            label="Active"
            value={stats.active}
            icon={<Play className="w-5 h-5" />}
            color="text-emerald-400"
            bgColor="bg-emerald-500/20"
          />
          <StatsCard
            label="Paused"
            value={stats.paused}
            icon={<Pause className="w-5 h-5" />}
            color="text-amber-400"
            bgColor="bg-amber-500/20"
          />
          <StatsCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="text-blue-400"
            bgColor="bg-blue-500/20"
          />
          <StatsCard
            label="Archived"
            value={stats.archived}
            icon={<Archive className="w-5 h-5" />}
            color="text-slate-400"
            bgColor="bg-slate-500/20"
          />
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeFilter === tab.id
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-white/5 text-slate-400 border border-transparent hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              {tab.label}
              {stats && tab.id !== 'all' && (
                <span className="ml-1.5 text-xs opacity-60">({stats[tab.id] || 0})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </button>
          <button
            onClick={fetchPlans}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
        >
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={fetchPlans}
            className="ml-auto text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/10" />
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-white/10 rounded w-full mb-4" />
              <div className="h-2 bg-white/10 rounded-full mb-4" />
              <div className="h-10 bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Plans Grid */}
      {!isLoading && (
        <AnimatePresence mode="wait">
          {filteredPlans.length > 0 ? (
            <motion.div
              key="plans-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  isUpdating={isUpdating}
                />
              ))}
            </motion.div>
          ) : (
            <EmptyState filter={activeFilter} />
          )}
        </AnimatePresence>
      )}

      {/* Create Plan Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreatePlanModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handlePlanCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
