/**
 * @file RoutineTemplates Component
 * @description Display pre-built routine templates for selection
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Calendar } from "lucide-react";
import { routineService } from "@/src/shared/services/wellbeing.service";

export function RoutineTemplates() {
  const [templates, setTemplates] = useState<Array<{ name: string; description?: string; type?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await routineService.getTemplates();

      if (result.success && result.data) {
        setTemplates(result.data.templates);
      } else {
        setError(result.error?.message || "Failed to load templates");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Routine Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Routine Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5 text-blue-400" />
          Routine Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No templates available</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.name}
                className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <h3 className="text-white font-medium mb-2">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-slate-400 mb-3">{template.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 capitalize">{template.type}</span>
                  <Button size="sm" variant="outline">
                    Use Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

