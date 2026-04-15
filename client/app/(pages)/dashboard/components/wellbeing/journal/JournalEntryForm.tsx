/**
 * @file JournalEntryForm Component
 * @description Form for creating journal entries in light/deep mode
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, BookOpen } from "lucide-react";
import { journalService, type CreateJournalEntryRequest, type JournalPrompt } from "@/src/shared/services/wellbeing.service";

interface JournalEntryFormProps {
  selectedPrompt?: JournalPrompt | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialMode?: "light" | "deep";
}

export function JournalEntryForm({
  selectedPrompt,
  onSuccess,
  onCancel,
  initialMode = "light",
}: JournalEntryFormProps) {
  const [mode, setMode] = useState<"light" | "deep">(initialMode);
  const [entryText, setEntryText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load prompt if not provided
  const [prompt, setPrompt] = useState<JournalPrompt | null>(selectedPrompt || null);

  useEffect(() => {
    if (!prompt && !selectedPrompt) {
      loadPrompt();
    } else if (selectedPrompt) {
      setPrompt(selectedPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrompt]);

  const loadPrompt = async () => {
    try {
      const result = await journalService.getPrompts(1);
      if (result.success && result.data && result.data.prompts.length > 0) {
        setPrompt(result.data.prompts[0]);
      }
    } catch (err) {
      console.error("Failed to load prompt:", err);
    }
  };

  const handleSubmit = async () => {
    if (!entryText.trim()) {
      setError("Please write something");
      return;
    }

    if (!prompt) {
      setError("No prompt available");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateJournalEntryRequest = {
        mode,
        prompt: prompt.text,
        prompt_category: prompt.category,
        entry_text: entryText.trim(),
      };

      const response = await journalService.createEntry(data);

      if (response.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('journal-logged'));
        }
        onSuccess?.();
      } else {
        setError(response.error?.message || "Failed to save entry");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const wordCount = entryText.trim().split(/\s+/).filter(Boolean).length;
  const isLightMode = mode === "light";
  const minWords = isLightMode ? 0 : 10;

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "light" | "deep")}>
        <TabsList className="grid w-full grid-cols-2 bg-white/5">
          <TabsTrigger value="light" className="data-[state=active]:bg-purple-600">
            Light Mode
          </TabsTrigger>
          <TabsTrigger value="deep" className="data-[state=active]:bg-purple-600">
            Deep Mode
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Prompt Display */}
      {prompt && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium">{prompt.text}</p>
              {prompt.description && (
                <p className="text-sm text-slate-300 mt-1">{prompt.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entry Text Area */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Your Reflection
          {isLightMode ? (
            <span className="text-xs text-slate-400 ml-2">(1-3 sentences is perfect)</span>
          ) : (
            <span className="text-xs text-slate-400 ml-2">(Take your time to reflect deeply)</span>
          )}
        </label>
        <Textarea
          placeholder={
            isLightMode
              ? "Write a few sentences about your thoughts..."
              : "Take time to reflect deeply on the prompt above..."
          }
          value={entryText}
          onChange={(e) => setEntryText(e.target.value)}
          rows={isLightMode ? 4 : 10}
          maxLength={5000}
          className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-400">
            {wordCount} {wordCount === 1 ? "word" : "words"}
            {!isLightMode && minWords > 0 && wordCount < minWords && (
              <span className="text-yellow-400 ml-2">
                (aim for at least {minWords} words)
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">{entryText.length}/5000</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 border-white/20 hover:bg-white/10"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !entryText.trim() || (!isLightMode && wordCount < minWords)}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Entry
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

