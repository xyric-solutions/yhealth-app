/**
 * Shared types for question input components
 * Used across onboarding assessments, settings, and forms
 */

// Base props shared by all question components
export interface BaseQuestionProps {
  /** Unique identifier for the question */
  id?: string;
  /** Label displayed above the input */
  label?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

// Slider Input Props
export interface SliderInputProps extends BaseQuestionProps {
  /** Current value */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Unit to display (e.g., "kg", "hours") */
  unit?: string;
  /** Whether to show the value display badge */
  showValue?: boolean;
  /** Labels to show at min/max positions */
  labels?: string[];
  /** Custom gradient colors for the thumb */
  gradientFrom?: string;
  gradientTo?: string;
}

// Emoji Scale Props
export interface EmojiScaleProps extends BaseQuestionProps {
  /** Current selected value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Scale options */
  options: EmojiScaleOption[];
  /** Number of columns (auto-calculated from options length if not provided) */
  columns?: 3 | 4 | 5;
}

export interface EmojiScaleOption {
  /** Unique value for this option */
  value: string;
  /** Display label */
  label: string;
  /** Emoji or number to display (optional - will use index+1 if not provided) */
  emoji?: string;
  /** Icon component to display (optional - takes precedence over emoji) */
  icon?: React.ComponentType<{ className?: string }>;
}

// Single Select Props
export interface SingleSelectProps extends BaseQuestionProps {
  /** Current selected value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available options */
  options: SingleSelectOption[];
  /** Layout - vertical list or grid */
  layout?: 'list' | 'grid';
  /** Number of grid columns (only used when layout='grid') */
  columns?: 2 | 3 | 4;
}

export interface SingleSelectOption {
  /** Unique value for this option */
  value: string;
  /** Display label */
  label: string;
  /** Optional description shown below label */
  description?: string;
  /** Optional icon (React node) */
  icon?: React.ReactNode;
}

// Number Input Props
export interface NumberInputProps extends BaseQuestionProps {
  /** Current value */
  value: number | undefined;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Unit to display (e.g., "kg", "cm") */
  unit?: string;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Input size variant */
  size?: 'sm' | 'md' | 'lg';
}

// Multi Select Props (for future use)
export interface MultiSelectProps extends BaseQuestionProps {
  /** Current selected values */
  value: string[];
  /** Callback when values change */
  onChange: (value: string[]) => void;
  /** Available options */
  options: SingleSelectOption[];
  /** Maximum selections allowed */
  maxSelections?: number;
  /** Layout - vertical list or grid */
  layout?: 'list' | 'grid';
  /** Number of grid columns (only used when layout='grid') */
  columns?: 2 | 3 | 4;
}
