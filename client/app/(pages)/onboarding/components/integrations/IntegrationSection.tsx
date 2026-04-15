'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { IntegrationSectionProps } from './types';
import { IntegrationCard } from './IntegrationCard';
import { INTEGRATION_BRANDING, containerVariants } from './constants';

/**
 * IntegrationSection - Collapsible section containing integration cards
 *
 * Features:
 * - Collapsible accordion with animation
 * - Connected count badge
 * - Grid layout for integration cards
 */
export function IntegrationSection({
  title,
  icon,
  integrations,
  description,
  connectedIntegrations,
  isExpanded,
  onToggle,
  connecting,
  onConnect,
}: IntegrationSectionProps) {
  const connectedCount = integrations.filter((i) =>
    connectedIntegrations.includes(i.id)
  ).length;

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:bg-slate-800/50 transition-colors mb-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center">
            {icon}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white flex items-center gap-2">
              {title}
              {connectedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                  {connectedCount} connected
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </motion.div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {integrations.map((integration) => {
                const branding = INTEGRATION_BRANDING[integration.id] || {
                  bg: 'bg-slate-500/15',
                  text: 'text-slate-400',
                  border: 'border-slate-500/40',
                  glow: 'shadow-slate-500/20',
                  logo: integration.icon,
                };

                return (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    isConnected={connectedIntegrations.includes(integration.id)}
                    isConnecting={connecting === integration.id}
                    branding={branding}
                    onConnect={onConnect}
                  />
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
