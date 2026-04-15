/**
 * Goal Setup Types
 */

import type { Goal } from '@/src/types';

export interface GoalCardProps {
  goal: Goal;
  isConfirmed: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  confidence: number;
  editedValues: Partial<Goal> | undefined;
  onToggle: () => void;
  onExpand: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (field: string, value: number | string) => void;
  onTimelineChange: (weeks: number) => void;
  onConfidenceChange: (value: number) => void;
}

export interface GoalHeaderProps {
  goal: Goal;
  isConfirmed: boolean;
  isEditing: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

export interface GoalEditFormProps {
  goal: Goal;
  editedValues: Partial<Goal> | undefined;
  onEditChange: (field: string, value: number | string) => void;
  onTimelineChange: (weeks: number) => void;
}

export interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export interface TimelineOption {
  weeks: number;
  label: string;
}
