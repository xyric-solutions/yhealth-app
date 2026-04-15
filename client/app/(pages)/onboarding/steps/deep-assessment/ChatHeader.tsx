'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import type { SupportedLanguage } from '@/src/shared/services';
import type { AssessmentInteractionMode } from './types';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  userMessageCount: number;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onBack: () => void;
  onSwitchMode: () => void;
  canChangeLanguage: boolean;
  interactionMode?: AssessmentInteractionMode;
  onInteractionModeChange?: (mode: AssessmentInteractionMode) => void;
  disableQuickMode?: boolean;
}

export function ChatHeader({
  language,
  onLanguageChange,
  onBack,
  onSwitchMode,
  canChangeLanguage,
  disableQuickMode = false,
}: ChatHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#02000f]/90 backdrop-blur-xl">
      {/* Back button */}
      <motion.button
        onClick={onBack}
        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl text-white text-sm sm:text-base border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all group"
        whileHover={{ x: -2 }}
      >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-medium hidden sm:inline">Back to Assessment Style</span>
        <span className="font-medium sm:hidden">Back</span>
      </motion.button>

      {/* Right: Language + Quick Mode */}
      <div className="flex items-center gap-2">
        <LanguageSelector
          language={language}
          onLanguageChange={onLanguageChange}
          canChange={canChangeLanguage}
        />
        <motion.button
          onClick={disableQuickMode ? undefined : onSwitchMode}
          disabled={disableQuickMode}
          className={cn(
            'flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-medium transition-all border',
            disableQuickMode
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 border-slate-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 border-white/20 shadow-lg shadow-emerald-600/20'
          )}
          whileTap={disableQuickMode ? undefined : { scale: 0.97 }}
        >
          <Zap className="w-4 h-4" />
          <span>Quick Mode</span>
        </motion.button>
      </div>
    </div>
  );
}
