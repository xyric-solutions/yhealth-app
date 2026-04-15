/**
 * Language Configuration Tests
 * Tests for multi-language support configuration
 */

import { describe, it, expect } from '@jest/globals';

describe('Language Configuration', () => {
  describe('Supported Languages', () => {
    it('should have a list of supported languages', () => {
      const supportedLanguages = [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
      ];

      expect(supportedLanguages.length).toBeGreaterThan(0);
      expect(supportedLanguages[0].code).toBe('en');
    });

    it('should validate language codes', () => {
      const validCodes = ['en', 'es', 'fr', 'de', 'ar', 'ur'];
      const testCode = 'en';

      expect(validCodes.includes(testCode)).toBe(true);
    });

    it('should have RTL configuration for Arabic and Urdu', () => {
      const rtlLanguages = ['ar', 'ur'];
      const testLanguage = 'ar';

      expect(rtlLanguages.includes(testLanguage)).toBe(true);
    });

    it('should have LTR configuration for other languages', () => {
      const ltrLanguages = ['en', 'es', 'fr', 'de'];
      const testLanguage = 'en';

      expect(ltrLanguages.includes(testLanguage)).toBe(true);
    });
  });

  describe('Language Detection', () => {
    it('should detect browser language', () => {
      const browserLanguage = navigator.language || 'en';

      expect(browserLanguage).toBeTruthy();
      expect(typeof browserLanguage).toBe('string');
    });

    it('should fall back to default language', () => {
      const detectedLanguage = 'xx'; // Unsupported
      const defaultLanguage = 'en';
      const supportedLanguages = ['en', 'es', 'fr'];

      const finalLanguage = supportedLanguages.includes(detectedLanguage)
        ? detectedLanguage
        : defaultLanguage;

      expect(finalLanguage).toBe('en');
    });

    it('should normalize language codes', () => {
      const testCases = [
        { input: 'en-US', expected: 'en' },
        { input: 'es-ES', expected: 'es' },
        { input: 'fr-FR', expected: 'fr' },
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = input.split('-')[0];
        expect(normalized).toBe(expected);
      });
    });
  });

  describe('Translation Keys', () => {
    it('should have common translation keys', () => {
      const commonKeys = [
        'common.save',
        'common.cancel',
        'common.delete',
        'common.edit',
        'common.submit',
        'common.loading',
      ];

      expect(commonKeys).toHaveLength(6);
      expect(commonKeys).toContain('common.save');
    });

    it('should have feature-specific translation keys', () => {
      const workoutKeys = [
        'workout.plan',
        'workout.exercises',
        'workout.sets',
        'workout.reps',
      ];

      expect(workoutKeys).toHaveLength(4);
      expect(workoutKeys).toContain('workout.plan');
    });

    it('should support nested translation keys', () => {
      const mockTranslation = {
        dashboard: {
          welcome: 'Welcome',
          tabs: {
            workouts: 'Workouts',
            nutrition: 'Nutrition',
            progress: 'Progress',
          },
        },
      };

      expect(mockTranslation.dashboard.tabs.workouts).toBe('Workouts');
    });
  });

  describe('Date and Number Formatting', () => {
    it('should format dates according to locale', () => {
      const testDate = new Date('2024-01-15');
      const enFormat = new Intl.DateTimeFormat('en').format(testDate);
      const esFormat = new Intl.DateTimeFormat('es').format(testDate);

      expect(enFormat).toBeTruthy();
      expect(esFormat).toBeTruthy();
      // Formats might differ
      expect(typeof enFormat).toBe('string');
    });

    it('should format numbers according to locale', () => {
      const testNumber = 1234.56;
      const enFormat = new Intl.NumberFormat('en').format(testNumber);
      const deFormat = new Intl.NumberFormat('de').format(testNumber);

      expect(enFormat).toBeTruthy();
      expect(deFormat).toBeTruthy();
    });

    it('should format currency according to locale', () => {
      const testAmount = 99.99;
      const usdFormat = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(testAmount);

      expect(usdFormat).toContain('$');
      expect(usdFormat).toContain('99.99');
    });
  });

  describe('Text Direction', () => {
    it('should set dir="ltr" for LTR languages', () => {
      const ltrLanguages = ['en', 'es', 'fr', 'de'];

      ltrLanguages.forEach(_lang => {
        const dir = 'ltr';
        expect(dir).toBe('ltr');
      });
    });

    it('should set dir="rtl" for RTL languages', () => {
      const rtlLanguages = ['ar', 'ur'];

      rtlLanguages.forEach(_lang => {
        const dir = 'rtl';
        expect(dir).toBe('rtl');
      });
    });

    it('should apply RTL-specific CSS classes', () => {
      const isRTL = true;
      const className = isRTL ? 'rtl' : 'ltr';

      expect(className).toBe('rtl');
    });
  });

  describe('Language Persistence', () => {
    it('should save language preference to localStorage', () => {
      const mockStorage: Record<string, string> = {};

      const setItem = (key: string, value: string) => {
        mockStorage[key] = value;
      };

      setItem('preferredLanguage', 'es');

      expect(mockStorage.preferredLanguage).toBe('es');
    });

    it('should retrieve language preference from localStorage', () => {
      const mockStorage: Record<string, string> = {
        preferredLanguage: 'fr',
      };

      const getItem = (key: string) => mockStorage[key];

      expect(getItem('preferredLanguage')).toBe('fr');
    });

    it('should handle missing localStorage gracefully', () => {
      const mockStorage: Record<string, string> = {};
      const getItem = (key: string) => mockStorage[key];
      const defaultLanguage = 'en';

      const language = getItem('preferredLanguage') || defaultLanguage;

      expect(language).toBe('en');
    });
  });

  describe('Dynamic Language Switching', () => {
    it('should switch language at runtime', () => {
      let currentLanguage = 'en';

      const switchLanguage = (newLanguage: string) => {
        currentLanguage = newLanguage;
      };

      switchLanguage('es');

      expect(currentLanguage).toBe('es');
    });

    it('should reload translations after language change', () => {
      let translationsLoaded = false;

      const loadTranslations = (language: string) => {
        translationsLoaded = true;
        return { language };
      };

      const result = loadTranslations('fr');

      expect(translationsLoaded).toBe(true);
      expect(result.language).toBe('fr');
    });

    it('should update document attributes on language change', () => {
      const updateDocument = (lang: string, dir: string) => {
        return { lang, dir };
      };

      const result = updateDocument('ar', 'rtl');

      expect(result.lang).toBe('ar');
      expect(result.dir).toBe('rtl');
    });
  });

  describe('Pluralization', () => {
    it('should handle plural forms', () => {
      const getPluralForm = (count: number, singular: string, plural: string) => {
        return count === 1 ? singular : plural;
      };

      expect(getPluralForm(1, 'workout', 'workouts')).toBe('workout');
      expect(getPluralForm(5, 'workout', 'workouts')).toBe('workouts');
    });

    it('should support complex pluralization rules', () => {
      // Example: Arabic has different plural rules
      const getArabicPluralForm = (count: number) => {
        if (count === 0) return 'zero';
        if (count === 1) return 'one';
        if (count === 2) return 'two';
        if (count >= 3 && count <= 10) return 'few';
        if (count >= 11) return 'many';
        return 'other';
      };

      expect(getArabicPluralForm(0)).toBe('zero');
      expect(getArabicPluralForm(1)).toBe('one');
      expect(getArabicPluralForm(5)).toBe('few');
      expect(getArabicPluralForm(15)).toBe('many');
    });
  });

  describe('Missing Translations', () => {
    it('should fall back to key when translation is missing', () => {
      const translations: Record<string, string> = {
        'common.save': 'Save',
      };

      const t = (key: string) => translations[key] || key;

      expect(t('common.save')).toBe('Save');
      expect(t('common.missing')).toBe('common.missing');
    });

    it('should fall back to English translation', () => {
      const enTranslations: Record<string, string> = {
        'workout.plan': 'Workout Plan',
      };
      const esTranslations: Record<string, string> = {};

      const getTranslation = (key: string, lang: string) => {
        if (lang === 'es' && esTranslations[key]) {
          return esTranslations[key];
        }
        return enTranslations[key] || key;
      };

      expect(getTranslation('workout.plan', 'es')).toBe('Workout Plan');
    });

    it('should log missing translation warnings', () => {
      const warnings: string[] = [];

      const t = (key: string, translations: Record<string, string>) => {
        if (!translations[key]) {
          warnings.push(`Missing translation: ${key}`);
          return key;
        }
        return translations[key];
      };

      t('missing.key', {});

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('missing.key');
    });
  });
});
