export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category:
    | "streak"
    | "milestone"
    | "special"
    | "challenge"
    | "pillar"
    | "comeback"
    | "micro-win";
  rarity: "common" | "rare" | "epic" | "legendary";
  xpReward: number;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  progressPercentage: number;
  unlockedAt?: string;
  aiGenerated?: boolean;
  emotionalContext?: string;
  type?: "streak" | "milestone" | "comeback" | "progression" | "micro-win";
}

export interface AchievementSummary {
  level: number;
  totalXP: number;
  xpProgress: number;
  xpNeeded: number;
  xpProgressPercentage: number;
  totalUnlocked: number;
  totalAchievements: number;
  featuredAchievements: Achievement[];
  nearlyUnlocked: Achievement[];
  currentStreak: number;
  longestStreak: number;
  recentUnlocks?: Achievement[];
}

export interface CategoryBreakdown {
  total: number;
  unlocked: number;
}

export interface AchievementsData {
  achievements: Achievement[];
  summary: {
    totalAchievements: number;
    unlockedCount: number;
    unlockedPercentage: number;
    totalXP: number;
    categoryBreakdown: Record<string, CategoryBreakdown>;
    rarityBreakdown: Record<string, number>;
  };
}

export type AchievementFilter = "all" | "unlocked" | "locked";
export type AchievementCategory =
  | "all"
  | "streak"
  | "milestone"
  | "pillar"
  | "special"
  | "challenge"
  | "comeback"
  | "micro-win";
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
