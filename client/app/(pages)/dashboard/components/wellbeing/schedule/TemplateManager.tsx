/**
 * @file TemplateManager Component
 * @description Manage schedule templates
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Loader2, X, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { scheduleService, type ScheduleTemplate, type DailySchedule } from "@/src/shared/services/schedule.service";

interface TemplateManagerProps {
  schedule: DailySchedule | null;
  onTemplateApplied?: (schedule: DailySchedule) => void;
}

export function TemplateManager({ schedule, onTemplateApplied }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await scheduleService.getTemplates();
      if (result.success && result.data) {
        setTemplates(result.data.templates);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!schedule || !templateName.trim()) return;

    setIsSaving(true);
    try {
      const result = await scheduleService.saveScheduleAsTemplate(
        schedule.id,
        templateName,
        templateDescription || undefined
      );

      if (result.success && result.data) {
        setTemplates([...templates, result.data.template]);
        setShowSaveModal(false);
        setTemplateName("");
        setTemplateDescription("");
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!schedule) return;

    try {
      const result = await scheduleService.applyTemplate(schedule.id, templateId);
      if (result.success && result.data && onTemplateApplied) {
        onTemplateApplied(result.data.schedule);
      }
    } catch (err) {
      console.error("Failed to apply template:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />
          Templates
        </h3>
        {schedule && (
          <Button
            size="sm"
            onClick={() => setShowSaveModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save as Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No templates yet</p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <motion.div
              key={template.id}
              className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">{template.name}</h4>
                  {template.description && (
                    <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                  )}
                  {template.isDefault && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded">
                      Default
                    </span>
                  )}
                </div>
                {schedule && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApplyTemplate(template.id)}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Save Template Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSaveModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 rounded-xl border border-emerald-500/20 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Save as Template</h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Template Name</label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Morning Routine"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Description (Optional)
                  </label>
                  <Textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe this template..."
                    rows={3}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveAsTemplate}
                    disabled={!templateName.trim() || isSaving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Template
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowSaveModal(false)}
                    variant="outline"
                    className="border-slate-700 text-slate-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


