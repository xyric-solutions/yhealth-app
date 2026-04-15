'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Ruler, Calendar } from 'lucide-react';
import { api } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface BodyMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  bicepLeft?: number;
  bicepRight?: number;
  thighLeft?: number;
  thighRight?: number;
  calfLeft?: number;
  calfRight?: number;
  neck?: number;
  shoulders?: number;
}

interface LogMeasurementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const measurementFields: Array<{ key: keyof BodyMeasurements; label: string; placeholder: string }> = [
  { key: 'chest', label: 'Chest', placeholder: 'cm' },
  { key: 'waist', label: 'Waist', placeholder: 'cm' },
  { key: 'hips', label: 'Hips', placeholder: 'cm' },
  { key: 'neck', label: 'Neck', placeholder: 'cm' },
  { key: 'shoulders', label: 'Shoulders', placeholder: 'cm' },
  { key: 'bicepLeft', label: 'Left Bicep', placeholder: 'cm' },
  { key: 'bicepRight', label: 'Right Bicep', placeholder: 'cm' },
  { key: 'thighLeft', label: 'Left Thigh', placeholder: 'cm' },
  { key: 'thighRight', label: 'Right Thigh', placeholder: 'cm' },
  { key: 'calfLeft', label: 'Left Calf', placeholder: 'cm' },
  { key: 'calfRight', label: 'Right Calf', placeholder: 'cm' },
];

export function LogMeasurementsModal({ isOpen, onClose, onSuccess }: LogMeasurementsModalProps) {
  const [measurements, setMeasurements] = useState<Partial<BodyMeasurements>>({});
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleMeasurementChange = (key: keyof BodyMeasurements, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    if (value === '' || (!isNaN(numValue!) && numValue! > 0)) {
      setMeasurements((prev) => ({
        ...prev,
        [key]: numValue,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate at least one measurement
    const hasMeasurement = Object.values(measurements).some((v) => v !== undefined && v > 0);
    if (!hasMeasurement) {
      toast.error('Please enter at least one measurement');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post('/progress/measurements', {
        measurements,
        date,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        toast.success('Measurements logged successfully!');
        setMeasurements({});
        setNotes('');
        setDate(new Date().toISOString().split('T')[0]);
        onSuccess();
        onClose();
      } else {
        toast.error('Failed to log measurements');
      }
    } catch (err: unknown) {
      console.error('Failed to log measurements:', err);
      const errObj = err as Record<string, unknown>;
      const respData = (errObj?.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const errorMessage = (respData?.error as string) || (errObj?.message as string) || 'Failed to log measurements';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Ruler className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Log Body Measurements</h3>
                <p className="text-sm text-slate-400">Track your body measurements</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Picker */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            {/* Measurements Grid */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Measurements (cm)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {measurementFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-sm text-slate-400 mb-1.5 block">{field.label}</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={measurements[field.key] || ''}
                        onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about your measurements..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !Object.values(measurements).some((v) => v !== undefined && v > 0)}
                className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Measurements'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

