'use client';

import { motion } from 'framer-motion';
import { Link2 } from 'lucide-react';

/**
 * IntegrationsHeader - Page header with title and description
 *
 * Features:
 * - Animated gradient badge
 * - Gradient text title
 */
export function IntegrationsHeader() {
  return (
    <motion.div
      className="text-center mb-10 md:mb-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 border border-blue-500/20 mb-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Link2 className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-cyan-400">Sync your health data</span>
      </motion.div>

      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
        Connect Your{' '}
        <span className="bg-linear-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Devices & Apps
        </span>
      </h1>
      <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
        Sync your wearables and health apps to get personalized insights based on your
        real data. The more you connect, the better we can help.
      </p>
    </motion.div>
  );
}
