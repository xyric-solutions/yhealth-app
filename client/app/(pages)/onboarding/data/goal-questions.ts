/**
 * Goal-specific assessment questions for onboarding
 * Each goal category has targeted questions that help personalize the user's plan
 */

import type { GoalCategory } from '@/src/types';
import {
  Activity,
  Moon,
  Utensils,
  Brain,
  Target,
  Ruler,
  Scale,
  Timer,
  Dumbbell,
  TrendingUp,
  Coffee,
  Clock,
  Heart,
  Zap,
  Trophy,
  Calendar,
  Pill,
  Apple,
  Flame,
  BedDouble,
  Sunrise,
  Wind,
  Sparkles,
  Circle,
  Egg,
  Fish,
  Beef,
  Drumstick,
} from 'lucide-react';
import { createElement } from 'react';

export interface QuestionOption {
  value: string;
  label: string;
  emoji?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  labels?: string[];
  unit?: string;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'slider' | 'emoji_scale' | 'single_select' | 'multi_select' | 'number';
  category: string;
  pillar: string;
  iconName: string;
  options?: QuestionOption[];
  sliderConfig?: SliderConfig;
  unit?: string;
}

// Helper to get icon component by name
export const getQuestionIcon = (iconName: string, className = 'w-6 h-6') => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Activity,
    Moon,
    Utensils,
    Brain,
    Target,
    Ruler,
    Scale,
    Timer,
    Dumbbell,
    TrendingUp,
    Coffee,
    Clock,
    Heart,
    Zap,
    Trophy,
    Calendar,
    Pill,
    Apple,
    Flame,
    BedDouble,
    Sunrise,
    Wind,
    Sparkles,
  };
  const IconComponent = iconMap[iconName] || Target;
  return createElement(IconComponent, { className });
};

// Common baseline questions that appear for all goals
const commonBaselineQuestions: AssessmentQuestion[] = [
  {
    id: 'height',
    text: 'What is your height?',
    type: 'number',
    category: 'body_stats',
    pillar: 'general',
    iconName: 'Ruler',
    unit: 'cm',
  },
  {
    id: 'weight',
    text: 'What is your current weight?',
    type: 'number',
    category: 'body_stats',
    pillar: 'general',
    iconName: 'Scale',
    unit: 'kg',
  },
];

// Weight Loss specific questions
const weightLossQuestions: AssessmentQuestion[] = [
  {
    id: 'target_weight',
    text: 'What is your target weight?',
    type: 'number',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Target',
    unit: 'kg',
  },
  {
    id: 'eating_habits',
    text: 'How would you describe your current eating habits?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'nutrition',
    iconName: 'Utensils',
    options: [
      { value: 'unhealthy', label: 'Mostly processed/fast food' },
      { value: 'mixed', label: 'Mix of healthy and unhealthy' },
      { value: 'healthy', label: 'Mostly whole foods' },
      { value: 'very_healthy', label: 'Very clean, balanced diet' },
    ],
  },
  {
    id: 'snacking',
    text: 'How often do you snack between meals?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'nutrition',
    iconName: 'Apple',
    options: [
      { value: 'rarely', label: 'Rarely or never' },
      { value: 'sometimes', label: '1-2 times per day' },
      { value: 'often', label: '3-4 times per day' },
      { value: 'frequently', label: 'Almost constantly' },
    ],
  },
  {
    id: 'previous_diets',
    text: 'Have you tried losing weight before?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'TrendingUp',
    options: [
      { value: 'never', label: 'This is my first time' },
      { value: 'once', label: 'Once, with some success' },
      { value: 'multiple_fail', label: 'Multiple times, struggled to keep it off' },
      { value: 'multiple_success', label: 'Multiple times, usually successful' },
    ],
  },
  {
    id: 'biggest_challenge_weight',
    text: 'What is your biggest weight loss challenge?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Target',
    options: [
      { value: 'cravings', label: 'Managing food cravings' },
      { value: 'portions', label: 'Controlling portion sizes' },
      { value: 'emotional', label: 'Emotional or stress eating' },
      { value: 'time', label: 'Finding time to cook healthy meals' },
      { value: 'motivation', label: 'Staying motivated' },
    ],
  },
];

// Muscle Building specific questions
const muscleBuildingQuestions: AssessmentQuestion[] = [
  {
    id: 'gym_experience',
    text: 'How much weight training experience do you have?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Dumbbell',
    options: [
      { value: 'beginner', label: 'Complete beginner (0-6 months)' },
      { value: 'intermediate', label: 'Some experience (6 months - 2 years)' },
      { value: 'experienced', label: 'Experienced (2-5 years)' },
      { value: 'advanced', label: 'Advanced (5+ years)' },
    ],
  },
  {
    id: 'training_frequency',
    text: 'How many days per week can you commit to training?',
    type: 'slider',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Calendar',
    sliderConfig: {
      min: 1,
      max: 7,
      step: 1,
      labels: ['1 day', '2-3 days', '4-5 days', '6-7 days'],
      unit: 'days/week',
    },
  },
  {
    id: 'gym_access',
    text: 'What equipment do you have access to?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Dumbbell',
    options: [
      { value: 'none', label: 'No equipment (bodyweight only)' },
      { value: 'basic', label: 'Basic home equipment (dumbbells, bands)' },
      { value: 'home_gym', label: 'Full home gym setup' },
      { value: 'commercial', label: 'Commercial gym membership' },
    ],
  },
  {
    id: 'protein_intake',
    text: 'How would you rate your current protein intake?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'nutrition',
    iconName: 'Utensils',
    options: [
      { value: '1', label: 'Very Low', icon: Circle },
      { value: '2', label: 'Low', icon: Egg },
      { value: '3', label: 'Moderate', icon: Fish },
      { value: '4', label: 'Good', icon: Drumstick },
      { value: '5', label: 'High', icon: Beef },
    ],
  },
  {
    id: 'muscle_goal',
    text: 'What is your primary muscle-building goal?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Target',
    options: [
      { value: 'strength', label: 'Get stronger (focus on lifts)' },
      { value: 'size', label: 'Build muscle size (hypertrophy)' },
      { value: 'tone', label: 'Get toned and defined' },
      { value: 'athletic', label: 'Improve athletic performance' },
    ],
  },
];

// Sleep Improvement specific questions
const sleepQuestions: AssessmentQuestion[] = [
  {
    id: 'sleep_hours',
    text: 'How many hours of sleep do you typically get?',
    type: 'slider',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Moon',
    sliderConfig: {
      min: 3,
      max: 10,
      step: 0.5,
      labels: ['3h', '5h', '7h', '9h', '10h'],
      unit: 'hours',
    },
  },
  {
    id: 'sleep_quality',
    text: 'How would you rate your overall sleep quality?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'BedDouble',
    options: [
      { value: '1', label: 'Very Poor', emoji: '1' },
      { value: '2', label: 'Poor', emoji: '2' },
      { value: '3', label: 'Fair', emoji: '3' },
      { value: '4', label: 'Good', emoji: '4' },
      { value: '5', label: 'Excellent', emoji: '5' },
    ],
  },
  {
    id: 'sleep_issues',
    text: 'What sleep issues do you experience most?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Moon',
    options: [
      { value: 'falling_asleep', label: 'Difficulty falling asleep' },
      { value: 'staying_asleep', label: 'Waking up during the night' },
      { value: 'waking_early', label: 'Waking up too early' },
      { value: 'not_rested', label: 'Not feeling rested after sleep' },
      { value: 'irregular', label: 'Irregular sleep schedule' },
    ],
  },
  {
    id: 'bedtime_routine',
    text: 'Do you have a consistent bedtime routine?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Clock',
    options: [
      { value: 'none', label: 'No routine at all' },
      { value: 'inconsistent', label: 'Sometimes, but inconsistent' },
      { value: 'basic', label: 'Basic routine, could be better' },
      { value: 'strong', label: 'Yes, a solid wind-down routine' },
    ],
  },
  {
    id: 'screen_time',
    text: 'How often do you use screens before bed?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Sunrise',
    options: [
      { value: 'never', label: 'Never - I avoid screens before bed' },
      { value: 'rarely', label: 'Rarely - maybe once a week' },
      { value: 'sometimes', label: 'Sometimes - a few times a week' },
      { value: 'always', label: 'Almost every night' },
    ],
  },
];

// Stress & Wellness specific questions
const stressQuestions: AssessmentQuestion[] = [
  {
    id: 'stress_level',
    text: 'What is your current stress level?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Brain',
    options: [
      { value: '1', label: 'Very Low', emoji: '1' },
      { value: '2', label: 'Low', emoji: '2' },
      { value: '3', label: 'Moderate', emoji: '3' },
      { value: '4', label: 'High', emoji: '4' },
      { value: '5', label: 'Very High', emoji: '5' },
    ],
  },
  {
    id: 'stress_sources',
    text: 'What is your primary source of stress?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Brain',
    options: [
      { value: 'work', label: 'Work or career' },
      { value: 'relationships', label: 'Relationships or family' },
      { value: 'health', label: 'Health concerns' },
      { value: 'finances', label: 'Financial stress' },
      { value: 'general', label: 'General life overwhelm' },
    ],
  },
  {
    id: 'mindfulness_experience',
    text: 'Have you tried mindfulness or meditation before?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Wind',
    options: [
      { value: 'never', label: 'Never tried' },
      { value: 'tried', label: 'Tried but did not stick with it' },
      { value: 'occasional', label: 'Practice occasionally' },
      { value: 'regular', label: 'Regular practice' },
    ],
  },
  {
    id: 'relaxation_time',
    text: 'How much time do you take for relaxation daily?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Clock',
    options: [
      { value: 'none', label: 'Almost none' },
      { value: '15min', label: 'About 15 minutes' },
      { value: '30min', label: 'About 30 minutes' },
      { value: '1hour', label: '1 hour or more' },
    ],
  },
  {
    id: 'stress_symptoms',
    text: 'How does stress typically affect you?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Heart',
    options: [
      { value: 'physical', label: 'Physical tension (headaches, muscle pain)' },
      { value: 'mental', label: 'Mental (anxiety, racing thoughts)' },
      { value: 'emotional', label: 'Emotional (irritability, mood swings)' },
      { value: 'behavioral', label: 'Behavioral (overeating, poor sleep)' },
    ],
  },
];

// Energy & Productivity specific questions
const energyQuestions: AssessmentQuestion[] = [
  {
    id: 'energy_level',
    text: 'How would you rate your typical energy level?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Zap',
    options: [
      { value: '1', label: 'Very Low', emoji: '1' },
      { value: '2', label: 'Low', emoji: '2' },
      { value: '3', label: 'Moderate', emoji: '3' },
      { value: '4', label: 'Good', emoji: '4' },
      { value: '5', label: 'High', emoji: '5' },
    ],
  },
  {
    id: 'energy_pattern',
    text: 'When do you feel most energetic?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Sunrise',
    options: [
      { value: 'morning', label: 'Early morning' },
      { value: 'mid_morning', label: 'Mid-morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
      { value: 'inconsistent', label: 'It varies a lot' },
    ],
  },
  {
    id: 'caffeine_intake',
    text: 'How much caffeine do you consume daily?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'nutrition',
    iconName: 'Coffee',
    options: [
      { value: 'none', label: 'None' },
      { value: 'light', label: '1-2 cups of coffee/tea' },
      { value: 'moderate', label: '3-4 cups of coffee/tea' },
      { value: 'heavy', label: '5+ cups or energy drinks' },
    ],
  },
  {
    id: 'afternoon_slump',
    text: 'Do you experience an afternoon energy crash?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'TrendingUp',
    options: [
      { value: 'never', label: 'Never or rarely' },
      { value: 'sometimes', label: 'A few times a week' },
      { value: 'often', label: 'Most days' },
      { value: 'always', label: 'Every day without fail' },
    ],
  },
  {
    id: 'hydration',
    text: 'How much water do you drink daily?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'nutrition',
    iconName: 'Target',
    options: [
      { value: 'low', label: 'Less than 4 glasses' },
      { value: 'moderate', label: '4-6 glasses' },
      { value: 'good', label: '7-8 glasses' },
      { value: 'excellent', label: 'More than 8 glasses' },
    ],
  },
];

// Event Training specific questions
const eventTrainingQuestions: AssessmentQuestion[] = [
  {
    id: 'event_type',
    text: 'What type of event are you training for?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Trophy',
    options: [
      { value: 'running', label: 'Running event (5K, marathon, etc.)' },
      { value: 'cycling', label: 'Cycling event' },
      { value: 'triathlon', label: 'Triathlon or multi-sport' },
      { value: 'sports', label: 'Sports competition' },
      { value: 'other', label: 'Other fitness challenge' },
    ],
  },
  {
    id: 'event_date',
    text: 'How many weeks until your event?',
    type: 'slider',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Calendar',
    sliderConfig: {
      min: 2,
      max: 24,
      step: 1,
      labels: ['2 weeks', '8 weeks', '16 weeks', '24 weeks'],
      unit: 'weeks',
    },
  },
  {
    id: 'current_fitness',
    text: 'What is your current fitness level for this event?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Activity',
    options: [
      { value: '1', label: 'Beginner', emoji: '1' },
      { value: '2', label: 'Below Average', emoji: '2' },
      { value: '3', label: 'Average', emoji: '3' },
      { value: '4', label: 'Good', emoji: '4' },
      { value: '5', label: 'Competitive', emoji: '5' },
    ],
  },
  {
    id: 'training_hours',
    text: 'How many hours per week can you train?',
    type: 'slider',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Timer',
    sliderConfig: {
      min: 2,
      max: 20,
      step: 1,
      labels: ['2h', '6h', '10h', '15h', '20h'],
      unit: 'hours/week',
    },
  },
  {
    id: 'event_goal',
    text: 'What is your goal for this event?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Target',
    options: [
      { value: 'complete', label: 'Just complete it' },
      { value: 'personal_best', label: 'Set a personal best' },
      { value: 'competitive', label: 'Place competitively' },
      { value: 'enjoy', label: 'Have fun and stay healthy' },
    ],
  },
];

// Health Condition specific questions
const healthConditionQuestions: AssessmentQuestion[] = [
  {
    id: 'condition_type',
    text: 'What area would you like to manage better?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Heart',
    options: [
      { value: 'cardiovascular', label: 'Heart health / Blood pressure' },
      { value: 'metabolic', label: 'Blood sugar / Diabetes management' },
      { value: 'joint', label: 'Joint health / Mobility' },
      { value: 'digestive', label: 'Digestive health' },
      { value: 'other', label: 'Other condition' },
    ],
  },
  {
    id: 'medical_guidance',
    text: 'Are you working with a healthcare provider?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'wellbeing',
    iconName: 'Pill',
    options: [
      { value: 'yes_active', label: 'Yes, actively under their care' },
      { value: 'yes_periodic', label: 'Yes, periodic check-ups' },
      { value: 'planning', label: 'Planning to see one' },
      { value: 'no', label: 'No, managing independently' },
    ],
  },
  {
    id: 'activity_limitations',
    text: 'Do you have any exercise limitations?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Activity',
    options: [
      { value: 'none', label: 'No limitations' },
      { value: 'mild', label: 'Minor limitations (some exercises to avoid)' },
      { value: 'moderate', label: 'Moderate limitations (need modifications)' },
      { value: 'significant', label: 'Significant limitations (restricted activities)' },
    ],
  },
  {
    id: 'lifestyle_changes',
    text: 'What lifestyle changes are you most ready for?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'TrendingUp',
    options: [
      { value: 'diet', label: 'Dietary changes' },
      { value: 'exercise', label: 'Regular exercise' },
      { value: 'stress', label: 'Stress management' },
      { value: 'all', label: 'Ready for comprehensive changes' },
    ],
  },
  {
    id: 'tracking_comfort',
    text: 'How comfortable are you tracking health metrics?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Target',
    options: [
      { value: '1', label: 'Not at all', emoji: '1' },
      { value: '2', label: 'Somewhat', emoji: '2' },
      { value: '3', label: 'Neutral', emoji: '3' },
      { value: '4', label: 'Comfortable', emoji: '4' },
      { value: '5', label: 'Very comfortable', emoji: '5' },
    ],
  },
];

// Habit Building specific questions
const habitBuildingQuestions: AssessmentQuestion[] = [
  {
    id: 'habit_focus',
    text: 'What type of habits do you want to build?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Sparkles',
    options: [
      { value: 'exercise', label: 'Exercise and movement' },
      { value: 'nutrition', label: 'Healthy eating' },
      { value: 'sleep', label: 'Better sleep routine' },
      { value: 'mindfulness', label: 'Mindfulness and self-care' },
      { value: 'multiple', label: 'Multiple areas' },
    ],
  },
  {
    id: 'habit_history',
    text: 'How successful have you been with building habits before?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'TrendingUp',
    options: [
      { value: '1', label: 'Very difficult', emoji: '1' },
      { value: '2', label: 'Struggled', emoji: '2' },
      { value: '3', label: 'Mixed results', emoji: '3' },
      { value: '4', label: 'Fairly good', emoji: '4' },
      { value: '5', label: 'Very successful', emoji: '5' },
    ],
  },
  {
    id: 'habit_blockers',
    text: 'What usually prevents you from sticking to habits?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Target',
    options: [
      { value: 'motivation', label: 'Losing motivation over time' },
      { value: 'time', label: 'Not having enough time' },
      { value: 'forgetting', label: 'Forgetting to do it' },
      { value: 'too_ambitious', label: 'Setting goals too big' },
      { value: 'disruptions', label: 'Life disruptions breaking the streak' },
    ],
  },
  {
    id: 'accountability',
    text: 'What type of accountability works best for you?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Heart',
    options: [
      { value: 'self', label: 'Self-tracking and personal goals' },
      { value: 'app', label: 'App reminders and streaks' },
      { value: 'social', label: 'Sharing progress with friends/family' },
      { value: 'coach', label: 'Professional coaching or guidance' },
    ],
  },
  {
    id: 'daily_time',
    text: 'How much time can you dedicate to new habits daily?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Clock',
    options: [
      { value: '5min', label: '5-10 minutes' },
      { value: '15min', label: '15-30 minutes' },
      { value: '30min', label: '30-60 minutes' },
      { value: '1hour', label: 'More than 1 hour' },
    ],
  },
];

// Overall Optimization specific questions
const overallOptimizationQuestions: AssessmentQuestion[] = [
  {
    id: 'current_health_rating',
    text: 'How would you rate your overall health right now?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Heart',
    options: [
      { value: '1', label: 'Poor', emoji: '1' },
      { value: '2', label: 'Fair', emoji: '2' },
      { value: '3', label: 'Good', emoji: '3' },
      { value: '4', label: 'Very Good', emoji: '4' },
      { value: '5', label: 'Excellent', emoji: '5' },
    ],
  },
  {
    id: 'weakest_area',
    text: 'Which health pillar needs the most attention?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Target',
    options: [
      { value: 'fitness', label: 'Fitness (exercise, strength, cardio)' },
      { value: 'nutrition', label: 'Nutrition (diet, eating habits)' },
      { value: 'sleep', label: 'Sleep (quality, consistency)' },
      { value: 'stress', label: 'Mental wellbeing (stress, mindfulness)' },
      { value: 'balanced', label: 'All need equal attention' },
    ],
  },
  {
    id: 'activity_level',
    text: 'How many days per week are you currently active?',
    type: 'slider',
    category: 'goal_specific',
    pillar: 'fitness',
    iconName: 'Activity',
    sliderConfig: {
      min: 0,
      max: 7,
      step: 1,
      labels: ['0 days', '2-3 days', '4-5 days', '6-7 days'],
      unit: 'days/week',
    },
  },
  {
    id: 'nutrition_quality',
    text: 'How would you rate your current diet quality?',
    type: 'emoji_scale',
    category: 'goal_specific',
    pillar: 'nutrition',
    iconName: 'Apple',
    options: [
      { value: '1', label: 'Very Poor', emoji: '1' },
      { value: '2', label: 'Poor', emoji: '2' },
      { value: '3', label: 'Average', emoji: '3' },
      { value: '4', label: 'Good', emoji: '4' },
      { value: '5', label: 'Excellent', emoji: '5' },
    ],
  },
  {
    id: 'optimization_priority',
    text: 'What is most important to you in optimizing your health?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Sparkles',
    options: [
      { value: 'longevity', label: 'Long-term health and longevity' },
      { value: 'performance', label: 'Peak physical performance' },
      { value: 'energy', label: 'Daily energy and vitality' },
      { value: 'balance', label: 'Work-life-health balance' },
      { value: 'appearance', label: 'Looking and feeling my best' },
    ],
  },
];

// Custom goal questions (general)
const customGoalQuestions: AssessmentQuestion[] = [
  {
    id: 'activity_level',
    text: 'How many days per week are you currently active?',
    type: 'slider',
    category: 'baseline',
    pillar: 'fitness',
    iconName: 'Activity',
    sliderConfig: {
      min: 0,
      max: 7,
      step: 1,
      labels: ['0 days', '1-2 days', '3-4 days', '5-6 days', '7 days'],
      unit: 'days/week',
    },
  },
  {
    id: 'sleep_quality',
    text: 'How would you rate your sleep quality?',
    type: 'emoji_scale',
    category: 'baseline',
    pillar: 'wellbeing',
    iconName: 'Moon',
    options: [
      { value: '1', label: 'Very Poor', emoji: '1' },
      { value: '2', label: 'Poor', emoji: '2' },
      { value: '3', label: 'Fair', emoji: '3' },
      { value: '4', label: 'Good', emoji: '4' },
      { value: '5', label: 'Excellent', emoji: '5' },
    ],
  },
  {
    id: 'stress_level',
    text: 'What is your current stress level?',
    type: 'emoji_scale',
    category: 'baseline',
    pillar: 'wellbeing',
    iconName: 'Brain',
    options: [
      { value: '1', label: 'Very Low', emoji: '1' },
      { value: '2', label: 'Low', emoji: '2' },
      { value: '3', label: 'Moderate', emoji: '3' },
      { value: '4', label: 'High', emoji: '4' },
      { value: '5', label: 'Very High', emoji: '5' },
    ],
  },
  {
    id: 'biggest_challenge',
    text: 'What is your biggest health challenge?',
    type: 'single_select',
    category: 'baseline',
    pillar: 'general',
    iconName: 'Target',
    options: [
      { value: 'time', label: 'Finding time' },
      { value: 'motivation', label: 'Staying motivated' },
      { value: 'knowledge', label: 'Knowing what to do' },
      { value: 'consistency', label: 'Being consistent' },
      { value: 'energy', label: 'Having enough energy' },
    ],
  },
  {
    id: 'custom_priority',
    text: 'What aspect of health matters most to you?',
    type: 'single_select',
    category: 'goal_specific',
    pillar: 'general',
    iconName: 'Heart',
    options: [
      { value: 'physical', label: 'Physical fitness' },
      { value: 'mental', label: 'Mental wellbeing' },
      { value: 'nutrition', label: 'Nutrition and diet' },
      { value: 'recovery', label: 'Rest and recovery' },
      { value: 'holistic', label: 'Holistic wellness' },
    ],
  },
];

// Map of goal categories to their specific questions
const goalQuestionMap: Record<GoalCategory, AssessmentQuestion[]> = {
  weight_loss: weightLossQuestions,
  muscle_building: muscleBuildingQuestions,
  sleep_improvement: sleepQuestions,
  stress_wellness: stressQuestions,
  energy_productivity: energyQuestions,
  event_training: eventTrainingQuestions,
  health_condition: healthConditionQuestions,
  habit_building: habitBuildingQuestions,
  overall_optimization: overallOptimizationQuestions,
  nutrition: customGoalQuestions,
  fitness: muscleBuildingQuestions,
  custom: customGoalQuestions,
};

// Get questions for a specific goal category
export function getQuestionsForGoal(goalCategory: GoalCategory | null): AssessmentQuestion[] {
  if (!goalCategory) {
    // Fallback to custom questions if no goal selected
    return [...customGoalQuestions, ...commonBaselineQuestions];
  }

  const goalSpecificQuestions = goalQuestionMap[goalCategory] || customGoalQuestions;

  // Combine goal-specific questions with common baseline questions
  // Body stats (height/weight) come at the end
  return [...goalSpecificQuestions, ...commonBaselineQuestions];
}

// Get the title for the assessment based on goal
export function getAssessmentTitle(goalCategory: GoalCategory | null): string {
  const titles: Record<GoalCategory, string> = {
    weight_loss: 'Weight Loss Assessment',
    muscle_building: 'Muscle Building Assessment',
    sleep_improvement: 'Sleep Quality Assessment',
    stress_wellness: 'Stress & Wellness Assessment',
    energy_productivity: 'Energy Assessment',
    event_training: 'Event Training Assessment',
    health_condition: 'Health Management Assessment',
    habit_building: 'Habit Building Assessment',
    overall_optimization: 'Health Optimization Assessment',
    nutrition: 'Nutrition Assessment',
    fitness: 'Fitness Assessment',
    custom: 'Personal Health Assessment',
  };

  return goalCategory ? titles[goalCategory] : 'Quick Assessment';
}

// Get subtitle for the assessment based on goal
export function getAssessmentSubtitle(goalCategory: GoalCategory | null): string {
  const subtitles: Record<GoalCategory, string> = {
    weight_loss: 'Help us understand your current habits to create your personalized weight loss plan',
    muscle_building: 'Tell us about your training background to build your muscle-gaining program',
    sleep_improvement: 'Share your sleep patterns so we can help you wake up refreshed',
    stress_wellness: 'Let us understand your stress triggers to design your wellness routine',
    energy_productivity: 'Help us identify what is draining your energy',
    event_training: 'Tell us about your event so we can create your training plan',
    health_condition: 'Share your health goals so we can support your journey safely',
    habit_building: 'Help us understand your patterns to build lasting healthy habits',
    overall_optimization: 'Give us a complete picture to optimize every aspect of your health',
    nutrition: 'Tell us about your eating habits to create a personalized nutrition plan',
    fitness: 'Share your fitness background to design your training program',
    custom: 'Answer a few questions to personalize your experience',
  };

  return goalCategory ? subtitles[goalCategory] : 'Help us personalize your health journey';
}
