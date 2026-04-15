'use client';

import { motion } from 'framer-motion';
import { Shield, ExternalLink } from 'lucide-react';

/**
 * SecurityInfoCard - Displays security and privacy information
 *
 * Features:
 * - OAuth 2.0 security messaging
 * - Learn more link
 */
export function SecurityInfoCard() {
  return (
    <motion.div
      className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-slate-800/50 via-slate-800/30 to-slate-800/50 border border-slate-700/50 mb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white mb-1">
            Your data is secure
          </h4>
          <p className="text-xs sm:text-sm text-slate-400">
            We use OAuth 2.0 for secure connections. Your credentials are never
            stored. You can disconnect anytime.{' '}
            <a
              href="#"
              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
            >
              Learn more <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
