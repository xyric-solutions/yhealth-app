'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Paperclip, Mic, Square, Smile, Image as ImageIcon, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReplyPreview } from './ReplyPreview';
import { MediaPreview } from './MediaPreview';
import dynamic from 'next/dynamic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { emitTyping, emitStopTyping } from '@/lib/socket-client';

const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { ssr: false }
) as React.ComponentType<{
  onEmojiClick: (emojiData: { emoji: string }) => void;
  width?: number;
  height?: number;
  skinTonesDisabled?: boolean;
  previewConfig?: { showPreview: boolean };
  theme?: string;
  searchDisabled?: boolean;
}>;

const GifPicker = dynamic(
  () => import('gif-picker-react'),
  { ssr: false }
) as React.ComponentType<{
  tenorApiKey: string;
  onGifClick?: (gif: { url: string; preview: { url: string } }) => void;
  width?: number | string;
  height?: number | string;
  theme?: string;
}>;

interface ChatInputProps {
  onSend: (message: string, options?: { mediaFiles?: File[]; repliedToId?: string; isViewOnce?: boolean; gifUrl?: string }) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  chatId?: string;
  replyTo?: {
    id: string;
    content: string;
    senderName?: string;
    mediaType?: string;
  } | null;
  onCancelReply?: () => void;
  permissionDeniedMessage?: string;
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Ask Aurea...',
  disabled = false,
  chatId,
  replyTo,
  onCancelReply,
  permissionDeniedMessage,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const hasContent = message.trim().length > 0 || mediaFiles.length > 0;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  useEffect(() => {
    if (!chatId || disabled || isLoading) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(chatId);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitStopTyping(chatId);
      }
    }, 1000);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current && trimmedMessage.length === 0) {
        isTypingRef.current = false;
        emitStopTyping(chatId);
      }
    };
  }, [message, chatId, disabled, isLoading]);

  const handleEmojiClick = (emojiData: { emoji?: string; unicode?: string }) => {
    const emoji = emojiData.emoji || emojiData.unicode || '';
    if (!emoji) return;
    const pos = textareaRef.current?.selectionStart || message.length;
    setMessage(message.substring(0, pos) + emoji + message.substring(pos));
    setTimeout(() => {
      textareaRef.current?.focus();
      const np = pos + emoji.length;
      textareaRef.current?.setSelectionRange(np, np);
    }, 0);
  };

  const handleGifClick = (gif: { url: string; preview: { url: string } }) => {
    setShowGifPicker(false);
    onSend('', { gifUrl: gif.url, repliedToId: replyTo?.id });
    onCancelReply?.();
  };

  const handleSubmit = () => {
    const trimmed = message.trim();
    if ((trimmed || mediaFiles.length > 0) && !isLoading && !disabled) {
      if (isTypingRef.current && chatId) {
        isTypingRef.current = false;
        emitStopTyping(chatId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      onSend(trimmed, {
        mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
        repliedToId: replyTo?.id,
        isViewOnce: isViewOnce && mediaFiles.length > 0 ? true : undefined,
      });
      setMessage('');
      setMediaFiles([]);
      setIsViewOnce(false);
      onCancelReply?.();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setMediaFiles((prev) => [...prev, new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })]);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toolBtnClass = cn(
    "h-8 w-8 shrink-0 rounded-lg transition-all duration-200",
    "text-slate-500 hover:text-slate-300",
    "hover:bg-white/[0.06]",
  );

  return (
    <div
      className="px-3 sm:px-4 py-3 safe-area-pb"
      style={{
        background: 'linear-gradient(180deg, rgba(6,8,14,0.85) 0%, rgba(8,10,18,0.95) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="w-full max-w-4xl mx-auto">
        {/* Reply preview */}
        {replyTo && (
          <div className="mb-2">
            <ReplyPreview message={replyTo} onCancel={onCancelReply || (() => {})} />
          </div>
        )}

        {/* Media previews */}
        {mediaFiles.length > 0 && (
          <div className="mb-3 space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
            {mediaFiles.map((file, index) => (
              <MediaPreview
                key={index}
                file={file}
                onRemove={() => handleRemoveMedia(index)}
                isViewOnce={isViewOnce}
                onToggleViewOnce={() => setIsViewOnce((prev) => !prev)}
              />
            ))}
          </div>
        )}

        {/* Main input container */}
        <div
          className="relative rounded-2xl transition-all duration-300 overflow-hidden"
          style={{
            background: isFocused
              ? 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(16,185,129,0.03))'
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isFocused ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
            boxShadow: isFocused
              ? '0 0 20px rgba(16,185,129,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
              : 'inset 0 1px 0 rgba(255,255,255,0.02)',
          }}
        >
          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={permissionDeniedMessage || placeholder}
            disabled={disabled || isLoading}
            className={cn(
              'min-h-[44px] max-h-[160px] resize-none w-full',
              'bg-transparent border-0 shadow-none ring-0',
              'text-white placeholder:text-slate-500',
              'focus-visible:ring-0 focus-visible:border-0 focus-visible:shadow-none',
              'text-[14px] leading-relaxed px-4 pt-3 pb-1',
              permissionDeniedMessage && 'cursor-not-allowed opacity-50'
            )}
            rows={1}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5">
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />

              <Button variant="ghost" size="icon" className={toolBtnClass} onClick={() => fileInputRef.current?.click()} disabled={disabled || isLoading}>
                <Paperclip className="h-4 w-4" />
              </Button>

              {/* Emoji */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon"
                    className={cn(toolBtnClass, showEmojiPicker && 'bg-emerald-500/10 text-emerald-400')}
                    disabled={disabled || isLoading}>
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto rounded-2xl border-white/[0.08] bg-[#0f1120]/95 backdrop-blur-xl shadow-2xl p-0">
                  <EmojiPicker onEmojiClick={handleEmojiClick} width={340} height={380} skinTonesDisabled previewConfig={{ showPreview: false }} theme="dark" searchDisabled={false} />
                </PopoverContent>
              </Popover>

              {/* GIF */}
              <Popover open={showGifPicker} onOpenChange={setShowGifPicker}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon"
                    className={cn(toolBtnClass, showGifPicker && 'bg-emerald-500/10 text-emerald-400')}
                    disabled={disabled || isLoading}>
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto rounded-2xl border-white/[0.08] bg-[#0f1120]/95 backdrop-blur-xl shadow-2xl p-0">
                  <GifPicker tenorApiKey={process.env.NEXT_PUBLIC_TENOR_API_KEY || ''} onGifClick={handleGifClick} width={340} height={380} theme="dark" />
                </PopoverContent>
              </Popover>

              {/* Mic */}
              {isRecording ? (
                <Button variant="ghost" size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 animate-pulse"
                  onClick={handleStopRecording}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className={toolBtnClass} onClick={handleStartRecording} disabled={disabled || isLoading}>
                  <Mic className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Send button */}
            <Button
              onClick={handleSubmit}
              disabled={!hasContent || isLoading || disabled}
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 rounded-lg transition-all duration-300',
                hasContent && !isLoading
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-white/[0.04] text-slate-600 cursor-not-allowed',
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
