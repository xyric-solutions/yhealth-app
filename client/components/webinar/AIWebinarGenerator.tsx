"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface GeneratedWebinarData {
  title: string;
  slug: string;
  description: string;
  content: string;
  category: string;
  host_name: string;
  host_title: string;
  duration_minutes: number;
}

interface AIWebinarGeneratorProps {
  onGenerate: (data: GeneratedWebinarData) => void;
  disabled?: boolean;
}

export function AIWebinarGenerator({ onGenerate, disabled }: AIWebinarGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [requirements, setRequirements] = useState("");
  const [tone, setTone] = useState<"professional" | "casual" | "friendly" | "technical" | "conversational">("professional");
  const [targetAudience, setTargetAudience] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Topic is required");
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const response = await api.post<GeneratedWebinarData>("/admin/webinars/generate", {
        topic: topic.trim(),
        requirements: requirements.trim() || undefined,
        tone,
        targetAudience: targetAudience.trim() || undefined,
        length,
      });

      if (response.success && response.data) {
        toast.success("Webinar content generated successfully!", {
          description: `"${response.data.title}" has been created.`,
        });
        onGenerate(response.data);
        setOpen(false);
        setTopic("");
        setRequirements("");
        setTargetAudience("");
        setTone("professional");
        setLength("medium");
      } else {
        throw new Error(response.error?.message || "Failed to generate webinar");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError ? err.message : "Failed to generate webinar content. Please try again.";
      setError(errorMessage);
      toast.error("Error generating webinar", { description: errorMessage });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
        >
          <Sparkles className="w-4 h-4" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Generate Webinar Content with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="webinar-topic" className="text-white">
              Webinar Topic <span className="text-red-400">*</span>
            </Label>
            <Input
              id="webinar-topic"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Mastering Mindful Eating for Better Health"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={generating}
            />
            <p className="text-xs text-slate-400">
              Describe what the webinar should be about
            </p>
          </div>

          {/* Requirements */}
          <div className="space-y-2">
            <Label htmlFor="webinar-requirements" className="text-white">
              Additional Requirements (Optional)
            </Label>
            <Textarea
              id="webinar-requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="e.g., Include Q&A segment, focus on practical exercises, mention research studies..."
              rows={3}
              className="bg-slate-800 border-slate-700 text-white"
              disabled={generating}
            />
          </div>

          {/* Tone and Length */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webinar-tone" className="text-white">Writing Tone</Label>
              <Select
                value={tone}
                onValueChange={(val: typeof tone) => setTone(val)}
                disabled={generating}
              >
                <SelectTrigger id="webinar-tone" className="w-full bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webinar-length" className="text-white">Content Length</Label>
              <Select
                value={length}
                onValueChange={(val: typeof length) => setLength(val)}
                disabled={generating}
              >
                <SelectTrigger id="webinar-length" className="w-full bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="short">Short (~500 words)</SelectItem>
                  <SelectItem value="medium">Medium (~1200 words)</SelectItem>
                  <SelectItem value="long">Long (~2500 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label htmlFor="webinar-audience" className="text-white">
              Target Audience (Optional)
            </Label>
            <Input
              id="webinar-audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., health professionals, fitness enthusiasts, general public"
              className="bg-slate-800 border-slate-700 text-white"
              disabled={generating}
            />
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
              >
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">{error}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-6 w-6 text-red-400 hover:text-red-300"
                  onClick={() => setError(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Webinar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
