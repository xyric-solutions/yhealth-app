/**
 * @file AssemblyAI Service
 * @description Speech-to-text transcription using AssemblyAI API
 */

import { logger } from './logger.service.js';
import { env } from '../config/env.config.js';

const ASSEMBLYAI_API_BASE = 'https://api.assemblyai.com/v2';
const DEFAULT_API_KEY = '4073f082153545629fee09f4582b398b';

export interface TranscriptionOptions {
  languageCode?: string;
  speakerLabels?: boolean;
  punctuate?: boolean;
  formatText?: boolean;
}

export interface TranscriptionResult {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
}

export class AssemblyAIService {
  private apiKey: string;

  constructor() {
    // Use env variable or fallback to default key
    this.apiKey = env.assemblyai?.apiKey || process.env.ASSEMBLY_VOICE_API_KEY || DEFAULT_API_KEY;
    if (!this.apiKey) {
      logger.warn('[AssemblyAI] API key not configured. Transcription will fallback to browser SpeechRecognition.');
    } else {
      logger.info('[AssemblyAI] Service initialized with API key');
    }
  }

  /**
   * Upload audio file to AssemblyAI
   * @param audioData - Audio file buffer or Blob
   * @returns Upload URL
   */
  async uploadAudio(audioData: Buffer | Uint8Array): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      const response = await fetch(`${ASSEMBLYAI_API_BASE}/upload`, {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
        },
        body: audioData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`AssemblyAI upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as { upload_url: string };
      return data.upload_url;
    } catch (error) {
      logger.error('[AssemblyAI] Upload failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start transcription from audio URL
   * @param audioUrl - URL of audio file (can be upload URL or external URL)
   * @param options - Transcription options
   * @returns Transcription ID
   */
  async startTranscription(
    audioUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const data = {
      audio_url: audioUrl,
      language_code: options.languageCode || 'en',
      speaker_labels: options.speakerLabels || false,
      punctuate: options.punctuate !== false,
      format_text: options.formatText !== false,
      speech_model: 'universal', // Use universal model for better accuracy
    };

    try {
      logger.debug('[AssemblyAI] Starting transcription', { audioUrl, options });

      const response = await fetch(`${ASSEMBLYAI_API_BASE}/transcript`, {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`AssemblyAI transcription start failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as { id: string };
      logger.debug('[AssemblyAI] Transcription started', { transcriptId: result.id });
      return result.id;
    } catch (error) {
      logger.error('[AssemblyAI] Transcription start failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get transcription status and result
   * @param transcriptId - Transcription ID
   * @returns Transcription result
   */
  async getTranscription(transcriptId: string): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      const response = await fetch(`${ASSEMBLYAI_API_BASE}/transcript/${transcriptId}`, {
        method: 'GET',
        headers: {
          authorization: this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`AssemblyAI get transcription failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as { id: string; status: 'queued' | 'processing' | 'completed' | 'error'; text?: string; error?: string };
      return {
        id: result.id,
        status: result.status,
        text: result.text,
        error: result.error,
      };
    } catch (error) {
      logger.error('[AssemblyAI] Get transcription failed', {
        error: error instanceof Error ? error.message : String(error),
        transcriptId,
      });
      throw error;
    }
  }

  /**
   * Transcribe audio file (upload + transcribe + poll)
   * @param audioData - Audio file buffer
   * @param options - Transcription options
   * @returns Transcribed text
   */
  async transcribeAudio(
    audioData: Buffer | Uint8Array,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      // Step 1: Upload audio
      logger.debug('[AssemblyAI] Uploading audio');
      const uploadUrl = await this.uploadAudio(audioData);

      // Step 2: Start transcription
      logger.debug('[AssemblyAI] Starting transcription');
      const transcriptId = await this.startTranscription(uploadUrl, options);

      // Step 3: Poll for results
      logger.debug('[AssemblyAI] Polling for transcription results');
      const maxAttempts = 60; // 3 minutes max (60 * 3 seconds)
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

        const result = await this.getTranscription(transcriptId);

        if (result.status === 'completed') {
          logger.debug('[AssemblyAI] Transcription completed', {
            transcriptId,
            textLength: result.text?.length || 0,
          });
          return result.text || '';
        } else if (result.status === 'error') {
          throw new Error(`Transcription failed: ${result.error || 'Unknown error'}`);
        }

        attempts++;
      }

      throw new Error('Transcription timeout - took longer than expected');
    } catch (error) {
      logger.error('[AssemblyAI] Transcription failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if AssemblyAI is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const assemblyAIService = new AssemblyAIService();

