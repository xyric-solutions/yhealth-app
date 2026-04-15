"use client";

import { motion } from "framer-motion";
import { Lock, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface Permission {
  id: string;
  slug: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface PermissionGroup {
  resource: string;
  permissions: Permission[];
}

interface PermissionMatrixProps {
  groups: PermissionGroup[];
  selectedIds: Set<string>;
  onToggle: (permissionId: string) => void;
  onToggleResource?: (resource: string, checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function formatResourceLabel(resource: string): string {
  const parts = resource.split(".");
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" / ");
}

export function PermissionMatrix({
  groups,
  selectedIds,
  onToggle,
  onToggleResource,
  disabled = false,
  className,
}: PermissionMatrixProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group, groupIndex) => {
        const allSelected = group.permissions.every((p) => selectedIds.has(p.id));

        return (
          <motion.div
            key={group.resource}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.05 }}
            className="rounded-xl bg-slate-900/40 border border-slate-800/60 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/30 border-b border-slate-800/60">
              {onToggleResource && (
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onToggleResource?.(group.resource, !!checked)}
                  disabled={disabled}
                  className="border-slate-600 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                />
              )}
              <Lock className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-white">
                {formatResourceLabel(group.resource)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
              {group.permissions.map((perm) => {
                const isSelected = selectedIds.has(perm.id);
                return (
                  <label
                    key={perm.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200",
                      isSelected
                        ? "bg-violet-500/10 border border-violet-500/30"
                        : "bg-slate-800/30 border border-transparent hover:bg-slate-800/50",
                      disabled && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => !disabled && onToggle(perm.id)}
                      disabled={disabled}
                      className="border-slate-600 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-200">{perm.name}</span>
                      {perm.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{perm.description}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
