"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, Globe, Volume2 } from "lucide-react";
import {
  getAvailableLanguages,
  getLanguageByCode,
  groupLanguagesByRegion,
  type LanguageConfig,
} from "@/lib/language-config";

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
  compact?: boolean; // Compact mode for header
  showPreview?: boolean; // Show voice preview button
}

export function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  compact = false,
  showPreview = true,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState<LanguageConfig[]>([]);
  const [_groupedLanguages, setGroupedLanguages] = useState<Record<string, LanguageConfig[]>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load available languages
  useEffect(() => {
    const loadLanguages = () => {
      const languages = getAvailableLanguages();
      console.log("[LanguageSelector] Loaded languages:", languages.length, languages);
      setAvailableLanguages(languages);
      setGroupedLanguages(groupLanguagesByRegion(languages));
    };

    // Load immediately
    loadLanguages();
    
    // Reload when voices change (voices may load asynchronously)
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Check if voices are already loaded
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        loadLanguages();
      }
      
      window.speechSynthesis.onvoiceschanged = loadLanguages;
      
      // Also try loading after a short delay (voices may load asynchronously)
      const timeout = setTimeout(loadLanguages, 500);
      
      return () => {
        clearTimeout(timeout);
      };
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        // Also check if it's not the dropdown content itself
        if (!target.closest('.language-dropdown-content')) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      // Use 'mousedown' with a delay to allow button clicks to complete first
      // This ensures the language selection happens before the dropdown closes
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside, true);
      }, 150);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside, true);
      };
    }
  }, [isOpen]);

  const selectedLang = getLanguageByCode(selectedLanguage);
  const filteredLanguages = availableLanguages.filter(lang => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lang.displayName.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
    );
  });

  const filteredGrouped = groupLanguagesByRegion(filteredLanguages);

  const handleLanguageSelect = (code: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Prevent event from bubbling up to document click handler
    onLanguageChange(code);
    // Close after a small delay to ensure the change is processed
    setTimeout(() => {
      setIsOpen(false);
      setSearchQuery("");
    }, 50);
  };

  const previewVoice = (code: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const lang = getLanguageByCode(code);
    if (!lang) return;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => {
      const voiceBase = v.lang.split("-")[0];
      const langBase = code.split("-")[0];
      return v.lang === code || voiceBase === langBase;
    });

    if (matchingVoice) {
      const utterance = new SpeechSynthesisUtterance(
        lang.nativeName || lang.displayName
      );
      utterance.voice = matchingVoice;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          aria-label="Select language"
        >
          <Globe className="w-4 h-4 text-white/70" />
          <span className="text-sm font-medium text-white">
            {selectedLang?.code.split("-")[1]?.toLowerCase() || selectedLang?.code.split("-")[0]?.toLowerCase() || "us"} {selectedLang?.code.split("-")[0]?.toUpperCase() || "EN"}
          </span>
        </button>

        <AnimatePresence>
          {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="language-dropdown-content absolute top-full right-0 mt-2 w-80 max-h-96 overflow-hidden bg-slate-900 rounded-xl border border-white/10 shadow-2xl z-[9999]"
              >
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search languages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div 
                className="max-h-80 overflow-y-auto overscroll-contain"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#475569 #1e293b'
                }}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {Object.keys(filteredGrouped).length === 0 ? (
                  <div className="p-4 text-center text-white/60 text-sm">
                    No languages found
                  </div>
                ) : (
                  Object.entries(filteredGrouped).map(([region, languages]) => (
                    <div key={region} className="p-2">
                      <div className="px-3 py-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider">
                        {region}
                      </div>
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleLanguageSelect(lang.code, e);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                            selectedLanguage === lang.code
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "text-white/80 hover:bg-white/5"
                          }`}
                        >
                          <span className="text-xl">{lang.flag}</span>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">{lang.displayName}</div>
                            <div className="text-xs text-white/50">{lang.nativeName}</div>
                          </div>
                          {selectedLanguage === lang.code && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                          {showPreview && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                previewVoice(lang.code);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="p-1.5 rounded hover:bg-white/10 transition-colors"
                              aria-label="Preview voice"
                            >
                              <Volume2 className="w-3.5 h-3.5 text-white/60" />
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full mode (for preferences tab)
  return (
    <div className="space-y-4 ">
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-white/90 mb-2 ">
          Voice Assistant Language
        </label>
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{selectedLang?.flag || "🌐"}</span>
            <div className="text-left">
              <div className="text-sm font-medium text-white">
                {selectedLang?.displayName || "Select Language"}
              </div>
              <div className="text-xs text-white/50">
                {selectedLang?.nativeName || selectedLanguage}
              </div>
            </div>
          </div>
          <Globe className="w-5 h-5 text-white/40" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  // Only close if clicking directly on the backdrop, not on child elements
                  if (e.target === e.currentTarget) {
                    setIsOpen(false);
                  }
                }}
                className="fixed inset-0 bg-black/50 z-40"
                style={{ pointerEvents: 'auto' }}
              />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="language-dropdown-content absolute top-full left-0 right-0 mt-2 max-h-96 overflow-hidden bg-slate-900 rounded-xl border border-white/10 shadow-2xl z-50"
                style={{ pointerEvents: 'auto' }}
              >
                <div className="p-3 border-b border-white/10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search languages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div 
                  className="max-h-80 overflow-y-auto overscroll-contain"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#475569 #1e293b'
                  }}
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  {Object.keys(filteredGrouped).length === 0 ? (
                    <div className="p-4 text-center text-white/60 text-sm">
                      No languages found
                    </div>
                  ) : (
                    Object.entries(filteredGrouped).map(([region, languages]) => (
                      <div key={region} className="p-2">
                        <div className="px-3 py-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider">
                          {region}
                        </div>
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleLanguageSelect(lang.code, e);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                              selectedLanguage === lang.code
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "text-white/80 hover:bg-white/5"
                            }`}
                          >
                            <span className="text-xl">{lang.flag}</span>
                            <div className="flex-1 text-left">
                              <div className="text-sm font-medium">{lang.displayName}</div>
                              <div className="text-xs text-white/50">{lang.nativeName}</div>
                            </div>
                            {selectedLanguage === lang.code && (
                              <Check className="w-4 h-4 text-emerald-400" />
                            )}
                            {showPreview && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  previewVoice(lang.code);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                                aria-label="Preview voice"
                              >
                                <Volume2 className="w-3.5 h-3.5 text-white/60" />
                              </button>
                            )}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

