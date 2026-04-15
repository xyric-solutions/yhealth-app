/**
 * @file Upload API Service
 * @description Centralized API calls for file upload operations
 */

import { api } from '@/lib/api-client';

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    key: string;
    url: string;
    publicUrl: string;
  };
}

/**
 * Upload Service - handles all file upload operations
 */
export const uploadService = {
  /**
   * Upload voice assistant avatar
   * @param file - Image file to upload (JPEG, PNG, or WebP)
   * @returns Upload response with public URL
   */
  uploadVoiceAssistantAvatar: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    // Use the upload method which handles FormData correctly
    const response = await api.upload<UploadResponse>(
      '/upload/voice-assistant-avatar',
      formData
    );

    // Extract data from ApiResponse wrapper
    if (response.data) {
      return response.data;
    }
    
    // Fallback if data is missing
    return {
      success: false,
      message: response.error?.message || 'Upload failed',
      data: {
        key: '',
        url: '',
        publicUrl: '',
      },
    };
  },
};

