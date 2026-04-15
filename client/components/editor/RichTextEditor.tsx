"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CharacterCount from "@tiptap/extension-character-count";
import { createLowlight } from "lowlight";
import { useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  mode?: "html" | "markdown";
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
  className?: string;
  onImageUpload?: (url: string) => void;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  minHeight = "400px",
  readOnly = false,
  className,
  onImageUpload,
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(),
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-cyan-400 underline hover:text-cyan-300",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert max-w-none focus:outline-none",
          "prose-headings:text-foreground",
          "prose-p:text-foreground prose-p:leading-relaxed",
          "prose-a:text-cyan-400",
          "prose-strong:text-foreground prose-strong:font-bold",
          "prose-code:text-cyan-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded",
          "prose-pre:bg-slate-900 prose-pre:text-foreground",
          "prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-300",
          "prose-ul:text-foreground prose-ol:text-foreground",
          "prose-img:rounded-lg prose-img:my-4",
          "min-h-[200px] p-4"
        ),
      },
    },
  });

  const handleAddLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setIsLinkDialogOpen(false);
    }
  }, [editor, linkUrl]);

  const handleRemoveLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const handleAddImage = useCallback(async () => {
    if (!editor) return;

    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      if (onImageUpload) {
        onImageUpload(imageUrl);
      }
      setImageUrl("");
      setIsImageDialogOpen(false);
    }
  }, [editor, imageUrl, onImageUpload]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post<{
          publicUrl?: string;
          url: string;
        }>("/upload/blog", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        if (response.success && response.data) {
          const imageUrl = response.data.publicUrl || response.data.url;
          editor.chain().focus().setImage({ src: imageUrl }).run();
          if (onImageUpload) {
            onImageUpload(imageUrl);
          }
        }
      } catch (error) {
        console.error("Failed to upload image:", error);
      } finally {
        setUploading(false);
      }
    },
    [editor, onImageUpload]
  );

  if (!editor) {
    return null;
  }

  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const characterCount = editor.storage.characterCount?.characters() ?? 0;

  return (
    <div className={cn("border border-slate-800 rounded-lg bg-slate-900/50", className)}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 p-2 border-b border-slate-800 flex-wrap">
          {/* Text Formatting */}
          <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("bold") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("italic") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("strike") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Strikethrough className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("code") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Code className="w-4 h-4" />
            </Button>
          </div>

          {/* Headings */}
          <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("heading", { level: 1 }) && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Heading1 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("heading", { level: 2 }) && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Heading2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("heading", { level: 3 }) && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Heading3 className="w-4 h-4" />
            </Button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("bulletList") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("orderedList") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={cn(
                "h-8 w-8",
                editor.isActive("blockquote") && "bg-cyan-500/20 text-cyan-400"
              )}
            >
              <Quote className="w-4 h-4" />
            </Button>
          </div>

          {/* Insert */}
          <div className="flex items-center gap-1 border-r border-slate-800 pr-2 mr-2">
            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    editor.isActive("link") && "bg-cyan-500/20 text-cyan-400"
                  )}
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle>Add Link</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="link-url">URL</Label>
                    <Input
                      id="link-url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddLink} className="flex-1">
                      Add Link
                    </Button>
                    {editor.isActive("link") && (
                      <Button
                        variant="destructive"
                        onClick={handleRemoveLink}
                        className="flex-1"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle>Add Image</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                      id="image-url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="relative">
                    <Label htmlFor="image-upload">Or Upload</Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="bg-slate-800 border-slate-700"
                      disabled={uploading}
                    />
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                        <div className="text-sm text-cyan-400">Uploading...</div>
                      </div>
                    )}
                  </div>
                  <Button onClick={handleAddImage} className="w-full" disabled={!imageUrl}>
                    Add Image
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              className="h-8 w-8"
            >
              <TableIcon className="w-4 h-4" />
            </Button>
          </div>

          {/* History */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="h-8 w-8"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="h-8 w-8"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div style={{ minHeight }} className="relative">
        <EditorContent editor={editor} />
        {!value && (
          <div className="absolute top-4 left-4 text-slate-500 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!readOnly && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span>{characterCount} characters</span>
          </div>
          <div className="text-slate-500">Rich Text Editor</div>
        </div>
      )}
    </div>
  );
}

