"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

export interface FormInputFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  /** Form control from react-hook-form */
  control: Control<TFieldValues>;
  /** Field name */
  name: TName;
  /** Field label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input type */
  type?: "text" | "email" | "password" | "tel" | "number" | "date";
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Icon to show on the right side */
  icon?: LucideIcon;
  /** Custom className for the input container */
  className?: string;
  /** Auto-complete attribute */
  autoComplete?: string;
  /** Optional description below the label */
  description?: string;
}

export function FormInputField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  placeholder,
  type = "text",
  disabled = false,
  icon: Icon = Pencil,
  className,
  autoComplete,
  description,
}: FormInputFieldProps<TFieldValues, TName>) {
  const [isActive, setIsActive] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-sm font-medium text-slate-200">
            {label}
          </FormLabel>
          {description && (
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          )}
          <FormControl>
            <div className="relative group">
              <Input
                className={cn(
                  "h-12 pl-4 pr-10 rounded-xl border-0 bg-muted/50",
                  "transition-all duration-300",
                  "hover:bg-muted/70 focus:bg-muted/70",
                  "focus-visible:ring-2 focus-visible:ring-primary/50",
                  "group-hover:shadow-md",
                  isActive && "ring-2 ring-primary/50 shadow-lg shadow-primary/10"
                )}
                type={type}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                {...field}
                onFocus={(_e) => {
                  setIsActive(true);
                  field.onBlur?.();
                }}
                onBlur={(_e) => {
                  setIsActive(false);
                  field.onBlur?.();
                }}
              />
              <motion.div
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2",
                  "transition-opacity duration-200",
                  isActive ? "opacity-100" : "opacity-50 group-hover:opacity-75"
                )}
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Icon className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default FormInputField;
