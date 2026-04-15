"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { detectBrowserLanguage, getAvailableLanguages, type LanguageConfig } from "@/lib/language-config";
import type { VoiceGender } from "@/src/shared/services/tts.service";

const DEFAULT_ASSISTANT_NAME = "Balencia Coach";

interface VoiceAssistantContextType {
  isOpen: boolean;
  openVoiceAssistant: () => void;
  closeVoiceAssistant: () => void;
  userMood: "happy" | "neutral" | "sad" | "excited" | "calm" | "stressed" | "motivated";
  setUserMood: (mood: VoiceAssistantContextType["userMood"]) => void;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  availableLanguages: LanguageConfig[];
  assistantName: string;
  setAssistantName: (name: string) => void;
  voiceGender: VoiceGender;
  setVoiceGender: (gender: VoiceGender) => void;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(undefined);

export function VoiceAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [userMood, setUserMood] = useState<VoiceAssistantContextType["userMood"]>("neutral");
  const [availableLanguages, setAvailableLanguages] = useState<LanguageConfig[]>([]);

  // Initialize assistant name from localStorage
  const [assistantName, setAssistantNameState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_ASSISTANT_NAME;
    return localStorage.getItem("voiceAssistantName") || DEFAULT_ASSISTANT_NAME;
  });

  // Initialize language from localStorage or browser detection
  const [selectedLanguage, setSelectedLanguageState] = useState<string>(() => {
    if (typeof window === "undefined") return "en-US";

    // Try to load from localStorage
    const saved = localStorage.getItem("voiceAssistantLanguage");
    if (saved) return saved;

    // Fallback to browser detection
    return detectBrowserLanguage();
  });

  // Initialize voice gender from localStorage
  const [voiceGender, setVoiceGenderState] = useState<VoiceGender>(() => {
    if (typeof window === "undefined") return "female";
    return (localStorage.getItem("voiceAssistantGender") as VoiceGender) || "female";
  });

  // Load available languages
  useEffect(() => {
    const loadLanguages = () => {
      const languages = getAvailableLanguages();
      setAvailableLanguages(languages);

      // If current language is not available, switch to a fallback
      const currentAvailable = languages.find(l => l.code === selectedLanguage);
      if (!currentAvailable && languages.length > 0) {
        // Try to find same base language
        const baseLang = selectedLanguage.split("-")[0];
        const sameBase = languages.find(l => l.code.startsWith(baseLang));
        if (sameBase) {
          setSelectedLanguageState(sameBase.code);
          localStorage.setItem("voiceAssistantLanguage", sameBase.code);
        } else {
          // Fallback to first available (usually English)
          setSelectedLanguageState(languages[0].code);
          localStorage.setItem("voiceAssistantLanguage", languages[0].code);
        }
      }
    };

    loadLanguages();

    // Reload when voices change
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadLanguages;
    }
  }, [selectedLanguage]);

  const openVoiceAssistant = () => setIsOpen(true);
  const closeVoiceAssistant = () => setIsOpen(false);

  const setSelectedLanguage = (language: string) => {
    setSelectedLanguageState(language);
    if (typeof window !== "undefined") {
      localStorage.setItem("voiceAssistantLanguage", language);
    }
  };

  const setAssistantName = (name: string) => {
    const trimmed = (name || "").trim() || DEFAULT_ASSISTANT_NAME;
    setAssistantNameState(trimmed);
    if (typeof window !== "undefined") {
      localStorage.setItem("voiceAssistantName", trimmed);
    }
  };

  const setVoiceGender = (gender: VoiceGender) => {
    setVoiceGenderState(gender);
    if (typeof window !== "undefined") {
      localStorage.setItem("voiceAssistantGender", gender);
    }
  };

  return (
    <VoiceAssistantContext.Provider
      value={{
        isOpen,
        openVoiceAssistant,
        closeVoiceAssistant,
        userMood,
        setUserMood,
        selectedLanguage,
        setSelectedLanguage,
        availableLanguages,
        assistantName,
        setAssistantName,
        voiceGender,
        setVoiceGender,
      }}
    >
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error("useVoiceAssistant must be used within VoiceAssistantProvider");
  }
  return context;
}
