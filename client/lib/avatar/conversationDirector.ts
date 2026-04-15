/**
 * @file Conversation Director
 * @description Analyzes AI response text and dispatches gesture + emotion directives.
 * Runs before TTS — splits response into sentences, classifies each, and produces
 * timed directives that the GesturePlayer and expression system consume.
 *
 * Zero dependencies on React or Three.js — pure text analysis.
 */

import type { GestureType } from './gestureSystem';

// ============================================
// TYPES
// ============================================

export interface ConversationDirective {
  /** Emotion to set (maps to EmotionModulators key). */
  emotion: string;
  /** Gesture to queue. */
  gesture: GestureType;
  /** Emotion intensity (0-1). */
  intensity: number;
  /** Delay in seconds from response start (estimated from sentence position). */
  delaySec: number;
}

type SentenceType =
  | 'question'
  | 'exclamation'
  | 'list_item'
  | 'greeting'
  | 'empathy'
  | 'explanation'
  | 'agreement'
  | 'disagreement'
  | 'encouragement'
  | 'warning'
  | 'default';

type Sentiment = 'positive' | 'negative' | 'neutral' | 'empathetic' | 'urgent';

// ============================================
// SENTENCE → GESTURE MAP
// ============================================

const SENTENCE_GESTURE_MAP: Record<SentenceType, GestureType[]> = {
  question:      ['hand_to_chin', 'open_palm_up'],
  exclamation:   ['both_hands_out', 'reach_out'],
  list_item:     ['counting_fingers', 'point_forward'],
  greeting:      ['left_hand_wave'],
  empathy:       ['hands_together', 'soft_nod'],
  explanation:   ['open_palm_up', 'point_forward', 'both_hands_out'],
  agreement:     ['head_nod_agree', 'thumbs_up', 'soft_nod'],
  disagreement:  ['head_shake_disagree', 'shrug'],
  encouragement: ['thumbs_up', 'both_hands_out', 'reach_out'],
  warning:       ['point_forward', 'open_palm_up'],
  default:       ['open_palm_up', 'soft_nod', 'idle_rest'],
};

// ============================================
// SENTIMENT → EMOTION MAP
// ============================================

const SENTIMENT_EMOTION_MAP: Record<Sentiment, string[]> = {
  positive:   ['happy', 'excitement', 'confident'],
  negative:   ['concern', 'sad', 'empathy'],
  neutral:    ['neutral', 'explaining', 'contemplation'],
  empathetic: ['empathy', 'concern', 'listening'],
  urgent:     ['determination', 'concern', 'angry'],
};

// ============================================
// KEYWORD PATTERNS
// ============================================

const GREETING_PATTERNS = /\b(hi|hello|hey|good\s+(morning|afternoon|evening)|welcome|greetings|namaste|salaam)\b/i;
const EMPATHY_PATTERNS = /\b(i\s+understand|i'm\s+sorry|that's\s+tough|i\s+hear\s+you|must\s+be\s+(hard|difficult)|feel\s+for\s+you|sorry\s+to\s+hear)\b/i;
const EXPLANATION_PATTERNS = /\b(here's\s+(how|what|why)|let\s+me\s+explain|the\s+reason|because|this\s+means|basically|in\s+other\s+words|think\s+of\s+it)\b/i;
const AGREEMENT_PATTERNS = /\b(exactly|absolutely|definitely|you're\s+right|that's\s+correct|i\s+agree|yes|great\s+job|well\s+done|perfect|nice)\b/i;
const DISAGREEMENT_PATTERNS = /\b(however|but|actually|not\s+quite|i\s+disagree|that's\s+not|unfortunately|the\s+problem|issue\s+is|careful)\b/i;
const ENCOURAGEMENT_PATTERNS = /\b(you\s+can|keep\s+going|great\s+work|proud|amazing|fantastic|let's\s+go|you've\s+got|believe\s+in|push|crush\s+it)\b/i;
const WARNING_PATTERNS = /\b(be\s+careful|warning|watch\s+out|important|critical|don't\s+ignore|red\s+flag|danger|risk|seriously)\b/i;
const LIST_ITEM_PATTERNS = /^\s*(\d+[\.\)]\s|[-•]\s|first(ly)?|second(ly)?|third(ly)?|finally|also|next|then)\b/i;

const POSITIVE_KEYWORDS = /\b(good|great|excellent|amazing|wonderful|fantastic|love|happy|excited|proud|strong|healthy|improving|better|progress|success)\b/i;
const NEGATIVE_KEYWORDS = /\b(bad|poor|low|worse|decline|drop|concern|worry|stress|pain|tired|exhausted|problem|issue|unfortunately|sad|anxious)\b/i;
const EMPATHETIC_KEYWORDS = /\b(understand|feel|hear|sorry|tough|hard|struggle|difficult|challenging)\b/i;
const URGENT_KEYWORDS = /\b(must|need\s+to|right\s+now|immediately|critical|emergency|urgent|asap|cannot\s+ignore)\b/i;

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

function classifySentenceType(sentence: string): SentenceType {
  const trimmed = sentence.trim();

  if (GREETING_PATTERNS.test(trimmed)) return 'greeting';
  if (EMPATHY_PATTERNS.test(trimmed)) return 'empathy';
  if (LIST_ITEM_PATTERNS.test(trimmed)) return 'list_item';
  if (AGREEMENT_PATTERNS.test(trimmed)) return 'agreement';
  if (DISAGREEMENT_PATTERNS.test(trimmed)) return 'disagreement';
  if (ENCOURAGEMENT_PATTERNS.test(trimmed)) return 'encouragement';
  if (WARNING_PATTERNS.test(trimmed)) return 'warning';
  if (EXPLANATION_PATTERNS.test(trimmed)) return 'explanation';
  if (trimmed.endsWith('?')) return 'question';
  if (trimmed.endsWith('!')) return 'exclamation';
  return 'default';
}

function classifySentiment(sentence: string): Sentiment {
  const scores = {
    positive: 0,
    negative: 0,
    empathetic: 0,
    urgent: 0,
  };

  const matches = (pattern: RegExp) => (sentence.match(pattern) || []).length;
  scores.positive = matches(POSITIVE_KEYWORDS);
  scores.negative = matches(NEGATIVE_KEYWORDS);
  scores.empathetic = matches(EMPATHETIC_KEYWORDS);
  scores.urgent = matches(URGENT_KEYWORDS);

  const max = Math.max(scores.positive, scores.negative, scores.empathetic, scores.urgent);
  if (max === 0) return 'neutral';
  if (scores.urgent === max) return 'urgent';
  if (scores.empathetic === max) return 'empathetic';
  if (scores.negative === max) return 'negative';
  if (scores.positive === max) return 'positive';
  return 'neutral';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Split text into sentences (handles ., !, ?, and newlines). */
function splitSentences(text: string): string[] {
  // Clean markdown formatting
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')       // Italic
    .replace(/#{1,6}\s/g, '')          // Headers
    .replace(/```[\s\S]*?```/g, '')    // Code blocks
    .trim();

  // Split on sentence-ending punctuation or newlines
  return cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

// ============================================
// MAIN EXPORTS
// ============================================

/** Average words-per-second for TTS speech estimation. */
const WORDS_PER_SECOND = 2.8;

/**
 * Analyze an AI response and produce timed gesture/emotion directives.
 * Call this before TTS playback starts.
 */
export function analyzeResponse(text: string): ConversationDirective[] {
  const sentences = splitSentences(text);
  const directives: ConversationDirective[] = [];

  let cumulativeWords = 0;
  let lastGesture: GestureType | null = null;

  for (const sentence of sentences) {
    const type = classifySentenceType(sentence);
    const sentiment = classifySentiment(sentence);

    // Pick gesture (avoid repeating the last one)
    const candidates = SENTENCE_GESTURE_MAP[type];
    let gesture = pickRandom(candidates);
    if (gesture === lastGesture && candidates.length > 1) {
      gesture = candidates.find(g => g !== lastGesture) ?? gesture;
    }
    lastGesture = gesture;

    // Pick emotion
    const emotions = SENTIMENT_EMOTION_MAP[sentiment];
    const emotion = pickRandom(emotions);

    // Estimate delay from word count
    const wordCount = sentence.split(/\s+/).length;
    const delaySec = cumulativeWords / WORDS_PER_SECOND;
    cumulativeWords += wordCount;

    // Intensity based on punctuation and urgency
    let intensity = 0.6;
    if (sentence.endsWith('!')) intensity = 0.8;
    if (sentiment === 'urgent') intensity = 0.9;
    if (type === 'empathy') intensity = 0.7;
    if (type === 'greeting') intensity = 0.5;

    directives.push({ emotion, gesture, intensity, delaySec });

    // For long sentences (>15 words), inject a mid-sentence gesture
    // This keeps hands moving naturally during extended speech
    if (wordCount > 15) {
      const midGestures: GestureType[] = ['open_palm_up', 'soft_nod', 'reach_out', 'both_hands_out'];
      const midGesture = midGestures.find(g => g !== gesture) ?? pickRandom(midGestures);
      const midDelay = delaySec + (wordCount / 2) / WORDS_PER_SECOND;
      directives.push({ emotion, gesture: midGesture, intensity: intensity * 0.8, delaySec: midDelay });
    }
  }

  return directives;
}

/**
 * Get the initial emotion for the first sentence (use before any delay).
 */
export function getInitialDirective(text: string): ConversationDirective | null {
  const directives = analyzeResponse(text);
  return directives.length > 0 ? directives[0] : null;
}
