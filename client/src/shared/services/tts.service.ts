/**
 * TTS Service
 * Client-side service for text-to-speech operations
 * Fallback chain: ElevenLabs → Google Cloud TTS → Browser speechSynthesis
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type VoiceGender = 'male' | 'female';

export interface TTSRequest {
  text: string;
  voiceId?: string;
  stream?: boolean;
  voiceGender?: VoiceGender;
  languageCode?: string;
}

export interface TTSStatusResponse {
  available: boolean;
  provider: string;
  providers?: Array<{ name: string; available: boolean }>;
  message: string;
}

export interface TTSResponse {
  success: boolean;
  provider?: string;
  data?: {
    audioUrl: string;
    blob: Blob;
  };
  error?: {
    message: string;
    code?: string;
  };
}

// ============================================================================
// Service
// ============================================================================

class TTSService {
  private baseUrl = '/tts';

  /**
   * Check if TTS service is available
   */
  async checkStatus(): Promise<TTSStatusResponse> {
    try {
      const response = await api.get<TTSStatusResponse>(`${this.baseUrl}/status`);
      return response.data || {
        available: false,
        provider: 'browser',
        message: 'TTS service unavailable',
      };
    } catch (error) {
      console.error('[TTS Service] Failed to check status:', error);
      return {
        available: false,
        provider: 'browser',
        message: 'TTS service unavailable',
      };
    }
  }

  /**
   * Convert text to speech using server-side TTS (ElevenLabs → Google Cloud fallback)
   * @param text - Text to convert to speech
   * @param voiceId - Optional ElevenLabs voice ID
   * @param voiceGender - Optional voice gender for Google Cloud TTS
   * @param languageCode - Optional language code for Google Cloud TTS
   * @returns Audio blob and URL
   */
  async speak(
    text: string,
    options?: {
      voiceId?: string;
      voiceGender?: VoiceGender;
      languageCode?: string;
    }
  ): Promise<TTSResponse> {
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: {
          message: 'Text cannot be empty',
        },
      };
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const url = `${apiUrl}${this.baseUrl}/speak`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof document !== 'undefined' && document.cookie.includes('balencia_access_token')
            ? {
                Authorization: `Bearer ${this.getAuthToken()}`,
              }
            : {}),
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: options?.voiceId,
          voiceGender: options?.voiceGender,
          languageCode: options?.languageCode,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorMessage = `TTS request failed: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        return {
          success: false,
          error: {
            message: errorMessage,
            code: response.status.toString(),
          },
        };
      }

      const provider = response.headers.get('X-TTS-Provider') || 'unknown';
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return {
        success: true,
        provider,
        data: {
          audioUrl,
          blob: audioBlob,
        },
      };
    } catch (error) {
      console.error('[TTS Service] Failed to convert text to speech:', error);
      return {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to convert text to speech. Please try again.',
        },
      };
    }
  }

  /**
   * @deprecated Use speak() instead. Kept for backward compatibility.
   */
  async speakWithElevenLabs(
    text: string,
    voiceId?: string
  ): Promise<TTSResponse> {
    return this.speak(text, { voiceId });
  }

  /**
   * Get auth token from cookie
   */
  private getAuthToken(): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split('; balencia_access_token=');
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  /**
   * Clean up audio URL (revoke object URL)
   */
  revokeAudioUrl(audioUrl: string): void {
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
  }
}

export const ttsService = new TTSService();
