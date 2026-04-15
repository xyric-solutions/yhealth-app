"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface AdminDetailSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onEdit?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}

export function AdminDetailSidebar({
  open,
  onOpenChange,
  title,
  onEdit,
  onDelete,
  children,
}: AdminDetailSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-lg border-r border-white/10 bg-slate-950/95 backdrop-blur-xl"
      >
        <SheetHeader className="border-b border-white/10 pb-4">
          <SheetTitle className="text-lg font-semibold text-foreground pr-8">
            {title}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-4">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="border-white/10 hover:bg-white/5"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 py-4 px-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
