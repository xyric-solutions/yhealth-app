/**
 * @file Activity domain models
 */

export type ActivityCompletionStatus = 'pending' | 'completed' | 'skipped';

export type ActivityType =
  | 'exercise'
  | 'meal'
  | 'hydration'
  | 'sleep'
  | 'meditation'
  | 'check_in'
  | 'custom';

export interface ActivityLog {
  id: string;
  planId: string;
  activityId: string;
  scheduledDate: string;
  status: ActivityCompletionStatus;
  completedAt?: string;
  notes?: string;
  actualValue?: number;
  targetValue?: number;
  duration?: number;
  mood?: number;
  aiFeedback?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Activity {
  id: string;
  type: ActivityType | string;
  title: string;
  description: string;
  targetValue?: number;
  targetUnit?: string;
  preferredTime: string;
  duration?: number;
  status: ActivityCompletionStatus;
  log?: ActivityLog;
}

export interface ActivityItem extends Activity {
  planId: string;
  scheduledDate: string;
  isRecurring: boolean;
  recurringPattern?: string;
}
