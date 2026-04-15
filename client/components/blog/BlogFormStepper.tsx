"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,

  FileText,
  Image as ImageIcon,
  Search,
  Settings,
  Eye,
  AlertCircle,
} from "lucide-react";
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
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { ImageUploader } from "./ImageUploader";
import { SEOFields } from "./SEOFields";
import { FormProgressIndicator, calculateFormProgress } from "./FormProgressIndicator";
import { AIBlogGenerator, type GeneratedBlogData } from "./AIBlogGenerator";
import { cn } from "@/lib/utils";
import { validateBlogField } from "@/lib/validators/blog.validator";

export interface BlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  markdown_content?: string;
  featured_image: string | null;
  status: "draft" | "published" | "archived";
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  category: string;
  tags: string[];
  published_at?: Date | null;
}

interface BlogFormStepperProps {
  initialData?: Partial<BlogFormData>;
  onSubmit: (data: BlogFormData) => Promise<void>;
  onSaveDraft?: (data: Partial<BlogFormData>) => Promise<void>;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

const STEPS = [
  { id: "basic", label: "Basic Info", icon: FileText, weight: 20 },
  { id: "content", label: "Content", icon: FileText, weight: 40 },
  { id: "media", label: "Media", icon: ImageIcon, weight: 15 },
  { id: "seo", label: "SEO", icon: Search, weight: 20 },
  { id: "settings", label: "Settings", icon: Settings, weight: 5 },
  { id: "review", label: "Review", icon: Eye, weight: 0 },
];

export function BlogFormStepper({
  initialData,
  onSubmit,
  onSaveDraft,
  isLoading = false,
  mode = "create",
}: BlogFormStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BlogFormData>({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    markdown_content: initialData?.markdown_content || "",
    featured_image: initialData?.featured_image || null,
    status: initialData?.status || "draft",
    meta_title: initialData?.meta_title || "",
    meta_description: initialData?.meta_description || "",
    meta_keywords: initialData?.meta_keywords || "",
    category: initialData?.category || "",
    tags: initialData?.tags || [],
    published_at: initialData?.published_at || null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Handle AI-generated blog data
  const handleAIGenerate = useCallback((data: GeneratedBlogData) => {
    setFormData((prev) => ({
      ...prev,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      meta_keywords: data.meta_keywords,
      category: data.category,
      tags: data.tags,
    }));
    // Clear any errors
    setErrors({});
    // Move to content step to review generated content
    setCurrentStep(1);
  }, []);

  // Auto-generate slug from title
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleFieldChange = (field: keyof BlogFormData, value: unknown) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-generate slug from title
      if (field === "title" && (!prev.slug || prev.slug === generateSlug(prev.title))) {
        updated.slug = generateSlug(value as string);
      }

      return updated;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const validateStep = useCallback((stepIndex: number, updateErrors: boolean = true): boolean => {
    const step = STEPS[stepIndex];
    const newErrors: Record<string, string> = {};

    switch (step.id) {
      case "basic":
        const titleError = validateBlogField.title(formData.title);
        if (titleError) newErrors.title = titleError;

        const slugError = validateBlogField.slug(formData.slug);
        if (slugError) newErrors.slug = slugError;

        const excerptError = validateBlogField.excerpt(formData.excerpt);
        if (excerptError) newErrors.excerpt = excerptError;
        break;

      case "content":
        const contentError = validateBlogField.content(formData.content);
        if (contentError) newErrors.content = contentError;
        break;

      case "seo":
        const metaTitleError = validateBlogField.metaTitle(formData.meta_title);
        if (metaTitleError) newErrors.meta_title = metaTitleError;

        const metaDescError = validateBlogField.metaDescription(formData.meta_description);
        if (metaDescError) newErrors.meta_description = metaDescError;
        break;
    }

    if (updateErrors) {
      setErrors(newErrors);
    }
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  }, [currentStep, validateStep]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && currentStep < STEPS.length - 1) {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft" && currentStep > 0) {
        e.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, handleNext, handlePrevious]);

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;

    setIsSavingDraft(true);
    try {
      await onSaveDraft(formData);
    } catch (error) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    // Validate all steps
    let isValid = true;
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (!validateStep(i, true)) {
        isValid = false;
        setCurrentStep(i);
        break;
      }
    }

    if (isValid) {
      await onSubmit(formData);
    }
  }, [formData, validateStep, onSubmit]);

  const progress = useMemo(() => calculateFormProgress(formData), [formData]);

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case "basic":
        return (
          <div className="space-y-6">
            {/* AI Generator */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-sky-500/10 border border-cyan-500/20">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-cyan-300 mb-1">
                  Generate with AI
                </h3>
                <p className="text-xs text-slate-400">
                  Let AI create your blog post based on your requirements
                </p>
              </div>
              <AIBlogGenerator
                onGenerate={handleAIGenerate}
                disabled={isLoading}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-400">Or fill manually</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-white">
                Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleFieldChange("title", e.target.value)}
                placeholder="Enter blog title"
                className="bg-slate-800 border-slate-700 text-white"
              />
              {errors.title && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.title}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-white">
                Slug <span className="text-red-400">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleFieldChange("slug", e.target.value)}
                placeholder="url-friendly-slug"
                className="bg-slate-800 border-slate-700 text-white"
              />
              {errors.slug && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.slug}
                </p>
              )}
              <p className="text-xs text-slate-400">
                URL-friendly version (auto-generated from title)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt" className="text-white">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => handleFieldChange("excerpt", e.target.value)}
                placeholder="Brief summary of the blog post"
                rows={3}
                maxLength={500}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <div className="flex items-center justify-between">
                {errors.excerpt && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.excerpt}
                  </p>
                )}
                <p className="text-xs text-slate-400 ml-auto">
                  {formData.excerpt.length}/500
                </p>
              </div>
            </div>
          </div>
        );

      case "content":
        return (
          <div className="space-y-4">
            <Label className="text-white">
              Content <span className="text-red-400">*</span>
            </Label>
            <RichTextEditor
              value={formData.content}
              onChange={(content) => handleFieldChange("content", content)}
              placeholder="Start writing your blog content..."
              minHeight="500px"
            />
            {errors.content && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.content}
              </p>
            )}
            <p className="text-xs text-slate-400">
              Minimum 100 characters required
            </p>
          </div>
        );

      case "media":
        return (
          <div className="space-y-4">
            <Label className="text-white">Featured Image</Label>
            <ImageUploader
              value={formData.featured_image}
              onChange={(url) => handleFieldChange("featured_image", url)}
            />
            <p className="text-xs text-slate-400">
              Upload a high-quality featured image for your blog post
            </p>
          </div>
        );

      case "seo":
        return (
          <div className="space-y-4">
            <SEOFields
              metaTitle={formData.meta_title}
              metaDescription={formData.meta_description}
              metaKeywords={formData.meta_keywords}
              onMetaTitleChange={(value) => handleFieldChange("meta_title", value)}
              onMetaDescriptionChange={(value) =>
                handleFieldChange("meta_description", value)
              }
              onMetaKeywordsChange={(value) => handleFieldChange("meta_keywords", value)}
            />
            {errors.meta_title && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.meta_title}
              </p>
            )}
            {errors.meta_description && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.meta_description}
              </p>
            )}
          </div>
        );

      case "settings":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="status" className="text-white">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: unknown) => handleFieldChange("status", value)}
              >
                <SelectTrigger id="status" className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-white">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleFieldChange("category", e.target.value)}
                placeholder="e.g., Health, Fitness, Nutrition"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-white">Tags</Label>
              <Input
                id="tags"
                value={formData.tags.join(", ")}
                onChange={(e) =>
                  handleFieldChange(
                    "tags",
                    e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                  )
                }
                placeholder="tag1, tag2, tag3"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-400">
                Comma-separated tags (max 10)
              </p>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-6">
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
              <h3 className="text-xl font-bold text-white">{formData.title}</h3>
              {formData.excerpt && (
                <p className="text-slate-300 italic">{formData.excerpt}</p>
              )}
              {formData.featured_image && (
                <div className="relative w-full h-64 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.featured_image}
                    alt={formData.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(formData.content) }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Status:</span>
                <span className="ml-2 text-white capitalize">{formData.status}</span>
              </div>
              <div>
                <span className="text-slate-400">Category:</span>
                <span className="ml-2 text-white">{formData.category || "None"}</span>
              </div>
              {formData.tags.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-400">Tags:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
        <FormProgressIndicator completion={progress} />
      </div>

      {/* Stepper Header - Full Width */}
      <div className="w-full">
        <div className="flex items-center justify-between w-full">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const isAccessible = index <= currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <motion.button
                  onClick={() => {
                    if (isAccessible) {
                      // Validate previous steps before allowing navigation
                      let canNavigate = true;
                      for (let i = 0; i < index; i++) {
                        if (!validateStep(i)) {
                          canNavigate = false;
                          setCurrentStep(i);
                          break;
                        }
                      }
                      if (canNavigate) {
                        setCurrentStep(index);
                      }
                    }
                  }}
                  whileHover={isAccessible ? { scale: 1.05 } : {}}
                  whileTap={isAccessible ? { scale: 0.95 } : {}}
                  className={cn(
                    "flex flex-col items-center gap-2 transition-all w-full",
                    !isAccessible && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shrink-0",
                      isActive
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                        : isCompleted
                        ? "bg-green-500 border-green-400 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium text-center",
                      isActive ? "text-cyan-400" : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                </motion.button>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 transition-all",
                      index < currentStep
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500"
                        : "bg-slate-700"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="bg-slate-900/50 rounded-lg p-6 border border-slate-800 min-h-[500px]"
        >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            {STEPS[currentStep].label}
          </h2>
          <p className="text-slate-400 text-sm">
            Step {currentStep + 1} of {STEPS.length}
          </p>
        </div>

        {renderStepContent()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isLoading}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            >
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0 || isLoading}
            className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
            >
              {isLoading ? "Submitting..." : mode === "create" ? "Create Blog" : "Update Blog"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

