'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, Trophy, Sliders, Target } from 'lucide-react';
import type { Competition } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';

interface CreateCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Competition | null;
}

interface ScoringWeights {
  workout: number;
  nutrition: number;
  wellbeing: number;
  biometrics: number;
  engagement: number;
  consistency: number;
}

export function CreateCompetitionModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CreateCompetitionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    type: 'admin_created' as 'admin_created' | 'ai_generated',
    status: 'draft' as 'draft' | 'active' | 'ended',
    scoring_weights: {
      workout: 30,
      nutrition: 20,
      wellbeing: 15,
      biometrics: 15,
      engagement: 10,
      consistency: 10,
    } as ScoringWeights,
    rules: {
      metric: 'total_score' as 'total_score' | 'workout' | 'nutrition' | 'wellbeing' | 'biometrics' | 'engagement' | 'consistency',
      aggregation: 'total' as 'total' | 'average' | 'streak',
      min_days: 1,
    },
    eligibility: {
      regions: [] as string[],
      subscription_tiers: [] as string[],
    },
    prize_metadata: {
      badges: [] as string[],
      rewards: [] as string[],
      top_n: 10,
    },
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        start_date: initialData.start_date.split('T')[0],
        end_date: initialData.end_date.split('T')[0],
        type: initialData.type,
        status: initialData.status,
        scoring_weights: (initialData.scoring_weights as unknown as ScoringWeights) || {
          workout: 30,
          nutrition: 20,
          wellbeing: 15,
          biometrics: 15,
          engagement: 10,
          consistency: 10,
        },
        rules: (initialData.rules as typeof formData.rules) ?? {
          metric: 'total_score',
          aggregation: 'total',
          min_days: 1,
        },
        eligibility: (initialData.eligibility as typeof formData.eligibility) ?? {
          regions: [],
          subscription_tiers: [],
        },
        prize_metadata: (initialData.prize_metadata as typeof formData.prize_metadata) ?? {
          badges: [],
          rewards: [],
          top_n: 10,
        },
      });
    } else {
      // Reset form
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        type: 'admin_created',
        status: 'draft',
        scoring_weights: {
          workout: 30,
          nutrition: 20,
          wellbeing: 15,
          biometrics: 15,
          engagement: 10,
          consistency: 10,
        },
        rules: {
          metric: 'total_score',
          aggregation: 'total',
          min_days: 1,
        },
        eligibility: {
          regions: [],
          subscription_tiers: [],
        },
        prize_metadata: {
          badges: [],
          rewards: [],
          top_n: 10,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen]);

  const handleScoringWeightChange = (key: keyof ScoringWeights, value: number) => {
    const newWeights = { ...formData.scoring_weights, [key]: value };
    const total = Object.values(newWeights).reduce((sum, v) => sum + v, 0);
    
    // Normalize to 100
    if (total !== 100) {
      const factor = 100 / total;
      Object.keys(newWeights).forEach((k) => {
        newWeights[k as keyof ScoringWeights] = Math.round(newWeights[k as keyof ScoringWeights] * factor);
      });
    }
    
    setFormData({ ...formData, scoring_weights: newWeights });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate scoring weights sum to 100
    const total = Object.values(formData.scoring_weights).reduce((sum, v) => sum + v, 0);
    if (total !== 100) {
      toast.error('Scoring weights must sum to 100%');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      };

      if (initialData) {
        await api.put(`/admin/competitions/${initialData.id}`, payload);
        toast.success('Competition updated successfully');
      } else {
        await api.post('/admin/competitions', payload);
        toast.success('Competition created successfully');
      }
      
      onSuccess();
    } catch (error: unknown) {
      toast.error((error instanceof Error ? error.message : null) || 'Failed to save competition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalWeight = Object.values(formData.scoring_weights).reduce((sum, v) => sum + v, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-emerald-400" />
            {initialData ? 'Edit Competition' : 'Create Competition'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure competition settings, scoring weights, and rules
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-white">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="Competition name"
                />
              </div>
              <div>
                <Label htmlFor="type" className="text-white">Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'admin_created' | 'ai_generated' })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white mt-1"
                >
                  <option value="admin_created">Admin Created</option>
                  <option value="ai_generated">AI Generated</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-white">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="Competition description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="start_date" className="text-white">Start Date *</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end_date" className="text-white">End Date *</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="status" className="text-white">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'active' | 'ended' })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white mt-1"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scoring Weights */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              Scoring Weights
            </h3>
            <p className="text-sm text-gray-400">Configure how each component contributes to the total score (must sum to 100%)</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(['workout', 'nutrition', 'wellbeing', 'biometrics', 'engagement', 'consistency'] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <Label className="text-white capitalize">{key}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.scoring_weights[key]}
                      onChange={(e) => handleScoringWeightChange(key, parseInt(e.target.value) || 0)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${formData.scoring_weights[key]}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className={cn(
              'p-3 rounded-lg text-sm',
              totalWeight === 100
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-300 border border-red-500/30'
            )}>
              Total: {totalWeight}% {totalWeight !== 100 && '(Must equal 100%)'}
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Competition Rules
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="metric" className="text-white">Metric</Label>
                <select
                  id="metric"
                  value={formData.rules.metric}
                  onChange={(e) => setFormData({
                    ...formData,
                    rules: { ...formData.rules, metric: e.target.value as 'total_score' | 'workout' | 'nutrition' | 'wellbeing' | 'biometrics' | 'engagement' | 'consistency' }
                  })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white mt-1"
                >
                  <option value="total_score">Total Score</option>
                  <option value="workout">Workout</option>
                  <option value="nutrition">Nutrition</option>
                  <option value="wellbeing">Wellbeing</option>
                  <option value="biometrics">Biometrics</option>
                  <option value="engagement">Engagement</option>
                  <option value="consistency">Consistency</option>
                </select>
              </div>
              <div>
                <Label htmlFor="aggregation" className="text-white">Aggregation</Label>
                <select
                  id="aggregation"
                  value={formData.rules.aggregation}
                  onChange={(e) => setFormData({
                    ...formData,
                    rules: { ...formData.rules, aggregation: e.target.value as 'total' | 'average' | 'streak' }
                  })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white mt-1"
                >
                  <option value="total">Total</option>
                  <option value="average">Average</option>
                  <option value="streak">Streak</option>
                </select>
              </div>
              <div>
                <Label htmlFor="min_days" className="text-white">Min Days</Label>
                <Input
                  id="min_days"
                  type="number"
                  min="1"
                  value={formData.rules.min_days}
                  onChange={(e) => setFormData({
                    ...formData,
                    rules: { ...formData.rules, min_days: parseInt(e.target.value) || 1 }
                  })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* Prizes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Prizes & Rewards
            </h3>
            
            <div>
              <Label htmlFor="top_n" className="text-white">Top N Winners</Label>
              <Input
                id="top_n"
                type="number"
                min="1"
                value={formData.prize_metadata.top_n}
                onChange={(e) => setFormData({
                  ...formData,
                  prize_metadata: {
                    ...formData.prize_metadata,
                    top_n: parseInt(e.target.value) || 10
                  }
                })}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || totalWeight !== 100}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {initialData ? 'Update' : 'Create'} Competition
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

