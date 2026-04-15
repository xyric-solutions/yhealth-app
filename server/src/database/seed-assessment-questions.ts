/**
 * Assessment Questions Seed File
 *
 * Seeds the assessment_questions table with goal-specific and universal questions
 * based on PRD Epic-01 requirements.
 *
 * Question Categories:
 * - Goal-specific questions (8-12 per goal)
 * - Cross-pillar universal questions (asked for ALL goals)
 *
 * @see balencia-platform/prd-epics/PRD-Epic-01-Onboarding-Assessment.md
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

type GoalCategory =
  | 'weight_loss'
  | 'muscle_gain'
  | 'sleep_improvement'
  | 'stress_reduction'
  | 'energy_boost'
  | 'event_training'
  | 'health_condition'
  | 'habit_building'
  | 'overall_optimization'
  | 'universal'; // For cross-pillar questions asked for all goals

type QuestionType =
  | 'single_select'
  | 'multi_select'
  | 'slider'
  | 'emoji_scale'
  | 'number_input'
  | 'date_picker'
  | 'text_input';

type HealthPillar = 'fitness' | 'nutrition' | 'wellbeing' | null;

interface SliderConfig {
  min: number;
  max: number;
  step: number;
  unit?: string;
  labels?: { value: number; label: string }[];
}

interface ValidationConfig {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
}

interface ShowIfCondition {
  question_id: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number | string[];
}

interface QuestionOption {
  value: string;
  label: string;
  emoji?: string;
  description?: string;
}

interface AssessmentQuestion {
  id: string;
  question_id: string;
  text: string;
  type: QuestionType;
  category: GoalCategory;
  pillar: HealthPillar;
  order_num: number;
  is_required: boolean;
  options: QuestionOption[] | null;
  slider_config: SliderConfig | null;
  validation: ValidationConfig | null;
  show_if: ShowIfCondition | null;
  is_active: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createQuestion(
  questionId: string,
  text: string,
  type: QuestionType,
  category: GoalCategory,
  pillar: HealthPillar,
  orderNum: number,
  options: Partial<{
    options: QuestionOption[];
    sliderConfig: SliderConfig;
    validation: ValidationConfig;
    showIf: ShowIfCondition;
    isRequired: boolean;
  }> = {}
): AssessmentQuestion {
  return {
    id: randomUUID(),
    question_id: questionId,
    text,
    type,
    category,
    pillar,
    order_num: orderNum,
    is_required: options.isRequired ?? true,
    options: options.options ?? null,
    slider_config: options.sliderConfig ?? null,
    validation: options.validation ?? null,
    show_if: options.showIf ?? null,
    is_active: true,
  };
}

// =============================================================================
// UNIVERSAL CROSS-PILLAR QUESTIONS (Asked for ALL goals)
// =============================================================================

const universalQuestions: AssessmentQuestion[] = [
  // -------------------------------------------------------------------------
  // FITNESS BASELINE (Universal)
  // -------------------------------------------------------------------------
  createQuestion(
    'universal_fitness_activity_days',
    'How many days per week do you currently exercise or engage in physical activity?',
    'slider',
    'universal',
    'fitness',
    1,
    {
      sliderConfig: {
        min: 0,
        max: 7,
        step: 1,
        unit: 'days',
        labels: [
          { value: 0, label: 'None' },
          { value: 1, label: '1 day' },
          { value: 3, label: '3 days' },
          { value: 5, label: '5 days' },
          { value: 7, label: 'Daily' },
        ],
      },
    }
  ),

  createQuestion(
    'universal_fitness_primary_activities',
    'What are your primary physical activities? Select all that apply.',
    'multi_select',
    'universal',
    'fitness',
    2,
    {
      options: [
        { value: 'walking', label: 'Walking', emoji: '🚶' },
        { value: 'running', label: 'Running/Jogging', emoji: '🏃' },
        { value: 'gym_weights', label: 'Gym/Weight Training', emoji: '🏋️' },
        { value: 'yoga', label: 'Yoga/Pilates', emoji: '🧘' },
        { value: 'swimming', label: 'Swimming', emoji: '🏊' },
        { value: 'cycling', label: 'Cycling', emoji: '🚴' },
        { value: 'sports', label: 'Team Sports', emoji: '⚽' },
        { value: 'hiit', label: 'HIIT/CrossFit', emoji: '💪' },
        { value: 'dance', label: 'Dance', emoji: '💃' },
        { value: 'martial_arts', label: 'Martial Arts', emoji: '🥋' },
        { value: 'hiking', label: 'Hiking', emoji: '🥾' },
        { value: 'none', label: 'No regular activity', emoji: '🛋️' },
      ],
      isRequired: true,
    }
  ),

  createQuestion(
    'universal_fitness_wearable',
    'Do you own a fitness tracker or smartwatch?',
    'single_select',
    'universal',
    'fitness',
    3,
    {
      options: [
        { value: 'apple_watch', label: 'Apple Watch' },
        { value: 'whoop', label: 'WHOOP' },
        { value: 'fitbit', label: 'Fitbit' },
        { value: 'garmin', label: 'Garmin' },
        { value: 'oura', label: 'Oura Ring' },
        { value: 'samsung', label: 'Samsung Galaxy Watch' },
        { value: 'other', label: 'Other wearable' },
        { value: 'none', label: 'No wearable' },
      ],
      isRequired: false,
    }
  ),

  // -------------------------------------------------------------------------
  // NUTRITION BASELINE (Universal)
  // -------------------------------------------------------------------------
  createQuestion(
    'universal_nutrition_meals_per_day',
    'How many meals do you typically eat per day?',
    'single_select',
    'universal',
    'nutrition',
    4,
    {
      options: [
        { value: '1', label: '1 meal' },
        { value: '2', label: '2 meals' },
        { value: '3', label: '3 meals' },
        { value: '4', label: '4 meals' },
        { value: '5_plus', label: '5+ meals/snacks' },
        { value: 'irregular', label: 'Irregular/varies' },
      ],
    }
  ),

  createQuestion(
    'universal_nutrition_cooking_frequency',
    'How often do you cook meals at home?',
    'single_select',
    'universal',
    'nutrition',
    5,
    {
      options: [
        { value: 'never', label: 'Never - I eat out or order in' },
        { value: 'rarely', label: 'Rarely - 1-2 times per week' },
        { value: 'sometimes', label: 'Sometimes - 3-4 times per week' },
        { value: 'often', label: 'Often - 5-6 times per week' },
        { value: 'always', label: 'Almost always - Daily cooking' },
      ],
    }
  ),

  createQuestion(
    'universal_nutrition_hydration',
    'How many glasses of water do you drink per day on average?',
    'slider',
    'universal',
    'nutrition',
    6,
    {
      sliderConfig: {
        min: 0,
        max: 15,
        step: 1,
        unit: 'glasses',
        labels: [
          { value: 0, label: '0' },
          { value: 4, label: '4' },
          { value: 8, label: '8 (recommended)' },
          { value: 12, label: '12' },
          { value: 15, label: '15+' },
        ],
      },
    }
  ),

  // -------------------------------------------------------------------------
  // WELLBEING BASELINE (Universal)
  // -------------------------------------------------------------------------
  createQuestion(
    'universal_wellbeing_mood',
    'How would you rate your average daily mood?',
    'emoji_scale',
    'universal',
    'wellbeing',
    7,
    {
      options: [
        { value: '1', label: 'Very low', emoji: '😢' },
        { value: '2', label: 'Low', emoji: '😔' },
        { value: '3', label: 'Below average', emoji: '😕' },
        { value: '4', label: 'Slightly low', emoji: '🙁' },
        { value: '5', label: 'Neutral', emoji: '😐' },
        { value: '6', label: 'Slightly good', emoji: '🙂' },
        { value: '7', label: 'Good', emoji: '😊' },
        { value: '8', label: 'Very good', emoji: '😄' },
        { value: '9', label: 'Excellent', emoji: '😁' },
        { value: '10', label: 'Amazing', emoji: '🤩' },
      ],
    }
  ),

  createQuestion(
    'universal_wellbeing_stress',
    'How would you rate your average daily stress level?',
    'emoji_scale',
    'universal',
    'wellbeing',
    8,
    {
      options: [
        { value: '1', label: 'No stress', emoji: '😌' },
        { value: '2', label: 'Minimal', emoji: '🙂' },
        { value: '3', label: 'Low', emoji: '😊' },
        { value: '4', label: 'Mild', emoji: '😐' },
        { value: '5', label: 'Moderate', emoji: '😕' },
        { value: '6', label: 'Noticeable', emoji: '😟' },
        { value: '7', label: 'High', emoji: '😰' },
        { value: '8', label: 'Very high', emoji: '😫' },
        { value: '9', label: 'Severe', emoji: '😩' },
        { value: '10', label: 'Overwhelming', emoji: '🤯' },
      ],
    }
  ),

  createQuestion(
    'universal_wellbeing_sleep_quality',
    'How would you rate your overall sleep quality?',
    'emoji_scale',
    'universal',
    'wellbeing',
    9,
    {
      options: [
        { value: '1', label: 'Terrible', emoji: '😴' },
        { value: '2', label: 'Very poor', emoji: '😫' },
        { value: '3', label: 'Poor', emoji: '😕' },
        { value: '4', label: 'Below average', emoji: '🙁' },
        { value: '5', label: 'Average', emoji: '😐' },
        { value: '6', label: 'Decent', emoji: '🙂' },
        { value: '7', label: 'Good', emoji: '😊' },
        { value: '8', label: 'Very good', emoji: '😄' },
        { value: '9', label: 'Excellent', emoji: '😁' },
        { value: '10', label: 'Perfect', emoji: '💤' },
      ],
    }
  ),

  createQuestion(
    'universal_wellbeing_mindfulness',
    'Do you practice any mindfulness activities?',
    'multi_select',
    'universal',
    'wellbeing',
    10,
    {
      options: [
        { value: 'meditation', label: 'Meditation', emoji: '🧘' },
        { value: 'journaling', label: 'Journaling', emoji: '📓' },
        { value: 'breathing', label: 'Breathing exercises', emoji: '🌬️' },
        { value: 'gratitude', label: 'Gratitude practice', emoji: '🙏' },
        { value: 'yoga', label: 'Yoga/Stretching', emoji: '🧘‍♀️' },
        { value: 'nature', label: 'Nature walks', emoji: '🌲' },
        { value: 'therapy', label: 'Therapy/Counseling', emoji: '💬' },
        { value: 'none', label: 'None currently', emoji: '❌' },
      ],
      isRequired: false,
    }
  ),
];

// =============================================================================
// WEIGHT LOSS SPECIFIC QUESTIONS
// =============================================================================

const weightLossQuestions: AssessmentQuestion[] = [
  createQuestion(
    'weight_loss_current_height',
    'What is your height?',
    'number_input',
    'weight_loss',
    null,
    1,
    {
      validation: { min: 100, max: 250 },
      sliderConfig: { min: 100, max: 250, step: 1, unit: 'cm' },
    }
  ),

  createQuestion(
    'weight_loss_current_weight',
    'What is your current weight?',
    'number_input',
    'weight_loss',
    null,
    2,
    {
      validation: { min: 30, max: 300 },
      sliderConfig: { min: 30, max: 300, step: 0.1, unit: 'kg' },
    }
  ),

  createQuestion(
    'weight_loss_target_weight',
    'What is your target weight?',
    'number_input',
    'weight_loss',
    null,
    3,
    {
      validation: { min: 30, max: 300 },
      sliderConfig: { min: 30, max: 300, step: 0.1, unit: 'kg' },
    }
  ),

  createQuestion(
    'weight_loss_timeline',
    'When would you like to reach your target weight?',
    'single_select',
    'weight_loss',
    null,
    4,
    {
      options: [
        { value: '3_months', label: '3 months', description: 'Aggressive but achievable' },
        { value: '6_months', label: '6 months', description: 'Recommended pace' },
        { value: '12_months', label: '12 months', description: 'Sustainable approach' },
        { value: '24_months', label: '24+ months', description: 'Long-term lifestyle change' },
        { value: 'no_deadline', label: 'No specific deadline' },
      ],
    }
  ),

  createQuestion(
    'weight_loss_past_diets',
    'Have you tried any specific diets before? Select all that apply.',
    'multi_select',
    'weight_loss',
    'nutrition',
    5,
    {
      options: [
        { value: 'keto', label: 'Keto/Low-carb' },
        { value: 'intermittent_fasting', label: 'Intermittent Fasting' },
        { value: 'calorie_counting', label: 'Calorie Counting' },
        { value: 'paleo', label: 'Paleo' },
        { value: 'mediterranean', label: 'Mediterranean' },
        { value: 'weight_watchers', label: 'Weight Watchers/Points' },
        { value: 'vegan_vegetarian', label: 'Vegan/Vegetarian' },
        { value: 'low_fat', label: 'Low Fat' },
        { value: 'meal_replacement', label: 'Meal Replacement (shakes, bars)' },
        { value: 'none', label: 'None - First time' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'weight_loss_past_success',
    'What worked well in your previous weight loss attempts?',
    'multi_select',
    'weight_loss',
    null,
    6,
    {
      options: [
        { value: 'meal_prep', label: 'Meal prepping ahead' },
        { value: 'tracking', label: 'Tracking food/calories' },
        { value: 'exercise', label: 'Regular exercise' },
        { value: 'accountability', label: 'Having accountability partner' },
        { value: 'structure', label: 'Structured meal plans' },
        { value: 'support_group', label: 'Support groups/community' },
        { value: 'professional', label: 'Working with nutritionist/trainer' },
        { value: 'nothing', label: 'Nothing worked long-term' },
        { value: 'first_time', label: 'This is my first attempt' },
      ],
      isRequired: false,
      showIf: {
        question_id: 'weight_loss_past_diets',
        operator: 'not_equals',
        value: 'none',
      },
    }
  ),

  createQuestion(
    'weight_loss_biggest_challenge',
    'What is your biggest challenge when it comes to weight loss?',
    'single_select',
    'weight_loss',
    null,
    7,
    {
      options: [
        { value: 'cravings', label: 'Cravings and temptations', emoji: '🍰' },
        { value: 'time', label: 'Not enough time to prepare healthy food', emoji: '⏰' },
        { value: 'motivation', label: 'Staying motivated long-term', emoji: '💪' },
        { value: 'knowledge', label: 'Not sure what to eat', emoji: '🤔' },
        { value: 'consistency', label: 'Being consistent day-to-day', emoji: '📅' },
        { value: 'emotional_eating', label: 'Emotional or stress eating', emoji: '😰' },
        { value: 'social', label: 'Social situations and dining out', emoji: '🍽️' },
        { value: 'exercise', label: 'Sticking to exercise routine', emoji: '🏋️' },
        { value: 'plateaus', label: 'Breaking through plateaus', emoji: '📉' },
      ],
    }
  ),

  createQuestion(
    'weight_loss_dietary_preferences',
    'Do you have any dietary restrictions or preferences?',
    'multi_select',
    'weight_loss',
    'nutrition',
    8,
    {
      options: [
        { value: 'vegetarian', label: 'Vegetarian' },
        { value: 'vegan', label: 'Vegan' },
        { value: 'pescatarian', label: 'Pescatarian' },
        { value: 'halal', label: 'Halal' },
        { value: 'kosher', label: 'Kosher' },
        { value: 'gluten_free', label: 'Gluten-free' },
        { value: 'dairy_free', label: 'Dairy-free' },
        { value: 'nut_allergy', label: 'Nut allergy' },
        { value: 'low_sodium', label: 'Low sodium' },
        { value: 'none', label: 'No restrictions' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'weight_loss_tracking_experience',
    'Have you tracked your food intake before?',
    'single_select',
    'weight_loss',
    'nutrition',
    9,
    {
      options: [
        { value: 'yes_enjoyed', label: 'Yes, and I found it helpful' },
        { value: 'yes_tedious', label: 'Yes, but found it tedious' },
        { value: 'tried_stopped', label: 'Tried but stopped quickly' },
        { value: 'never', label: 'Never tracked before' },
      ],
    }
  ),

  createQuestion(
    'weight_loss_support_system',
    'Who supports your weight loss goals?',
    'multi_select',
    'weight_loss',
    'wellbeing',
    10,
    {
      options: [
        { value: 'partner', label: 'Partner/Spouse' },
        { value: 'family', label: 'Family members' },
        { value: 'friends', label: 'Friends' },
        { value: 'coworkers', label: 'Coworkers' },
        { value: 'online', label: 'Online community' },
        { value: 'professional', label: 'Professional (trainer, dietitian)' },
        { value: 'alone', label: 'Going at it alone' },
      ],
    }
  ),

  createQuestion(
    'weight_loss_motivation',
    'What is your primary motivation for losing weight?',
    'single_select',
    'weight_loss',
    'wellbeing',
    11,
    {
      options: [
        { value: 'health', label: 'Improve overall health' },
        { value: 'energy', label: 'Have more energy' },
        { value: 'confidence', label: 'Feel more confident' },
        { value: 'event', label: 'Upcoming event (wedding, vacation, etc.)' },
        { value: 'medical', label: 'Doctor recommended' },
        { value: 'active', label: 'Be more active with family/kids' },
        { value: 'longevity', label: 'Live longer, healthier life' },
        { value: 'athletic', label: 'Athletic/performance goals' },
      ],
    }
  ),
];

// =============================================================================
// MUSCLE GAIN SPECIFIC QUESTIONS
// =============================================================================

const muscleGainQuestions: AssessmentQuestion[] = [
  createQuestion(
    'muscle_gain_current_height',
    'What is your height?',
    'number_input',
    'muscle_gain',
    null,
    1,
    {
      validation: { min: 100, max: 250 },
      sliderConfig: { min: 100, max: 250, step: 1, unit: 'cm' },
    }
  ),

  createQuestion(
    'muscle_gain_current_weight',
    'What is your current weight?',
    'number_input',
    'muscle_gain',
    null,
    2,
    {
      validation: { min: 30, max: 200 },
      sliderConfig: { min: 30, max: 200, step: 0.1, unit: 'kg' },
    }
  ),

  createQuestion(
    'muscle_gain_target_weight',
    'What is your target weight or muscle mass goal?',
    'number_input',
    'muscle_gain',
    null,
    3,
    {
      validation: { min: 30, max: 200 },
      sliderConfig: { min: 30, max: 200, step: 0.1, unit: 'kg' },
      isRequired: false,
    }
  ),

  createQuestion(
    'muscle_gain_timeline',
    'What is your timeline for achieving your muscle gain goals?',
    'single_select',
    'muscle_gain',
    null,
    4,
    {
      options: [
        { value: '3_months', label: '3 months' },
        { value: '6_months', label: '6 months' },
        { value: '12_months', label: '12 months' },
        { value: 'ongoing', label: 'Ongoing - no specific deadline' },
      ],
    }
  ),

  createQuestion(
    'muscle_gain_training_experience',
    'How would you describe your weight training experience?',
    'single_select',
    'muscle_gain',
    'fitness',
    5,
    {
      options: [
        { value: 'beginner', label: 'Beginner - Less than 6 months' },
        { value: 'intermediate', label: 'Intermediate - 6 months to 2 years' },
        { value: 'advanced', label: 'Advanced - 2+ years consistent training' },
        { value: 'returning', label: 'Returning after a break' },
      ],
    }
  ),

  createQuestion(
    'muscle_gain_current_lifts',
    'What are your current strength levels? (Select closest match)',
    'single_select',
    'muscle_gain',
    'fitness',
    6,
    {
      options: [
        { value: 'never_lifted', label: 'Never done barbell training' },
        { value: 'learning', label: 'Still learning proper form' },
        { value: 'submaximal', label: 'Can lift but not tracking maxes' },
        { value: 'tracking', label: 'Actively tracking and progressing' },
        { value: 'plateaued', label: 'Hit a plateau, need breakthrough' },
      ],
    }
  ),

  createQuestion(
    'muscle_gain_training_split',
    'What training split are you currently following or interested in?',
    'single_select',
    'muscle_gain',
    'fitness',
    7,
    {
      options: [
        { value: 'full_body', label: 'Full Body (2-3x/week)' },
        { value: 'upper_lower', label: 'Upper/Lower Split (4x/week)' },
        { value: 'push_pull_legs', label: 'Push/Pull/Legs (6x/week)' },
        { value: 'bro_split', label: 'Body Part Split (5x/week)' },
        { value: 'unsure', label: 'Not sure - need guidance' },
      ],
    }
  ),

  createQuestion(
    'muscle_gain_protein_intake',
    'How would you describe your current protein intake?',
    'single_select',
    'muscle_gain',
    'nutrition',
    8,
    {
      options: [
        { value: 'low', label: 'Low - I struggle to eat enough protein' },
        { value: 'moderate', label: 'Moderate - Some protein at most meals' },
        { value: 'high', label: 'High - I prioritize protein at every meal' },
        { value: 'tracking', label: 'Tracking - I know my daily grams' },
        { value: 'unsure', label: 'Unsure - Need to evaluate' },
      ],
    }
  ),

  createQuestion(
    'muscle_gain_supplements',
    'Which supplements do you currently use? Select all that apply.',
    'multi_select',
    'muscle_gain',
    'nutrition',
    9,
    {
      options: [
        { value: 'protein_powder', label: 'Protein Powder' },
        { value: 'creatine', label: 'Creatine' },
        { value: 'pre_workout', label: 'Pre-workout' },
        { value: 'bcaa', label: 'BCAAs/EAAs' },
        { value: 'multivitamin', label: 'Multivitamin' },
        { value: 'fish_oil', label: 'Fish Oil/Omega-3' },
        { value: 'none', label: 'No supplements' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'muscle_gain_recovery',
    'How would you rate your recovery between workouts?',
    'emoji_scale',
    'muscle_gain',
    'fitness',
    10,
    {
      options: [
        { value: '1', label: 'Very poor', emoji: '😫' },
        { value: '2', label: 'Poor', emoji: '😕' },
        { value: '3', label: 'Below average', emoji: '🙁' },
        { value: '4', label: 'Slightly low', emoji: '😐' },
        { value: '5', label: 'Average', emoji: '🙂' },
        { value: '6', label: 'Good', emoji: '😊' },
        { value: '7', label: 'Very good', emoji: '😄' },
        { value: '8', label: 'Excellent', emoji: '💪' },
      ],
    }
  ),

  createQuestion(
    'muscle_gain_biggest_challenge',
    'What is your biggest challenge in building muscle?',
    'single_select',
    'muscle_gain',
    null,
    11,
    {
      options: [
        { value: 'eating_enough', label: 'Eating enough calories/protein' },
        { value: 'consistency', label: 'Staying consistent with workouts' },
        { value: 'recovery', label: 'Recovery and sleep' },
        { value: 'knowledge', label: 'Not sure about proper programming' },
        { value: 'time', label: 'Finding time to train' },
        { value: 'motivation', label: 'Staying motivated' },
        { value: 'plateau', label: 'Breaking through plateaus' },
        { value: 'injury', label: 'Avoiding or working around injuries' },
      ],
    }
  ),
];

// =============================================================================
// SLEEP IMPROVEMENT SPECIFIC QUESTIONS
// =============================================================================

const sleepImprovementQuestions: AssessmentQuestion[] = [
  createQuestion(
    'sleep_current_hours',
    'On average, how many hours of sleep do you get per night?',
    'slider',
    'sleep_improvement',
    'wellbeing',
    1,
    {
      sliderConfig: {
        min: 3,
        max: 12,
        step: 0.5,
        unit: 'hours',
        labels: [
          { value: 3, label: '3h' },
          { value: 6, label: '6h' },
          { value: 8, label: '8h (recommended)' },
          { value: 10, label: '10h' },
          { value: 12, label: '12h' },
        ],
      },
    }
  ),

  createQuestion(
    'sleep_target_hours',
    'How many hours of sleep would you like to get?',
    'slider',
    'sleep_improvement',
    'wellbeing',
    2,
    {
      sliderConfig: {
        min: 6,
        max: 10,
        step: 0.5,
        unit: 'hours',
        labels: [
          { value: 6, label: '6h' },
          { value: 7, label: '7h' },
          { value: 8, label: '8h' },
          { value: 9, label: '9h' },
          { value: 10, label: '10h' },
        ],
      },
    }
  ),

  createQuestion(
    'sleep_bedtime',
    'What time do you typically go to bed?',
    'single_select',
    'sleep_improvement',
    'wellbeing',
    3,
    {
      options: [
        { value: 'before_9pm', label: 'Before 9 PM' },
        { value: '9pm_10pm', label: '9 PM - 10 PM' },
        { value: '10pm_11pm', label: '10 PM - 11 PM' },
        { value: '11pm_midnight', label: '11 PM - Midnight' },
        { value: 'after_midnight', label: 'After Midnight' },
        { value: 'varies', label: 'Varies significantly' },
      ],
    }
  ),

  createQuestion(
    'sleep_wake_time',
    'What time do you typically wake up?',
    'single_select',
    'sleep_improvement',
    'wellbeing',
    4,
    {
      options: [
        { value: 'before_5am', label: 'Before 5 AM' },
        { value: '5am_6am', label: '5 AM - 6 AM' },
        { value: '6am_7am', label: '6 AM - 7 AM' },
        { value: '7am_8am', label: '7 AM - 8 AM' },
        { value: 'after_8am', label: 'After 8 AM' },
        { value: 'varies', label: 'Varies significantly' },
      ],
    }
  ),

  createQuestion(
    'sleep_issues',
    'What sleep issues do you experience? Select all that apply.',
    'multi_select',
    'sleep_improvement',
    'wellbeing',
    5,
    {
      options: [
        { value: 'falling_asleep', label: 'Difficulty falling asleep' },
        { value: 'staying_asleep', label: 'Waking up during the night' },
        { value: 'early_waking', label: 'Waking too early' },
        { value: 'not_refreshed', label: 'Not feeling refreshed after sleep' },
        { value: 'snoring', label: 'Snoring or sleep apnea' },
        { value: 'racing_mind', label: 'Racing thoughts at bedtime' },
        { value: 'screen_time', label: 'Screen time before bed' },
        { value: 'inconsistent', label: 'Inconsistent schedule' },
        { value: 'none', label: 'No major issues' },
      ],
    }
  ),

  createQuestion(
    'sleep_environment',
    'How would you describe your sleep environment?',
    'multi_select',
    'sleep_improvement',
    'wellbeing',
    6,
    {
      options: [
        { value: 'dark', label: 'Room is dark enough' },
        { value: 'quiet', label: 'Room is quiet' },
        { value: 'cool', label: 'Room is cool (65-68F)' },
        { value: 'comfortable_bed', label: 'Comfortable mattress/pillows' },
        { value: 'partner_disrupts', label: 'Partner disrupts sleep' },
        { value: 'noise_issues', label: 'External noise issues' },
        { value: 'light_issues', label: 'Too much light' },
        { value: 'temp_issues', label: 'Temperature problems' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'sleep_caffeine',
    'When is your caffeine cutoff time?',
    'single_select',
    'sleep_improvement',
    'nutrition',
    7,
    {
      options: [
        { value: 'no_caffeine', label: 'I do not consume caffeine' },
        { value: 'before_noon', label: 'Before noon' },
        { value: 'before_2pm', label: 'Before 2 PM' },
        { value: 'before_4pm', label: 'Before 4 PM' },
        { value: 'before_6pm', label: 'Before 6 PM' },
        { value: 'evening', label: 'I have caffeine in the evening' },
        { value: 'no_cutoff', label: 'No specific cutoff' },
      ],
    }
  ),

  createQuestion(
    'sleep_wind_down',
    'Do you have a wind-down routine before bed?',
    'single_select',
    'sleep_improvement',
    'wellbeing',
    8,
    {
      options: [
        { value: 'yes_consistent', label: 'Yes, I follow it consistently' },
        { value: 'yes_sometimes', label: 'Yes, but not consistently' },
        { value: 'trying', label: 'Trying to build one' },
        { value: 'no', label: 'No wind-down routine' },
      ],
    }
  ),

  createQuestion(
    'sleep_timeline',
    'How quickly do you want to improve your sleep?',
    'single_select',
    'sleep_improvement',
    null,
    9,
    {
      options: [
        { value: '1_week', label: '1 week' },
        { value: '2_weeks', label: '2 weeks' },
        { value: '1_month', label: '1 month' },
        { value: '3_months', label: '3 months' },
        { value: 'gradual', label: 'Gradual improvement is fine' },
      ],
    }
  ),

  createQuestion(
    'sleep_biggest_obstacle',
    'What is your biggest obstacle to better sleep?',
    'single_select',
    'sleep_improvement',
    null,
    10,
    {
      options: [
        { value: 'work_schedule', label: 'Work schedule' },
        { value: 'family', label: 'Family responsibilities (kids, caregiving)' },
        { value: 'stress', label: 'Stress and anxiety' },
        { value: 'habits', label: 'Bad habits (screens, late eating)' },
        { value: 'social', label: 'Social life/FOMO' },
        { value: 'medical', label: 'Medical condition' },
        { value: 'environment', label: 'Sleep environment' },
        { value: 'discipline', label: 'Lack of discipline' },
      ],
    }
  ),
];

// =============================================================================
// STRESS REDUCTION SPECIFIC QUESTIONS
// =============================================================================

const stressReductionQuestions: AssessmentQuestion[] = [
  createQuestion(
    'stress_current_level',
    'How would you rate your current stress level on average?',
    'slider',
    'stress_reduction',
    'wellbeing',
    1,
    {
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        labels: [
          { value: 1, label: 'Minimal' },
          { value: 5, label: 'Moderate' },
          { value: 10, label: 'Overwhelming' },
        ],
      },
    }
  ),

  createQuestion(
    'stress_target_level',
    'What stress level would you like to achieve?',
    'slider',
    'stress_reduction',
    'wellbeing',
    2,
    {
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        labels: [
          { value: 1, label: 'Minimal' },
          { value: 3, label: 'Low' },
          { value: 5, label: 'Moderate' },
        ],
      },
    }
  ),

  createQuestion(
    'stress_primary_sources',
    'What are your primary sources of stress? Select all that apply.',
    'multi_select',
    'stress_reduction',
    'wellbeing',
    3,
    {
      options: [
        { value: 'work', label: 'Work/Career', emoji: '💼' },
        { value: 'finances', label: 'Finances', emoji: '💰' },
        { value: 'relationships', label: 'Relationships', emoji: '💑' },
        { value: 'family', label: 'Family responsibilities', emoji: '👨‍👩‍👧' },
        { value: 'health', label: 'Health concerns', emoji: '🏥' },
        { value: 'future', label: 'Uncertainty about the future', emoji: '❓' },
        { value: 'time', label: 'Time management', emoji: '⏰' },
        { value: 'social', label: 'Social pressures', emoji: '👥' },
        { value: 'self', label: 'Self-expectations/perfectionism', emoji: '🎯' },
        { value: 'other', label: 'Other', emoji: '📝' },
      ],
    }
  ),

  createQuestion(
    'stress_physical_symptoms',
    'How does stress manifest physically for you? Select all that apply.',
    'multi_select',
    'stress_reduction',
    'wellbeing',
    4,
    {
      options: [
        { value: 'headaches', label: 'Headaches' },
        { value: 'muscle_tension', label: 'Muscle tension (neck, shoulders, back)' },
        { value: 'fatigue', label: 'Fatigue/exhaustion' },
        { value: 'digestive', label: 'Digestive issues' },
        { value: 'sleep', label: 'Sleep problems' },
        { value: 'heart', label: 'Racing heart/palpitations' },
        { value: 'appetite', label: 'Appetite changes' },
        { value: 'skin', label: 'Skin issues (acne, eczema)' },
        { value: 'none', label: 'No physical symptoms' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'stress_mental_symptoms',
    'How does stress affect you mentally/emotionally? Select all that apply.',
    'multi_select',
    'stress_reduction',
    'wellbeing',
    5,
    {
      options: [
        { value: 'anxiety', label: 'Anxiety/worry' },
        { value: 'irritability', label: 'Irritability' },
        { value: 'overwhelm', label: 'Feeling overwhelmed' },
        { value: 'concentration', label: 'Difficulty concentrating' },
        { value: 'mood_swings', label: 'Mood swings' },
        { value: 'negative_thoughts', label: 'Negative self-talk' },
        { value: 'motivation', label: 'Low motivation' },
        { value: 'isolation', label: 'Wanting to isolate' },
        { value: 'none', label: 'No mental/emotional symptoms' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'stress_current_coping',
    'How do you currently cope with stress? Select all that apply.',
    'multi_select',
    'stress_reduction',
    'wellbeing',
    6,
    {
      options: [
        { value: 'exercise', label: 'Exercise' },
        { value: 'meditation', label: 'Meditation/mindfulness' },
        { value: 'social', label: 'Talking to friends/family' },
        { value: 'nature', label: 'Spending time in nature' },
        { value: 'hobbies', label: 'Hobbies/creative activities' },
        { value: 'food', label: 'Comfort food' },
        { value: 'alcohol', label: 'Alcohol' },
        { value: 'screens', label: 'Screens (TV, social media, gaming)' },
        { value: 'nothing', label: 'I just push through' },
        { value: 'therapy', label: 'Therapy/counseling' },
      ],
    }
  ),

  createQuestion(
    'stress_tried_before',
    'Have you tried any stress management techniques before?',
    'multi_select',
    'stress_reduction',
    'wellbeing',
    7,
    {
      options: [
        { value: 'meditation_apps', label: 'Meditation apps (Headspace, Calm)' },
        { value: 'breathing', label: 'Breathing exercises' },
        { value: 'journaling', label: 'Journaling' },
        { value: 'yoga', label: 'Yoga' },
        { value: 'therapy', label: 'Therapy/counseling' },
        { value: 'medication', label: 'Medication' },
        { value: 'time_management', label: 'Time management systems' },
        { value: 'boundaries', label: 'Setting boundaries' },
        { value: 'none', label: 'Haven not tried anything specific' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'stress_timeline',
    'How quickly do you want to see improvement in your stress levels?',
    'single_select',
    'stress_reduction',
    null,
    8,
    {
      options: [
        { value: 'immediate', label: 'Immediate - I need relief now' },
        { value: '1_week', label: 'Within 1 week' },
        { value: '1_month', label: 'Within 1 month' },
        { value: 'gradual', label: 'Gradual improvement over time' },
      ],
    }
  ),

  createQuestion(
    'stress_willing_to_try',
    'What are you willing to try for stress management?',
    'multi_select',
    'stress_reduction',
    'wellbeing',
    9,
    {
      options: [
        { value: 'meditation', label: 'Daily meditation (5-20 min)' },
        { value: 'exercise', label: 'Regular exercise' },
        { value: 'journaling', label: 'Journaling/reflection' },
        { value: 'breathing', label: 'Breathing exercises' },
        { value: 'sleep', label: 'Improving sleep habits' },
        { value: 'boundaries', label: 'Setting boundaries' },
        { value: 'therapy', label: 'Professional therapy' },
        { value: 'lifestyle', label: 'Lifestyle changes' },
        { value: 'open', label: 'Open to suggestions' },
      ],
    }
  ),

  createQuestion(
    'stress_support_system',
    'Do you have a support system?',
    'single_select',
    'stress_reduction',
    'wellbeing',
    10,
    {
      options: [
        { value: 'strong', label: 'Strong support network' },
        { value: 'some', label: 'Some people I can talk to' },
        { value: 'limited', label: 'Limited support' },
        { value: 'none', label: 'Dealing with this alone' },
        { value: 'professional', label: 'Working with a professional' },
      ],
    }
  ),
];

// =============================================================================
// ENERGY BOOST SPECIFIC QUESTIONS
// =============================================================================

const energyBoostQuestions: AssessmentQuestion[] = [
  createQuestion(
    'energy_current_level',
    'How would you rate your average daily energy level?',
    'slider',
    'energy_boost',
    'wellbeing',
    1,
    {
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        labels: [
          { value: 1, label: 'Exhausted' },
          { value: 5, label: 'Average' },
          { value: 10, label: 'High energy' },
        ],
      },
    }
  ),

  createQuestion(
    'energy_target_level',
    'What energy level would you like to achieve?',
    'slider',
    'energy_boost',
    'wellbeing',
    2,
    {
      sliderConfig: {
        min: 5,
        max: 10,
        step: 1,
        labels: [
          { value: 5, label: 'Average' },
          { value: 7, label: 'Good' },
          { value: 10, label: 'Optimal' },
        ],
      },
    }
  ),

  createQuestion(
    'energy_pattern',
    'When do you feel most energized during the day?',
    'single_select',
    'energy_boost',
    'wellbeing',
    3,
    {
      options: [
        { value: 'morning', label: 'Morning person - peak energy before noon' },
        { value: 'midday', label: 'Midday - best between 10am-2pm' },
        { value: 'afternoon', label: 'Afternoon - pick up after lunch' },
        { value: 'evening', label: 'Night owl - most energy in evening' },
        { value: 'inconsistent', label: 'Inconsistent - varies day to day' },
        { value: 'never', label: 'Rarely feel energized' },
      ],
    }
  ),

  createQuestion(
    'energy_crash_times',
    'When do you typically experience energy crashes?',
    'multi_select',
    'energy_boost',
    'wellbeing',
    4,
    {
      options: [
        { value: 'morning', label: 'Early morning - hard to get going' },
        { value: 'mid_morning', label: 'Mid-morning slump' },
        { value: 'post_lunch', label: 'After lunch (food coma)' },
        { value: 'afternoon', label: 'Mid-afternoon (2-4pm)' },
        { value: 'evening', label: 'Early evening' },
        { value: 'no_crashes', label: 'No specific crash times' },
        { value: 'always_low', label: 'Consistently low all day' },
      ],
    }
  ),

  createQuestion(
    'energy_caffeine_usage',
    'How much caffeine do you consume daily?',
    'single_select',
    'energy_boost',
    'nutrition',
    5,
    {
      options: [
        { value: 'none', label: 'No caffeine' },
        { value: 'light', label: '1 cup of coffee/tea' },
        { value: 'moderate', label: '2-3 cups of coffee/tea' },
        { value: 'heavy', label: '4+ cups of coffee/tea' },
        { value: 'energy_drinks', label: 'Energy drinks' },
        { value: 'varies', label: 'Varies significantly' },
      ],
    }
  ),

  createQuestion(
    'energy_sleep_quality',
    'How would you rate your sleep quality?',
    'emoji_scale',
    'energy_boost',
    'wellbeing',
    6,
    {
      options: [
        { value: '1', label: 'Terrible', emoji: '😴' },
        { value: '2', label: 'Very poor', emoji: '😫' },
        { value: '3', label: 'Poor', emoji: '😕' },
        { value: '4', label: 'Below average', emoji: '🙁' },
        { value: '5', label: 'Average', emoji: '😐' },
        { value: '6', label: 'Decent', emoji: '🙂' },
        { value: '7', label: 'Good', emoji: '😊' },
        { value: '8', label: 'Very good', emoji: '😄' },
        { value: '9', label: 'Excellent', emoji: '😁' },
        { value: '10', label: 'Perfect', emoji: '💤' },
      ],
    }
  ),

  createQuestion(
    'energy_meal_pattern',
    'How do your meals affect your energy?',
    'single_select',
    'energy_boost',
    'nutrition',
    7,
    {
      options: [
        { value: 'crash_after', label: 'Energy crash after meals' },
        { value: 'stable', label: 'Energy stays stable' },
        { value: 'boost', label: 'Energy boost after eating' },
        { value: 'skip_meals', label: 'I often skip meals' },
        { value: 'varies', label: 'Depends on what I eat' },
      ],
    }
  ),

  createQuestion(
    'energy_exercise_effect',
    'How does exercise affect your energy?',
    'single_select',
    'energy_boost',
    'fitness',
    8,
    {
      options: [
        { value: 'boosts', label: 'Exercise boosts my energy' },
        { value: 'drains', label: 'Exercise drains me' },
        { value: 'no_exercise', label: 'I do not exercise regularly' },
        { value: 'mixed', label: 'Depends on the workout' },
        { value: 'too_tired', label: 'Too tired to exercise' },
      ],
    }
  ),

  createQuestion(
    'energy_potential_causes',
    'What do you think might be causing your low energy?',
    'multi_select',
    'energy_boost',
    null,
    9,
    {
      options: [
        { value: 'sleep', label: 'Poor sleep' },
        { value: 'stress', label: 'Stress' },
        { value: 'nutrition', label: 'Poor nutrition' },
        { value: 'sedentary', label: 'Sedentary lifestyle' },
        { value: 'overworked', label: 'Overworking' },
        { value: 'medical', label: 'Potential medical issue' },
        { value: 'hydration', label: 'Dehydration' },
        { value: 'mental_health', label: 'Mental health (depression, anxiety)' },
        { value: 'unsure', label: 'Not sure' },
      ],
    }
  ),

  createQuestion(
    'energy_timeline',
    'How quickly do you want to improve your energy levels?',
    'single_select',
    'energy_boost',
    null,
    10,
    {
      options: [
        { value: 'asap', label: 'As soon as possible' },
        { value: '1_week', label: 'Within 1 week' },
        { value: '2_weeks', label: 'Within 2 weeks' },
        { value: '1_month', label: 'Within 1 month' },
        { value: 'gradual', label: 'Gradual improvement is fine' },
      ],
    }
  ),

  createQuestion(
    'energy_willing_to_change',
    'What changes are you willing to make?',
    'multi_select',
    'energy_boost',
    null,
    11,
    {
      options: [
        { value: 'sleep_schedule', label: 'Improve sleep schedule' },
        { value: 'nutrition', label: 'Improve nutrition' },
        { value: 'exercise', label: 'Start/increase exercise' },
        { value: 'reduce_caffeine', label: 'Reduce caffeine dependency' },
        { value: 'stress_management', label: 'Stress management practices' },
        { value: 'hydration', label: 'Drink more water' },
        { value: 'medical', label: 'See a doctor' },
        { value: 'open', label: 'Open to all suggestions' },
      ],
    }
  ),
];

// =============================================================================
// EVENT TRAINING SPECIFIC QUESTIONS
// =============================================================================

const eventTrainingQuestions: AssessmentQuestion[] = [
  createQuestion(
    'event_type',
    'What type of event are you training for?',
    'single_select',
    'event_training',
    'fitness',
    1,
    {
      options: [
        { value: '5k', label: '5K Run' },
        { value: '10k', label: '10K Run' },
        { value: 'half_marathon', label: 'Half Marathon' },
        { value: 'marathon', label: 'Marathon' },
        { value: 'ultra', label: 'Ultra Marathon' },
        { value: 'triathlon_sprint', label: 'Triathlon (Sprint)' },
        { value: 'triathlon_olympic', label: 'Triathlon (Olympic)' },
        { value: 'triathlon_iron', label: 'Ironman/Half Ironman' },
        { value: 'cycling', label: 'Cycling Event' },
        { value: 'obstacle', label: 'Obstacle Course Race' },
        { value: 'powerlifting', label: 'Powerlifting Competition' },
        { value: 'bodybuilding', label: 'Bodybuilding Competition' },
        { value: 'sports', label: 'Sports Competition' },
        { value: 'other', label: 'Other event' },
      ],
    }
  ),

  createQuestion(
    'event_date',
    'When is your event?',
    'date_picker',
    'event_training',
    null,
    2,
    {
      validation: { required: true },
    }
  ),

  createQuestion(
    'event_experience',
    'Have you completed this type of event before?',
    'single_select',
    'event_training',
    'fitness',
    3,
    {
      options: [
        { value: 'first_time', label: 'First time - completely new' },
        { value: 'done_once', label: 'Done 1-2 times before' },
        { value: 'experienced', label: 'Experienced - done multiple times' },
        { value: 'veteran', label: 'Veteran - looking to improve time/performance' },
      ],
    }
  ),

  createQuestion(
    'event_goal',
    'What is your primary goal for this event?',
    'single_select',
    'event_training',
    null,
    4,
    {
      options: [
        { value: 'finish', label: 'Just finish/complete the event' },
        { value: 'time_goal', label: 'Achieve a specific time goal' },
        { value: 'podium', label: 'Compete for podium/placement' },
        { value: 'personal_best', label: 'Beat my personal best' },
        { value: 'enjoy', label: 'Enjoy the experience' },
        { value: 'bucket_list', label: 'Check it off my bucket list' },
      ],
    }
  ),

  createQuestion(
    'event_current_fitness',
    'How would you describe your current fitness level for this event?',
    'single_select',
    'event_training',
    'fitness',
    5,
    {
      options: [
        { value: 'beginner', label: 'Beginner - starting from scratch' },
        { value: 'building', label: 'Building - some base fitness' },
        { value: 'moderate', label: 'Moderate - regularly active' },
        { value: 'fit', label: 'Fit - good base, need event-specific training' },
        { value: 'very_fit', label: 'Very fit - need fine-tuning' },
      ],
    }
  ),

  createQuestion(
    'event_training_days',
    'How many days per week can you dedicate to training?',
    'slider',
    'event_training',
    'fitness',
    6,
    {
      sliderConfig: {
        min: 1,
        max: 7,
        step: 1,
        unit: 'days',
        labels: [
          { value: 1, label: '1 day' },
          { value: 3, label: '3 days' },
          { value: 5, label: '5 days' },
          { value: 7, label: 'Daily' },
        ],
      },
    }
  ),

  createQuestion(
    'event_longest_session',
    'How long can your longest training session be?',
    'single_select',
    'event_training',
    'fitness',
    7,
    {
      options: [
        { value: '30_min', label: 'Up to 30 minutes' },
        { value: '1_hour', label: 'Up to 1 hour' },
        { value: '90_min', label: 'Up to 90 minutes' },
        { value: '2_hours', label: 'Up to 2 hours' },
        { value: '3_hours', label: 'Up to 3 hours' },
        { value: '4_plus_hours', label: '4+ hours' },
      ],
    }
  ),

  createQuestion(
    'event_injury_history',
    'Do you have any injury history or concerns?',
    'multi_select',
    'event_training',
    'fitness',
    8,
    {
      options: [
        { value: 'knee', label: 'Knee issues' },
        { value: 'ankle', label: 'Ankle/foot issues' },
        { value: 'hip', label: 'Hip issues' },
        { value: 'back', label: 'Back issues' },
        { value: 'shoulder', label: 'Shoulder issues' },
        { value: 'recurring', label: 'Recurring injury' },
        { value: 'recovering', label: 'Currently recovering from injury' },
        { value: 'none', label: 'No injuries or concerns' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'event_equipment',
    'Do you have access to necessary equipment?',
    'single_select',
    'event_training',
    'fitness',
    9,
    {
      options: [
        { value: 'full', label: 'Yes, fully equipped' },
        { value: 'partial', label: 'Partial - need some equipment' },
        { value: 'minimal', label: 'Minimal equipment access' },
        { value: 'gym', label: 'Gym membership available' },
        { value: 'need_all', label: 'Need to get equipment' },
      ],
    }
  ),

  createQuestion(
    'event_nutrition_plan',
    'Do you have an event nutrition strategy?',
    'single_select',
    'event_training',
    'nutrition',
    10,
    {
      options: [
        { value: 'yes_dialed', label: 'Yes, dialed in from experience' },
        { value: 'yes_basic', label: 'Yes, basic understanding' },
        { value: 'need_help', label: 'Need help with nutrition planning' },
        { value: 'never_thought', label: 'Haven not thought about it' },
      ],
    }
  ),

  createQuestion(
    'event_biggest_concern',
    'What is your biggest concern about this event?',
    'single_select',
    'event_training',
    null,
    11,
    {
      options: [
        { value: 'not_ready', label: 'Not being ready in time' },
        { value: 'injury', label: 'Getting injured during training' },
        { value: 'time', label: 'Finding time to train' },
        { value: 'nutrition', label: 'Fueling/nutrition during event' },
        { value: 'mental', label: 'Mental/psychological challenges' },
        { value: 'pace', label: 'Pacing strategy' },
        { value: 'recovery', label: 'Recovery between sessions' },
        { value: 'no_concerns', label: 'No major concerns' },
      ],
    }
  ),
];

// =============================================================================
// HEALTH CONDITION SPECIFIC QUESTIONS
// =============================================================================

const healthConditionQuestions: AssessmentQuestion[] = [
  createQuestion(
    'health_condition_type',
    'What health condition are you managing? Select all that apply.',
    'multi_select',
    'health_condition',
    null,
    1,
    {
      options: [
        { value: 'diabetes_type1', label: 'Type 1 Diabetes' },
        { value: 'diabetes_type2', label: 'Type 2 Diabetes/Pre-diabetes' },
        { value: 'hypertension', label: 'High Blood Pressure' },
        { value: 'heart_disease', label: 'Heart Disease' },
        { value: 'cholesterol', label: 'High Cholesterol' },
        { value: 'arthritis', label: 'Arthritis' },
        { value: 'autoimmune', label: 'Autoimmune Condition' },
        { value: 'thyroid', label: 'Thyroid Issues' },
        { value: 'pcos', label: 'PCOS' },
        { value: 'digestive', label: 'Digestive Issues (IBS, IBD)' },
        { value: 'mental_health', label: 'Mental Health Condition' },
        { value: 'chronic_pain', label: 'Chronic Pain' },
        { value: 'other', label: 'Other condition' },
      ],
    }
  ),

  createQuestion(
    'health_condition_doctor_clearance',
    'Has your doctor cleared you for exercise?',
    'single_select',
    'health_condition',
    null,
    2,
    {
      options: [
        { value: 'yes_full', label: 'Yes, cleared for all exercise' },
        { value: 'yes_limited', label: 'Yes, with some limitations' },
        { value: 'pending', label: 'Waiting for clearance' },
        { value: 'no', label: 'No, not yet discussed' },
        { value: 'na', label: 'Not applicable to my condition' },
      ],
    }
  ),

  createQuestion(
    'health_condition_medications',
    'Are you currently taking medications for this condition?',
    'single_select',
    'health_condition',
    null,
    3,
    {
      options: [
        { value: 'yes', label: 'Yes, prescription medications' },
        { value: 'supplements', label: 'Supplements/OTC only' },
        { value: 'both', label: 'Both prescription and supplements' },
        { value: 'no', label: 'No medications' },
      ],
    }
  ),

  createQuestion(
    'health_condition_limitations',
    'What physical limitations do you have? Select all that apply.',
    'multi_select',
    'health_condition',
    'fitness',
    4,
    {
      options: [
        { value: 'high_impact', label: 'Avoid high-impact activities' },
        { value: 'heavy_lifting', label: 'Limited heavy lifting' },
        { value: 'cardio_intensity', label: 'Heart rate restrictions' },
        { value: 'flexibility', label: 'Limited range of motion' },
        { value: 'balance', label: 'Balance issues' },
        { value: 'fatigue', label: 'Fatigue/energy limitations' },
        { value: 'fasting', label: 'Cannot fast/skip meals' },
        { value: 'none', label: 'No significant limitations' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'health_condition_dietary_restrictions',
    'Do you have dietary restrictions related to your condition?',
    'multi_select',
    'health_condition',
    'nutrition',
    5,
    {
      options: [
        { value: 'low_sugar', label: 'Low sugar/carb' },
        { value: 'low_sodium', label: 'Low sodium' },
        { value: 'low_fat', label: 'Low fat' },
        { value: 'high_fiber', label: 'High fiber required' },
        { value: 'anti_inflammatory', label: 'Anti-inflammatory diet' },
        { value: 'elimination', label: 'Elimination diet' },
        { value: 'fodmap', label: 'Low FODMAP' },
        { value: 'medication_interactions', label: 'Food-medication interactions' },
        { value: 'none', label: 'No dietary restrictions' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'health_condition_goal',
    'What is your primary health goal related to your condition?',
    'single_select',
    'health_condition',
    null,
    6,
    {
      options: [
        { value: 'manage_symptoms', label: 'Better manage symptoms' },
        { value: 'reduce_medication', label: 'Reduce medication dependency' },
        { value: 'prevent_progression', label: 'Prevent condition from worsening' },
        { value: 'improve_markers', label: 'Improve health markers (A1C, BP, etc.)' },
        { value: 'quality_of_life', label: 'Improve quality of life' },
        { value: 'weight_management', label: 'Weight management' },
        { value: 'energy', label: 'Increase energy levels' },
        { value: 'remission', label: 'Work toward remission' },
      ],
    }
  ),

  createQuestion(
    'health_condition_tracking',
    'What health metrics do you currently track?',
    'multi_select',
    'health_condition',
    null,
    7,
    {
      options: [
        { value: 'blood_sugar', label: 'Blood sugar/glucose' },
        { value: 'blood_pressure', label: 'Blood pressure' },
        { value: 'weight', label: 'Weight' },
        { value: 'symptoms', label: 'Symptoms diary' },
        { value: 'medication', label: 'Medication adherence' },
        { value: 'food', label: 'Food intake' },
        { value: 'exercise', label: 'Exercise/activity' },
        { value: 'sleep', label: 'Sleep' },
        { value: 'none', label: 'Not tracking anything currently' },
      ],
      isRequired: false,
    }
  ),

  createQuestion(
    'health_condition_support',
    'What support do you have for managing your condition?',
    'multi_select',
    'health_condition',
    null,
    8,
    {
      options: [
        { value: 'doctor', label: 'Regular doctor appointments' },
        { value: 'specialist', label: 'Specialist care' },
        { value: 'dietitian', label: 'Dietitian/nutritionist' },
        { value: 'pt', label: 'Physical therapist' },
        { value: 'mental_health', label: 'Mental health professional' },
        { value: 'support_group', label: 'Support group' },
        { value: 'family', label: 'Family support' },
        { value: 'minimal', label: 'Minimal professional support' },
      ],
    }
  ),

  createQuestion(
    'health_condition_biggest_challenge',
    'What is your biggest challenge in managing your condition?',
    'single_select',
    'health_condition',
    null,
    9,
    {
      options: [
        { value: 'consistency', label: 'Staying consistent with management' },
        { value: 'motivation', label: 'Staying motivated' },
        { value: 'knowledge', label: 'Understanding what to do' },
        { value: 'symptoms', label: 'Dealing with symptoms' },
        { value: 'lifestyle', label: 'Making lifestyle changes' },
        { value: 'mental', label: 'Mental/emotional aspect' },
        { value: 'time', label: 'Finding time for self-care' },
        { value: 'cost', label: 'Cost of treatment/management' },
      ],
    }
  ),

  createQuestion(
    'health_condition_timeline',
    'What is your timeline for seeing improvement?',
    'single_select',
    'health_condition',
    null,
    10,
    {
      options: [
        { value: '1_month', label: '1 month' },
        { value: '3_months', label: '3 months' },
        { value: '6_months', label: '6 months' },
        { value: '12_months', label: '12 months' },
        { value: 'ongoing', label: 'Ongoing management' },
      ],
    }
  ),
];

// =============================================================================
// HABIT BUILDING SPECIFIC QUESTIONS
// =============================================================================

const habitBuildingQuestions: AssessmentQuestion[] = [
  createQuestion(
    'habit_target_habits',
    'What habits do you want to build? Select all that apply.',
    'multi_select',
    'habit_building',
    null,
    1,
    {
      options: [
        { value: 'exercise', label: 'Regular exercise', emoji: '🏃' },
        { value: 'healthy_eating', label: 'Healthy eating', emoji: '🥗' },
        { value: 'sleep', label: 'Better sleep routine', emoji: '😴' },
        { value: 'meditation', label: 'Meditation/mindfulness', emoji: '🧘' },
        { value: 'hydration', label: 'Drink more water', emoji: '💧' },
        { value: 'journaling', label: 'Journaling/reflection', emoji: '📝' },
        { value: 'reading', label: 'Reading/learning', emoji: '📚' },
        { value: 'morning_routine', label: 'Morning routine', emoji: '🌅' },
        { value: 'evening_routine', label: 'Evening routine', emoji: '🌙' },
        { value: 'screen_time', label: 'Reduce screen time', emoji: '📱' },
        { value: 'meal_prep', label: 'Meal prepping', emoji: '🍱' },
        { value: 'stretching', label: 'Daily stretching', emoji: '🤸' },
        { value: 'other', label: 'Other habit' },
      ],
    }
  ),

  createQuestion(
    'habit_primary_focus',
    'Which habit is your TOP priority right now?',
    'text_input',
    'habit_building',
    null,
    2,
    {
      validation: { minLength: 3, maxLength: 100 },
    }
  ),

  createQuestion(
    'habit_why_now',
    'Why is now the right time to build this habit?',
    'single_select',
    'habit_building',
    null,
    3,
    {
      options: [
        { value: 'new_year', label: 'New year/fresh start' },
        { value: 'health_scare', label: 'Health wake-up call' },
        { value: 'life_change', label: 'Major life change' },
        { value: 'accumulated', label: 'Things have accumulated' },
        { value: 'inspired', label: 'Feeling inspired/motivated' },
        { value: 'accountability', label: 'Found accountability (Balencia!)' },
        { value: 'always', label: 'Always the right time' },
      ],
    }
  ),

  createQuestion(
    'habit_past_attempts',
    'Have you tried building this habit before?',
    'single_select',
    'habit_building',
    null,
    4,
    {
      options: [
        { value: 'never', label: 'Never tried before' },
        { value: 'once_failed', label: 'Tried once, gave up quickly' },
        { value: 'multiple_failed', label: 'Tried multiple times, never stuck' },
        { value: 'partial_success', label: 'Had some success but lost it' },
        { value: 'rebuilding', label: 'Rebuilding a lost habit' },
      ],
    }
  ),

  createQuestion(
    'habit_past_blockers',
    'What typically causes you to fall off with new habits?',
    'multi_select',
    'habit_building',
    null,
    5,
    {
      options: [
        { value: 'motivation', label: 'Motivation fades' },
        { value: 'forgot', label: 'Simply forgot' },
        { value: 'time', label: 'No time' },
        { value: 'too_hard', label: 'Started too ambitious' },
        { value: 'life_event', label: 'Life event disrupted routine' },
        { value: 'no_accountability', label: 'No accountability' },
        { value: 'no_progress', label: 'Did not see progress' },
        { value: 'perfectionism', label: 'All-or-nothing thinking' },
        { value: 'unsure', label: 'Not sure' },
      ],
    }
  ),

  createQuestion(
    'habit_best_time',
    'When is the best time in your day for this habit?',
    'single_select',
    'habit_building',
    null,
    6,
    {
      options: [
        { value: 'early_morning', label: 'Early morning (5-7am)' },
        { value: 'morning', label: 'Morning (7-9am)' },
        { value: 'mid_morning', label: 'Mid-morning (9-12pm)' },
        { value: 'lunch', label: 'Lunch break' },
        { value: 'afternoon', label: 'Afternoon' },
        { value: 'evening', label: 'Evening' },
        { value: 'before_bed', label: 'Before bed' },
        { value: 'flexible', label: 'Flexible - anytime works' },
        { value: 'unsure', label: 'Need help figuring this out' },
      ],
    }
  ),

  createQuestion(
    'habit_time_available',
    'How much time can you dedicate to this habit daily?',
    'single_select',
    'habit_building',
    null,
    7,
    {
      options: [
        { value: '5_min', label: '5 minutes or less' },
        { value: '10_min', label: '10 minutes' },
        { value: '15_min', label: '15 minutes' },
        { value: '30_min', label: '30 minutes' },
        { value: '1_hour', label: '1 hour' },
        { value: 'more', label: 'More than 1 hour' },
      ],
    }
  ),

  createQuestion(
    'habit_existing_trigger',
    'What existing habit could this new habit attach to?',
    'single_select',
    'habit_building',
    null,
    8,
    {
      options: [
        { value: 'waking_up', label: 'Waking up' },
        { value: 'morning_coffee', label: 'Morning coffee/tea' },
        { value: 'after_breakfast', label: 'After breakfast' },
        { value: 'commute', label: 'After commute' },
        { value: 'lunch', label: 'Lunch time' },
        { value: 'after_work', label: 'After work' },
        { value: 'dinner', label: 'After dinner' },
        { value: 'before_bed', label: 'Before bed routine' },
        { value: 'none', label: 'No clear anchor - need help' },
      ],
    }
  ),

  createQuestion(
    'habit_accountability',
    'What type of accountability works best for you?',
    'single_select',
    'habit_building',
    null,
    9,
    {
      options: [
        { value: 'self', label: 'Self-tracking and streaks' },
        { value: 'partner', label: 'Accountability partner' },
        { value: 'group', label: 'Group/community' },
        { value: 'coach', label: 'Coach or mentor' },
        { value: 'public', label: 'Public commitment' },
        { value: 'rewards', label: 'Rewards and incentives' },
        { value: 'unsure', label: 'Not sure what works for me' },
      ],
    }
  ),

  createQuestion(
    'habit_streak_goal',
    'What streak length would feel like a win?',
    'single_select',
    'habit_building',
    null,
    10,
    {
      options: [
        { value: '7_days', label: '7 days' },
        { value: '21_days', label: '21 days' },
        { value: '30_days', label: '30 days' },
        { value: '66_days', label: '66 days (habit formation)' },
        { value: '90_days', label: '90 days' },
        { value: 'indefinite', label: 'Indefinitely/lifestyle' },
      ],
    }
  ),

  createQuestion(
    'habit_support_needed',
    'What kind of support do you need most?',
    'single_select',
    'habit_building',
    'wellbeing',
    11,
    {
      options: [
        { value: 'reminders', label: 'Reminders and prompts' },
        { value: 'encouragement', label: 'Encouragement and motivation' },
        { value: 'education', label: 'Education on why habits work' },
        { value: 'tracking', label: 'Simple tracking system' },
        { value: 'flexibility', label: 'Flexibility when I miss days' },
        { value: 'celebration', label: 'Celebration of small wins' },
        { value: 'all', label: 'All of the above' },
      ],
    }
  ),
];

// =============================================================================
// OVERALL OPTIMIZATION SPECIFIC QUESTIONS
// =============================================================================

const overallOptimizationQuestions: AssessmentQuestion[] = [
  createQuestion(
    'optimization_current_state',
    'How would you describe your current overall health?',
    'single_select',
    'overall_optimization',
    null,
    1,
    {
      options: [
        { value: 'excellent', label: 'Excellent - looking to optimize further' },
        { value: 'good', label: 'Good - room for improvement' },
        { value: 'average', label: 'Average - want to level up' },
        { value: 'below_average', label: 'Below average - need improvement' },
        { value: 'poor', label: 'Poor - need significant changes' },
      ],
    }
  ),

  createQuestion(
    'optimization_height',
    'What is your height?',
    'number_input',
    'overall_optimization',
    null,
    2,
    {
      validation: { min: 100, max: 250 },
      sliderConfig: { min: 100, max: 250, step: 1, unit: 'cm' },
    }
  ),

  createQuestion(
    'optimization_weight',
    'What is your current weight?',
    'number_input',
    'overall_optimization',
    null,
    3,
    {
      validation: { min: 30, max: 300 },
      sliderConfig: { min: 30, max: 300, step: 0.1, unit: 'kg' },
    }
  ),

  createQuestion(
    'optimization_priority_pillars',
    'Which health pillars do you want to focus on? Rank your priorities.',
    'multi_select',
    'overall_optimization',
    null,
    4,
    {
      options: [
        { value: 'fitness', label: 'Fitness - Exercise, strength, endurance', emoji: '💪' },
        { value: 'nutrition', label: 'Nutrition - Diet, eating habits', emoji: '🥗' },
        { value: 'wellbeing', label: 'Wellbeing - Sleep, stress, mental health', emoji: '🧘' },
      ],
    }
  ),

  createQuestion(
    'optimization_fitness_goal',
    'What is your primary fitness focus?',
    'single_select',
    'overall_optimization',
    'fitness',
    5,
    {
      options: [
        { value: 'strength', label: 'Build strength' },
        { value: 'endurance', label: 'Improve endurance' },
        { value: 'flexibility', label: 'Increase flexibility' },
        { value: 'weight', label: 'Weight management' },
        { value: 'consistency', label: 'Exercise consistency' },
        { value: 'balanced', label: 'Balanced fitness' },
      ],
    }
  ),

  createQuestion(
    'optimization_nutrition_goal',
    'What is your primary nutrition focus?',
    'single_select',
    'overall_optimization',
    'nutrition',
    6,
    {
      options: [
        { value: 'whole_foods', label: 'Eat more whole foods' },
        { value: 'balanced', label: 'Balanced macros' },
        { value: 'meal_timing', label: 'Better meal timing' },
        { value: 'reduce_processed', label: 'Reduce processed foods' },
        { value: 'hydration', label: 'Better hydration' },
        { value: 'mindful', label: 'Mindful eating' },
      ],
    }
  ),

  createQuestion(
    'optimization_wellbeing_goal',
    'What is your primary wellbeing focus?',
    'single_select',
    'overall_optimization',
    'wellbeing',
    7,
    {
      options: [
        { value: 'sleep', label: 'Better sleep' },
        { value: 'stress', label: 'Stress management' },
        { value: 'energy', label: 'More energy' },
        { value: 'mental_health', label: 'Mental health' },
        { value: 'work_life', label: 'Work-life balance' },
        { value: 'mindfulness', label: 'Mindfulness practice' },
      ],
    }
  ),

  createQuestion(
    'optimization_time_commitment',
    'How much time can you commit to health improvement daily?',
    'single_select',
    'overall_optimization',
    null,
    8,
    {
      options: [
        { value: '15_min', label: '15 minutes' },
        { value: '30_min', label: '30 minutes' },
        { value: '1_hour', label: '1 hour' },
        { value: '2_hours', label: '2 hours' },
        { value: 'varies', label: 'Varies by day' },
        { value: 'flexible', label: 'Flexible - can make time' },
      ],
    }
  ),

  createQuestion(
    'optimization_approach',
    'How would you like to approach optimization?',
    'single_select',
    'overall_optimization',
    null,
    9,
    {
      options: [
        { value: 'aggressive', label: 'Aggressive - maximize results quickly' },
        { value: 'moderate', label: 'Moderate - steady progress' },
        { value: 'gradual', label: 'Gradual - sustainable changes' },
        { value: 'experiment', label: 'Experimental - try different approaches' },
      ],
    }
  ),

  createQuestion(
    'optimization_tracking_interest',
    'How interested are you in tracking and data?',
    'single_select',
    'overall_optimization',
    null,
    10,
    {
      options: [
        { value: 'love_data', label: 'Love data - the more metrics the better' },
        { value: 'some_data', label: 'Some tracking is helpful' },
        { value: 'minimal', label: 'Minimal tracking preferred' },
        { value: 'no_tracking', label: 'No tracking - just guidance' },
      ],
    }
  ),

  createQuestion(
    'optimization_biohacking',
    'Are you interested in biohacking/advanced optimization?',
    'single_select',
    'overall_optimization',
    null,
    11,
    {
      options: [
        { value: 'very', label: 'Very interested - push the limits' },
        { value: 'curious', label: 'Curious - open to trying things' },
        { value: 'basics', label: 'Focus on basics first' },
        { value: 'not_interested', label: 'Not interested - keep it simple' },
      ],
    }
  ),

  createQuestion(
    'optimization_timeline',
    'What is your optimization timeline?',
    'single_select',
    'overall_optimization',
    null,
    12,
    {
      options: [
        { value: '1_month', label: '1 month sprint' },
        { value: '3_months', label: '3 month program' },
        { value: '6_months', label: '6 month transformation' },
        { value: 'ongoing', label: 'Ongoing lifestyle optimization' },
      ],
    }
  ),
];

// =============================================================================
// COMBINE ALL QUESTIONS
// =============================================================================

const allQuestions: AssessmentQuestion[] = [
  ...universalQuestions,
  ...weightLossQuestions,
  ...muscleGainQuestions,
  ...sleepImprovementQuestions,
  ...stressReductionQuestions,
  ...energyBoostQuestions,
  ...eventTrainingQuestions,
  ...healthConditionQuestions,
  ...habitBuildingQuestions,
  ...overallOptimizationQuestions,
];

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedAssessmentQuestions(): Promise<void> {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('Connecting to database...');
    console.log(`Total questions to seed: ${allQuestions.length}`);

    // Upsert questions in batches (insert new, update existing — no destructive DELETE)
    const batchSize = 50;
    let upsertedCount = 0;

    for (let i = 0; i < allQuestions.length; i += batchSize) {
      const batch = allQuestions.slice(i, i + batchSize);

      const values: unknown[] = [];
      const placeholders: string[] = [];

      batch.forEach((q, idx) => {
        const offset = idx * 12;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`
        );
        values.push(
          q.id,
          q.question_id,
          q.text,
          q.type,
          q.category,
          q.pillar,
          q.order_num,
          q.is_required,
          q.options ? JSON.stringify(q.options) : null,
          q.slider_config ? JSON.stringify(q.slider_config) : null,
          q.validation ? JSON.stringify(q.validation) : null,
          q.show_if ? JSON.stringify(q.show_if) : null
        );
      });

      const insertQuery = `
        INSERT INTO assessment_questions (
          id, question_id, text, type, category, pillar, order_num,
          is_required, options, slider_config, validation, show_if
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (question_id) DO UPDATE SET
          text = EXCLUDED.text,
          type = EXCLUDED.type,
          category = EXCLUDED.category,
          pillar = EXCLUDED.pillar,
          order_num = EXCLUDED.order_num,
          is_required = EXCLUDED.is_required,
          options = EXCLUDED.options,
          slider_config = EXCLUDED.slider_config,
          validation = EXCLUDED.validation,
          show_if = EXCLUDED.show_if,
          updated_at = CURRENT_TIMESTAMP
      `;

      await pool.query(insertQuery, values);
      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${allQuestions.length} questions...`);
    }

    // Verify insertion
    const result = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM assessment_questions
      GROUP BY category
      ORDER BY category
    `);

    console.log('\n=== Assessment Questions Seeded Successfully ===\n');
    console.log('Questions by category:');
    result.rows.forEach((row: { category: string; count: string }) => {
      console.log(`  ${row.category}: ${row.count} questions`);
    });

    const totalResult = await pool.query('SELECT COUNT(*) as total FROM assessment_questions');
    console.log(`\nTotal questions: ${totalResult.rows[0].total}`);
  } catch (error) {
    console.error('Error seeding assessment questions:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seed
seedAssessmentQuestions();
