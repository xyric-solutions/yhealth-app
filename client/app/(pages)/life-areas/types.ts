export type LifeAreaDomainType =
  | 'career' | 'relationships' | 'creativity' | 'spirituality'
  | 'finance' | 'fitness' | 'learning' | 'custom';

export interface LifeAreaPreferences {
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  blockedDays?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  tone?: 'gentle' | 'direct' | 'playful' | 'neutral';
  followUpFrequency?: 'daily' | 'every-other-day' | 'weekly' | 'off';
  customNotes?: string[];
}

export interface LifeArea {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  domain_type: LifeAreaDomainType;
  icon: string | null;
  color: string | null;
  is_flagship: boolean;
  preferences: LifeAreaPreferences;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface LifeAreaLink {
  id: string;
  life_area_id: string;
  entity_type: 'goal' | 'schedule' | 'contract' | 'reminder';
  entity_id: string;
  created_at: string;
}

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

export interface RoutingChip {
  lifeAreaId: string;
  lifeAreaName: string;
  domainType: LifeAreaDomainType;
  wasAutoCreated: boolean;
  alternatives: { type: LifeAreaDomainType; displayName: string }[];
}
