'use client';

import { motion } from 'framer-motion';
import { Shield, Lock, Eye, Trash2 } from 'lucide-react';
import type { PrivacyNoticeProps } from './types';

/**
 * PrivacyNotice - Displays privacy information and consent checkbox
 */
export function PrivacyNotice({ isConsented, onConsentChange }: PrivacyNoticeProps) {
  const privacyPoints = [
    {
      icon: Lock,
      title: 'End-to-end encrypted',
      description: 'Your photos are encrypted before storage',
    },
    {
      icon: Eye,
      title: 'AI analysis only',
      description: 'Used exclusively for body composition analysis',
    },
    {
      icon: Trash2,
      title: 'Delete anytime',
      description: 'You can remove your photos at any time',
    },
  ];

  return (
    <motion.div
      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Your Privacy Matters</h3>
          <p className="text-slate-400 text-sm">Your photos are protected</p>
        </div>
      </div>

      {/* Privacy Points */}
      <div className="space-y-3 mb-6">
        {privacyPoints.map((point, index) => (
          <motion.div
            key={point.title}
            className="flex items-start gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
              <point.icon className="w-4 h-4 text-slate-300" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{point.title}</p>
              <p className="text-slate-400 text-xs">{point.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Consent Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={isConsented}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="sr-only peer"
          />
          <div
            className={`w-5 h-5 rounded-md border-2 transition-all ${
              isConsented
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-slate-500 group-hover:border-slate-400'
            }`}
          >
            {isConsented && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-full h-full text-white p-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </motion.svg>
            )}
          </div>
        </div>
        <span className="text-sm text-slate-300 leading-tight">
          I consent to Balencia securely storing and analyzing my photos to provide
          personalized health insights and track my progress.
        </span>
      </label>
    </motion.div>
  );
}
