"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, History, Loader2, Sparkles, MessageCircle, Target, Zap, TrendingUp } from "lucide-react";
import { CallCoachButton } from "../CallCoachButton";
import { CallHistory } from "../CallHistory";
import { CallPurposeSelector } from "../voice-assistant/CallPurposeSelector";
import { voiceCallService, type VoiceCall, type CallPurpose } from "@/src/shared/services/voice-call.service";
import { toast } from "react-hot-toast";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";

export function VoiceCallTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<VoiceCall | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPurposeSelector, setShowPurposeSelector] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState<CallPurpose | null>(null);
  
  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };
  
  const userName = user?.firstName || "there";
  const greeting = getGreeting();

  // Check for active call on mount and poll for status updates
  useEffect(() => {
    checkActiveCall();
    
    // Poll for call status updates every 3 seconds if there's an active call
    const pollInterval = setInterval(() => {
      if (activeCall && (activeCall.status === "initiating" || activeCall.status === "connecting" || activeCall.status === "ringing")) {
        voiceCallService.getCall(activeCall.id)
          .then((response) => {
            if (response.success && response.data) {
              const updatedCall = response.data;
              setActiveCall(updatedCall);
              
              // If call is now active, stop polling (user has navigated to voice assistant)
              if (updatedCall.status === "active") {
                console.log("[VoiceCallTab] Call is now active, stopping polling");
                // Don't clear activeCall, just stop polling
              }
              
              // If call ended or failed, stop polling and clear active call
              if (updatedCall.status === "ended" || updatedCall.status === "failed" || updatedCall.status === "cancelled") {
                setActiveCall(null);
              }
            }
          })
          .catch((error) => {
            console.error("Failed to poll call status:", error);
          });
      } else if (activeCall && activeCall.status === "active") {
        // Call is active, stop polling
        clearInterval(pollInterval);
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.id, activeCall?.status]); // Include status in dependencies

  const checkActiveCall = async () => {
    try {
      setIsLoading(true);
      // Check if there's an active call
      const response = await voiceCallService.getHistory({ page: 1, limit: 1 });
      if (response.success) {
        // Paginated response: data is the array
        const callsArray = Array.isArray(response.data) ? response.data : [];
        if (callsArray.length > 0) {
          const latestCall = callsArray[0];
          if (latestCall.status === "ringing" || latestCall.status === "active" || latestCall.status === "connecting" || latestCall.status === "initiating") {
            setActiveCall(latestCall);
          }
        }
      }
    } catch (error) {
      console.error("Failed to check active call:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallInitiated = (callId: string) => {
    // Fetch the call details to get the full VoiceCall object
    voiceCallService.getCall(callId)
      .then((response) => {
        if (response.success && response.data) {
          setActiveCall(response.data);
          setShowPurposeSelector(false);
          setSelectedPurpose(null);
          toast.success("Call connecting...");
        }
      })
      .catch((error) => {
        console.error("Failed to fetch call details:", error);
        toast.error("Call initiated but failed to load details");
      });
  };

  const handleCallPurposeSelected = async (purpose: CallPurpose | null) => {
    setSelectedPurpose(purpose);
    setShowPurposeSelector(false);
    
    // Initiate call with selected purpose
    if (!user) {
      toast.error("Please sign in to call your coach");
      return;
    }

    try {
      const response = await voiceCallService.initiate({
        channel: "mobile_app",
        call_purpose: purpose || undefined,
      });

      if (response.success && response.data) {
        const callId = response.data.callId;
        handleCallInitiated(callId);
        // Navigate directly to Voice Assistant page
        toast.success("Connecting to AI Coach...");
        // Navigate to voice-assistant page with callId and purpose
        const params = new URLSearchParams();
        params.set("callId", callId);
        if (purpose) {
          params.set("purpose", purpose);
        }
        router.push(`/voice-assistant?${params.toString()}`);
        console.log("[VoiceCallTab] Navigating to voice-assistant with callId:", callId, "purpose:", purpose);
      } else {
        throw new Error(response.error?.message || "Failed to initiate call");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start call. Please try again.";
      toast.error(errorMessage);
      setSelectedPurpose(null);
    }
  };

  const handleCallEnded = async () => {
    if (!activeCall) return;
    
    try {
      await voiceCallService.endCall(activeCall.id);
      setActiveCall(null);
      toast.success("Call ended");
    } catch (error) {
      console.error("Failed to end call:", error);
      toast.error(error instanceof Error ? error.message : "Failed to end call");
      // Still clear the UI even if API call fails
      setActiveCall(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 -left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 p-3 sm:p-4 md:p-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-bold mb-0.5 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent"
              style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}
            >
              {greeting}, {userName}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-400"
              style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}
            >
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-slate-300 mt-0.5"
              style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}
            >
              Start a voice call with your AI health coach for real-time guidance
            </motion.p>
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl transition-all text-white"
          >
            <History className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="font-medium" style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}>{showHistory ? "Hide" : "Show"} History</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeCall ? (
            <motion.div
              key="active-call"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-2xl sm:rounded-3xl border-2 border-blue-500/30 backdrop-blur-2xl p-4 sm:p-6 md:p-8 text-center shadow-2xl relative overflow-hidden">
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-blue-500 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-purple-500 rounded-full blur-3xl" />
                </div>
                
                <div className="relative z-10">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-3 sm:mb-4 md:mb-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl relative"
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 animate-pulse opacity-75" />
                    <Phone className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white relative z-10" />
                  </motion.div>
                  
                  <h2 className="font-bold mb-2 sm:mb-3 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}>
                    Call in Progress
                  </h2>
                  <p className="text-slate-300 mb-4 sm:mb-6" style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}>
                    Status: <span className="capitalize font-semibold text-blue-400">{activeCall.status}</span>
                  </p>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCallEnded}
                    className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl sm:rounded-2xl font-semibold flex items-center gap-2 sm:gap-3 mx-auto shadow-xl transition-all"
                    style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}
                  >
                    <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>End Call</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="call-ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8"
            >
              {/* Main Call Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-slate-900/90 via-indigo-900/50 to-slate-900/90 rounded-2xl sm:rounded-3xl border-2 border-purple-500/20 backdrop-blur-2xl p-4 sm:p-6 md:p-8 lg:p-12 text-center shadow-2xl relative overflow-hidden">
                  {/* Animated gradient orbs */}
                  <div className="absolute top-0 left-1/4 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-72 lg:h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute bottom-0 right-1/4 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-72 lg:h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                  
                  <div className="relative z-10">
                    {/* Phone Icon with Animation */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="relative mx-auto mb-4 sm:mb-6 md:mb-8"
                    >
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 mx-auto">
                        {/* Outer glow rings */}
                        <motion.div
                          className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.8, 0.5],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                        <motion.div
                          className="absolute inset-2 sm:inset-3 md:inset-4 rounded-full bg-gradient-to-br from-purple-500/40 to-pink-500/40"
                          animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.4, 0.7, 0.4],
                          }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.5,
                          }}
                        />
                        
                        {/* Main icon container */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
                          <motion.div
                            animate={{
                              rotate: [0, 5, -5, 0],
                            }}
                            transition={{
                              duration: 4,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          >
                            <Phone className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white drop-shadow-2xl" />
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Title and Description */}
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="font-bold mb-2 sm:mb-3 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent"
                      style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}
                    >
                      Ready to Call Your Coach?
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-slate-300 mb-4 sm:mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed px-2"
                      style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}
                    >
                      Start a voice call with your AI health coach for personalized guidance,
                      motivation, and real-time support. Get instant advice tailored to your goals.
                    </motion.p>

                    {/* Call Button - Centered */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex justify-center"
                    >
                      <CallCoachButton
                        size="lg"
                        channel="mobile_app"
                        callPurpose={selectedPurpose || undefined}
                        onCallInitiated={() => setShowPurposeSelector(true)}
                      />
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* Feature Cards */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
              >
                {[
                  {
                    title: "Real-time Guidance",
                    description: "Get instant advice and support from your AI coach",
                    icon: MessageCircle,
                    gradient: "from-blue-500/20 to-cyan-500/20",
                    borderColor: "border-blue-500/30",
                    iconColor: "text-blue-400",
                  },
                  {
                    title: "Voice Interaction",
                    description: "Natural conversation through voice calls",
                    icon: Sparkles,
                    gradient: "from-purple-500/20 to-pink-500/20",
                    borderColor: "border-purple-500/30",
                    iconColor: "text-purple-400",
                  },
                  {
                    title: "Personalized Support",
                    description: "Tailored coaching based on your health goals",
                    icon: Target,
                    gradient: "from-emerald-500/20 to-teal-500/20",
                    borderColor: "border-emerald-500/30",
                    iconColor: "text-emerald-400",
                  },
                ].map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      className={`bg-gradient-to-br ${feature.gradient} rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border-2 ${feature.borderColor} backdrop-blur-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer`}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${feature.gradient} border ${feature.borderColor} flex items-center justify-center mb-2 sm:mb-3 md:mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 ${feature.iconColor}`} />
                      </div>
                      <h3 className="font-bold mb-1 sm:mb-2 text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-200 group-hover:bg-clip-text transition-all" style={{ fontSize: 'clamp(11px, 2.2vw, 13px)' }}>
                        {feature.title}
                      </h3>
                      <p className="text-slate-300 leading-relaxed" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>
                        {feature.description}
                      </p>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Additional Info Cards */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6"
              >
                <div className="bg-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-white/10 backdrop-blur-xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    </div>
                    <h4 className="font-semibold text-white" style={{ fontSize: 'clamp(11px, 2.2vw, 13px)' }}>Quick Connect</h4>
                  </div>
                  <p className="text-slate-400" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>
                    Connect instantly with your AI coach in seconds
                  </p>
                </div>
                
                <div className="bg-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-white/10 backdrop-blur-xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    </div>
                    <h4 className="font-semibold text-white" style={{ fontSize: 'clamp(11px, 2.2vw, 13px)' }}>Track Progress</h4>
                  </div>
                  <p className="text-slate-400" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>
                    Monitor your health journey with detailed insights
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Call History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 sm:mt-12"
            >
              <CallHistory />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Purpose Selector Modal */}
      <AnimatePresence>
        {showPurposeSelector && (
          <CallPurposeSelector
            selectedPurpose={selectedPurpose}
            onSelect={handleCallPurposeSelected}
            onClose={() => setShowPurposeSelector(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

