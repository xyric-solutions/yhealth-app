'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Link2 } from 'lucide-react';
import type { IntegrationCardProps } from './types';
import { cardVariants } from './constants';

/**
 * IntegrationCard - Individual integration card with connect/disconnect functionality
 *
 * Features:
 * - Brand-specific styling
 * - Connected badge with animation
 * - Loading state during OAuth flow
 * - Expandable data types on connection
 * - Hover shine effect
 */
export function IntegrationCard({
  integration,
  isConnected,
  isConnecting,
  branding,
  onConnect,
}: IntegrationCardProps) {
  return (
    <motion.button
      variants={cardVariants}
      onClick={() => onConnect(integration.id)}
      disabled={isConnecting}
      className={`
        group relative p-4 sm:p-5 rounded-2xl text-left transition-all duration-300
        border backdrop-blur-sm overflow-hidden
        ${
          isConnected
            ? `${branding.bg} ${branding.border} shadow-lg ${branding.glow}`
            : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700/80'
        }
      `}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Connected Badge */}
      <ConnectedBadge isConnected={isConnected} />

      <div className="flex items-center gap-4">
        {/* Icon */}
        <IntegrationIcon
          logo={branding.logo}
          isConnected={isConnected}
          isConnecting={isConnecting}
          branding={branding}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4
            className={`font-semibold truncate ${
              isConnected ? 'text-white' : 'text-slate-300'
            }`}
          >
            {integration.name}
          </h4>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {integration.dataTypes.slice(0, 3).join(' • ')}
            {integration.dataTypes.length > 3 && ' +more'}
          </p>
        </div>

        {/* Action */}
        <ConnectionStatus isConnected={isConnected} isConnecting={isConnecting} />
      </div>

      {/* Data types on connected */}
      <DataTypesExpanded
        isConnected={isConnected}
        dataTypes={integration.dataTypes}
        branding={branding}
      />

      {/* Hover shine effect */}
      <HoverShineEffect />
    </motion.button>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ConnectedBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <AnimatePresence>
      {isConnected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 z-10"
        >
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface IntegrationIconProps {
  logo: string;
  isConnected: boolean;
  isConnecting: boolean;
  branding: { bg: string; text: string };
}

function IntegrationIcon({ logo, isConnected, isConnecting, branding }: IntegrationIconProps) {
  return (
    <div
      className={`
        relative w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg
        transition-all duration-300
        ${isConnected ? `${branding.bg} ${branding.text}` : 'bg-slate-800/80 text-slate-400'}
      `}
    >
      {isConnecting ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <span className="text-xl">{logo}</span>
      )}

      {/* Connecting pulse */}
      {isConnecting && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-cyan-400/50"
          animate={{
            scale: [1, 1.2, 1.2],
            opacity: [0.5, 0, 0],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
          }}
        />
      )}
    </div>
  );
}

function ConnectionStatus({
  isConnected,
  isConnecting,
}: {
  isConnected: boolean;
  isConnecting: boolean;
}) {
  if (isConnected) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium"
      >
        <Link2 className="w-3.5 h-3.5" />
        Connected
      </motion.div>
    );
  }

  if (isConnecting) {
    return (
      <div className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium">
        Connecting...
      </div>
    );
  }

  return (
    <div className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-xs font-medium group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
      Connect
    </div>
  );
}

interface DataTypesExpandedProps {
  isConnected: boolean;
  dataTypes: string[];
  branding: { bg: string; text: string };
}

function DataTypesExpanded({ isConnected, dataTypes, branding }: DataTypesExpandedProps) {
  return (
    <AnimatePresence>
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-slate-700/50"
        >
          <div className="flex flex-wrap gap-2">
            {dataTypes.map((type) => (
              <span
                key={type}
                className={`px-2 py-1 rounded-md text-xs ${branding.bg} ${branding.text}`}
              >
                {type}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HoverShineEffect() {
  return (
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
    </div>
  );
}
