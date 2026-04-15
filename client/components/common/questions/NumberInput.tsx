"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { NumberInputProps } from "./types";

/**
 * NumberInput - A styled number input with unit display
 *
 * Features:
 * - Unit label display
 * - Min/max validation
 * - Size variants
 * - Controlled & synced with external value
 * - Accessible with keyboard navigation
 *
 * @example
 * <NumberInput
 *   value={weight}
 *   onChange={setWeight}
 *   unit="kg"
 *   placeholder="Enter weight"
 *   min={30}
 *   max={300}
 * />
 */
export function NumberInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Enter value",
  unit,
  min,
  max,
  step = 1,
  size = "md",
  disabled = false,
  error,
  className,
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState(value?.toString() || "");
  const inputId = useMemo(() => {
    if (id) return id;
    // Use a counter-based approach for stable IDs
    // eslint-disable-next-line react-hooks/purity
    return `number-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }, [id]);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value?.toString() || "");
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      if (val === "") {
        // Allow clearing the input
        return;
      }

      const numVal = Number(val);
      if (!isNaN(numVal)) {
        // Apply min/max constraints
        let constrainedVal = numVal;
        if (min !== undefined && numVal < min) constrainedVal = min;
        if (max !== undefined && numVal > max) constrainedVal = max;
        onChange(constrainedVal);
      }
    },
    [onChange, min, max]
  );

  const handleBlur = useCallback(() => {
    // On blur, sync input display with actual value
    if (value !== undefined) {
      setInputValue(value.toString());
    }
  }, [value]);

  // Size variants
  const sizeClasses = {
    sm: "w-28 px-3 py-2 text-lg",
    md: "w-40 px-4 py-4 text-2xl",
    lg: "w-52 px-5 py-5 text-3xl",
  }[size];

  const unitSizeClasses = {
    sm: "right-3 text-sm",
    md: "right-4 text-base",
    lg: "right-5 text-lg",
  }[size];

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-300"
        >
          {label}
        </label>
      )}

      <div className="flex justify-center">
        <div className="relative inline-flex items-center">
          <input
            id={inputId}
            type="number"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              sizeClasses,
              "text-center font-bold rounded-xl",
              "bg-white/5 border border-white/10 text-white",
              "placeholder-slate-500",
              "focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20",
              // Hide spin buttons
              "[appearance:textfield]",
              "[&::-webkit-outer-spin-button]:appearance-none",
              "[&::-webkit-inner-spin-button]:appearance-none",
              disabled && "opacity-50 cursor-not-allowed",
              error && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
            )}
          />
          {unit && (
            <span
              className={cn(
                "absolute text-slate-400 font-medium pointer-events-none",
                unitSizeClasses
              )}
            >
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-400 text-center mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
