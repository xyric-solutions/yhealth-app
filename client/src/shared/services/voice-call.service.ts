/**
 * Voice Call Service
 * Client-side service for voice call operations
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type CallStatus = 'initiating' | 'connecting' | 'ringing' | 'active' | 'ended' | 'failed' | 'timeout' | 'cancelled';
export type CallChannel = 'mobile_app' | 'whatsapp' | 'widget';
export type CallPurpose =
  | 'workout'
  | 'nutrition'
  | 'meal'
  | 'emotion'
  | 'emergency'
  | 'sleep'
  | 'stress'
  | 'goal_review'
  | 'general_health'
  | 'fitness'
  | 'wellness'
  | 'recovery';

export interface VoiceCall {
  id: string;
  user_id: string;
  channel: CallChannel;
  status: CallStatus;
  session_id?: string;
  initiated_at: string;
  connected_at?: string;
  ended_at?: string;
  connection_duration?: number;
  call_duration?: number;
  webrtc_session_id?: string;
  signaling_url?: string;
  ice_servers?: RTCIceServer[];
  error_code?: string;
  error_message?: string;
  retry_count: number;
  pre_call_context?: string;
  call_purpose?: CallPurpose;
  call_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface CallInitiationRequest {
  channel: CallChannel;
  pre_call_context?: string;
  call_purpose?: CallPurpose;
}

export interface CallInitiationResponse {
  callId: string;
  webrtcConfig: {
    signalingUrl: string;
    iceServers: RTCIceServer[];
  };
  status: CallStatus;
}

export interface CallStatusResponse {
  status: CallStatus;
  connectionDuration?: number;
  callDuration?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface CallHistoryResponse {
  calls: VoiceCall[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VoiceCallSummary {
  callId: string;
  summary: string;
  duration: number;
  keyTopics?: string[];
}

export interface WebRTCOffer {
  sdp: string;
  type: 'offer';
}

export interface WebRTCAnswer {
  sdp: string;
  type: 'answer';
}

export interface RTCIceCandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

// ============================================================================
// Voice Call Service
// ============================================================================

export const voiceCallService = {
  /**
   * Initiate a new voice call
   */
  initiate: (data: CallInitiationRequest) =>
    api.post<CallInitiationResponse>('/voice-calls/initiate', data),

  /**
   * Get call status
   */
  getStatus: (callId: string) =>
    api.get<CallStatusResponse>(`/voice-calls/${callId}/status`),

  /**
   * End a call
   */
  endCall: (callId: string, reason?: string) =>
    api.post<VoiceCallSummary>(`/voice-calls/${callId}/end`, { reason }),

  /**
   * Get call history
   */
  getHistory: (params?: {
    page?: number;
    limit?: number;
    channel?: CallChannel;
    status?: CallStatus;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.channel) queryParams.append('channel', params.channel);
    if (params?.status) queryParams.append('status', params.status);
    
    const query = queryParams.toString();
    return api.get<CallHistoryResponse>(`/voice-calls/history${query ? `?${query}` : ''}`);
  },

  /**
   * Get call details
   */
  getCall: (callId: string) =>
    api.get<VoiceCall>(`/voice-calls/${callId}`),

  /**
   * Handle WebRTC offer
   */
  handleOffer: (callId: string, offer: WebRTCOffer) =>
    api.post<{ answer: WebRTCAnswer }>(`/voice-calls/${callId}/offer`, offer),

  /**
   * Handle ICE candidate
   */
  handleIceCandidate: (callId: string, candidate: RTCIceCandidate) =>
    api.post<{ success: boolean }>(`/voice-calls/${callId}/ice-candidate`, candidate),

  /**
   * Get ICE servers
   */
  getIceServers: (callId: string) =>
    api.get<{ iceServers: RTCIceServer[] }>(`/voice-calls/${callId}/ice-servers`),

  /**
   * Mark call as active
   */
  markActive: (callId: string) =>
    api.post<{ success: boolean }>(`/voice-calls/${callId}/active`, {}),

  /**
   * Retry a failed call
   */
  retry: (callId: string) =>
    api.post<{ success: boolean }>(`/voice-calls/${callId}/retry`, {}),
};

