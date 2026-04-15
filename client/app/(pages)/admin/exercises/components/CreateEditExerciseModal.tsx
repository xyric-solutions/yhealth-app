"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { adminExercisesService } from "@/src/shared/services/admin-exercises.service";
import type { ExerciseDetail } from "@/src/shared/services/exercises.service";
import { toast } from "react-hot-toast";

// ============================================
// TYPES
// ============================================

interface CreateEditExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise?: ExerciseDetail | null;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description: string;
  category: string;
  difficulty_level: string;
  body_part: string;
  primary_muscle_group: string;
  instructions: string[];
  tips: string[];
  common_mistakes: string[];
  default_sets: number;
  default_reps: number;
  default_duration_seconds: string;
  default_rest_seconds: number;
  calories_per_minute: string;
  met_value: string;
  video_url: string;
  thumbnail_url: string;
  animation_url: string;
  tags: string;
  target_muscles: string;
  secondary_muscle_groups: string;
  equipment_required: string;
  is_active: boolean;
}

const CATEGORIES = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
  { value: "balance", label: "Balance" },
  { value: "plyometric", label: "Plyometric" },
];

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

// ============================================
// HELPERS
// ============================================

function getDefaultFormData(): FormData {
  return {
    name: "",
    description: "",
    category: "strength",
    difficulty_level: "beginner",
    body_part: "",
    primary_muscle_group: "",
    instructions: [""],
    tips: [""],
    common_mistakes: [""],
    default_sets: 3,
    default_reps: 10,
    default_duration_seconds: "",
    default_rest_seconds: 60,
    calories_per_minute: "",
    met_value: "",
    video_url: "",
    thumbnail_url: "",
    animation_url: "",
    tags: "",
    target_muscles: "",
    secondary_muscle_groups: "",
    equipment_required: "",
    is_active: true,
  };
}

function exerciseToFormData(exercise: ExerciseDetail): FormData {
  return {
    name: exercise.name,
    description: exercise.description ?? "",
    category: exercise.category || "strength",
    difficulty_level: exercise.difficulty_level || "beginner",
    body_part: exercise.body_part ?? "",
    primary_muscle_group: exercise.primary_muscle_group ?? "",
    instructions:
      exercise.instructions && exercise.instructions.length > 0
        ? exercise.instructions
        : [""],
    tips:
      exercise.tips && exercise.tips.length > 0 ? exercise.tips : [""],
    common_mistakes:
      exercise.common_mistakes && exercise.common_mistakes.length > 0
        ? exercise.common_mistakes
        : [""],
    default_sets: exercise.default_sets ?? 3,
    default_reps: exercise.default_reps ?? 10,
    default_duration_seconds:
      exercise.default_duration_seconds != null
        ? String(exercise.default_duration_seconds)
        : "",
    default_rest_seconds: exercise.default_rest_seconds ?? 60,
    calories_per_minute:
      exercise.calories_per_minute != null
        ? String(exercise.calories_per_minute)
        : "",
    met_value:
      exercise.met_value != null ? String(exercise.met_value) : "",
    video_url: exercise.video_url ?? "",
    thumbnail_url: exercise.thumbnail_url ?? "",
    animation_url: exercise.animation_url ?? "",
    tags: exercise.tags?.join(", ") ?? "",
    target_muscles: exercise.target_muscles?.join(", ") ?? "",
    secondary_muscle_groups:
      exercise.secondary_muscle_groups?.join(", ") ?? "",
    equipment_required: exercise.equipment_required?.join(", ") ?? "",
    is_active: exercise.is_active ?? true,
  };
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value: string): number | null {
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// ============================================
// DYNAMIC LIST SECTION
// ============================================

function DynamicListSection({
  label,
  items,
  onUpdate,
}: {
  label: string;
  items: string[];
  onUpdate: (items: string[]) => void;
}) {
  const handleAdd = () => {
    onUpdate([...items, ""]);
  };

  const handleRemove = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onUpdate(updated.length > 0 ? updated : [""]);
  };

  const handleChange = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onUpdate(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white text-sm font-medium">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          className="text-violet-400 hover:text-violet-300 h-7 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-6 text-right shrink-0">
              {index + 1}.
            </span>
            <Input
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={`Enter ${label.toLowerCase().replace(/s$/, "")}...`}
              className="bg-white/5 border-white/10 text-white flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(index)}
              className="text-slate-500 hover:text-red-400 h-8 w-8 p-0 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function CreateEditExerciseModal({
  open,
  onOpenChange,
  exercise,
  onSuccess,
}: CreateEditExerciseModalProps) {
  const isEditMode = exercise != null;
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<FormData>(getDefaultFormData);

  useEffect(() => {
    if (open) {
      if (exercise) {
        setFormData(exerciseToFormData(exercise));
      } else {
        setFormData(getDefaultFormData());
      }
      setActiveTab("basic");
    }
  }, [exercise, open]);

  const updateField = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Exercise name is required");
      setActiveTab("basic");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        difficulty_level: formData.difficulty_level,
        body_part: formData.body_part.trim() || null,
        primary_muscle_group: formData.primary_muscle_group.trim() || null,
        instructions: formData.instructions.filter((s) => s.trim()),
        tips: formData.tips.filter((s) => s.trim()),
        common_mistakes: formData.common_mistakes.filter((s) => s.trim()),
        default_sets: formData.default_sets,
        default_reps: formData.default_reps,
        default_duration_seconds: parseOptionalNumber(
          formData.default_duration_seconds
        ),
        default_rest_seconds: formData.default_rest_seconds,
        calories_per_minute: parseOptionalNumber(formData.calories_per_minute),
        met_value: parseOptionalNumber(formData.met_value),
        video_url: formData.video_url.trim() || null,
        thumbnail_url: formData.thumbnail_url.trim() || null,
        animation_url: formData.animation_url.trim() || null,
        tags: parseCommaSeparated(formData.tags),
        target_muscles: parseCommaSeparated(formData.target_muscles),
        secondary_muscle_groups: parseCommaSeparated(
          formData.secondary_muscle_groups
        ),
        equipment_required: parseCommaSeparated(formData.equipment_required),
        is_active: formData.is_active,
      };

      if (isEditMode) {
        await adminExercisesService.update(exercise.id, payload);
        toast.success("Exercise updated successfully");
      } else {
        await adminExercisesService.create(payload);
        toast.success("Exercise created successfully");
      }

      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save exercise";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            {isEditMode ? "Edit Exercise" : "Create Exercise"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full bg-slate-800/80 border border-white/5 h-10">
              <TabsTrigger
                value="basic"
                className="text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300"
              >
                Basic Info
              </TabsTrigger>
              <TabsTrigger
                value="instructions"
                className="text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300"
              >
                Instructions
              </TabsTrigger>
              <TabsTrigger
                value="defaults"
                className="text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300"
              >
                Defaults
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300"
              >
                Media
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300"
              >
                Advanced
              </TabsTrigger>
            </TabsList>

            {/* -------------------------------- */}
            {/* TAB 1: Basic Info                */}
            {/* -------------------------------- */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="exercise-name" className="text-white">
                  Name *
                </Label>
                <Input
                  id="exercise-name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. Barbell Bench Press"
                  required
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>

              <div>
                <Label htmlFor="exercise-description" className="text-white">
                  Description
                </Label>
                <Textarea
                  id="exercise-description"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief description of the exercise..."
                  rows={3}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exercise-category" className="text-white">
                    Category
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => updateField("category", value)}
                  >
                    <SelectTrigger
                      id="exercise-category"
                      className="bg-white/5 border-white/10 text-white mt-1"
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10">
                      {CATEGORIES.map((cat) => (
                        <SelectItem
                          key={cat.value}
                          value={cat.value}
                          className="text-white focus:bg-violet-500/20 focus:text-violet-200"
                        >
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="exercise-difficulty" className="text-white">
                    Difficulty Level
                  </Label>
                  <Select
                    value={formData.difficulty_level}
                    onValueChange={(value) =>
                      updateField("difficulty_level", value)
                    }
                  >
                    <SelectTrigger
                      id="exercise-difficulty"
                      className="bg-white/5 border-white/10 text-white mt-1"
                    >
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10">
                      {DIFFICULTY_LEVELS.map((level) => (
                        <SelectItem
                          key={level.value}
                          value={level.value}
                          className="text-white focus:bg-violet-500/20 focus:text-violet-200"
                        >
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exercise-body-part" className="text-white">
                    Body Part
                  </Label>
                  <Input
                    id="exercise-body-part"
                    value={formData.body_part}
                    onChange={(e) => updateField("body_part", e.target.value)}
                    placeholder="e.g. Chest, Back, Legs"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="exercise-primary-muscle"
                    className="text-white"
                  >
                    Primary Muscle Group
                  </Label>
                  <Input
                    id="exercise-primary-muscle"
                    value={formData.primary_muscle_group}
                    onChange={(e) =>
                      updateField("primary_muscle_group", e.target.value)
                    }
                    placeholder="e.g. Pectoralis Major"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
              </div>
            </TabsContent>

            {/* -------------------------------- */}
            {/* TAB 2: Instructions              */}
            {/* -------------------------------- */}
            <TabsContent value="instructions" className="space-y-6 mt-4">
              <DynamicListSection
                label="Instructions"
                items={formData.instructions}
                onUpdate={(items) => updateField("instructions", items)}
              />

              <DynamicListSection
                label="Tips"
                items={formData.tips}
                onUpdate={(items) => updateField("tips", items)}
              />

              <DynamicListSection
                label="Common Mistakes"
                items={formData.common_mistakes}
                onUpdate={(items) => updateField("common_mistakes", items)}
              />
            </TabsContent>

            {/* -------------------------------- */}
            {/* TAB 3: Defaults                  */}
            {/* -------------------------------- */}
            <TabsContent value="defaults" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exercise-sets" className="text-white">
                    Default Sets
                  </Label>
                  <Input
                    id="exercise-sets"
                    type="number"
                    min={1}
                    value={formData.default_sets}
                    onChange={(e) =>
                      updateField(
                        "default_sets",
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="exercise-reps" className="text-white">
                    Default Reps
                  </Label>
                  <Input
                    id="exercise-reps"
                    type="number"
                    min={1}
                    value={formData.default_reps}
                    onChange={(e) =>
                      updateField(
                        "default_reps",
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="exercise-duration"
                    className="text-white"
                  >
                    Default Duration (seconds)
                  </Label>
                  <Input
                    id="exercise-duration"
                    type="number"
                    min={0}
                    value={formData.default_duration_seconds}
                    onChange={(e) =>
                      updateField("default_duration_seconds", e.target.value)
                    }
                    placeholder="Optional"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="exercise-rest" className="text-white">
                    Default Rest (seconds)
                  </Label>
                  <Input
                    id="exercise-rest"
                    type="number"
                    min={0}
                    value={formData.default_rest_seconds}
                    onChange={(e) =>
                      updateField(
                        "default_rest_seconds",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="exercise-calories"
                    className="text-white"
                  >
                    Calories per Minute
                  </Label>
                  <Input
                    id="exercise-calories"
                    type="number"
                    min={0}
                    step="0.1"
                    value={formData.calories_per_minute}
                    onChange={(e) =>
                      updateField("calories_per_minute", e.target.value)
                    }
                    placeholder="Optional"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="exercise-met" className="text-white">
                    MET Value
                  </Label>
                  <Input
                    id="exercise-met"
                    type="number"
                    min={0}
                    step="0.1"
                    value={formData.met_value}
                    onChange={(e) =>
                      updateField("met_value", e.target.value)
                    }
                    placeholder="Optional"
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
              </div>
            </TabsContent>

            {/* -------------------------------- */}
            {/* TAB 4: Media                     */}
            {/* -------------------------------- */}
            <TabsContent value="media" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="exercise-video-url" className="text-white">
                  Video URL
                </Label>
                <Input
                  id="exercise-video-url"
                  type="url"
                  value={formData.video_url}
                  onChange={(e) => updateField("video_url", e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor="exercise-thumbnail-url"
                  className="text-white"
                >
                  Thumbnail URL
                </Label>
                <Input
                  id="exercise-thumbnail-url"
                  type="url"
                  value={formData.thumbnail_url}
                  onChange={(e) =>
                    updateField("thumbnail_url", e.target.value)
                  }
                  placeholder="https://example.com/thumbnail.jpg"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor="exercise-animation-url"
                  className="text-white"
                >
                  Animation URL
                </Label>
                <Input
                  id="exercise-animation-url"
                  type="url"
                  value={formData.animation_url}
                  onChange={(e) =>
                    updateField("animation_url", e.target.value)
                  }
                  placeholder="https://example.com/animation.gif"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </TabsContent>

            {/* -------------------------------- */}
            {/* TAB 5: Advanced                  */}
            {/* -------------------------------- */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="exercise-tags" className="text-white">
                  Tags
                </Label>
                <Input
                  id="exercise-tags"
                  value={formData.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                  placeholder="compound, push, upper-body (comma-separated)"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate multiple tags with commas
                </p>
              </div>

              <div>
                <Label
                  htmlFor="exercise-target-muscles"
                  className="text-white"
                >
                  Target Muscles
                </Label>
                <Input
                  id="exercise-target-muscles"
                  value={formData.target_muscles}
                  onChange={(e) =>
                    updateField("target_muscles", e.target.value)
                  }
                  placeholder="pecs, deltoids, triceps (comma-separated)"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate multiple muscles with commas
                </p>
              </div>

              <div>
                <Label
                  htmlFor="exercise-secondary-muscles"
                  className="text-white"
                >
                  Secondary Muscle Groups
                </Label>
                <Input
                  id="exercise-secondary-muscles"
                  value={formData.secondary_muscle_groups}
                  onChange={(e) =>
                    updateField("secondary_muscle_groups", e.target.value)
                  }
                  placeholder="anterior deltoid, serratus anterior (comma-separated)"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate multiple groups with commas
                </p>
              </div>

              <div>
                <Label
                  htmlFor="exercise-equipment"
                  className="text-white"
                >
                  Equipment Required
                </Label>
                <Input
                  id="exercise-equipment"
                  value={formData.equipment_required}
                  onChange={(e) =>
                    updateField("equipment_required", e.target.value)
                  }
                  placeholder="barbell, bench, rack (comma-separated)"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate multiple items with commas
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
                <div>
                  <Label
                    htmlFor="exercise-is-active"
                    className="text-white font-medium"
                  >
                    Active
                  </Label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inactive exercises are hidden from the public library
                  </p>
                </div>
                <Switch
                  id="exercise-is-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    updateField("is_active", checked)
                  }
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* -------------------------------- */}
          {/* Actions                          */}
          {/* -------------------------------- */}
          <div className="flex justify-end gap-3 pt-5 mt-5 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="border-white/10 text-slate-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEditMode ? (
                "Update Exercise"
              ) : (
                "Create Exercise"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
