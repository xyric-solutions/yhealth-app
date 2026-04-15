/**
 * @file Wellbeing Auto-Tracker Service
 * @description Automatically detects and extracts wellbeing information from user messages
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { modelFactory } from './model-factory.service.js';
import { logger } from './logger.service.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService, type StressTrigger } from './stress.service.js';
import { energyService } from './wellbeing/energy.service.js';
import { journalService } from './wellbeing/journal.service.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { parseLlmJson } from '../helper/llm-json-parser.js';

// ============================================
// TYPES
// ============================================

export interface AutoTrackedEntry {
  type: 'mood' | 'energy' | 'stress' | 'journal' | 'habits' | 'schedule';
  action: 'auto_create' | 'suggest';
  data: Record<string, unknown>;
  confidence: number;
}

export interface AutoTrackingResult {
  entries: AutoTrackedEntry[];
  suggestions: Array<{
    type: 'journal' | 'habits' | 'schedule';
    message: string;
    data?: Record<string, unknown>;
  }>;
}

// ============================================
// TRIGGER MAPPING
// ============================================

const VALID_TRIGGERS: StressTrigger[] = ['Work', 'Relationships', 'Finances', 'Health', 'Family', 'Uncertainty', 'Time pressure', 'Conflict', 'Other'];

/**
 * Maps natural language trigger strings to valid StressTrigger enum values
 * Returns both mapped triggers and any unmapped triggers for otherTrigger field
 */
function mapTriggersToValidValues(triggers: string[]): { triggers: StressTrigger[]; otherTrigger?: string } {
  const triggerMap: Record<string, StressTrigger> = {
    // Work-related
    'work': 'Work',
    'working': 'Work',
    'overworking': 'Work',
    'overwork': 'Work',
    'job': 'Work',
    'career': 'Work',
    'boss': 'Work',
    'colleague': 'Work',
    'deadline': 'Work',
    'meeting': 'Work',
    'project': 'Work',
    'workload': 'Work',
    'staying busy': 'Work',
    'busy': 'Time pressure',
    
    // Time pressure
    'time pressure': 'Time pressure',
    'timepressure': 'Time pressure',
    'rushed': 'Time pressure',
    'rushing': 'Time pressure',
    'hurry': 'Time pressure',
    'hurried': 'Time pressure',
    'schedule': 'Time pressure',
    'scheduling': 'Time pressure',
    'time constraint': 'Time pressure',
    
    // Relationships
    'relationship': 'Relationships',
    'relationships': 'Relationships',
    'partner': 'Relationships',
    'spouse': 'Relationships',
    'boyfriend': 'Relationships',
    'girlfriend': 'Relationships',
    'friend': 'Relationships',
    'friends': 'Relationships',
    'dating': 'Relationships',
    'romance': 'Relationships',
    'social': 'Relationships',
    
    // Family
    'family': 'Family',
    'parent': 'Family',
    'parents': 'Family',
    'mother': 'Family',
    'father': 'Family',
    'mom': 'Family',
    'dad': 'Family',
    'sibling': 'Family',
    'siblings': 'Family',
    'brother': 'Family',
    'sister': 'Family',
    'child': 'Family',
    'children': 'Family',
    'kid': 'Family',
    'kids': 'Family',
    
    // Finances
    'finance': 'Finances',
    'finances': 'Finances',
    'financial': 'Finances',
    'money': 'Finances',
    'bills': 'Finances',
    'debt': 'Finances',
    'income': 'Finances',
    'salary': 'Finances',
    'payment': 'Finances',
    'expense': 'Finances',
    'expenses': 'Finances',
    'budget': 'Finances',
    
    // Health
    'health': 'Health',
    'illness': 'Health',
    'sick': 'Health',
    'sickness': 'Health',
    'disease': 'Health',
    'pain': 'Health',
    'injury': 'Health',
    'medical': 'Health',
    'doctor': 'Health',
    'hospital': 'Health',
    'treatment': 'Health',
    'symptoms': 'Health',
    
    // Uncertainty
    'uncertainty': 'Uncertainty',
    'uncertain': 'Uncertainty',
    'unknown': 'Uncertainty',
    'unclear': 'Uncertainty',
    'unpredictable': 'Uncertainty',
    'change': 'Uncertainty',
    'changes': 'Uncertainty',
    'future': 'Uncertainty',
    'unknown future': 'Uncertainty',
    
    // Conflict
    'conflict': 'Conflict',
    'disagreement': 'Conflict',
    'argument': 'Conflict',
    'fight': 'Conflict',
    'dispute': 'Conflict',
    'tension': 'Conflict',
  };

  const mappedTriggers: StressTrigger[] = [];
  const seen = new Set<StressTrigger>();
  const unmappedTriggers: string[] = [];

  for (const trigger of triggers) {
    const normalized = trigger.toLowerCase().trim();
    
    // Direct match
    if (VALID_TRIGGERS.includes(trigger as StressTrigger)) {
      if (!seen.has(trigger as StressTrigger)) {
        mappedTriggers.push(trigger as StressTrigger);
        seen.add(trigger as StressTrigger);
      }
      continue;
    }
    
    // Check mapping
    const mapped = triggerMap[normalized];
    if (mapped && !seen.has(mapped)) {
      mappedTriggers.push(mapped);
      seen.add(mapped);
      continue;
    }
    
    // Partial match (contains keyword)
    let found = false;
    for (const [key, value] of Object.entries(triggerMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        if (!seen.has(value)) {
          mappedTriggers.push(value);
          seen.add(value);
          found = true;
          break;
        }
      }
    }
    
    // If no match found, collect for otherTrigger
    if (!found) {
      unmappedTriggers.push(trigger);
    }
  }

  // If we have unmapped triggers, add "Other" if not already present
  if (unmappedTriggers.length > 0 && !seen.has('Other')) {
    mappedTriggers.push('Other');
  }

  return {
    triggers: mappedTriggers.length > 0 ? mappedTriggers : [],
    otherTrigger: unmappedTriggers.length > 0 ? unmappedTriggers.join(', ') : undefined,
  };
}

// ============================================
// SERVICE CLASS
// ============================================

class WellbeingAutoTrackerService {
  private llm: BaseChatModel;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'light',
      temperature: 0.3,
      maxTokens: 2000,
    });
  }

  /**
   * Extract wellbeing information from user message
   */
  async extractWellbeingInfo(userId: string, message: string): Promise<AutoTrackingResult> {
    try {
      // Use LLM to extract structured data
      const extractionPrompt = `Analyze the following user message and extract any wellbeing-related information.

User message: "${message}"

Extract the following information if present:
1. Mood indicators (happy, sad, anxious, stressed, tired, energetic, etc.)
2. Energy levels (tired, energetic, low energy, high energy, etc.)
3. Stress indicators (stressed, overwhelmed, anxious, worried, etc.)
4. Reflection/thoughts that could be journaled
5. Activities/habits mentioned
6. Schedule/time-based activities mentioned

Return a JSON object with this structure:
{
  "mood": {
    "detected": boolean,
    "emoji": "😊" | "😐" | "😟" | "😡" | "😰" | "😴" | null,
    "happinessRating": number (1-10) | null,
    "energyRating": number (1-10) | null,
    "stressRating": number (1-10) | null,
    "anxietyRating": number (1-10) | null,
    "emotionTags": string[],
    "contextNote": string | null,
    "confidence": number (0-1)
  },
  "energy": {
    "detected": boolean,
    "rating": number (1-10) | null,
    "contextTag": string | null,
    "contextNote": string | null,
    "confidence": number (0-1)
  },
  "stress": {
    "detected": boolean,
    "rating": number (1-10) | null,
    "triggers": string[],
    "note": string | null,
    "confidence": number (0-1)
  },
  "journal": {
    "suggested": boolean,
    "prompt": string | null,
    "confidence": number (0-1)
  },
  "habits": {
    "suggested": boolean,
    "habitName": string | null,
    "confidence": number (0-1)
  },
  "schedule": {
    "suggested": boolean,
    "title": string | null,
    "time": string | null,
    "confidence": number (0-1)
  }
}

Only include fields where information was detected. Be conservative - only extract if you're reasonably confident.`;

      const { result: response, llm: updatedLlm } = await modelFactory.invokeWithFallback(
        this.llm,
        [extractionPrompt],
        { tier: 'light', temperature: 0.3, maxTokens: 2000 },
      );
      this.llm = updatedLlm; // Update to whichever model succeeded
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Parse JSON from response (handles markdown fences, truncated output, etc.)
      const extracted = parseLlmJson<any>(content);
      if (!extracted) {
        logger.warn('[WellbeingAutoTracker] Failed to parse LLM response', {
          content: content.substring(0, 200),
        });
        return { entries: [], suggestions: [] };
      }

      const result: AutoTrackingResult = {
        entries: [],
        suggestions: [],
      };

      // Process mood (auto-create if confidence > 0.7)
      if (extracted.mood?.detected && extracted.mood.confidence > 0.7) {
        const moodData: Record<string, unknown> = {
          mode: 'light',
        };

        if (extracted.mood.emoji) {
          moodData.moodEmoji = extracted.mood.emoji;
        }

        if (extracted.mood.happinessRating) {
          moodData.happinessRating = extracted.mood.happinessRating;
          moodData.mode = 'deep';
        }

        if (extracted.mood.energyRating) {
          moodData.energyRating = extracted.mood.energyRating;
          moodData.mode = 'deep';
        }

        if (extracted.mood.stressRating) {
          moodData.stressRating = extracted.mood.stressRating;
          moodData.mode = 'deep';
        }

        if (extracted.mood.anxietyRating) {
          moodData.anxietyRating = extracted.mood.anxietyRating;
          moodData.mode = 'deep';
        }

        if (extracted.mood.emotionTags && extracted.mood.emotionTags.length > 0) {
          moodData.emotionTags = extracted.mood.emotionTags;
        }

        if (extracted.mood.contextNote) {
          moodData.contextNote = extracted.mood.contextNote;
        }

        result.entries.push({
          type: 'mood',
          action: 'auto_create',
          data: moodData,
          confidence: extracted.mood.confidence,
        });
      }

      // Process energy (auto-create if confidence > 0.7)
      if (extracted.energy?.detected && extracted.energy.confidence > 0.7 && extracted.energy.rating) {
        result.entries.push({
          type: 'energy',
          action: 'auto_create',
          data: {
            energyRating: extracted.energy.rating,
            contextTag: extracted.energy.contextTag || undefined,
            contextNote: extracted.energy.contextNote || undefined,
          },
          confidence: extracted.energy.confidence,
        });
      }

      // Process stress (auto-create if confidence > 0.7)
      if (extracted.stress?.detected && extracted.stress.confidence > 0.7 && extracted.stress.rating) {
        // Generate client request ID for idempotency
        const clientRequestId = `auto_${userId}_${Date.now()}`;
        
        // Map triggers to valid enum values
        const rawTriggers = extracted.stress.triggers || [];
        const { triggers: mappedTriggers, otherTrigger } = mapTriggersToValidValues(rawTriggers);
        
        result.entries.push({
          type: 'stress',
          action: 'auto_create',
          data: {
            stressRating: extracted.stress.rating,
            triggers: mappedTriggers,
            otherTrigger: otherTrigger,
            note: extracted.stress.note || undefined,
            checkInType: 'on_demand',
            clientRequestId,
          },
          confidence: extracted.stress.confidence,
        });
      }

      // Process journal (suggest if confidence > 0.6)
      if (extracted.journal?.suggested && extracted.journal.confidence > 0.6) {
        result.suggestions.push({
          type: 'journal',
          message: extracted.journal.prompt || 'Would you like to journal about this?',
          data: {
            prompt: extracted.journal.prompt || 'How are you feeling about this?',
          },
        });
      }

      // Process habits (suggest if confidence > 0.6)
      if (extracted.habits?.suggested && extracted.habits.confidence > 0.6 && extracted.habits.habitName) {
        result.suggestions.push({
          type: 'habits',
          message: `Did you complete "${extracted.habits.habitName}"?`,
          data: {
            habitName: extracted.habits.habitName,
          },
        });
      }

      // Process schedule (suggest if confidence > 0.6)
      if (extracted.schedule?.suggested && extracted.schedule.confidence > 0.6) {
        result.suggestions.push({
          type: 'schedule',
          message: `Would you like to add "${extracted.schedule.title}" to your schedule${extracted.schedule.time ? ` at ${extracted.schedule.time}` : ''}?`,
          data: {
            title: extracted.schedule.title,
            time: extracted.schedule.time,
          },
        });
      }

      return result;
    } catch (error) {
      // If provider error (503, billing, etc.), refresh model for next call
      if (modelFactory.handleProviderError(error)) {
        try {
          this.llm = modelFactory.getModel({ tier: 'light', temperature: 0.3, maxTokens: 2000 });
          logger.info('[WellbeingAutoTracker] Refreshed LLM after provider error', {
            newProvider: modelFactory.getLastProviderUsed(),
          });
        } catch {
          // No providers available — will retry on next message
        }
      }
      logger.error('[WellbeingAutoTracker] Failed to extract wellbeing info', {
        userId,
        message: message.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { entries: [], suggestions: [] };
    }
  }

  /**
   * Auto-create entries from extracted data
   */
  async autoCreateEntries(userId: string, entries: AutoTrackedEntry[]): Promise<Array<{ type: string; success: boolean; id?: string; error?: string }>> {
    const results: Array<{ type: string; success: boolean; id?: string; error?: string }> = [];

    for (const entry of entries) {
      if (entry.action !== 'auto_create') continue;

      try {
        let createdId: string | undefined;

        switch (entry.type) {
          case 'mood':
            const moodLog = await moodService.createMoodLog(userId, entry.data as any);
            createdId = moodLog.id;
            
            // Queue embedding
            await embeddingQueueService.queueWellbeingEmbedding(
              userId,
              'mood',
              moodLog.id,
              'create'
            ).catch(() => {});
            break;

          case 'energy':
            const energyLog = await energyService.createEnergyLog(userId, entry.data as any);
            createdId = energyLog.id;
            
            // Queue embedding
            await embeddingQueueService.queueWellbeingEmbedding(
              userId,
              'energy',
              energyLog.id,
              'create'
            ).catch(() => {});
            break;

          case 'stress':
            const stressLog = await stressService.createStressLog(userId, entry.data as any);
            createdId = stressLog.id;
            
            // Queue embedding
            await embeddingQueueService.queueWellbeingEmbedding(
              userId,
              'stress',
              stressLog.id,
              'create'
            ).catch(() => {});
            break;

          case 'journal':
            const journalEntry = await journalService.createJournalEntry(userId, entry.data as any);
            createdId = journalEntry.id;
            
            // Queue embedding
            await embeddingQueueService.queueWellbeingEmbedding(
              userId,
              'journal',
              journalEntry.id,
              'create'
            ).catch(() => {});
            break;

          default:
            logger.warn('[WellbeingAutoTracker] Unknown entry type for auto-create', { type: entry.type });
            continue;
        }

        results.push({
          type: entry.type,
          success: true,
          id: createdId,
        });

        logger.info('[WellbeingAutoTracker] Auto-created entry', {
          userId,
          type: entry.type,
          id: createdId,
          confidence: entry.confidence,
        });
      } catch (error) {
        logger.error('[WellbeingAutoTracker] Failed to auto-create entry', {
          userId,
          type: entry.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          entryData: entry.data,
        });

        results.push({
          type: entry.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Extract wellbeing data from image analysis text
   * This extracts mood, energy, stress, and journal data from image analysis results
   */
  async extractWellbeingFromImageAnalysis(
    userId: string,
    analysisText: string,
    imageType: string
  ): Promise<AutoTrackingResult> {
    try {
      // Extract wellbeing data from any image type that contains a person
      // This includes: body_photo, fitness_progress, and potentially other types with people
      const personImageTypes = ['body_photo', 'fitness_progress'];
      
      if (!personImageTypes.includes(imageType)) {
        logger.debug('[WellbeingAutoTracker] Skipping wellbeing extraction for non-person image type', {
          userId,
          imageType,
        });
        return { entries: [], suggestions: [] };
      }

      logger.info('[WellbeingAutoTracker] Extracting wellbeing data from image analysis', {
        userId,
        imageType,
        analysisTextLength: analysisText?.length || 0,
      });

      // Truncate analysis text if too long to avoid token limits
      const truncatedAnalysis = analysisText.length > 3000 
        ? analysisText.substring(0, 3000) + '... [truncated]'
        : analysisText;

      const extractionPrompt = `Analyze the following image analysis text and extract wellbeing-related information (mood, energy, stress, journal-worthy reflections).

Image Analysis Text: "${truncatedAnalysis}"

Extract the following information if present:
1. Mood indicators (happy, sad, anxious, stressed, tired, energetic, confident, alert, etc.) - Look for facial expressions, body language, and emotional state descriptions
2. Energy levels (tired, energetic, low energy, high energy, fatigued, etc.) - Look for descriptions of energy, vitality, fatigue, or exhaustion
3. Stress indicators (stressed, overwhelmed, anxious, worried, tense, etc.) - Look for stress-related observations, tension, or anxiety indicators
4. Reflection/thoughts that could be journaled (observations about wellness, lifestyle, health status, progress, concerns, or insights)

Return a JSON object with this structure:
{
  "mood": {
    "detected": boolean,
    "emoji": "😊" | "😐" | "😟" | "😡" | "😰" | "😴" | null,
    "happinessRating": number (1-10) | null,
    "energyRating": number (1-10) | null,
    "stressRating": number (1-10) | null,
    "anxietyRating": number (1-10) | null,
    "emotionTags": string[],
    "contextNote": string | null,
    "confidence": number (0-1)
  },
  "energy": {
    "detected": boolean,
    "rating": number (1-10) | null,
    "contextTag": string | null,
    "contextNote": string | null,
    "confidence": number (0-1)
  },
  "stress": {
    "detected": boolean,
    "rating": number (1-10) | null,
    "triggers": string[],
    "note": string | null,
    "confidence": number (0-1)
  },
  "journal": {
    "suggested": boolean,
    "prompt": string | null,
    "confidence": number (0-1)
  }
}

Only include fields where information was detected. Be conservative - only extract if you're reasonably confident (confidence > 0.6).`;

      logger.debug('[WellbeingAutoTracker] Invoking LLM for wellbeing extraction', {
        userId,
        imageType,
        analysisTextLength: truncatedAnalysis.length,
      });

      const response = await this.llm.invoke(extractionPrompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      
      logger.debug('[WellbeingAutoTracker] Received LLM response', {
        userId,
        contentLength: content.length,
        hasJson: content.includes('{'),
      });
      
      // Parse JSON from response (handles markdown fences, truncated output, etc.)
      const extracted = parseLlmJson<any>(content);
      if (extracted) {
        logger.debug('[WellbeingAutoTracker] Successfully parsed JSON from LLM response', {
          userId,
          hasMood: !!(extracted as any).mood,
          hasEnergy: !!(extracted as any).energy,
          hasStress: !!(extracted as any).stress,
          hasJournal: !!(extracted as any).journal,
        });
      }
      if (!extracted) {
        logger.warn('[WellbeingAutoTracker] Failed to parse image analysis extraction', {
          userId,
          imageType,
          content: content.substring(0, 200),
        });
        return { entries: [], suggestions: [] };
      }

      const result: AutoTrackingResult = {
        entries: [],
        suggestions: [],
      };

      // Process mood (auto-create if confidence > 0.6 for image analysis)
      if (extracted.mood?.detected && extracted.mood.confidence > 0.6) {
        logger.debug('[WellbeingAutoTracker] Processing mood extraction', {
          userId,
          confidence: extracted.mood.confidence,
          hasEmoji: !!extracted.mood.emoji,
          hasRatings: !!(extracted.mood.happinessRating || extracted.mood.energyRating),
        });
        const moodData: Record<string, unknown> = {
          mode: 'light',
        };

        if (extracted.mood.emoji) {
          moodData.moodEmoji = extracted.mood.emoji;
        }

        if (extracted.mood.happinessRating) {
          moodData.happinessRating = extracted.mood.happinessRating;
        }

        if (extracted.mood.energyRating) {
          moodData.energyRating = extracted.mood.energyRating;
        }

        if (extracted.mood.stressRating) {
          moodData.stressRating = extracted.mood.stressRating;
        }

        if (extracted.mood.anxietyRating) {
          moodData.anxietyRating = extracted.mood.anxietyRating;
        }

        if (extracted.mood.emotionTags && extracted.mood.emotionTags.length > 0) {
          moodData.emotionTags = extracted.mood.emotionTags;
        }

        if (extracted.mood.contextNote) {
          moodData.note = extracted.mood.contextNote;
        }

        result.entries.push({
          type: 'mood',
          action: 'auto_create',
          data: moodData,
          confidence: extracted.mood.confidence,
        });
      }

      // Process energy (auto-create if confidence > 0.6)
      if (extracted.energy?.detected && extracted.energy.confidence > 0.6) {
        logger.debug('[WellbeingAutoTracker] Processing energy extraction', {
          userId,
          confidence: extracted.energy.confidence,
          rating: extracted.energy.rating,
        });
        const energyData: Record<string, unknown> = {};

        if (extracted.energy.rating) {
          energyData.rating = extracted.energy.rating;
        }

        if (extracted.energy.contextTag) {
          energyData.contextTag = extracted.energy.contextTag;
        }

        if (extracted.energy.contextNote) {
          energyData.note = extracted.energy.contextNote;
        }

        result.entries.push({
          type: 'energy',
          action: 'auto_create',
          data: energyData,
          confidence: extracted.energy.confidence,
        });
      }

      // Process stress (auto-create if confidence > 0.6)
      if (extracted.stress?.detected && extracted.stress.confidence > 0.6) {
        logger.debug('[WellbeingAutoTracker] Processing stress extraction', {
          userId,
          confidence: extracted.stress.confidence,
          rating: extracted.stress.rating,
          hasTriggers: !!(extracted.stress.triggers && extracted.stress.triggers.length > 0),
        });
        const stressData: Record<string, unknown> = {};

        if (extracted.stress.rating) {
          stressData.stressRating = extracted.stress.rating;
        }

        if (extracted.stress.triggers && extracted.stress.triggers.length > 0) {
          // Map triggers to valid enum values
          const { triggers: mappedTriggers, otherTrigger } = mapTriggersToValidValues(extracted.stress.triggers);
          stressData.triggers = mappedTriggers;
          if (otherTrigger) {
            stressData.otherTrigger = otherTrigger;
          }
        }

        if (extracted.stress.note) {
          stressData.note = extracted.stress.note;
        }
        
        // Add required fields for CreateStressLogInput
        stressData.checkInType = 'manual';
        stressData.clientRequestId = `auto-track-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        result.entries.push({
          type: 'stress',
          action: 'auto_create',
          data: stressData,
          confidence: extracted.stress.confidence,
        });
      }

      // Process journal - auto-create if confidence > 0.7, suggest if 0.6-0.7
      if (extracted.journal?.suggested && extracted.journal.confidence > 0.6 && extracted.journal.prompt) {
        if (extracted.journal.confidence > 0.7) {
          // Auto-create journal entry for high confidence
          const journalData: Record<string, unknown> = {
            entryText: extracted.journal.prompt,
            prompt: 'Image Analysis Reflection',
            promptCategory: 'wellness',
            mode: 'light',
          };

          result.entries.push({
            type: 'journal',
            action: 'auto_create',
            data: journalData,
            confidence: extracted.journal.confidence,
          });

          logger.debug('[WellbeingAutoTracker] Auto-creating journal entry from image analysis', {
            userId,
            confidence: extracted.journal.confidence,
          });
        } else {
          // Suggest journal entry for medium confidence
          result.suggestions.push({
            type: 'journal',
            message: extracted.journal.prompt,
            data: {
              source: 'image_analysis',
              prompt: extracted.journal.prompt,
            },
          });
        }
      }

      logger.info('[WellbeingAutoTracker] Completed wellbeing extraction from image analysis', {
        userId,
        imageType,
        entriesCount: result.entries.length,
        suggestionsCount: result.suggestions.length,
        entryTypes: result.entries.map(e => e.type),
      });

      return result;
    } catch (error) {
      logger.error('[WellbeingAutoTracker] Failed to extract wellbeing from image analysis', {
        userId,
        imageType,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { entries: [], suggestions: [] };
    }
  }
}

export const wellbeingAutoTrackerService = new WellbeingAutoTrackerService();
export default wellbeingAutoTrackerService;

