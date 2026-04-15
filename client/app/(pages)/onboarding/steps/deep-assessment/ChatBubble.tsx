'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Check,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  X,
  Maximize2,
} from 'lucide-react';
import { MessageActions } from './MessageActions';
import type { Message } from './types';

interface ChatBubbleProps {
  message: Message;
  isLatest: boolean;
  onRetry?: () => void;
  onRegenerate?: () => void;
  showActions?: boolean;
}

export function ChatBubble({
  message,
  isLatest,
  onRetry,
  onRegenerate,
  showActions = true,
}: ChatBubbleProps) {
  const isAI = message.sender === 'ai';
  const isError = message.status === 'error';
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.text]);

  // Text-to-Speech with natural human-like voice
  const handleVoice = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Clean up text for more natural speech
    const cleanText = message.text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\n\n+/g, '. ') // Convert double newlines to pauses
      .replace(/\n/g, ', ') // Convert single newlines to brief pauses
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\.\s*\./g, '.') // Remove double periods
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // More natural speech parameters
    utterance.rate = 0.92; // Slightly slower for warmth
    utterance.pitch = 1.05; // Slightly higher for friendliness
    utterance.volume = 1;

    // Priority order for natural-sounding voices
    const voices = window.speechSynthesis.getVoices();
    const voicePreferences = [
      // Premium neural/natural voices (most human-like)
      (v: SpeechSynthesisVoice) => v.name.includes('Neural') && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.name.includes('Wavenet') && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.name.includes('Natural') && v.lang.startsWith('en'),
      // High-quality system voices
      (v: SpeechSynthesisVoice) => v.name.includes('Samantha') && v.lang.startsWith('en'), // macOS
      (v: SpeechSynthesisVoice) => v.name.includes('Karen') && v.lang.startsWith('en'), // macOS
      (v: SpeechSynthesisVoice) => v.name.includes('Zira') && v.lang.startsWith('en'), // Windows
      (v: SpeechSynthesisVoice) => v.name.includes('David') && v.lang.startsWith('en'), // Windows
      // Google voices
      (v: SpeechSynthesisVoice) => v.name.includes('Google') && v.lang.startsWith('en-US'),
      (v: SpeechSynthesisVoice) => v.name.includes('Google') && v.lang.startsWith('en'),
      // Any English voice as fallback
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en-US'),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
    ];

    let selectedVoice: SpeechSynthesisVoice | undefined;
    for (const preference of voicePreferences) {
      selectedVoice = voices.find(preference);
      if (selectedVoice) break;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [message.text, isSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  return (
    <motion.div
      className={`flex items-end gap-2 ${isAI ? 'justify-start' : 'justify-end'}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* AI Avatar */}
      {isAI && <AIAvatar />}

      {/* Message Bubble */}
      <div className={`relative max-w-[75%] group ${isAI ? '' : 'order-first'}`}>
        <motion.div
          className={`
            relative px-4 py-3 shadow-xl
            ${
              isAI
                ? 'rounded-2xl rounded-bl-md bg-slate-800/90 border border-slate-700/50 backdrop-blur-sm'
                : isError
                  ? 'rounded-2xl rounded-br-md bg-red-900/50 border border-red-500/50'
                  : 'rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600'
            }
          `}
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          {isAI && (
            <div className="absolute inset-0 rounded-2xl rounded-bl-md bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          )}

          {/* Image attachment */}
          {message.imageUrl && (
            <ImageAttachment
              imageUrl={message.imageUrl}
              imageName={message.imageName}
              isLightboxOpen={isLightboxOpen}
              onOpenLightbox={() => setIsLightboxOpen(true)}
              onCloseLightbox={() => setIsLightboxOpen(false)}
            />
          )}

          {/* Text content - hide if it's just the upload placeholder */}
          {(!message.imageUrl || !message.text.startsWith('📷 Uploaded image:')) && (
            <p
              className={`relative z-10 text-sm leading-relaxed ${isAI ? 'text-slate-200' : 'text-white'}`}
            >
              {message.text}
            </p>
          )}

          {/* Retry button for errors */}
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}

          {/* Timestamp and status */}
          <MessageFooter message={message} isAI={isAI} />

          {/* Message Actions */}
          {showActions && !isError && (isHovered || isCopied || isSpeaking) && (
            <MessageActions
              isAI={isAI}
              onCopy={handleCopy}
              onVoice={handleVoice}
              onRegenerate={isAI ? onRegenerate : undefined}
              isSpeaking={isSpeaking}
              isCopied={isCopied}
            />
          )}

          {/* Glow effect for latest message */}
          {isLatest && !isError && (
            <motion.div
              className={`absolute -inset-px rounded-2xl pointer-events-none ${isAI ? 'rounded-bl-md' : 'rounded-br-md'}`}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 2 }}
              style={{
                background: isAI
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), transparent)'
                  : 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(217, 70, 239, 0.4))',
              }}
            />
          )}
        </motion.div>

        {/* Background glow for AI messages */}
        {isAI && (
          <div className="absolute inset-0 rounded-2xl rounded-bl-md bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 blur-2xl -z-10" />
        )}
      </div>

      {/* User Avatar */}
      {!isAI && <UserAvatar />}
    </motion.div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function AIAvatar() {
  return (
    <motion.div
      className="relative flex-shrink-0"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', delay: 0.1 }}
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
        <Brain className="w-4 h-4 text-white" />
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-slate-900" />
    </motion.div>
  );
}

function UserAvatar() {
  return (
    <motion.div
      className="relative flex-shrink-0"
      initial={{ scale: 0, rotate: 180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', delay: 0.1 }}
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 text-white font-bold text-xs">
        Y
      </div>
    </motion.div>
  );
}

function MessageFooter({ message, isAI }: { message: Message; isAI: boolean }) {
  return (
    <div className={`flex items-center gap-2 mt-2 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <span className="text-[10px] text-slate-500">
        {message.timestamp.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
      {!isAI && message.status && (
        <motion.span
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-slate-400"
        >
          {message.status === 'read' ? (
            <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
          ) : message.status === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
        </motion.span>
      )}
    </div>
  );
}

interface ImageAttachmentProps {
  imageUrl: string;
  imageName?: string;
  isLightboxOpen: boolean;
  onOpenLightbox: () => void;
  onCloseLightbox: () => void;
}

function ImageAttachment({
  imageUrl,
  imageName,
  isLightboxOpen,
  onOpenLightbox,
  onCloseLightbox,
}: ImageAttachmentProps) {
  return (
    <>
      <div className="relative z-10 mb-2">
        <div
          className="relative group cursor-pointer overflow-hidden rounded-lg"
          onClick={onOpenLightbox}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageName || 'Uploaded image'}
            className="max-w-full max-h-48 rounded-lg object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        {imageName && (
          <p className="text-xs text-slate-400 mt-1 truncate">{imageName}</p>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseLightbox}
          >
            <motion.div
              className="relative max-w-[90vw] max-h-[90vh]"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={imageName || 'Uploaded image'}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
              <button
                onClick={onCloseLightbox}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              {imageName && (
                <p className="absolute -bottom-8 left-0 right-0 text-center text-sm text-slate-400">
                  {imageName}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
