'use client';

import { motion } from 'framer-motion';
import { Copy, Check, Volume2, StopCircle, RotateCcw } from 'lucide-react';

interface MessageActionsProps {
  isAI: boolean;
  onCopy: () => void;
  onVoice: () => void;
  onRegenerate?: () => void;
  isSpeaking: boolean;
  isCopied: boolean;
}

export function MessageActions({
  isAI,
  onCopy,
  onVoice,
  onRegenerate,
  isSpeaking,
  isCopied,
}: MessageActionsProps) {
  return (
    <motion.div
      className="flex items-center gap-0.5 mt-2 pt-2 border-t border-slate-700/30"
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Copy Button */}
      <motion.button
        onClick={onCopy}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
          isCopied
            ? 'bg-green-500/20 text-green-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title="Copy to clipboard"
      >
        {isCopied ? (
          <>
            <Check className="w-3 h-3" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            <span>Copy</span>
          </>
        )}
      </motion.button>

      {/* Voice Button (Text-to-Speech) */}
      <motion.button
        onClick={onVoice}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
          isSpeaking
            ? 'bg-violet-500/20 text-violet-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
      >
        {isSpeaking ? (
          <>
            <StopCircle className="w-3 h-3" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3 h-3" />
            <span>Listen</span>
          </>
        )}
      </motion.button>

      {/* Regenerate Button (AI messages only) */}
      {isAI && onRegenerate && (
        <motion.button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          title="Regenerate response"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Retry</span>
        </motion.button>
      )}
    </motion.div>
  );
}
