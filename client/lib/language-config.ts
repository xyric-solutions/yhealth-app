/**
 * Language Configuration for Voice Assistant
 * Supports all languages available through browser Web Speech API
 */

export interface LanguageConfig {
  code: string; // BCP 47 format (e.g., "en-US", "hi-IN")
  displayName: string; // English display name
  nativeName: string; // Native language name
  flag: string; // Flag emoji
  region?: string; // Region grouping (e.g., "South Asia", "Europe")
  supported: {
    recognition: boolean; // Speech recognition support
    tts: boolean; // Text-to-speech support
  };
}

// Common language configurations
export const LANGUAGE_CONFIGS: LanguageConfig[] = [
  // English variants
  { code: "en-US", displayName: "English (US)", nativeName: "English", flag: "🇺🇸", region: "North America", supported: { recognition: true, tts: true } },
  { code: "en-GB", displayName: "English (UK)", nativeName: "English", flag: "🇬🇧", region: "Europe", supported: { recognition: true, tts: true } },
  { code: "en-AU", displayName: "English (Australia)", nativeName: "English", flag: "🇦🇺", region: "Oceania", supported: { recognition: true, tts: true } },
  { code: "en-CA", displayName: "English (Canada)", nativeName: "English", flag: "🇨🇦", region: "North America", supported: { recognition: true, tts: true } },
  { code: "en-IN", displayName: "English (India)", nativeName: "English", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Hindi
  { code: "hi-IN", displayName: "Hindi", nativeName: "हिंदी", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Urdu
  { code: "ur-PK", displayName: "Urdu (Pakistan)", nativeName: "اردو", flag: "🇵🇰", region: "South Asia", supported: { recognition: true, tts: true } },
  { code: "ur-IN", displayName: "Urdu (India)", nativeName: "اردو", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Punjabi
  { code: "pa-IN", displayName: "Punjabi (India)", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  { code: "pa-PK", displayName: "Punjabi (Pakistan)", nativeName: "پنجابی", flag: "🇵🇰", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // French
  { code: "fr-FR", displayName: "French (France)", nativeName: "Français", flag: "🇫🇷", region: "Europe", supported: { recognition: true, tts: true } },
  { code: "fr-CA", displayName: "French (Canada)", nativeName: "Français", flag: "🇨🇦", region: "North America", supported: { recognition: true, tts: true } },
  { code: "fr-BE", displayName: "French (Belgium)", nativeName: "Français", flag: "🇧🇪", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Arabic
  { code: "ar-SA", displayName: "Arabic (Saudi Arabia)", nativeName: "العربية", flag: "🇸🇦", region: "Middle East", supported: { recognition: true, tts: true } },
  { code: "ar-EG", displayName: "Arabic (Egypt)", nativeName: "العربية", flag: "🇪🇬", region: "Middle East", supported: { recognition: true, tts: true } },
  { code: "ar-AE", displayName: "Arabic (UAE)", nativeName: "العربية", flag: "🇦🇪", region: "Middle East", supported: { recognition: true, tts: true } },
  
  // Spanish
  { code: "es-ES", displayName: "Spanish (Spain)", nativeName: "Español", flag: "🇪🇸", region: "Europe", supported: { recognition: true, tts: true } },
  { code: "es-MX", displayName: "Spanish (Mexico)", nativeName: "Español", flag: "🇲🇽", region: "North America", supported: { recognition: true, tts: true } },
  { code: "es-AR", displayName: "Spanish (Argentina)", nativeName: "Español", flag: "🇦🇷", region: "South America", supported: { recognition: true, tts: true } },
  
  // German
  { code: "de-DE", displayName: "German", nativeName: "Deutsch", flag: "🇩🇪", region: "Europe", supported: { recognition: true, tts: true } },
  { code: "de-AT", displayName: "German (Austria)", nativeName: "Deutsch", flag: "🇦🇹", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Italian
  { code: "it-IT", displayName: "Italian", nativeName: "Italiano", flag: "🇮🇹", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Portuguese
  { code: "pt-BR", displayName: "Portuguese (Brazil)", nativeName: "Português", flag: "🇧🇷", region: "South America", supported: { recognition: true, tts: true } },
  { code: "pt-PT", displayName: "Portuguese (Portugal)", nativeName: "Português", flag: "🇵🇹", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Chinese
  { code: "zh-CN", displayName: "Chinese (Simplified)", nativeName: "中文", flag: "🇨🇳", region: "East Asia", supported: { recognition: true, tts: true } },
  { code: "zh-TW", displayName: "Chinese (Traditional)", nativeName: "中文", flag: "🇹🇼", region: "East Asia", supported: { recognition: true, tts: true } },
  
  // Japanese
  { code: "ja-JP", displayName: "Japanese", nativeName: "日本語", flag: "🇯🇵", region: "East Asia", supported: { recognition: true, tts: true } },
  
  // Korean
  { code: "ko-KR", displayName: "Korean", nativeName: "한국어", flag: "🇰🇷", region: "East Asia", supported: { recognition: true, tts: true } },
  
  // Russian
  { code: "ru-RU", displayName: "Russian", nativeName: "Русский", flag: "🇷🇺", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Turkish
  { code: "tr-TR", displayName: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", region: "Middle East", supported: { recognition: true, tts: true } },
  
  // Bengali
  { code: "bn-IN", displayName: "Bengali (India)", nativeName: "বাংলা", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  { code: "bn-BD", displayName: "Bengali (Bangladesh)", nativeName: "বাংলা", flag: "🇧🇩", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Tamil
  { code: "ta-IN", displayName: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Telugu
  { code: "te-IN", displayName: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Marathi
  { code: "mr-IN", displayName: "Marathi", nativeName: "मराठी", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Gujarati
  { code: "gu-IN", displayName: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", region: "South Asia", supported: { recognition: true, tts: true } },
  
  // Dutch
  { code: "nl-NL", displayName: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Polish
  { code: "pl-PL", displayName: "Polish", nativeName: "Polski", flag: "🇵🇱", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Swedish
  { code: "sv-SE", displayName: "Swedish", nativeName: "Svenska", flag: "🇸🇪", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Norwegian
  { code: "no-NO", displayName: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Danish
  { code: "da-DK", displayName: "Danish", nativeName: "Dansk", flag: "🇩🇰", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Finnish
  { code: "fi-FI", displayName: "Finnish", nativeName: "Suomi", flag: "🇫🇮", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Greek
  { code: "el-GR", displayName: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Hebrew
  { code: "he-IL", displayName: "Hebrew", nativeName: "עברית", flag: "🇮🇱", region: "Middle East", supported: { recognition: true, tts: true } },
  
  // Thai
  { code: "th-TH", displayName: "Thai", nativeName: "ไทย", flag: "🇹🇭", region: "Southeast Asia", supported: { recognition: true, tts: true } },
  
  // Vietnamese
  { code: "vi-VN", displayName: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", region: "Southeast Asia", supported: { recognition: true, tts: true } },
  
  // Indonesian
  { code: "id-ID", displayName: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", region: "Southeast Asia", supported: { recognition: true, tts: true } },
  
  // Malay
  { code: "ms-MY", displayName: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", region: "Southeast Asia", supported: { recognition: true, tts: true } },
  
  // Czech
  { code: "cs-CZ", displayName: "Czech", nativeName: "Čeština", flag: "🇨🇿", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Romanian
  { code: "ro-RO", displayName: "Romanian", nativeName: "Română", flag: "🇷🇴", region: "Europe", supported: { recognition: true, tts: true } },
  
  // Hungarian
  { code: "hu-HU", displayName: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", region: "Europe", supported: { recognition: true, tts: true } },
];

/**
 * Get language configuration by code
 */
export function getLanguageByCode(code: string): LanguageConfig | undefined {
  return LANGUAGE_CONFIGS.find(lang => lang.code === code);
}

/**
 * Get display name for language code
 */
export function getLanguageDisplayName(code: string): string {
  const lang = getLanguageByCode(code);
  if (lang) return lang.displayName;
  
  // Fallback: try to parse and format the code
  const parts = code.split("-");
  if (parts.length >= 2) {
    return `${parts[0].toUpperCase()}-${parts[1].toUpperCase()}`;
  }
  return code;
}

/**
 * Get native name for language code
 */
export function getLanguageNativeName(code: string): string {
  const lang = getLanguageByCode(code);
  return lang?.nativeName || getLanguageDisplayName(code);
}

/**
 * Get all available languages from browser
 * Returns all configured languages (browser will use best available voice)
 */
export function getAvailableLanguages(): LanguageConfig[] {
  // Return all configured languages - browser will use best available voice
  // This allows users to select any language even if specific voices aren't loaded yet
  return LANGUAGE_CONFIGS;
}

/**
 * Group languages by region
 */
export function groupLanguagesByRegion(languages: LanguageConfig[]): Record<string, LanguageConfig[]> {
  const grouped: Record<string, LanguageConfig[]> = {};
  
  languages.forEach(lang => {
    const region = lang.region || "Other";
    if (!grouped[region]) {
      grouped[region] = [];
    }
    grouped[region].push(lang);
  });

  // Sort regions and languages within regions
  Object.keys(grouped).forEach(region => {
    grouped[region].sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  return grouped;
}

/**
 * Detect browser/system language
 * Returns the best matching language code from our configs
 */
export function detectBrowserLanguage(): string {
  if (typeof window === "undefined" || !navigator) {
    return "en-US";
  }

  const browserLangs = navigator.languages || [navigator.language || "en-US"];
  
  // Try to find exact match first
  for (const browserLang of browserLangs) {
    const exactMatch = LANGUAGE_CONFIGS.find(lang => lang.code === browserLang);
    if (exactMatch) {
      return exactMatch.code;
    }
  }

  // Try to find base language match (e.g., "en" matches "en-US")
  for (const browserLang of browserLangs) {
    const baseLang = browserLang.split("-")[0];
    const baseMatch = LANGUAGE_CONFIGS.find(lang => {
      const langBase = lang.code.split("-")[0];
      return langBase === baseLang;
    });
    if (baseMatch) {
      return baseMatch.code;
    }
  }

  // Default to English US
  return "en-US";
}

/**
 * Check if a language code is supported for speech recognition
 */
export function isRecognitionSupported(code: string): boolean {
  const lang = getLanguageByCode(code);
  return lang?.supported.recognition ?? false;
}

/**
 * Check if a language code is supported for TTS
 */
export function isTTSSupported(code: string): boolean {
  const lang = getLanguageByCode(code);
  return lang?.supported.tts ?? false;
}

/**
 * Get fallback language if current language is not available
 */
export function getFallbackLanguage(code: string): string {
  const lang = getLanguageByCode(code);
  if (!lang) return "en-US";

  // Try same base language first (e.g., "en-GB" -> "en-US")
  const baseLang = code.split("-")[0];
  const sameBase = LANGUAGE_CONFIGS.find(l => 
    l.code !== code && 
    l.code.startsWith(baseLang) && 
    l.supported.recognition && 
    l.supported.tts
  );
  if (sameBase) return sameBase.code;

  // Fallback to English
  return "en-US";
}

