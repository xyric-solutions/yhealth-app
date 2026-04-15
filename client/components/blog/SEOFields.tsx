"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface SEOFieldsProps {
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onMetaKeywordsChange: (value: string) => void;
  className?: string;
}

export function SEOFields({
  metaTitle,
  metaDescription,
  metaKeywords,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onMetaKeywordsChange,
  className,
}: SEOFieldsProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Label htmlFor="meta-title">
          Meta Title
          <span className="text-xs text-muted-foreground ml-2">
            ({metaTitle?.length || 0}/60 recommended)
          </span>
        </Label>
        <Input
          id="meta-title"
          value={metaTitle || ""}
          onChange={(e) => onMetaTitleChange(e.target.value)}
          placeholder="SEO title for search engines"
          maxLength={255}
        />
        <p className="text-xs text-muted-foreground">
          Optimize for 50-60 characters for best display in search results
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta-description">
          Meta Description
          <span className="text-xs text-muted-foreground ml-2">
            ({metaDescription?.length || 0}/160 recommended)
          </span>
        </Label>
        <Textarea
          id="meta-description"
          value={metaDescription || ""}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          placeholder="Brief description for search engines"
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Write a compelling description (150-160 characters) to improve click-through rates
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta-keywords">Meta Keywords</Label>
        <Input
          id="meta-keywords"
          value={metaKeywords || ""}
          onChange={(e) => onMetaKeywordsChange(e.target.value)}
          placeholder="health, wellness, fitness (comma-separated)"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated keywords (optional, less important for modern SEO)
        </p>
      </div>
    </div>
  );
}

