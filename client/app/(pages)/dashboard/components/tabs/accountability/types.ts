export interface Contract {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  conditionType: string;
  conditionMetric: string | null;
  conditionOperator: string | null;
  conditionValue: number | null;
  conditionWindowDays: number;
  conditionDetails: Record<string, unknown>;
  penaltyType: string;
  penaltyAmount: number | null;
  penaltyCurrency: string;
  penaltyDetails: Record<string, unknown>;
  status: ContractStatus;
  signedAt: string | null;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  pauseCount: number;
  verificationMethod: string;
  gracePeriodHours: number;
  confidenceThreshold: number;
  aiSuggested: boolean;
  aiSuggestionReason: string | null;
  socialEnforcerIds: string[];
  violationCount: number;
  successCount: number;
  totalChecks: number;
  lastCheckedAt: string | null;
  lastViolationAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export type ContractStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "violated"
  | "completed"
  | "cancelled"
  | "paused";

export interface ContractViolation {
  id: string;
  contractId: string;
  userId: string;
  violationType: string;
  confidenceScore: number;
  evidence: Record<string, unknown>;
  penaltyStatus: string;
  penaltyExecutedAt: string | null;
  penaltyExecutionDetails: Record<string, unknown>;
  graceExpiresAt: string | null;
  graceUsed: boolean;
  aiIntervened: boolean;
  aiInterventionMessage: string | null;
  userNotified: boolean;
  enforcersNotified: boolean;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface ContractStats {
  activeCount: number;
  completedCount: number;
  totalViolations: number;
  totalSuccessChecks: number;
  overallSuccessRate: number;
  currentActiveStreak: number;
  penaltiesExecuted: number;
  penaltiesPending: number;
}

export interface ContractSuggestion {
  id: string;
  title: string;
  description: string;
  reason: string;
  conditionType: string;
  conditionMetric: string | null;
  conditionOperator: string | null;
  conditionValue: number | null;
  conditionWindowDays: number;
  penaltyType: string;
  penaltyAmount: number;
  penaltyCurrency: string;
  confidence: number;
}

export interface ContractsResponse {
  contracts: Contract[];
  total: number;
}
