'use client';

import { motion } from 'framer-motion';
import { Heart, Moon, Activity } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface WhoopMetricsCardsProps {
  recovery: {
    score: number;
    hrv: number;
    rhr: number;
    timestamp: string;
  } | null;
  sleep: {
    duration: number;
    quality: number;
    efficiency: number;
    timestamp: string;
  } | null;
  strain: {
    score: number;
    normalized: number;
    timestamp: string;
  } | null;
}

export function WhoopMetricsCards({ recovery, sleep, strain }: WhoopMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Recovery Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl p-6 border-2 border-red-500/30 overflow-hidden group"
      >
        <motion.div
          className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5 text-red-400">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Recovery</p>
              <p className="text-3xl font-bold text-white">
                {recovery ? <AnimatedNumber value={recovery.score} /> : '--'}
              </p>
            </div>
          </div>
          {recovery && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">HRV:</span>
                <span className="text-white font-semibold">{recovery.hrv.toFixed(2)}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">RHR:</span>
                <span className="text-white font-semibold">{recovery.rhr} bpm</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {new Date(recovery.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          {!recovery && (
            <p className="text-sm text-slate-400">No recovery data</p>
          )}
        </div>
      </motion.div>

      {/* Sleep Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl p-6 border-2 border-blue-500/30 overflow-hidden group"
      >
        <motion.div
          className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5 text-blue-400">
              <Moon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Sleep</p>
              <p className="text-3xl font-bold text-white">
                {sleep ? (
                  <>
                    <AnimatedNumber value={Math.round(sleep.duration / 60)} />h
                  </>
                ) : (
                  '0h'
                )}
              </p>
            </div>
          </div>
          {sleep && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Quality:</span>
                <span className="text-white font-semibold">{sleep.quality.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Efficiency:</span>
                <span className="text-white font-semibold">{sleep.efficiency.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {new Date(sleep.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          {!sleep && (
            <p className="text-sm text-slate-400">No sleep data</p>
          )}
        </div>
      </motion.div>

      {/* Strain Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl p-6 border-2 border-purple-500/30 overflow-hidden group"
      >
        <motion.div
          className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5 text-purple-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Strain</p>
              <p className="text-3xl font-bold text-white">
                {strain ? <AnimatedNumber value={strain.score} /> : '--'}
              </p>
            </div>
          </div>
          {strain && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Normalized:</span>
                <span className="text-white font-semibold">{strain.normalized.toFixed(1)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {new Date(strain.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          {!strain && (
            <p className="text-sm text-slate-400">No strain data</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

