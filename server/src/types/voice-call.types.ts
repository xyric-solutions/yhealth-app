// Voice Call Types

// WebRTC types (not available in Node.js by default)
export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type CallStatus = 'initiating' | 'connecting' | 'ringing' | 'active' | 'ended' | 'failed' | 'timeout' | 'cancelled';
export type CallChannel = 'mobile_app' | 'whatsapp' | 'widget';
export type CallEventType = 'initiated' | 'signaling_started' | 'ice_candidate_exchanged' | 'connection_established' | 'media_started' | 'ai_response_started' | 'ai_response_completed' | 'user_spoke' | 'call_ended' | 'error_occurred';

export interface VoiceCall {
  id: string;
  user_id: string;
  channel: CallChannel;
  status: CallStatus;
  session_id?: string;
  initiated_at: Date;
  connected_at?: Date;
  ended_at?: Date;
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
  created_at: Date;
  updated_at: Date;
}

export interface VoiceCallEvent {
  id: string;
  call_id: string;
  event_type: CallEventType;
  event_data?: Record<string, unknown>;
  timestamp: Date;
}

export type SessionType =
  | 'quick_checkin'
  | 'coaching_session'
  | 'emergency_support'
  | 'goal_review'
  | 'health_coach'
  | 'nutrition'
  | 'fitness'
  | 'wellness';

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

export interface CallInitiationRequest {
  channel: CallChannel;
  pre_call_context?: string;
  session_type?: SessionType;
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

export interface CallHistoryFilters {
  page?: number;
  limit?: number;
  channel?: CallChannel;
  status?: CallStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface CallHistoryResponse {
  calls: VoiceCall[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CallSummary {
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

