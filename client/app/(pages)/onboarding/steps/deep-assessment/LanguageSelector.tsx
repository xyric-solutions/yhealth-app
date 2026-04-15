'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';
import { LANGUAGE_CONFIG, type SupportedLanguage } from '@/src/shared/services';

interface LanguageSelectorProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  canChange: boolean;
}

export function LanguageSelector({
  language,
  onLanguageChange,
  canChange,
}: LanguageSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-xs"
        whileTap={{ scale: 0.98 }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{LANGUAGE_CONFIG[language].nativeName}</span>
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden min-w-32"
          >
            {(Object.keys(LANGUAGE_CONFIG) as SupportedLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  if (lang !== language) {
                    onLanguageChange(lang);
                  }
                  setShowMenu(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  language === lang
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
                style={{ direction: LANGUAGE_CONFIG[lang].dir }}
              >
                <span>{LANGUAGE_CONFIG[lang].nativeName}</span>
                <span className="text-xs text-slate-500">{LANGUAGE_CONFIG[lang].name}</span>
              </button>
            ))}
            {!canChange && (
              <div className="px-3 py-2 text-xs text-amber-400/80 bg-amber-500/10 border-t border-slate-700">
                Note: Language will apply to new messages
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
