/**
 * Transcription Service
 * Client-side service for speech-to-text transcription using AssemblyAI
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export interface TranscriptionOptions {
  languageCode?: string;
  speakerLabels?: boolean;
  punctuate?: boolean;
  formatText?: boolean;
}

export interface TranscriptionResult {
  text: string;
  language: string;
}

export interface TranscriptionStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
}

// ============================================================================
// Transcription Service
// ============================================================================

export const transcriptionService = {
  /**
   * Check if transcription service is available
   */
  checkStatus: () =>
    api.get<{ available: boolean; provider: string; message: string }>('/transcription/status'),

  /**
   * Transcribe audio file (synchronous - waits for result)
   */
  transcribe: (audioFile: File, options?: TranscriptionOptions) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    if (options) {
      if (options.languageCode) formData.append('languageCode', options.languageCode);
      if (options.speakerLabels !== undefined) formData.append('speakerLabels', String(options.speakerLabels));
      if (options.punctuate !== undefined) formData.append('punctuate', String(options.punctuate));
      if (options.formatText !== undefined) formData.append('formatText', String(options.formatText));
    }

    return api.post<TranscriptionResult>('/transcription/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Start transcription (asynchronous - returns transcript ID)
   */
  startTranscription: (audioFile: File, options?: TranscriptionOptions) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    if (options) {
      if (options.languageCode) formData.append('languageCode', options.languageCode);
      if (options.speakerLabels !== undefined) formData.append('speakerLabels', String(options.speakerLabels));
      if (options.punctuate !== undefined) formData.append('punctuate', String(options.punctuate));
      if (options.formatText !== undefined) formData.append('formatText', String(options.formatText));
    }

    return api.post<{ transcriptId: string; status: string }>('/transcription/start', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Get transcription status and result
   */
  getTranscription: (transcriptId: string) =>
    api.get<TranscriptionStatus>(`/transcription/${transcriptId}`),
};

