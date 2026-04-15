"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Sparkles,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";
import { EnhancedNetworkBackground } from "@/components/common/enhanced-network-background";
import { getFallbackLanguage } from "@/lib/language-config";
import { ttsService } from "@/src/shared/services/tts.service";
import { ActionCommand } from "@/src/shared/services/rag-chat.service";
import { parseActionsFromResponse, executeAction } from "@/src/shared/services/action-handler.service";
import { navigateToPage } from "@/src/shared/utils/navigation.helper";
import { api } from "@/lib/api-client";
import toast from "react-hot-toast";
import { ImageAnalysisModal } from "../modals/ImageAnalysisModal";
import { analyzeResponse as analyzeResponseForGestures } from "@/lib/avatar/conversationDirector";
import { X, Loader2, MicOff, Eye, EyeOff } from "lucide-react";
import { preferencesService } from "@/src/shared/services/preferences.service";
import { uploadService } from "@/src/shared/services/upload.service";
import { ragChatService } from "@/src/shared/services/rag-chat.service";
import { transcriptionService } from "@/src/shared/services/transcription.service";
import { voiceCallService } from "@/src/shared/services/voice-call.service";
import {
  subscribeToVisionEvents,
  emitVisionFrame,
  startVisionSession,
  stopVisionSession,
  type VisionStateEvent,
  type VisionCoachingEvent,
} from "@/lib/socket-client";
import type { Preferences } from "@/src/types";
// Import extracted components
import { VoiceAssistantHeader } from "../voice-assistant/VoiceAssistantHeader";
import { InlineCameraPanel } from "../voice-assistant/InlineCameraPanel";
import { VisionCoachingOverlay } from "../voice-assistant/VisionCoachingOverlay";
import { AvatarLayer, type AvatarLayerHandle } from "@/components/avatar/AvatarLayer";
import { VOICE_STATE_TO_AVATAR_STATE } from "@/lib/avatar/vrmMappings";
import { ContextPanel } from "../voice-assistant/ContextPanel";
import { SessionTypeSelector, type SessionTypeOption, SESSION_DURATIONS } from "../voice-assistant/SessionTypeSelector";
import { EmergencyResources } from "../voice-assistant/EmergencyResources";
import { JarvisLoader } from "@/components/voice-assistant/JarvisLoader";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

// Silence detection - shorter for snappier response
const SILENCE_THRESHOLD = 1200;
const MIN_SPEECH_LENGTH = 2;

interface VoiceAssistantTabProps {
  callId?: string | null;
  callPurpose?: string | null;
  onCallEnd?: () => void;
}

export function VoiceAssistantTab({ callId: initialCallId, callPurpose, onCallEnd }: VoiceAssistantTabProps = {}) {
  const router = useRouter();
  const { user, getInitials } = useAuth();
  const { setUserMood, selectedLanguage, setSelectedLanguage, assistantName, voiceGender } = useVoiceAssistant();

  // Also check URL for callId (fallback for direct navigation)
  const [urlCallId, setUrlCallId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const callIdFromUrl = params.get('callId');
      if (callIdFromUrl) {
        setUrlCallId(callIdFromUrl);
      }
    }
  }, []);

  // Use initialCallId from props, or fallback to URL param
  const effectiveCallId = initialCallId || urlCallId;

  // State
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalMode, _setImageModalMode] = useState<"camera" | "upload">("upload");
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  const [inlineCameraMode, setInlineCameraMode] = useState<"camera" | "upload">("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shouldAutoCapture, setShouldAutoCapture] = useState(false);
  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);
  // Vision coaching state
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [visionState, setVisionState] = useState<VisionStateEvent | null>(null);
  const [visionCoaching, setVisionCoaching] = useState<VisionCoachingEvent | null>(null);
  const visionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visionFrameIntervalMs = useRef(3000);
  const visionCleanupRef = useRef<(() => void) | null>(null);
  const [imageDescription, setImageDescription] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [_connectionStatus] = useState<"connected" | "connecting" | "disconnected">("connected");
  const [_voiceAssistantAvatarUrl, setVoiceAssistantAvatarUrl] = useState<string | null>(null);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [avatarUploadFile, setAvatarUploadFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [sessionType, setSessionType] = useState<SessionTypeOption | null>(null);
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [_sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const [showEmergencyResources, setShowEmergencyResources] = useState(false);
  const [emergencyResources, setEmergencyResources] = useState<{ country?: string; hotlines: Array<{ name: string; number: string; type: 'suicide_prevention' | 'crisis_text' | 'emergency' | 'local'; description?: string }> } | undefined>(undefined);
  const [callId, setCallId] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const callMarkedActiveRef = useRef(false);

  // Debug: Log call state on every render
  console.log("[VoiceAssistant] Render state:", { 
    initialCallId, 
    urlCallId, 
    effectiveCallId, 
    callId, 
    isCallActive 
  });

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const pendingTranscriptRef = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const isConversationActiveRef = useRef<boolean>(false);
  // Camera refs
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const inlineStreamRef = useRef<MediaStream | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const isTTSEnabledRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  const speakResponseRef = useRef<((text: string) => void) | null>(null);
  const processWithStreamRef = useRef<((text: string) => Promise<void>) | null>(null);
  const isTTSActiveRef = useRef<boolean>(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const avatarRef = useRef<AvatarLayerHandle>(null);
  const isListeningActiveRef = useRef<boolean>(false);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestartingRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const [useAssemblyAIFallback, setUseAssemblyAIFallback] = useState(false);
  const [_isTranscribing, setIsTranscribing] = useState(false);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Keep refs in sync
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { isConversationActiveRef.current = isConversationActive; }, [isConversationActive]);
  useEffect(() => { isTTSEnabledRef.current = isTTSEnabled; }, [isTTSEnabled]);

  // Sync callId from props or URL - this runs whenever effectiveCallId changes
  useEffect(() => {
    if (effectiveCallId) {
      console.log("[VoiceAssistant] Setting active call:", effectiveCallId);
      setCallId(effectiveCallId);
      setIsCallActive(true);
      callMarkedActiveRef.current = false;
    } else if (!initialCallId && !urlCallId) {
      // Only clear if both sources are empty
      setIsCallActive(false);
    }
  }, [effectiveCallId, initialCallId, urlCallId]);

  // Note: Call is already marked as active when page loads with callId (see effect above)
  // This effect is kept for backwards compatibility but shouldn't be needed

  // End call when component unmounts or conversation ends
  useEffect(() => {
    return () => {
      if (callId && isCallActive) {
        voiceCallService.endCall(callId).then(() => {
          console.log("[VoiceAssistant] Call ended on unmount:", callId);
          onCallEnd?.();
        }).catch((err) => {
          console.warn("[VoiceAssistant] Failed to end call:", err);
        });
      }
    };
  }, [callId, isCallActive, onCallEnd]);

  // Fetch greeting with call purpose for auto-start (defined early for use in useEffect)
  const fetchGreetingWithPurpose = useCallback(async (): Promise<string | null> => {
    try {
      if (!callPurpose) return null;
      // Extract base language code (e.g., "ur" from "ur-PK")
      const baseLang = selectedLanguage ? selectedLanguage.split("-")[0] : undefined;
      const response = await ragChatService.getGreeting(callPurpose, baseLang);
      return response.greeting;
    } catch (error) {
      console.error("[VoiceAssistant] Error fetching greeting with purpose:", error);
      return null;
    }
  }, [callPurpose, selectedLanguage]);

  // Mark call as active immediately when page loads with a callId
  useEffect(() => {
    if (effectiveCallId && !callMarkedActiveRef.current) {
      console.log("[VoiceAssistant] Marking call as active on page load:", effectiveCallId);
      callMarkedActiveRef.current = true;
      setCallId(effectiveCallId);
      setIsCallActive(true);
      
      // Mark call as active in backend immediately
      voiceCallService.markActive(effectiveCallId)
        .then((response) => {
          if (response.success) {
            console.log("[VoiceAssistant] Call marked as active successfully");
          }
        })
        .catch((error) => {
          console.error("[VoiceAssistant] Failed to mark call as active:", error);
        });
    }
  }, [effectiveCallId]);

  // Auto-start conversation when there's an active call from VoiceCallTab
  useEffect(() => {
    if (effectiveCallId && !isConversationActive) {
      console.log("[VoiceAssistant] Auto-starting conversation for call:", effectiveCallId, "purpose:", callPurpose);
      // Start immediately - don't wait for speech support check
      const timer = setTimeout(async () => {
        setIsConversationActive(true);
        isConversationActiveRef.current = true;
        setAiResponse("");
        setTranscript("");
        
        // Fetch greeting with call purpose if available
        try {
          if (callPurpose) {
            const greeting = await fetchGreetingWithPurpose();
            if (greeting) {
              setAiResponse(greeting);
              if (isTTSEnabledRef.current && speakResponseRef.current) {
                await speakResponseRef.current(greeting);
              } else {
                setTimeout(() => {
                  const startRef = startListeningRef.current;
                  if (startRef) startRef();
                }, 500);
              }
              return;
            }
          }
        } catch (error) {
          console.error("[VoiceAssistant] Error fetching greeting with purpose:", error);
        }
        
        toast.success("Connected! Start speaking...");
        // Start listening will happen automatically due to isConversationActive change
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCallId, callPurpose, fetchGreetingWithPurpose]); // Include callPurpose and dependencies

  // Handle end call action
  const handleEndCall = useCallback(async () => {
    if (callId) {
      try {
        // Stop any ongoing speech/listening
        setIsConversationActive(false);
        isConversationActiveRef.current = false;
        setVoiceState("idle");
        
        // End the call via API
        await voiceCallService.endCall(callId);
        console.log("[VoiceAssistant] Call ended:", callId);
        toast.success("Call ended");
        
        // Clear call state
        setCallId(null);
        setIsCallActive(false);
        
        // Notify parent
        onCallEnd?.();
        
        // Navigate to dashboard overview
        router.push("/dashboard?tab=overview");
      } catch (err) {
        console.error("[VoiceAssistant] Failed to end call:", err);
        toast.error("Failed to end call");
        // Still navigate even if API call fails
        router.push("/dashboard?tab=overview");
      }
    } else {
      // No active call, just navigate back
      router.push("/dashboard?tab=overview");
    }
  }, [callId, onCallEnd, router]);

  // Load voice assistant avatar from preferences
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const response = await preferencesService.get();
        if (response.success && response.data?.preferences) {
          // Access voiceAssistant from the API response (it's not in the Preferences type yet)
          const prefs = response.data.preferences as Preferences & { voiceAssistant?: { avatarUrl?: string | null } };
          if (prefs.voiceAssistant?.avatarUrl) {
            setVoiceAssistantAvatarUrl(prefs.voiceAssistant.avatarUrl);
          }
        }
      } catch (error) {
        console.error("[VoiceAssistant] Error loading avatar:", error);
      }
    };
    loadAvatar();
  }, []);

  // Load voices - filter by selected language
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as { webkitSpeechRecognition?: { new (): SpeechRecognition } }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTimeout(async () => {
        setIsSpeechSupported(false);
        // Check if AssemblyAI is available as fallback
        try {
          const response = await transcriptionService.checkStatus();
          if (response.success && response.data?.available) {
            setUseAssemblyAIFallback(true);
            setError("Browser speech recognition not available. Using AssemblyAI transcription instead.");
          } else {
            setError("Speech recognition not supported. Please use Chrome or Edge, or configure AssemblyAI.");
          }
        } catch {
          setError("Speech recognition not supported. Please use Chrome or Edge.");
        }
      }, 0);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      const baseLang = selectedLanguage.split("-")[0];
      let preferredVoice = voices.find(v => v.lang === selectedLanguage);
      
        if (!preferredVoice) {
        preferredVoice = voices.find(v => {
          const voiceBase = v.lang.split("-")[0];
          return voiceBase === baseLang;
        });
      }

        if (!preferredVoice) {
        const langVoices = voices.filter(v => {
          const voiceBase = v.lang.split("-")[0];
          return voiceBase === baseLang;
        });
        
        if (langVoices.length > 0) {
          preferredVoice = langVoices.find(v => 
            v.name.toLowerCase().includes("neural") ||
            v.name.toLowerCase().includes("premium") ||
            v.name.toLowerCase().includes("enhanced")
          ) || langVoices[0];
        }
      }

      if (!preferredVoice) {
        const fallbackLang = getFallbackLanguage(selectedLanguage);
        const fallbackBase = fallbackLang.split("-")[0];
        
        preferredVoice = voices.find(v => v.lang === fallbackLang) ||
                         voices.find(v => {
                           const voiceBase = v.lang.split("-")[0];
                           return voiceBase === fallbackBase;
                         }) ||
                          voices.find(v => v.lang.startsWith("en")) ||
                          voices[0];
        }

        setSelectedVoice(preferredVoice);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [selectedLanguage]);

  // Get auth token from cookie
  const getAuthToken = useCallback(() => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split("; balencia_access_token=");
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || null;
    }
    return null;
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (isProcessingRef.current || !isConversationActiveRef.current) {
      console.log("[VoiceAssistant] startListening blocked", {
      isProcessing: isProcessingRef.current,
      isConversationActive: isConversationActiveRef.current,
    });
      return;
    }
    
    // Prevent multiple simultaneous starts
    if (isListeningActiveRef.current || isRestartingRef.current) {
      console.log("[VoiceAssistant] startListening blocked - already listening or restarting");
      return;
    }

    // Check if SpeechRecognition is available, otherwise use AssemblyAI fallback
    const SpeechRecognition = window.SpeechRecognition || (window as { webkitSpeechRecognition?: { new (): SpeechRecognition } }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("[VoiceAssistant] SpeechRecognition not available, using AssemblyAI fallback");
      if (useAssemblyAIFallback) {
        startAssemblyAIRecording();
        return;
      } else {
        setError("Speech recognition not available. Please refresh the page.");
        return;
      }
    }

    setTranscript("");
    setInterimTranscript("");
    pendingTranscriptRef.current = "";
    setError(null);

    // Stop any existing recognition and wait a bit before starting new one
    if (recognitionRef.current) {
      try { 
        recognitionRef.current.onend = null; // Remove handler to prevent auto-restart
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop(); 
        isListeningActiveRef.current = false;
      } catch (err) { 
        console.warn("[VoiceAssistant] Error stopping previous recognition:", err);
      }
      recognitionRef.current = null;
    }

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Small delay to ensure previous recognition is fully stopped
    setTimeout(() => {
      // Double-check conditions before starting
      if (!isConversationActiveRef.current || isProcessingRef.current || isListeningActiveRef.current) {
        console.log("[VoiceAssistant] Conditions changed, aborting recognition start");
        return;
    }

      // Additional check - ensure SpeechRecognition is still available
      const SpeechRecognitionCheck = window.SpeechRecognition || (window as { webkitSpeechRecognition?: { new (): SpeechRecognition } }).webkitSpeechRecognition;
      if (!SpeechRecognitionCheck) {
        console.error("[VoiceAssistant] SpeechRecognition no longer available");
        setError("Speech recognition not available. Please refresh the page.");
        return;
      }

    const recognition = new SpeechRecognitionCheck();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;
    recognition.maxAlternatives = 1; // Reduce processing overhead

    recognition.onstart = () => {
        console.log("[VoiceAssistant] Recognition started");
      isListeningActiveRef.current = true;
        isRestartingRef.current = false;
      setVoiceState("listening");
      };

      recognition.onresult = (event) => {
        // Only process if still in conversation
        if (!isConversationActiveRef.current) return;

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            final += transcript + " ";
        } else {
            interim += transcript;
          }
        }

      if (final) {
        pendingTranscriptRef.current += final;
        setTranscript(pendingTranscriptRef.current);
          setInterimTranscript("");
        } else {
      setInterimTranscript(interim);
        }

        if (final.trim().length >= MIN_SPEECH_LENGTH) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
            const fullText = (pendingTranscriptRef.current + final).trim();
            
            // Check for "analyze picture/image" commands
            const lowerText = fullText.toLowerCase();
            const analyzePatterns = [
              /\b(analyze|analyse|analyze this|analyze the picture|analyze the image|analyze picture|analyze image|what.*in.*(picture|image|photo)|check.*(picture|image|photo)|analyze it|analyze that)\b/,
              /\b(what.*this|what.*that|what.*in|tell me.*about.*(picture|image|photo)|analyze|examine|review)\b/,
            ];
            
            const isAnalyzeCommand = analyzePatterns.some(pattern => pattern.test(lowerText));
            
            // Check if image is available (from parent scope via closure)
            const hasImage = capturedImage || imageFile;
            
            if (isAnalyzeCommand && hasImage) {
              // Extract description from command if present
              const descriptionMatch = lowerText.match(/(?:analyze|analyse|check|what.*in|tell me.*about|examine|review).*?(?:picture|image|photo|this|that|it)?\s*(.+?)(?:please|now|\.|$)/i);
              if (descriptionMatch && descriptionMatch[1]) {
                const extractedDescription = descriptionMatch[1].trim();
                if (extractedDescription && extractedDescription.length > 3) {
                  setImageDescription(extractedDescription);
                }
              }
              
              // Set flag to auto-analyze after processing the command
              setShouldAutoAnalyze(true);
              console.log("[VoiceAssistant] Analyze command detected, will auto-analyze image");
            }
            
            if (fullText.length >= MIN_SPEECH_LENGTH && !isProcessingRef.current && isConversationActiveRef.current) {
              processWithStreamRef.current?.(fullText);
        }
      }, SILENCE_THRESHOLD);
        }
    };

      recognition.onerror = (event) => {
        // Ignore "aborted" errors as they're expected when we manually stop
      if (event.error === "aborted") {
          console.log("[VoiceAssistant] Recognition aborted (expected)");
        isListeningActiveRef.current = false;
        return;
      }
      
        // Handle non-critical errors - these are expected or transient
        const nonCriticalErrors = ["no-speech", "audio-capture", "network", "service-not-allowed"];
        if (nonCriticalErrors.includes(event.error)) {
          console.log(`[VoiceAssistant] Recognition ${event.error} (non-critical, will retry if conversation active)`);
          isListeningActiveRef.current = false;
          
          // For network and audio-capture errors, try to retry if conversation is active
          if ((event.error === "network" || event.error === "audio-capture") && isConversationActiveRef.current && !isProcessingRef.current) {
            // Small delay before retrying to allow recovery
            setTimeout(() => {
              if (isConversationActiveRef.current && !isProcessingRef.current && !isTTSActiveRef.current && !isListeningActiveRef.current) {
                const startRef = startListeningRef.current;
                if (startRef) {
                  console.log(`[VoiceAssistant] Retrying after ${event.error} error...`);
                  startRef();
                }
              }
            }, 1500); // Increased delay for better recovery
          }
          return;
        }
      
        // Log actual critical errors
        console.error("[VoiceAssistant] Recognition error:", event.error);
        isListeningActiveRef.current = false;
        
        // Show error to user for critical errors only
        const criticalErrors = ["not-allowed", "bad-grammar", "language-not-supported"];
        if (criticalErrors.includes(event.error)) {
          setError(`Recognition error: ${event.error}. Please check your microphone permissions or settings.`);
        }
        
        // Don't restart on critical errors - let the onend handler or manual restart handle it
        if (!isConversationActiveRef.current) {
        setVoiceState("idle");
      }
      };
      
      recognition.onend = () => {
        console.log("[VoiceAssistant] Recognition ended");
        isListeningActiveRef.current = false;
        
        // Only restart if conversation is still active and not processing
        if (isConversationActiveRef.current && !isProcessingRef.current && !isTTSActiveRef.current) {
          // Prevent rapid restarts
          if (isRestartingRef.current) {
            console.log("[VoiceAssistant] Already restarting, skipping");
        return;
      }
      
          isRestartingRef.current = true;
          
          // Clear any existing restart timeout
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }

          // Restart after a delay, but only if conditions are still met
          restartTimeoutRef.current = setTimeout(() => {
            isRestartingRef.current = false;
            
            // Double-check conditions before restarting
            if (isConversationActiveRef.current && !isProcessingRef.current && !isTTSActiveRef.current && !isListeningActiveRef.current) {
              console.log("[VoiceAssistant] Auto-restarting recognition");
          const startRef = startListeningRef.current;
              if (startRef) {
                // Add a small delay before actually starting to ensure clean state
                setTimeout(() => {
                  if (isConversationActiveRef.current && !isProcessingRef.current && !isTTSActiveRef.current && !isListeningActiveRef.current) {
            startRef();
                  }
                }, 100);
              }
          } else {
              console.log("[VoiceAssistant] Conditions changed, not restarting", {
              isConversationActive: isConversationActiveRef.current,
              isProcessing: isProcessingRef.current,
                isTTSActive: isTTSActiveRef.current,
                isListeningActive: isListeningActiveRef.current,
            });
          }
          }, 500); // Increased delay to prevent rapid restarts
      } else if (!isConversationActiveRef.current) {
        setVoiceState("idle");
      }
    };

    recognitionRef.current = recognition;
    try { 
      recognition.start();
      console.log("[VoiceAssistant] Recognition start() called successfully");
      } catch (err: unknown) {
        console.error("[VoiceAssistant] Failed to start recognition:", err);
        isListeningActiveRef.current = false;
        isRestartingRef.current = false;
        
        // Handle specific error cases
        const error = err as Error & { name?: string; message?: string };
        if (error?.name === "InvalidStateError" || error?.message?.includes("already started")) {
          // Recognition might already be running, try to stop and restart
          console.log("[VoiceAssistant] Recognition already started, attempting recovery...");
          try {
            if (recognitionRef.current) {
              recognitionRef.current.stop();
              recognitionRef.current = null;
            }
            // Wait a bit longer before retrying
            setTimeout(() => {
              if (isConversationActiveRef.current && !isProcessingRef.current && !isListeningActiveRef.current) {
                const startRef = startListeningRef.current;
                if (startRef) {
                  console.log("[VoiceAssistant] Retrying after InvalidStateError recovery...");
                  startRef();
                }
              }
            }, 800);
          } catch (recoveryErr) {
            console.error("[VoiceAssistant] Recovery attempt failed:", recoveryErr);
            setError("Failed to start listening. Please try clicking the microphone button.");
            // Reset state to allow manual retry
            isListeningActiveRef.current = false;
            isRestartingRef.current = false;
          }
        } else if (error?.name === "NotAllowedError" || error?.message?.includes("permission")) {
          setError("Microphone permission denied. Please allow microphone access and try again.");
          isListeningActiveRef.current = false;
          isRestartingRef.current = false;
        } else {
          setError("Failed to start listening. Please try again or check microphone permissions.");
          // Reset state to allow manual retry
          isListeningActiveRef.current = false;
          isRestartingRef.current = false;
          
          // Auto-retry after a delay if conversation is still active
          if (isConversationActiveRef.current) {
            setTimeout(() => {
              if (isConversationActiveRef.current && !isProcessingRef.current && !isListeningActiveRef.current) {
                const startRef = startListeningRef.current;
                if (startRef) {
                  console.log("[VoiceAssistant] Auto-retrying after start error...");
                  startRef();
                }
              }
            }, 2000);
          }
        }
      }
    }, 200); // Delay to ensure previous recognition is stopped
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, capturedImage, imageFile, setImageDescription, setShouldAutoAnalyze]);

  // Fallback to browser TTS
  const speakWithBrowserTTS = useCallback((text: string) => {
    // Check if speechSynthesis is available
    if (!('speechSynthesis' in window)) {
      console.error("[VoiceAssistant] Browser TTS not supported");
      isTTSActiveRef.current = false;
      isProcessingRef.current = false;
      setVoiceState("idle");
      return;
    }

    // Cancel any ongoing speech
    try {
    window.speechSynthesis.cancel();
    } catch (error) {
      console.warn("[VoiceAssistant] Error canceling speechSynthesis:", error);
    }

    isTTSActiveRef.current = false;
    currentUtteranceRef.current = null;

    // Validate text
    if (!text || text.trim().length === 0) {
      console.warn("[VoiceAssistant] Empty text for TTS");
      isProcessingRef.current = false;
      setVoiceState("idle");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.lang = selectedLanguage;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      console.log("[VoiceAssistant] Browser TTS started");
      isTTSActiveRef.current = true;
      setVoiceState("speaking");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { /* ignore */ }
      }
    };

    utterance.onend = () => {
      console.log("[VoiceAssistant] Browser TTS ended");
      isTTSActiveRef.current = false;
      currentUtteranceRef.current = null;
      isProcessingRef.current = false;
      
      if (isConversationActiveRef.current && !isListeningActiveRef.current) {
        // Add a small delay before restarting to ensure TTS is fully complete
        setTimeout(() => {
          const startRef = startListeningRef.current;
          if (startRef && !isProcessingRef.current && !isTTSActiveRef.current && isConversationActiveRef.current && !isListeningActiveRef.current) {
            console.log("[VoiceAssistant] Restarting recognition after TTS ended");
            startRef();
          }
        }, 300);
      } else {
        setVoiceState("idle");
      }
    };

    utterance.onerror = (event) => {
      // Extract error details from SpeechSynthesisErrorEvent
      // Handle both SpeechSynthesisErrorEvent and generic events
      let errorDetails: Record<string, unknown> = {};
      
      try {
        // Try to access SpeechSynthesisErrorEvent properties
        const synthEvent = event as SpeechSynthesisErrorEvent;
        const eventUnknown = event as unknown as Record<string, unknown>;
        
        errorDetails = {
          error: synthEvent.error || 'unknown',
          errorType: synthEvent.error || 'unknown',
          type: event.type || 'error',
          charIndex: synthEvent.charIndex !== undefined ? synthEvent.charIndex : null,
          charLength: synthEvent.charLength !== undefined ? synthEvent.charLength : null,
          elapsedTime: synthEvent.elapsedTime !== undefined ? synthEvent.elapsedTime : null,
          name: event.constructor?.name || event.type || 'SpeechSynthesisErrorEvent',
          message: (eventUnknown.message as string) || 'No error message',
        };

        // If errorDetails is still empty or only has 'unknown', try to extract from event directly
        if (Object.keys(errorDetails).length === 0 || (errorDetails.error === 'unknown' && !errorDetails.message)) {
          errorDetails = {
            ...errorDetails,
            eventType: event.type,
            eventTarget: event.target ? String(event.target) : null,
            eventTimeStamp: event.timeStamp,
            // Try to get any enumerable properties
            ...Object.fromEntries(
              Object.entries(eventUnknown).filter(([key]) => !key.startsWith('_') && key !== 'target')
            ),
          };
        }
      } catch (extractError) {
        // Fallback if extraction fails
        const extractErr = extractError as Error;
        errorDetails = {
          error: 'error_extraction_failed',
          originalError: extractErr?.message || String(extractError),
          eventType: event?.type || 'unknown',
        };
      }

      // Only log if we have meaningful information
      if (Object.keys(errorDetails).length > 0 && (errorDetails.error !== 'unknown' || errorDetails.message)) {
        console.error("[VoiceAssistant] Browser TTS error:", errorDetails);
      } else {
        // Log minimal info if details are empty
        console.warn("[VoiceAssistant] Browser TTS error occurred but details unavailable:", {
          eventType: event?.type,
          hasError: !!event,
        });
      }
      
      // Log additional context with safe property access
      try {
        // Capture all context values with explicit checks to avoid closure issues
        const textLength = typeof text === 'string' ? text.length : (text ? String(text).length : 0);
        const textPreview = typeof text === 'string' 
          ? text.substring(0, 50) 
          : (text ? String(text).substring(0, 50) : 'N/A');
        const textType = typeof text;
        
        const speechSynthesisState = {
          pending: window.speechSynthesis?.pending ?? false,
          speaking: window.speechSynthesis?.speaking ?? false,
          paused: window.speechSynthesis?.paused ?? false,
          available: !!window.speechSynthesis,
        };
        
        const voiceName = selectedVoice?.name ?? 'default';
        const voiceLang = selectedVoice?.lang ?? 'N/A';
        const lang = selectedLanguage ?? 'N/A';
        
        const utteranceText = utterance?.text 
          ? (typeof utterance.text === 'string' ? utterance.text.substring(0, 50) : String(utterance.text).substring(0, 50))
          : 'N/A';
        const utteranceLang = utterance?.lang ?? 'N/A';
        const hasUtterance = !!utterance;
        
        // Include error details in context - ensure all values are primitives or plain objects
        const contextInfo: Record<string, unknown> = {
          error: String(errorDetails.error || 'unknown'),
          errorType: String(errorDetails.errorType || 'unknown'),
          errorMessage: String(errorDetails.message || 'No error message'),
          textLength: Number(textLength),
          textPreview: String(textPreview),
          textType: String(textType),
          speechSynthesisPending: Boolean(speechSynthesisState.pending),
          speechSynthesisSpeaking: Boolean(speechSynthesisState.speaking),
          speechSynthesisPaused: Boolean(speechSynthesisState.paused),
          speechSynthesisAvailable: Boolean(speechSynthesisState.available),
          selectedVoice: String(voiceName),
          selectedVoiceLang: String(voiceLang),
          selectedLanguage: String(lang),
          utteranceText: String(utteranceText),
          utteranceLang: String(utteranceLang),
          hasUtterance: Boolean(hasUtterance),
          eventType: String(event?.type || 'unknown'),
          timestamp: new Date().toISOString(),
        };
        
        // Log the context - use JSON.stringify to ensure proper serialization and visibility
        try {
          const contextString = JSON.stringify(contextInfo, null, 2);
          console.error("[VoiceAssistant] TTS Error context:", contextString);
          // Also log as object for console inspection
          console.error("[VoiceAssistant] TTS Error context (object):", contextInfo);
        } catch (stringifyError) {
          // Fallback if JSON.stringify fails
          console.error("[VoiceAssistant] TTS Error context (fallback):", {
            error: String(errorDetails.error || 'unknown'),
            errorMessage: String(errorDetails.message || 'No error message'),
            textLength,
            textPreview,
            textType,
            speechSynthesisAvailable: speechSynthesisState.available,
            selectedVoice: voiceName,
            eventType: event?.type || 'unknown',
            stringifyError: stringifyError instanceof Error ? stringifyError.message : String(stringifyError),
          });
        }
      } catch (contextError) {
        // Fallback if context construction fails
        const fallbackContext: Record<string, unknown> = {
          errorConstructingContext: contextError instanceof Error ? contextError.message : String(contextError),
          errorStack: contextError instanceof Error ? contextError.stack : undefined,
          textExists: typeof text !== 'undefined',
          textIsNull: text === null,
          textType: typeof text,
          textValue: typeof text === 'string' ? text.substring(0, 100) : String(text).substring(0, 100),
          selectedVoiceExists: typeof selectedVoice !== 'undefined',
          selectedVoiceIsNull: selectedVoice === null,
          selectedVoiceName: selectedVoice?.name || 'undefined',
          selectedLanguageExists: typeof selectedLanguage !== 'undefined',
          selectedLanguageValue: String(selectedLanguage || 'undefined'),
          utteranceExists: typeof utterance !== 'undefined',
          utteranceIsNull: utterance === null,
          utteranceTextValue: utterance?.text ? String(utterance.text).substring(0, 100) : 'undefined',
          errorDetailsError: String(errorDetails.error || 'unknown'),
          errorDetailsMessage: String(errorDetails.message || 'No error message'),
          eventType: String(event?.type || 'unknown'),
        };
        console.error("[VoiceAssistant] TTS Error context (fallback):", fallbackContext);
      }

      isTTSActiveRef.current = false;
      currentUtteranceRef.current = null;
      isProcessingRef.current = false;
      
      // Try to reset speechSynthesis if it's in a bad state
      try {
        window.speechSynthesis.cancel();
        // Small delay before allowing retry
        setTimeout(() => {
          if (isConversationActiveRef.current) {
          const startRef = startListeningRef.current;
          if (startRef && !isProcessingRef.current) {
            startRef();
          }
      } else {
            setVoiceState("idle");
          }
        }, 1000);
      } catch (resetError) {
        console.error("[VoiceAssistant] Error resetting speechSynthesis:", resetError);
        setVoiceState("idle");
      }
    };

    // Use a small delay to ensure speechSynthesis is ready
    // Also check if speechSynthesis is speaking/pending before starting
    const trySpeak = () => {
      try {
        // Double-check speechSynthesis is available
        if (!window.speechSynthesis) {
          console.error("[VoiceAssistant] speechSynthesis not available");
          isProcessingRef.current = false;
          setVoiceState("idle");
          return;
        }

        // If speechSynthesis is busy, cancel and retry
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
          setTimeout(() => {
            try {
              window.speechSynthesis.speak(utterance);
            } catch (speakError) {
              console.error("[VoiceAssistant] Error calling speak:", speakError);
              isProcessingRef.current = false;
              setVoiceState("idle");
            }
          }, 100);
        } else {
          window.speechSynthesis.speak(utterance);
        }
      } catch (error) {
        console.error("[VoiceAssistant] Error in trySpeak:", error);
        isProcessingRef.current = false;
        setVoiceState("idle");
      }
    };

    setTimeout(trySpeak, 30);
  }, [selectedVoice, selectedLanguage]);

  // Speak response - Try ElevenLabs first, fallback to browser TTS
  const speakResponse = useCallback(async (text: string) => {
    // Clean up any existing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      ttsService.revokeAudioUrl(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    window.speechSynthesis.cancel();
    isTTSActiveRef.current = false;
    currentUtteranceRef.current = null;

    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[-*]\s/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    if (!cleanText) {
      isProcessingRef.current = false;
      isTTSActiveRef.current = false;
      if (!isConversationActiveRef.current) {
        setVoiceState("idle");
      }
      return;
    }

    // Analyze response text → queue timed gestures + emotions for the avatar
    try {
      const directives = analyzeResponseForGestures(cleanText);
      for (const d of directives) {
        const delayMs = d.delaySec * 1000;
        setTimeout(() => {
          avatarRef.current?.queueGesture(d.gesture);
          avatarRef.current?.setEmotionFromBackend(d.emotion, d.intensity * 100);
        }, delayMs);
      }
    } catch {
      // Non-critical — avatar still works without directives
    }

    // Try server-side TTS (ElevenLabs → Google Cloud TTS fallback chain)
    try {
      console.log("[VoiceAssistant] Attempting server TTS (ElevenLabs → Google Cloud)");
      const ttsResponse = await ttsService.speak(cleanText, {
        voiceGender,
        languageCode: selectedLanguage,
      });

      if (ttsResponse.success && ttsResponse.data) {
        // Create audio element for playback
        const audio = new Audio(ttsResponse.data.audioUrl);
        currentAudioRef.current = audio;
        currentAudioUrlRef.current = ttsResponse.data.audioUrl;

        audio.onplay = () => {
          console.log(`[VoiceAssistant] TTS audio started (provider: ${ttsResponse.provider})`);
      isTTSActiveRef.current = true;
      setVoiceState("speaking");
          // Connect 3D avatar lip-sync to TTS audio
          avatarRef.current?.speakFromAudioElement(audio);
          if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
            } catch { /* ignore */ }
          }
        };

        audio.onended = () => {
          console.log("[VoiceAssistant] TTS audio ended");
          isTTSActiveRef.current = false;
          isProcessingRef.current = false;
          // Stop 3D avatar lip-sync
          avatarRef.current?.stopSpeaking();

          // Clean up
          if (currentAudioUrlRef.current) {
            ttsService.revokeAudioUrl(currentAudioUrlRef.current);
            currentAudioUrlRef.current = null;
          }
          currentAudioRef.current = null;

          if (isConversationActiveRef.current && !isListeningActiveRef.current) {
            // Wait a bit longer before restarting to ensure audio is fully stopped
            setTimeout(() => {
              const startRef = startListeningRef.current;
              if (startRef && !isProcessingRef.current && !isTTSActiveRef.current && isConversationActiveRef.current) {
                startRef();
              }
            }, 500);
          } else {
            setVoiceState("idle");
          }
        };

        audio.onerror = (event) => {
          console.error("[VoiceAssistant] TTS audio playback error:", event);
      isTTSActiveRef.current = false;
      isProcessingRef.current = false;
      
          // Clean up
          if (currentAudioUrlRef.current) {
            ttsService.revokeAudioUrl(currentAudioUrlRef.current);
            currentAudioUrlRef.current = null;
          }
          currentAudioRef.current = null;

          // Fallback to browser TTS
          console.log("[VoiceAssistant] Falling back to browser TTS");
          speakWithBrowserTTS(cleanText);
        };

        // Start playback
        await audio.play();
        return;
      } else {
        // Server TTS failed, fallback to browser TTS
        console.warn("[VoiceAssistant] Server TTS failed, using browser TTS:", ttsResponse.error?.message);
        speakWithBrowserTTS(cleanText);
      }
    } catch (error) {
      // Network or other error, fallback to browser TTS
      console.error("[VoiceAssistant] Server TTS error, using browser TTS:", error);
      speakWithBrowserTTS(cleanText);
    }
  }, [speakWithBrowserTTS, selectedLanguage, voiceGender]);

  // Detect mood
  const detectMood = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    
    if (/\b(great|awesome|amazing|excellent|fantastic|wonderful|happy|excited|joy|love|perfect|best|good|nice|yeah|yes|yay|woohoo|hooray)\b/.test(lowerText)) {
      if (/\b(excited|amazing|fantastic|awesome|woohoo|hooray)\b/.test(lowerText)) {
        setUserMood("excited");
      } else {
        setUserMood("happy");
      }
      return;
    }
    
    if (/\b(stress|stressed|worried|anxious|nervous|overwhelmed|tired|exhausted|frustrated|difficult|hard|struggling|problem|issue|help|need)\b/.test(lowerText)) {
      setUserMood("stressed");
      return;
    }
    
    if (/\b(sad|down|depressed|upset|disappointed|bad|terrible|awful|horrible|sick|pain|hurt|lonely|miss|sorry)\b/.test(lowerText)) {
      setUserMood("sad");
      return;
    }
    
    if (/\b(motivated|ready|let's|let us|go|start|begin|workout|exercise|train|fitness|goal|achieve|progress|improve|strong|power|energy)\b/.test(lowerText)) {
      setUserMood("motivated");
      return;
    }
    
    if (/\b(calm|peaceful|relax|relaxed|meditate|breath|breathe|zen|peace|quiet|chill|easy|slow|gentle|soft)\b/.test(lowerText)) {
      setUserMood("calm");
      return;
    }
    
    setUserMood("neutral");
  }, [setUserMood]);

  // Inline camera functions (defined before executeActionsAsync)
  const startInlineCamera = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:793',message:'startInlineCamera called',data:{hasMediaDevices:!!navigator.mediaDevices,hasGetUserMedia:!!navigator.mediaDevices?.getUserMedia,videoRefExists:!!inlineVideoRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = "Camera not supported in this browser";
      console.error("[VoiceAssistant]", errorMsg);
      setCameraError(errorMsg);
      setIsCameraActive(false);
      toast.error(errorMsg);
      return;
    }

    // Stop any existing stream first
    if (inlineStreamRef.current) {
      inlineStreamRef.current.getTracks().forEach((track) => track.stop());
      inlineStreamRef.current = null;
    }
    
    setIsCameraActive(false);
    setCameraError(null);
    
    try {
      // Try environment (back camera) first, fallback to user (front camera)
      let mediaStream: MediaStream | null = null;
      let error: Error | null = null;

      try {
        // Try back camera first
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:828',message:'getUserMedia succeeded (back camera)',data:{streamId:mediaStream?.id,activeTracks:mediaStream?.getVideoTracks().filter(t=>t.readyState==='live').length,totalTracks:mediaStream?.getVideoTracks().length,enabledTracks:mediaStream?.getVideoTracks().filter(t=>t.enabled).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      } catch (envError) {
        console.log("[VoiceAssistant] Back camera failed, trying front camera:", envError);
        error = envError as Error;
        
        // Fallback to front camera or any available camera
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false,
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:841',message:'getUserMedia succeeded (front camera)',data:{streamId:mediaStream?.id,activeTracks:mediaStream?.getVideoTracks().filter(t=>t.readyState==='live').length,totalTracks:mediaStream?.getVideoTracks().length,enabledTracks:mediaStream?.getVideoTracks().filter(t=>t.enabled).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        } catch {
          // If both fail, try without facingMode constraint
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false,
            });
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:851',message:'getUserMedia succeeded (fallback)',data:{streamId:mediaStream?.id,activeTracks:mediaStream?.getVideoTracks().filter(t=>t.readyState==='live').length,totalTracks:mediaStream?.getVideoTracks().length,enabledTracks:mediaStream?.getVideoTracks().filter(t=>t.enabled).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          } catch (fallbackError) {
            throw fallbackError;
          }
        }
      }

      if (!mediaStream) {
        throw error || new Error("Failed to access camera");
      }

      inlineStreamRef.current = mediaStream;
      
      // Wait for video element to be ready
      if (inlineVideoRef.current) {
        const video = inlineVideoRef.current;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:865',message:'Video ref exists, before attaching stream',data:{videoReadyState:video.readyState,videoPaused:video.paused,hasSrcObject:!!video.srcObject,videoWidth:video.videoWidth,videoHeight:video.videoHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion
        
        // Clear any existing stream first
        if (video.srcObject) {
          const oldStream = video.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
        
        // Set the stream
        video.srcObject = mediaStream;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:876',message:'Stream attached to video element',data:{srcObjectSet:!!video.srcObject,streamId:mediaStream.id,streamActive:mediaStream.active,streamTracks:mediaStream.getVideoTracks().length,enabledTracks:mediaStream.getVideoTracks().filter(t=>t.enabled).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Ensure video properties are set BEFORE setting srcObject
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        
        // Wait for video to be ready and playing before setting active state
        await new Promise<void>((resolve, reject) => {
          if (!inlineVideoRef.current) {
            reject(new Error("Video element not available"));
            return;
          }

          let resolved = false;
          
          const cleanup = () => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("playing", onPlaying);
            video.removeEventListener("play", onPlay);
            video.removeEventListener("error", onError);
          };

          const onLoadedMetadata = () => {
            console.log("[VoiceAssistant] Camera video metadata loaded");
            // Try to play the video
            video.play().catch((playError) => {
              console.warn("[VoiceAssistant] Auto-play prevented, will try manual play:", playError);
            });
          };

          const onCanPlay = () => {
            console.log("[VoiceAssistant] Camera video can play");
            // Ensure video is playing
            if (video.paused) {
              video.play().catch((playError) => {
                console.warn("[VoiceAssistant] Play failed:", playError);
              });
            }
          };

          const onPlay = () => {
            console.log("[VoiceAssistant] Camera video started playing");
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:920',message:'Video play event fired',data:{videoPaused:video.paused,videoReadyState:video.readyState,videoWidth:video.videoWidth,videoHeight:video.videoHeight,hasSrcObject:!!video.srcObject},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve();
            }
          };

          const onPlaying = () => {
            console.log("[VoiceAssistant] Camera video is playing");
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:929',message:'Video playing event fired',data:{videoPaused:video.paused,videoReadyState:video.readyState,videoWidth:video.videoWidth,videoHeight:video.videoHeight,hasSrcObject:!!video.srcObject},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve();
            }
          };

          const onError = (e: Event) => {
            console.error("[VoiceAssistant] Video element error:", e);
            if (!resolved) {
              resolved = true;
              cleanup();
              reject(new Error("Video element failed to load"));
            }
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata);
          video.addEventListener("canplay", onCanPlay);
          video.addEventListener("play", onPlay);
          video.addEventListener("playing", onPlaying);
          video.addEventListener("error", onError);
          
          // Try to play immediately - multiple attempts
          const attemptPlay = async () => {
            try {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:953',message:'Attempting video.play()',data:{videoPaused:video.paused,videoReadyState:video.readyState,hasSrcObject:!!video.srcObject,streamActive:mediaStream.active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,F'})}).catch(()=>{});
              // #endregion
              await video.play();
              console.log("[VoiceAssistant] Video play() succeeded");
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:957',message:'video.play() succeeded',data:{videoPaused:video.paused,videoReadyState:video.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            } catch (playError: unknown) {
              const error = playError as Error & { name?: string; message?: string };
              console.warn("[VoiceAssistant] Play attempt failed, will retry:", playError);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:960',message:'video.play() failed',data:{errorName:error?.name,errorMessage:error?.message,videoPaused:video.paused,videoReadyState:video.readyState,hasSrcObject:!!video.srcObject},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,F'})}).catch(()=>{});
              // #endregion
              // Retry after a short delay
              setTimeout(() => {
                if (!resolved && video.srcObject) {
                  video.play().catch((err) => {
                    console.warn("[VoiceAssistant] Retry play failed:", err);
                  });
                }
              }, 100);
            }
          };
          
          attemptPlay();
          
          // Timeout after 5 seconds
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              // Check if video is actually playing or has valid stream
              if (video.srcObject && video.readyState >= 2) {
                // Force play one more time
                if (video.paused) {
                  video.play().catch(() => {});
                }
                console.log("[VoiceAssistant] Camera video ready (timeout check passed)");
                resolve();
              } else {
                reject(new Error("Camera initialization timeout - video not playing"));
              }
            }
          }, 5000);
        });

        setIsCameraActive(true);
        console.log("[VoiceAssistant] Camera started successfully");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1002',message:'Camera marked as active',data:{videoPaused:video.paused,videoReadyState:video.readyState,videoWidth:video.videoWidth,videoHeight:video.videoHeight,hasSrcObject:!!video.srcObject,streamActive:mediaStream.active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,D'})}).catch(()=>{});
        // #endregion
      } else {
        // Video ref not ready yet, set stream and wait
        inlineStreamRef.current = mediaStream;
        setIsCameraActive(true);
        console.log("[VoiceAssistant] Camera stream obtained, waiting for video element");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1007',message:'Video ref not ready, stream stored',data:{streamId:mediaStream.id,streamActive:mediaStream.active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'})}).catch(()=>{});
        // #endregion
      }
    } catch (err) {
      const error = err as Error;
      console.error("[VoiceAssistant] Inline camera error:", error);
      
      // Clean up on error
      if (inlineStreamRef.current) {
        inlineStreamRef.current.getTracks().forEach((track) => track.stop());
        inlineStreamRef.current = null;
      }
      
      let errorMsg = "Camera access denied";
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMsg = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMsg = "No camera found. Please connect a camera and try again.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorMsg = "Camera is being used by another application. Please close other apps and try again.";
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setCameraError(errorMsg);
      setIsCameraActive(false);
      toast.error(`Camera error: ${errorMsg}`);
    }
  }, []);

  const stopInlineCamera = useCallback(() => {
    if (inlineStreamRef.current) {
      inlineStreamRef.current.getTracks().forEach((track) => track.stop());
      inlineStreamRef.current = null;
      setIsCameraActive(false);
      if (inlineVideoRef.current) {
        inlineVideoRef.current.srcObject = null;
      }
    }
  }, []);

  // ============================================
  // VISION COACHING
  // ============================================

  const captureAndSendFrame = useCallback(() => {
    const video = inlineVideoRef.current;
    const canvas = inlineCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    // Downscale to 640x480 for efficient transmission
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 640, 480);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    const base64 = dataUrl.split(',')[1];
    if (base64) {
      emitVisionFrame(base64);
    }
  }, []);

  const startVisionCoaching = useCallback(() => {
    if (isVisionActive || !isCameraActive) return;

    console.log('[VoiceAssistant] Starting vision coaching');
    setIsVisionActive(true);

    // Emit vision:start via Socket.IO
    startVisionSession();

    // Subscribe to vision events
    const cleanup = subscribeToVisionEvents({
      onState: (data) => {
        setVisionState(data);
      },
      onCoaching: (data) => {
        setVisionCoaching(data);
        // Auto-clear coaching toast after 5s
        setTimeout(() => setVisionCoaching(null), 5000);
        // Optionally speak the coaching feedback
        if (isTTSEnabledRef.current && speakResponseRef.current && data.severity === 'warning') {
          speakResponseRef.current(data.message);
        }
      },
      onThrottle: (data) => {
        console.log('[VoiceAssistant] Vision throttled, new interval:', data.intervalMs);
        visionFrameIntervalMs.current = data.intervalMs;
        // Restart the interval with new timing
        if (visionIntervalRef.current) {
          clearInterval(visionIntervalRef.current);
          visionIntervalRef.current = setInterval(captureAndSendFrame, data.intervalMs);
        }
      },
      onError: (data) => {
        console.error('[VoiceAssistant] Vision error:', data.message);
        toast.error(`Vision: ${data.message}`);
      },
      onFood: (data) => {
        toast.success(`Food detected: ${data.item}`, { duration: 4000 });
      },
    });
    visionCleanupRef.current = cleanup;

    // Start frame capture interval
    visionIntervalRef.current = setInterval(captureAndSendFrame, visionFrameIntervalMs.current);
  }, [isVisionActive, isCameraActive, captureAndSendFrame]);

  const stopVisionCoaching = useCallback(() => {
    if (!isVisionActive) return;

    console.log('[VoiceAssistant] Stopping vision coaching');
    setIsVisionActive(false);
    setVisionState(null);
    setVisionCoaching(null);
    visionFrameIntervalMs.current = 3000;

    // Clear frame capture interval
    if (visionIntervalRef.current) {
      clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }

    // Unsubscribe from vision events
    if (visionCleanupRef.current) {
      visionCleanupRef.current();
      visionCleanupRef.current = null;
    }

    // Emit vision:stop
    stopVisionSession();
  }, [isVisionActive]);

  // Stop vision coaching when camera is deactivated
  useEffect(() => {
    if (!isCameraActive && isVisionActive) {
      stopVisionCoaching();
    }
  }, [isCameraActive, isVisionActive, stopVisionCoaching]);

  // Cleanup vision coaching on unmount
  useEffect(() => {
    return () => {
      if (visionIntervalRef.current) {
        clearInterval(visionIntervalRef.current);
      }
      if (visionCleanupRef.current) {
        visionCleanupRef.current();
      }
    };
  }, []);

  const captureInlinePhoto = useCallback(() => {
    if (!inlineVideoRef.current || !inlineCanvasRef.current) return;

    const video = inlineVideoRef.current;
    const canvas = inlineCanvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        setImageFile(file);
        setCapturedImage(url);
        // Don't stop camera - let user see the captured image and optionally retake
      },
      "image/jpeg",
      0.95
    );
  }, []);

  const handleInlineFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image too large. Maximum size is 10MB");
        return;
      }
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setCapturedImage(url);
      setCameraError(null);
    }
    if (e.target) e.target.value = "";
  }, []);

  const analyzeInlineImage = useCallback(async () => {
    if (!imageFile) return;
    
    setIsAnalyzing(true);
    setCameraError(null);
    setAnalysisResult(null);

    try {
      const { aiCoachService } = await import("@/src/shared/services/ai-coach.service");
      console.log("[VoiceAssistant] Starting image analysis...", { 
        fileName: imageFile.name, 
        fileSize: imageFile.size,
        description: imageDescription 
      });
      
      const result = await aiCoachService.analyzeImage(
        imageFile,
        undefined, // goal
        imageDescription.trim() || undefined // question/description
      );
      
      console.log("[VoiceAssistant] Image analysis result:", result);
      
      // result.analysis is an ImageAnalysisResult object with an 'analysis' string property
      // result.response is a string response
      let analysis: string;
      if (typeof result.analysis === 'string') {
        analysis = result.analysis;
      } else if (result.analysis && typeof result.analysis === 'object' && 'analysis' in result.analysis) {
        analysis = result.analysis.analysis || result.response || "Analysis completed";
      } else {
        analysis = result.response || "Analysis completed";
      }
      
      if (!analysis || analysis === "Analysis completed") {
        console.warn("[VoiceAssistant] No analysis text found in result:", result);
        throw new Error("Analysis completed but no analysis text was returned");
      }
      
      console.log("[VoiceAssistant] Extracted analysis text:", analysis.substring(0, 100) + "...");
      setAnalysisResult(analysis);
      
      if (isTTSEnabledRef.current) {
        await speakWithBrowserTTS(analysis);
      }
      
      // Reset after analysis
      setTimeout(() => {
        setShowInlineCamera(false);
        setCapturedImage(null);
        setImageFile(null);
        setAnalysisResult(null);
        setImageDescription("");
      }, 3000);
    } catch (err: unknown) {
      console.error("[VoiceAssistant] Image analysis error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to analyze image";
      setCameraError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageFile, imageDescription, speakWithBrowserTTS]);

  // Execute actions asynchronously
  const executeActionsAsync = useCallback(async (actions: ActionCommand[]) => {
    for (const action of actions) {
      try {
        if (action.type === 'navigate') {
          // Execute navigation immediately
          const navigated = navigateToPage(router, action.target);
          if (navigated) {
            console.log(`[VoiceAssistant] Navigated to ${action.target}`);
          } else {
            console.warn(`[VoiceAssistant] Could not navigate to ${action.target}`);
          }
        } else {
          // For other actions, use executeAction helper
          await executeAction(
            action,
            router,
            (tabId: string) => navigateToPage(router, tabId),
            async (target: string, params?: Record<string, unknown>) => {
              // Handle update actions
              if (target.includes('workout') || target.includes('plan')) {
                try {
                  const plansResponse = await api.get<{ plans?: Array<{ id: string; status?: string }> }>('/workouts/plans');
                  const activePlan = plansResponse.data?.plans?.find((p) => p.status === 'active');
                  if (activePlan) {
                    const response = await api.patch(`/workouts/plans/${activePlan.id}`, params || {});
                    return response.success || false;
                  }
                } catch (error) {
                  console.error('[VoiceAssistant] Error updating plan:', error);
                  return false;
                }
              }
              return false;
            },
            async () => false, // onCreate - not implemented yet
            async () => false, // onDelete - not implemented yet
            async (target: string, params?: Record<string, unknown>) => {
              // Handle camera/image inline actions (top right)
              console.log('[VoiceAssistant] Opening inline camera:', target, params);
              
              // Check if this is a "take picture" command (not just "open camera")
              const isTakePictureCommand = params?.action === 'take_picture' || 
                                         params?.autoCapture === true ||
                                         (typeof params === 'object' && params !== null && 'take' in params);
              
              // Check if this is an "analyze picture" command
              const isAnalyzeCommand = params?.action === 'analyze_image' || 
                                      params?.action === 'analyze_picture' ||
                                      params?.autoAnalyze === true ||
                                      (typeof params === 'object' && params !== null && 'analyze' in params);
              
              if (target === 'camera') {
                console.log('[VoiceAssistant] Setting camera mode and opening inline camera', { isTakePictureCommand, isAnalyzeCommand });
                setInlineCameraMode("camera");
                setShowInlineCamera(true);
                setShouldAutoCapture(isTakePictureCommand);
                
                // If analyze command, set flag for auto-analysis after capture
                if (isAnalyzeCommand) {
                  setShouldAutoAnalyze(true);
                  // Also extract description if provided
                  if (params?.description && typeof params.description === 'string') {
                    setImageDescription(params.description as string);
                  }
                }
                
                // Start camera automatically
                setTimeout(() => {
                  startInlineCamera();
                }, 100);
                return true;
              } else if (target === 'image_upload') {
                console.log('[VoiceAssistant] Setting upload mode and opening inline camera', { isAnalyzeCommand });
                setInlineCameraMode("upload");
                setShowInlineCamera(true);
                
                // If analyze command with uploaded image, auto-analyze
                if (isAnalyzeCommand && params?.imageUrl) {
                  setShouldAutoAnalyze(true);
                  if (params?.description && typeof params.description === 'string') {
                    setImageDescription(params.description as string);
                  }
                }
                
                // Stop camera if it was running
                stopInlineCamera();
                return true;
              }
              return false;
            }
          );
        }
      } catch (error) {
        console.error(`[VoiceAssistant] Error executing action:`, action, error);
      }
    }
  }, [router, startInlineCamera, stopInlineCamera]);

  const handleImageAnalysisComplete = useCallback(async (analysis: string) => {
    // After image analysis, speak the result
    if (analysis && isTTSEnabledRef.current) {
      await speakWithBrowserTTS(analysis);
    }
  }, [speakWithBrowserTTS]);

  // Auto-start camera when modal opens in camera mode
  useEffect(() => {
    // Only start if modal is open, in camera mode, no stream exists, and camera is not already active
    if (showInlineCamera && inlineCameraMode === "camera" && !inlineStreamRef.current && !isCameraActive) {
      // Use requestAnimationFrame to wait for DOM to be ready, then check for video element
      let rafId: number | null = null;
      const timeoutId = setTimeout(() => {
        const checkAndStart = () => {
          if (inlineVideoRef.current && !isCameraActive) {
            console.log("[VoiceAssistant] Auto-starting camera - video ref ready");
            startInlineCamera();
          } else if (!inlineVideoRef.current) {
            // Video not ready yet, try again on next frame
            rafId = requestAnimationFrame(checkAndStart);
          }
        };
        rafId = requestAnimationFrame(checkAndStart);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInlineCamera, inlineCameraMode, startInlineCamera]);

  // Auto-capture timer when "take picture" is requested
  useEffect(() => {
    if (shouldAutoCapture && isCameraActive && !capturedImage && inlineVideoRef.current) {
      // Start 3-second countdown
      setCountdown(3);
      
      const countdownId = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownId);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Capture after 3 seconds
      const timerId = setTimeout(() => {
        console.log('[VoiceAssistant] Auto-capturing photo after 3 seconds');
        captureInlinePhoto();
        clearInterval(countdownId);
        setCountdown(null);
        setShouldAutoCapture(false);
      }, 3000);

      return () => {
        clearTimeout(timerId);
        clearInterval(countdownId);
      };
    }
  }, [shouldAutoCapture, isCameraActive, capturedImage, captureInlinePhoto]);

  // Auto-analyze when "analyze picture" command is detected and image is available
  useEffect(() => {
    // Only auto-analyze if: flag is set, image file exists (required for analysis), not already analyzing, no result yet
    if (shouldAutoAnalyze && imageFile && !isAnalyzing && !analysisResult) {
      console.log("[VoiceAssistant] Auto-analyzing image after command detection");
      // Small delay to ensure image file is fully ready
      const analyzeTimer = setTimeout(() => {
        if (imageFile && !isAnalyzing) {
          analyzeInlineImage().then(() => {
            setShouldAutoAnalyze(false);
          }).catch((err) => {
            console.error("[VoiceAssistant] Error in auto-analyze:", err);
            setShouldAutoAnalyze(false);
          });
        }
      }, 800);
      
      return () => {
        clearTimeout(analyzeTimer);
      };
    }
  }, [shouldAutoAnalyze, imageFile, isAnalyzing, analysisResult, analyzeInlineImage]);

  // Attach stored stream to video element when it becomes available
  useEffect(() => {
    // Only run when camera modal is open in camera mode
    if (!showInlineCamera || inlineCameraMode !== "camera") {
      return;
    }

    // Check if we have a stream to attach
    const stream = inlineStreamRef.current;
    if (!stream) {
      return;
    }

    const video = inlineVideoRef.current;
    if (!video) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1306',message:'Stream exists but video ref not ready, waiting...',data:{hasStream:!!stream,streamId:stream.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'})}).catch(()=>{});
      // #endregion
      return;
    }

    // If video already has srcObject, skip
    if (video.srcObject) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1313',message:'Video already has srcObject, skipping attachment',data:{hasSrcObject:!!video.srcObject},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return;
    }

    // Attach the stored stream to the video element
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1320',message:'Attaching stored stream to video element',data:{streamId:stream.id,streamActive:stream.active,videoReadyState:video.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'})}).catch(()=>{});
    // #endregion
    
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');

    // Try to play
    video.play().then(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1334',message:'Video play() succeeded after stream attachment',data:{videoPaused:video.paused,videoReadyState:video.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setIsCameraActive(true);
    }).catch((err: unknown) => {
      const error = err as Error & { name?: string; message?: string };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1339',message:'Video play() failed after stream attachment',data:{errorName:error?.name,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,F'})}).catch(()=>{});
      // #endregion
      console.warn("[VoiceAssistant] Play failed after stream attachment:", err);
    });
     
  }, [showInlineCamera, inlineCameraMode]);

  // Monitor video element and ensure it's playing when stream is attached
  useEffect(() => {
    if (!showInlineCamera || inlineCameraMode !== "camera" || !inlineStreamRef.current) {
      return;
    }

    const video = inlineVideoRef.current;
    if (!video) return;

    const checkAndPlay = () => {
      if (video.srcObject && video.paused && video.readyState >= 2) {
        console.log("[VoiceAssistant] Video has stream but is paused, attempting to play");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1255',message:'Monitor: video paused with stream, attempting play',data:{videoPaused:video.paused,videoReadyState:video.readyState,hasSrcObject:!!video.srcObject,videoWidth:video.videoWidth,videoHeight:video.videoHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        video.play().catch((err) => {
          console.warn("[VoiceAssistant] Failed to play video in monitor:", err);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/bb6df240-51fe-4dc2-a5e6-f43a10ef3d12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VoiceAssistantTab.tsx:1260',message:'Monitor: play() failed',data:{errorName:err?.name,errorMessage:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,F'})}).catch(()=>{});
          // #endregion
        });
      }
    };

    // Check immediately
    checkAndPlay();

    // Set up interval to check periodically
    const interval = setInterval(() => {
      checkAndPlay();
    }, 500);

    // Listen for video events
    const handleLoadedMetadata = () => {
      console.log("[VoiceAssistant] Video metadata loaded in monitor");
      checkAndPlay();
    };

    const handleCanPlay = () => {
      console.log("[VoiceAssistant] Video can play in monitor");
      checkAndPlay();
    };

    const handlePlay = () => {
      console.log("[VoiceAssistant] Video started playing in monitor");
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);

    return () => {
      clearInterval(interval);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
    };
  }, [showInlineCamera, inlineCameraMode]);

  // Cleanup camera on unmount or when closing
  useEffect(() => {
    if (!showInlineCamera) {
      stopInlineCamera();
      setCapturedImage(null);
      setImageFile(null);
      setAnalysisResult(null);
      setCameraError(null);
      setImageDescription("");
      setShouldAutoAnalyze(false);
    }
    return () => {
      stopInlineCamera();
    };
  }, [showInlineCamera, stopInlineCamera]);

  // Avatar upload handlers
  const _handleAvatarFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Maximum size is 5MB");
      return;
    }

    setAvatarUploadFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setShowAvatarUpload(true);
  }, []);

  const handleAvatarUpload = useCallback(async () => {
    if (!avatarUploadFile) return;

    setIsUploadingAvatar(true);
    try {
      const response = await uploadService.uploadVoiceAssistantAvatar(avatarUploadFile);
      if (response.success && response.data?.publicUrl) {
        setVoiceAssistantAvatarUrl(response.data.publicUrl);
        toast.success("Avatar updated successfully");
        setShowAvatarUpload(false);
        setAvatarUploadFile(null);
        setAvatarPreview(null);
        if (avatarFileInputRef.current) {
          avatarFileInputRef.current.value = "";
        }
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("[VoiceAssistant] Error uploading avatar:", error);
      toast.error("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [avatarUploadFile]);

  const handleCancelAvatarUpload = useCallback(() => {
    setShowAvatarUpload(false);
    setAvatarUploadFile(null);
    setAvatarPreview(null);
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = "";
    }
  }, [setShowAvatarUpload, setAvatarUploadFile, setAvatarPreview]);

  // Process with streaming
  const processWithStream = useCallback(async (text: string) => {
    if (isProcessingRef.current || !text.trim()) return;

    detectMood(text);
    isProcessingRef.current = true;
    setVoiceState("processing");
    setAiResponse("");

    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    processingTimeoutRef.current = setTimeout(() => {
      if (isProcessingRef.current) {
        isProcessingRef.current = false;
        setVoiceState("idle");
        setError("Request timed out. Please try again.");
        if (isConversationActiveRef.current) {
          setTimeout(() => {
            const startRef = startListeningRef.current;
            if (startRef) startRef();
          }, 500);
        }
      }
    }, 30000);

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const requestBody: { message: string; conversationId?: string; callId?: string; sessionType?: string; callPurpose?: string; language?: string } = {
      message: text.trim(),
    };
    if (conversationIdRef.current) {
      requestBody.conversationId = conversationIdRef.current;
    }
    if (callId) {
      requestBody.callId = callId;
    }
    if (sessionType) {
      requestBody.sessionType = sessionType;
    }
    if (callPurpose) {
      requestBody.callPurpose = callPurpose;
    }
    // Add language parameter - extract base language code (e.g., "ur" from "ur-PK")
    if (selectedLanguage) {
      const baseLang = selectedLanguage.split("-")[0];
      requestBody.language = baseLang; // Send base language code (e.g., "ur", "en")
    }

    // Include current camera frame when camera is active (AI can see the user)
    if (isCameraActive && inlineVideoRef.current && inlineCanvasRef.current) {
      const video = inlineVideoRef.current;
      const canvas = inlineCanvasRef.current;
      if (video.readyState >= 2) {
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 640, 480);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const base64Data = dataUrl.split(',')[1];
          if (base64Data) {
            (requestBody as Record<string, unknown>).imageBase64 = base64Data;
          }
        }
      }
    }

    try {
      const response = await fetch(`${API_URL}/rag-chat/message/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let doneHandled = false;

      if (!reader) {
        throw new Error("No response body available");
      }

        while (true) {
          const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
          if (line.trim() === "" || !line.startsWith("data: ")) continue;
            
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.token) {
                  fullResponse += data.token;
                  setAiResponse(fullResponse);
            }
            
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                }
            
                // Handle emotion detection — drive avatar expression + body language
                if (data.emotion) {
                  console.log('[VoiceAssistant] Emotion detected:', data.emotion);
                  avatarRef.current?.setEmotionFromBackend(
                    data.emotion.category || data.emotion,
                    data.emotion.confidence || 80
                  );
                }
            
                // Handle crisis detection
                if (data.crisis || data.emergency) {
                  console.warn('[VoiceAssistant] Crisis detected:', data);
                  // Show emergency resources modal
                  if (data.resources) {
                    setEmergencyResources(data.resources);
                    setShowEmergencyResources(true);
                  }
                }
            
            if (data.done) {
                  doneHandled = true;
                  if (processingTimeoutRef.current) {
                    clearTimeout(processingTimeoutRef.current);
                    processingTimeoutRef.current = null;
                  }

                  // Handle actions from response
                  console.log('[VoiceAssistant] Done event received:', { 
                    hasActions: !!data.actions, 
                    actionsCount: data.actions?.length || 0,
                    actions: data.actions 
                  });
                  
                  if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
                    console.log('[VoiceAssistant] Executing actions:', data.actions);
                    // Execute actions asynchronously
                    executeActionsAsync(data.actions).catch(err => {
                      console.error('[VoiceAssistant] Error executing actions:', err);
                    });
                  } else {
                    // Try to parse actions from the message itself (fallback)
                    const parsedActions = parseActionsFromResponse(fullResponse);
                    if (parsedActions.length > 0) {
                      console.log('[VoiceAssistant] Parsed actions from response:', parsedActions);
                      executeActionsAsync(parsedActions).catch(err => {
                        console.error('[VoiceAssistant] Error executing parsed actions:', err);
                      });
                    }
                  }

              if (isTTSEnabledRef.current) {
                speakResponse(fullResponse);
                  } else {
                    isProcessingRef.current = false;
                    if (isConversationActiveRef.current) {
                      if (!isListeningActiveRef.current) {
                        setTimeout(() => {
                          const startRef = startListeningRef.current;
                          if (startRef) startRef();
                        }, 100);
                      }
                    } else {
                      setVoiceState("idle");
                    }
                  }
              return;
            }
          } catch (_e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }

      if (fullResponse.trim() && !doneHandled) {
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          
          // Try to parse and execute actions from the response (if not already executed)
          try {
            const parsedActions = parseActionsFromResponse(fullResponse);
            if (parsedActions.length > 0) {
              executeActionsAsync(parsedActions);
            }
          } catch (error) {
            console.error('[VoiceAssistant] Error parsing actions from response:', error);
          }
          
          if (isTTSEnabledRef.current) {
            speakResponse(fullResponse);
          } else {
      isProcessingRef.current = false;
            if (isConversationActiveRef.current) {
              if (!isListeningActiveRef.current) {
                setTimeout(() => {
                  const startRef = startListeningRef.current;
                  if (startRef) startRef();
                }, 100);
              }
    } else {
              setVoiceState("idle");
            }
          }
      }
    } catch (err) {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      
      const error = err as Error;
      if (error.name !== "AbortError") {
        let errorMessage = "Connection error. Please try again.";
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          errorMessage = "Network error. Please check your internet connection.";
        } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          errorMessage = "Authentication error. Please refresh the page.";
        } else if (error.message.includes("500") || error.message.includes("Server error")) {
          errorMessage = "Server error. Please try again in a moment.";
        }
        setError(errorMessage);
      isProcessingRef.current = false;
        setVoiceState("idle");
        
      if (isConversationActiveRef.current) {
          setTimeout(() => {
            const startRef = startListeningRef.current;
            if (startRef) startRef();
          }, 1000);
        }
      } else {
        isProcessingRef.current = false;
        setVoiceState("idle");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAuthToken, speakResponse, detectMood, executeActionsAsync, sessionType, callId, isCameraActive]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening, useAssemblyAIFallback]);
  useEffect(() => { speakResponseRef.current = speakResponse; }, [speakResponse]);
  useEffect(() => { processWithStreamRef.current = processWithStream; }, [processWithStream]);

  // Sync voiceState -> 3D avatar state
  useEffect(() => {
    const state = VOICE_STATE_TO_AVATAR_STATE[voiceState] || "idle";
    avatarRef.current?.setState(state);
  }, [voiceState]);

  // AssemblyAI fallback recording functions
  const startAssemblyAIRecording = useCallback(async () => {
    if (isRecordingRef.current || isProcessingRef.current) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeWithAssemblyAI(audioBlob);
        
        // Stop the stream
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
          recordingStreamRef.current = null;
        }
      };

      mediaRecorder.start();
      isRecordingRef.current = true;
      setVoiceState("listening");
      setError(null);
      console.log("[VoiceAssistant] AssemblyAI recording started");
    } catch (error) {
      console.error("[VoiceAssistant] Failed to start AssemblyAI recording:", error);
      setError("Failed to access microphone. Please check permissions.");
      setVoiceState("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _stopAssemblyAIRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setVoiceState("processing");
      console.log("[VoiceAssistant] AssemblyAI recording stopped");
    }
  }, []);

  const transcribeWithAssemblyAI = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      const langCode = selectedLanguage.split('-')[0] || 'en';
      
      const response = await transcriptionService.transcribe(audioFile, {
        languageCode: langCode,
        punctuate: true,
        formatText: true,
      });

      if (response.success && response.data?.text) {
        const transcribedText = response.data.text.trim();
        if (transcribedText.length >= MIN_SPEECH_LENGTH) {
          setTranscript(transcribedText);
          pendingTranscriptRef.current = transcribedText;
          // Process the transcribed text
          if (processWithStreamRef.current) {
            await processWithStreamRef.current(transcribedText);
          }
        } else {
          setError("No speech detected. Please try again.");
          setVoiceState("idle");
        }
      } else {
        throw new Error(response.error?.message || "Transcription failed");
      }
    } catch (error) {
      console.error("[VoiceAssistant] AssemblyAI transcription failed:", error);
      setError(error instanceof Error ? error.message : "Transcription failed. Please try again.");
      setVoiceState("idle");
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedLanguage]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    // Clear session timers
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (sessionCountdownRef.current) {
      clearInterval(sessionCountdownRef.current);
      sessionCountdownRef.current = null;
    }
    setSessionTimeRemaining(null);
    setSessionStartTime(null);
    setIsConversationActive(false);
    isConversationActiveRef.current = false;
    isProcessingRef.current = false;
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    isRestartingRef.current = false;
    
    if (recognitionRef.current) {
      try {
        // Remove handlers to prevent auto-restart
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        isListeningActiveRef.current = false;
      } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    
    // Clean up audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      ttsService.revokeAudioUrl(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    
    window.speechSynthesis.cancel();
    isTTSActiveRef.current = false;
    currentUtteranceRef.current = null;
    isListeningActiveRef.current = false;
    setVoiceState("idle");
  }, []);

  // Stop speaking/TTS function
  const stopSpeaking = useCallback(() => {
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // Stop audio TTS
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      ttsService.revokeAudioUrl(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    
    isTTSActiveRef.current = false;
    isProcessingRef.current = false;
    currentUtteranceRef.current = null;

    // Stop 3D avatar lip-sync
    avatarRef.current?.stopSpeaking();

    setVoiceState("idle");

    // Resume listening after stopping speech
    if (isConversationActiveRef.current) {
      setTimeout(() => {
        if (isConversationActiveRef.current && !isProcessingRef.current && !isTTSActiveRef.current) {
          startListening();
        }
      }, 300);
    }
  }, [startListening]);

  // Fetch personalized greeting from backend
  const fetchGreeting = useCallback(async (overrideSessionType?: string): Promise<string> => {
    try {
      // Extract base language code (e.g., "ur" from "ur-PK")
      const baseLang = selectedLanguage ? selectedLanguage.split("-")[0] : undefined;
      const effectiveSessionType = overrideSessionType || sessionType || undefined;
      const response = await ragChatService.getGreeting(callPurpose || undefined, baseLang, effectiveSessionType);
      return response.greeting;
    } catch (error) {
      console.error("[VoiceAssistant] Error fetching greeting:", error);
      // Fallback to simple greeting in selected language
      const userName = user?.firstName || null;
      const baseLang = selectedLanguage ? selectedLanguage.split("-")[0] : 'en';
      if (baseLang === 'ur') {
        return userName ? `السلام علیکم ${userName}! آپ کیسے ہیں؟` : 'السلام علیکم! آپ کیسے ہیں؟';
      }
      return userName ? `Hey ${userName}! How can I help you today?` : "Hey! How can I help you today?";
    }
  }, [user, callPurpose, selectedLanguage, sessionType]);

  // Toggle conversation
  const toggleConversation = useCallback(async () => {
    if (isConversationActive) {
      stopConversation();
    } else {
      // If no session type selected, show session selector
      if (!sessionType) {
        setShowSessionSelector(true);
        return;
      }

      setIsConversationActive(true);
      isConversationActiveRef.current = true;
      setAiResponse("");
      setTranscript("");
      pendingTranscriptRef.current = "";
      isProcessingRef.current = false;
      isTTSActiveRef.current = false;
      currentUtteranceRef.current = null;

      // Fetch greeting from backend
      const greeting = await fetchGreeting();
      setAiResponse(greeting);

      if (isTTSEnabled) {
        speakResponse(greeting);
      } else {
        setTimeout(() => {
          const startRef = startListeningRef.current;
          if (startRef) startRef();
        }, 500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConversationActive, stopConversation, isTTSEnabled, speakResponse, fetchGreeting, sessionType, startListening]);

  const getStatusText = () => {
    const userName = user?.firstName;
    if (!isConversationActive) {
      if (userName) {
        return `${userName}, ${assistantName} is ready. Tap to start`;
      }
      return `${assistantName} is ready. Tap to start`;
    }
    switch (voiceState) {
      case "listening": return userName ? `Listening, ${userName}...` : "Listening...";
      case "processing": return "Thinking...";
      case "speaking": return "";
      default: return "";
    }
  };

  if (!isSpeechSupported) {
    return (
      <div className="relative w-full h-full bg-slate-950 flex items-center justify-center z-50">
        <div className="text-center px-4">
          <MicOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Voice Not Supported</h2>
          <p className="text-slate-400 mb-6">Please use Chrome, Edge, or Safari.</p>
          <button
            onClick={() => router.push("/dashboard?tab=ai-coach")}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium"
          >
            Use Text Chat
          </button>
        </div>
      </div>
    );
  }


  if (!isSpeechSupported) {
    return (
      <div className="relative w-full h-full flex items-center justify-center z-50" style={{ backgroundColor: "#0B0F14" }}>
        <div className="text-center px-4">
          <MicOff className="w-16 h-16 mx-auto mb-4" style={{ color: "#F87171" }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#E0E0E0" }}>Voice Not Supported</h2>
          <p className="mb-6" style={{ color: "#888" }}>Please use Chrome, Edge, or Safari.</p>
          <button
            onClick={() => router.push("/dashboard?tab=ai-coach")}
            className="px-6 py-3 rounded-xl font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #1DE9B6, #00E5FF)",
              color: "#0B0F14",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Use Text Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full z-50 flex flex-col overflow-hidden" style={{ backgroundColor: "#0B0F14" }}>
      {/* Subtle animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 w-[800px] h-[800px] rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, #00E5FF20 0%, transparent 70%)` }}
          animate={{ x: ["-10%", "10%", "-10%"], y: ["-10%", "20%", "-10%"], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-0 bottom-0 w-[800px] h-[800px] rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, #1DE9B620 0%, transparent 70%)` }}
          animate={{ x: ["10%", "-10%", "10%"], y: ["10%", "-20%", "10%"], scale: [1, 1.3, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        {voiceState === "processing" && (
          <motion.div
            className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
            style={{ background: `radial-gradient(circle, #7C4DFF30 0%, transparent 70%)` }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* Modern Header */}
      <VoiceAssistantHeader
        user={user}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        isTTSEnabled={isTTSEnabled}
        setIsTTSEnabled={setIsTTSEnabled}
        getInitials={getInitials}
        isCallActive={isCallActive}
        onEndCall={handleEndCall}
        showCamera={showInlineCamera}
        onToggleCamera={() => {
          if (showInlineCamera) {
            setShowInlineCamera(false);
          } else {
            setShowInlineCamera(true);
            setInlineCameraMode("camera");
          }
        }}
      />

      {/* Emergency Button - Visible when not in a call */}
      {!showEmergencyResources && !isCallActive && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowEmergencyResources(true)}
          className="absolute top-20 right-4 z-40 p-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-full shadow-2xl border-2 border-red-400/50 hover:border-red-400 transition-all"
        >
          <AlertCircle className="w-6 h-6 text-white" />
        </motion.button>
      )}

      {/* Session Type Indicator */}
      {/* Session Timer Display */}
      {sessionType && isConversationActive && sessionTimeRemaining !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-20 right-4 z-40 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-4 min-w-[160px]"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="p-2 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20"
            >
              <Clock className="w-4 h-4 text-teal-400" />
            </motion.div>
            <div className="flex-1">
              <p className="text-xs text-white/60 mb-0.5">Session Time</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {Math.floor(sessionTimeRemaining / 60000)}:{(Math.floor((sessionTimeRemaining % 60000) / 1000)).toString().padStart(2, '0')}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
              initial={{ width: '100%' }}
              animate={{ 
                width: `${Math.max(0, (sessionTimeRemaining / (SESSION_DURATIONS[sessionType] * 60 * 1000)) * 100)}%` 
              }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}

      {sessionType && isConversationActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20"
        >
          <span className="text-xs text-white/90 font-medium capitalize">
            {sessionType.replace(/_/g, ' ')}
          </span>
        </motion.div>
      )}

      {/* Vision Coaching Toggle - show when camera is active */}
      {isCameraActive && showInlineCamera && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => isVisionActive ? stopVisionCoaching() : startVisionCoaching()}
          className={`absolute top-20 left-4 z-40 p-3 rounded-full shadow-xl border transition-all ${
            isVisionActive
              ? 'bg-gradient-to-r from-teal-600 to-cyan-600 border-teal-400/50 hover:border-teal-400'
              : 'bg-gradient-to-r from-slate-700 to-slate-600 border-white/20 hover:border-white/40'
          }`}
          title={isVisionActive ? 'Stop Vision Coaching' : 'Start Vision Coaching'}
        >
          {isVisionActive ? (
            <Eye className="w-5 h-5 text-white" />
          ) : (
            <EyeOff className="w-5 h-5 text-white/70" />
          )}
        </motion.button>
      )}

      {/* Inline Camera - Top Right */}
      <InlineCameraPanel
        showInlineCamera={showInlineCamera}
        setShowInlineCamera={setShowInlineCamera}
        inlineCameraMode={inlineCameraMode}
        setInlineCameraMode={setInlineCameraMode}
        capturedImage={capturedImage}
        setCapturedImage={setCapturedImage}
        setImageFile={setImageFile}
        imageDescription={imageDescription}
        setImageDescription={setImageDescription}
        analysisResult={analysisResult}
        isAnalyzing={isAnalyzing}
        cameraError={cameraError}
        setCameraError={setCameraError}
        isCameraActive={isCameraActive}
        setIsCameraActive={setIsCameraActive}
        countdown={countdown}
        setShouldAutoCapture={setShouldAutoCapture}
        setCountdown={setCountdown}
        inlineVideoRef={inlineVideoRef}
        inlineCanvasRef={inlineCanvasRef}
        inlineStreamRef={inlineStreamRef}
        inlineFileInputRef={inlineFileInputRef}
        startInlineCamera={startInlineCamera}
        stopInlineCamera={stopInlineCamera}
        captureInlinePhoto={captureInlinePhoto}
        analyzeInlineImage={analyzeInlineImage}
        handleInlineFileChange={handleInlineFileChange}
      />

      {/* Vision Coaching Overlay */}
      {isVisionActive && (
        <VisionCoachingOverlay
          visionState={visionState}
          coaching={visionCoaching}
          isActive={isVisionActive}
          onStop={stopVisionCoaching}
        />
      )}

      {/* Enhanced Network Background with geometric patterns */}
      <EnhancedNetworkBackground
        active={isConversationActive}
        voiceState={voiceState}
      />

      {/* Full-Screen Avatar Canvas — fills entire viewport behind UI */}
      <div className="absolute inset-0 z-[5] cursor-pointer" onClick={toggleConversation}>
        <AvatarLayer
          ref={avatarRef}
          vrmUrl="/models/coach-avatar.vrm"
          autoMapVoiceState
          className="w-full h-full"
        />
      </div>

      {/* Overlay UI — status, loader, errors on top of avatar */}
      <div className="flex-1 flex flex-col items-center justify-end px-3 sm:px-6 pb-16 sm:pb-20 overflow-hidden relative z-10 pointer-events-none">
        <div className="flex flex-col items-center justify-center w-full max-w-4xl py-4 sm:py-6 relative">
          {/* JARVIS Loader - Show when processing */}
          {voiceState === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <JarvisLoader
                text="processing"
                progress={undefined}
                voiceState={voiceState}
                isActive={isConversationActive}
              />
            </div>
          )}

          {/* Spacer to push status text below avatar center */}
          <div className="h-[45vh] sm:h-[50vh] md:h-[48vh]" />

          {/* Status Text - Minimal */}
          {getStatusText() && voiceState !== "processing" && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-base sm:text-lg font-medium mt-6 text-center px-4"
              style={{ color: "#E0E0E0" }}
            >
              {getStatusText()}
            </motion.p>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 backdrop-blur-xl rounded-lg border p-4 pointer-events-auto"
              style={{
                background: "rgba(220, 38, 38, 0.1)",
                borderColor: "rgba(220, 38, 38, 0.3)",
              }}
            >
              <p className="text-sm font-medium text-center" style={{ color: "#F87171" }}>{error}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Context Panel - Shows transcript/response at bottom */}
      <ContextPanel
        transcript={transcript}
        interimTranscript={interimTranscript}
        aiResponse={aiResponse}
        voiceState={voiceState}
        isVisible={!!(transcript || interimTranscript || aiResponse)}
        onSkipSpeaking={stopSpeaking}
      />

      {/* Footer */}
      {/* <VoiceAssistantControls
        isConversationActive={isConversationActive}
        stopConversation={stopConversation}
        userName={userName}
      /> */}

      {/* Image Analysis Modal */}
      <ImageAnalysisModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onAnalysisComplete={handleImageAnalysisComplete}
        mode={imageModalMode}
        conversationId={conversationId || undefined}
      />

      {/* Session Type Selector Modal */}
      <AnimatePresence>
        {showSessionSelector && !isConversationActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowSessionSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
            >
              {/* Animated background gradient */}
              <motion.div
                className="absolute inset-0 opacity-30"
                animate={{
                  backgroundPosition: ['0% 0%', '100% 100%'],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
                style={{
                  background: `linear-gradient(135deg, rgba(29, 233, 182, 0.1), rgba(0, 229, 255, 0.1), rgba(124, 77, 255, 0.1))`,
                  backgroundSize: '200% 200%',
                }}
              />

              {/* Header */}
              <div className="relative flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
                    <Sparkles className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Select Session Type</h2>
                    <p className="text-sm text-white/60 mt-0.5">Choose your preferred coaching session</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSessionSelector(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="relative p-6">
                <SessionTypeSelector
                  selectedType={sessionType || undefined}
                  onSelect={async (type) => {
                    setSessionType(type);
                    setShowSessionSelector(false);
                    
                    // Get session duration in minutes
                    const durationMinutes = SESSION_DURATIONS[type] || 15;
                    const durationMs = durationMinutes * 60 * 1000;
                    
                    // Start conversation with selected session type
                    setIsConversationActive(true);
                    isConversationActiveRef.current = true;
                    setAiResponse("");
                    setTranscript("");
                    pendingTranscriptRef.current = "";
                    isProcessingRef.current = false;
                    isTTSActiveRef.current = false;
                    currentUtteranceRef.current = null;

                    // Set session start time
                    const startTime = new Date();
                    setSessionStartTime(startTime);
                    setSessionTimeRemaining(durationMs);

                    // Clear any existing timers
                    if (sessionTimerRef.current) {
                      clearTimeout(sessionTimerRef.current);
                    }
                    if (sessionCountdownRef.current) {
                      clearInterval(sessionCountdownRef.current);
                    }

                    // Start countdown timer (update every second)
                    sessionCountdownRef.current = setInterval(() => {
                      setSessionTimeRemaining((prev) => {
                        if (prev === null || prev <= 1000) {
                          return 0;
                        }
                        return prev - 1000;
                      });
                    }, 1000);

                    // Auto-close timer
                    sessionTimerRef.current = setTimeout(() => {
                      // Stop conversation
                      stopConversation();
                      
                      // Clear timers
                      if (sessionCountdownRef.current) {
                        clearInterval(sessionCountdownRef.current);
                      }
                      setSessionTimeRemaining(null);
                      setSessionStartTime(null);
                      
                      // Show completion message
                      toast.success(`Session completed! Duration: ${durationMinutes} minutes`);
                    }, durationMs);

                    // Fetch greeting from backend (pass type directly to avoid stale-closure)
                    const greeting = await fetchGreeting(type);
                    setAiResponse(greeting);

                    if (isTTSEnabled) {
                      speakResponse(greeting);
                    } else {
                      setTimeout(() => {
                        startListening();
                      }, 500);
                    }
                  }}
                  showEmergency={true}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Resources Modal */}
      <EmergencyResources
        isOpen={showEmergencyResources}
        onClose={() => setShowEmergencyResources(false)}
        resources={emergencyResources}
      />

      {/* Avatar Upload Modal */}
      <AnimatePresence>
        {showAvatarUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancelAvatarUpload}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Upload Avatar</h3>
                <button
                  onClick={handleCancelAvatarUpload}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {avatarPreview && (
                <div className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-xl"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancelAvatarUpload}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAvatarUpload}
                  disabled={isUploadingAvatar || !avatarUploadFile}
                  className="flex-1 px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploadingAvatar ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
