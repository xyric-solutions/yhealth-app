'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Edit, Trash2, Calendar, Users, Sparkles, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { CreateCompetitionModal } from './components/CreateCompetitionModal';
import type { Competition } from '@/src/shared/services/leaderboard.service';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function AdminCompetitionsPage() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'ended'>('all');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadCompetitions();
    }
  }, [user]);

  const loadCompetitions = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ competitions: Competition[] }>('/admin/competitions');
      if (response.success && response.data) {
        setCompetitions(response.data.competitions || []);
      }
    } catch (error) {
      toast.error('Failed to load competitions');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this competition?')) return;

    try {
      await api.delete(`/admin/competitions/${id}`);
      toast.success('Competition deleted');
      loadCompetitions();
    } catch (_error) {
      toast.error('Failed to delete competition');
    }
  };

  const filteredCompetitions = competitions.filter((comp) => {
    const matchesSearch = comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || comp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Unauthorized</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-emerald-400" />
            Competitions Management
          </h1>
          <p className="text-gray-400 mt-2">Create and manage competitions</p>
        </div>
        <Button
          onClick={() => {
            setEditingCompetition(null);
            setShowCreateModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Competition
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search competitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'draft', 'active', 'ended'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className={cn(
                statusFilter === status && 'bg-emerald-600 hover:bg-emerald-700'
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Competitions List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
              <div className="h-4 bg-white/10 rounded w-full mb-2" />
              <div className="h-4 bg-white/10 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No competitions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompetitions.map((competition) => (
            <motion.div
              key={competition.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg mb-1">{competition.name}</h3>
                  {competition.description && (
                    <p className="text-gray-400 text-sm line-clamp-2">{competition.description}</p>
                  )}
                </div>
                {competition.type === 'ai_generated' && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(new Date(competition.start_date), 'MMM d')} - {format(new Date(competition.end_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Users className="w-4 h-4" />
                  <span>Status: <span className="capitalize text-white">{competition.status}</span></span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingCompetition(competition);
                    setShowCreateModal(true);
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(competition.id)}
                  className="text-red-400 border-red-500/50 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CreateCompetitionModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingCompetition(null);
        }}
        onSuccess={() => {
          loadCompetitions();
          setShowCreateModal(false);
          setEditingCompetition(null);
        }}
        initialData={editingCompetition}
      />
    </div>
  );
}

