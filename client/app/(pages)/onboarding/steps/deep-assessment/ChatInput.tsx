'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, MicOff, Paperclip, Smile } from 'lucide-react';
import type { CustomSpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from './types';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onImageUpload?: (file: File) => void;
  disabled: boolean;
  placeholder?: string;
  isUploading?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onImageUpload,
  disabled,
  placeholder = 'Share your thoughts...',
  isUploading = false,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);

  // Keep valueRef in sync with value prop
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Check if Speech Recognition is available
  const isSpeechRecognitionSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isSpeechRecognitionSupported) return;

    const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        const currentValue = valueRef.current || '';
        const separator = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
        onChange(currentValue + separator + finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setRecordingError(
        event.error === 'not-allowed'
          ? 'Microphone access denied'
          : 'Voice recognition failed'
      );
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition as CustomSpeechRecognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSpeechRecognitionSupported, onChange]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    setRecordingError(null);

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
        setRecordingError('Could not start voice recording');
      }
    }
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      const validTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
      ];
      if (!validTypes.includes(file.type.toLowerCase())) {
        setRecordingError('Please upload a valid image (JPEG, PNG, WebP, or HEIC)');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setRecordingError('Image too large. Maximum size is 10MB');
        return;
      }
      setRecordingError(null);
      onImageUpload(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className="px-6 py-4 bg-gradient-to-t from-slate-950 via-slate-900/95 to-transparent backdrop-blur-xl border-t border-slate-800/30">
      <div className="max-w-3xl mx-auto">
        {/* Error message */}
        {recordingError && <ErrorMessage message={recordingError} />}

        {/* Recording indicator */}
        {isRecording && <RecordingIndicator />}

        {/* Uploading indicator */}
        {isUploading && <UploadingIndicator />}

        {/* Input container */}
        <motion.div
          className={`
            relative flex items-end gap-2 p-3 rounded-2xl border transition-all duration-300
            ${
              isFocused
                ? 'bg-slate-800/80 border-violet-500/50 shadow-lg shadow-violet-500/10'
                : 'bg-slate-800/50 border-slate-700/50'
            }
            ${isRecording ? 'border-red-500/50 shadow-lg shadow-red-500/10' : ''}
          `}
          animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Image upload button */}
          <motion.button
            onClick={handleImageClick}
            disabled={disabled || isUploading}
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              isUploading
                ? 'text-violet-400 bg-violet-500/20'
                : 'text-slate-500 hover:text-violet-400 hover:bg-violet-500/10'
            } disabled:opacity-50`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Upload health image (body, X-ray, food, etc.)"
          >
            <Paperclip className="w-4 h-4" />
          </motion.button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isRecording ? 'Speak now...' : placeholder}
            disabled={disabled || isUploading}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-slate-500 resize-none outline-none text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed min-h-6 max-h-30"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {value.trim() ? (
              <SendButton onClick={onSend} disabled={disabled || isUploading} />
            ) : (
              <VoiceButton
                isRecording={isRecording}
                isSupported={isSpeechRecognitionSupported}
                disabled={disabled || isUploading}
                onClick={toggleRecording}
              />
            )}
          </div>

          {/* Focused glow */}
          {isFocused && (
            <motion.div
              className="absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 -z-10 blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </motion.div>

        {/* Help text */}
        <p className="mt-2 text-xs text-slate-600 text-center">
          Press{' '}
          <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-xs">
            Enter
          </kbd>{' '}
          to send
          <span className="mx-1.5 text-slate-700">|</span>
          <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-xs">
            Shift + Enter
          </kbd>{' '}
          for new line
          <span className="mx-1.5 text-slate-700">|</span>
          <span className="text-violet-400/60">Upload health images</span>
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ErrorMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-500/30 text-xs text-red-400"
    >
      {message}
    </motion.div>
  );
}

function RecordingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-500/30"
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-red-500"
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className="text-xs text-red-400">Listening... Speak now</span>
    </motion.div>
  );
}

function UploadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-900/30 border border-violet-500/30"
    >
      <motion.div
        className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="text-xs text-violet-400">Analyzing image...</span>
    </motion.div>
  );
}

function SendButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <Send className="w-4 h-4" />
    </motion.button>
  );
}

interface VoiceButtonProps {
  isRecording: boolean;
  isSupported: boolean;
  disabled: boolean;
  onClick: () => void;
}

function VoiceButton({ isRecording, isSupported, disabled, onClick }: VoiceButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={!isSupported || disabled}
      className={`flex-shrink-0 p-2.5 rounded-xl transition-all duration-200 ${
        isRecording
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
          : 'bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={
        isSupported
          ? isRecording
            ? 'Stop recording'
            : 'Start voice input'
          : 'Voice input not supported'
      }
    >
      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </motion.button>
  );
}
