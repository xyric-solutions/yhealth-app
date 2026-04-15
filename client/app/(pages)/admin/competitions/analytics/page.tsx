'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, Trophy, TrendingUp, Award, Activity } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/app/context/AuthContext';
import { cn } from '@/lib/utils';

interface CompetitionAnalytics {
  total_competitions: number;
  active_competitions: number;
  total_participants: number;
  total_entries: number;
  top_competitions: Array<{
    id: string;
    name: string;
    participants: number;
    status: string;
  }>;
  participation_trend: Array<{
    date: string;
    count: number;
  }>;
  engagement_metrics: {
    avg_participants_per_competition: number;
    completion_rate: number;
    avg_score: number;
  };
}

export default function CompetitionAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<CompetitionAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<CompetitionAnalytics>('/admin/competitions/analytics');
      if (response.success && response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Unauthorized</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Competitions',
      value: analytics?.total_competitions || 0,
      icon: Trophy,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Active Competitions',
      value: analytics?.active_competitions || 0,
      icon: Activity,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Total Participants',
      value: analytics?.total_participants || 0,
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Total Entries',
      value: analytics?.total_entries || 0,
      icon: Award,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-emerald-400" />
          Competition Analytics
        </h1>
        <p className="text-gray-400 mt-2">Overview of competition performance and engagement</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
              <div className="h-8 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'bg-white/5 border border-white/10 rounded-xl p-6',
                    stat.bgColor
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Icon className={cn('w-8 h-8 bg-gradient-to-r text-transparent bg-clip-text', stat.color)} />
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Engagement Metrics */}
          {analytics?.engagement_metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-xl p-6"
              >
                <p className="text-gray-400 text-sm mb-2">Avg Participants/Competition</p>
                <p className="text-2xl font-bold text-white">
                  {analytics.engagement_metrics.avg_participants_per_competition.toFixed(1)}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 border border-white/10 rounded-xl p-6"
              >
                <p className="text-gray-400 text-sm mb-2">Completion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {(analytics.engagement_metrics.completion_rate * 100).toFixed(1)}%
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 border border-white/10 rounded-xl p-6"
              >
                <p className="text-gray-400 text-sm mb-2">Average Score</p>
                <p className="text-2xl font-bold text-white">
                  {analytics.engagement_metrics.avg_score.toFixed(1)}
                </p>
              </motion.div>
            </div>
          )}

          {/* Top Competitions */}
          {analytics?.top_competitions && analytics.top_competitions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-emerald-400" />
                Top Competitions
              </h3>
              <div className="space-y-3">
                {analytics.top_competitions.map((comp, index) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-white',
                        index === 0 && 'bg-gradient-to-r from-emerald-500 to-emerald-600',
                        index === 1 && 'bg-gradient-to-r from-gray-400 to-gray-500',
                        index === 2 && 'bg-gradient-to-r from-amber-500 to-amber-600',
                        index > 2 && 'bg-white/10'
                      )}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{comp.name}</p>
                        <p className="text-gray-400 text-sm capitalize">{comp.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-white font-semibold">{comp.participants}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

