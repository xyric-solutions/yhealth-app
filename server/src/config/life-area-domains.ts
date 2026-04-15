export type LifeAreaDomainType =
  | 'career'
  | 'relationships'
  | 'creativity'
  | 'spirituality'
  | 'finance'
  | 'fitness'
  | 'learning'
  | 'custom';

export interface LifeAreaDomain {
  type: LifeAreaDomainType;
  displayName: string;
  description: string;
  defaultIcon: string;
  defaultColor: string;
  isFlagship: boolean;
  suggestedCadence: 'daily' | 'weekly' | 'custom';
  coachPromptHints: string[];
  examplePhrases: string[];
}

export const LIFE_AREA_DOMAINS: LifeAreaDomain[] = [
  {
    type: 'career',
    displayName: 'Career',
    description: 'Job hunting, skill building, performance reviews, promotion planning, salary prep, side projects.',
    defaultIcon: 'Briefcase',
    defaultColor: '#6366f1',
    isFlagship: true,
    suggestedCadence: 'daily',
    coachPromptHints: [
      'Ask about applications sent today.',
      'Nudge on resume tweaks weekly.',
      'Check in on networking outreach.',
    ],
    examplePhrases: [
      'I want a better job',
      "I've been lazy about applying",
      'need to update my resume',
      'prep for my review',
      'negotiate my salary',
    ],
  },
  {
    type: 'relationships',
    displayName: 'Relationships',
    description: 'Spending quality time with family, friends, partner; maintaining connections; social routines.',
    defaultIcon: 'Heart',
    defaultColor: '#ec4899',
    isFlagship: false,
    suggestedCadence: 'daily',
    coachPromptHints: ['Ask gently about time spent with the person.', 'Avoid guilt-tripping tone.'],
    examplePhrases: [
      "don't spend enough time with my mother",
      'want to call my friend more',
      'date night with my partner',
      'reconnect with old friends',
    ],
  },
  {
    type: 'creativity',
    displayName: 'Creativity',
    description: 'Creative practice — writing, drawing, music, crafts; projects, portfolio, daily practice.',
    defaultIcon: 'Palette',
    defaultColor: '#f59e0b',
    isFlagship: false,
    suggestedCadence: 'daily',
    coachPromptHints: ['Celebrate any output, however small.', 'Never critique creative work — only consistency.'],
    examplePhrases: ['want to write more', 'practice guitar', 'work on my novel', 'draw every day'],
  },
  {
    type: 'spirituality',
    displayName: 'Spirituality',
    description: 'Prayer, meditation, reflection, faith practices.',
    defaultIcon: 'Sparkles',
    defaultColor: '#8b5cf6',
    isFlagship: false,
    suggestedCadence: 'daily',
    coachPromptHints: ["Respect the user's faith tradition.", 'Stay neutral on religious content.'],
    examplePhrases: ['pray more', 'meditation practice', 'read scripture daily'],
  },
  {
    type: 'finance',
    displayName: 'Finance',
    description: 'Budgeting, saving, debt reduction, investing habits.',
    defaultIcon: 'Wallet',
    defaultColor: '#10b981',
    isFlagship: false,
    suggestedCadence: 'weekly',
    coachPromptHints: ['Ask about the number, not feelings about the number.'],
    examplePhrases: ['save more', 'pay off debt', 'track my spending'],
  },
  {
    type: 'fitness',
    displayName: 'Fitness',
    description: 'Exercise consistency, movement habits, sport practice.',
    defaultIcon: 'Dumbbell',
    defaultColor: '#ef4444',
    isFlagship: false,
    suggestedCadence: 'daily',
    coachPromptHints: ['Coordinate with existing workout plans.'],
    examplePhrases: ['exercise more', 'go to the gym', 'run 3x a week'],
  },
  {
    type: 'learning',
    displayName: 'Learning',
    description: 'Courses, books, skills outside career; intellectual curiosity.',
    defaultIcon: 'BookOpen',
    defaultColor: '#06b6d4',
    isFlagship: false,
    suggestedCadence: 'daily',
    coachPromptHints: ['Track pages/minutes, not completion.'],
    examplePhrases: ['read more books', 'learn spanish', 'take a course'],
  },
  {
    type: 'custom',
    displayName: 'Custom',
    description: "Anything that doesn't fit another category — user defines it.",
    defaultIcon: 'Target',
    defaultColor: '#64748b',
    isFlagship: false,
    suggestedCadence: 'custom',
    coachPromptHints: ["Follow the user's lead on tone and cadence."],
    examplePhrases: ['something I want to improve'],
  },
];

export function getDomainByType(type: LifeAreaDomainType): LifeAreaDomain | null {
  return LIFE_AREA_DOMAINS.find((d) => d.type === type) ?? null;
}

export function listDomainTypes(): LifeAreaDomainType[] {
  return LIFE_AREA_DOMAINS.map((d) => d.type);
}
