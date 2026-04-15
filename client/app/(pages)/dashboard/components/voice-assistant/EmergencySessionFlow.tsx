"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Heart,
  Shield,
  Phone,
  MessageCircle,

  ExternalLink,
} from "lucide-react";

// Session phases for Emergency Support (15 minutes)
const PHASES = [
  { id: "immediate_acknowledgment", label: "Acknowledgment", duration: 30, icon: Heart, description: "Immediate acknowledgment and safety check" },
  { id: "active_listening", label: "Active Listening", duration: 180, icon: MessageCircle, description: "Full attention and validation" },
  { id: "emotional_validation", label: "Emotional Validation", duration: 120, icon: Shield, description: "Acknowledge and validate feelings" },
  { id: "immediate_coping", label: "Coping Strategies", duration: 240, icon: Heart, description: "Immediate coping techniques" },
  { id: "resource_provision", label: "Resources", duration: 180, icon: Phone, description: "Provide crisis resources" },
  { id: "follow_up", label: "Follow-Up", duration: 150, icon: CheckCircle2, description: "Schedule check-in" },
] as const;

type Phase = typeof PHASES[number]["id"];

interface EmergencyResource {
  name: string;
  phone: string;
  description: string;
  available: string;
}

const CRISIS_RESOURCES: EmergencyResource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    phone: "988",
    description: "Free, confidential support 24/7",
    available: "24/7",
  },
  {
    name: "Crisis Text Line",
    phone: "Text HOME to 741741",
    description: "Text-based crisis support",
    available: "24/7",
  },
  {
    name: "SAMHSA National Helpline",
    phone: "1-800-662-4357",
    description: "Mental health referrals",
    available: "24/7",
  },
];

interface EmergencySessionFlowProps {
  isActive: boolean;
  onPhaseChange?: (phase: Phase, phaseIndex: number) => void;
  onComplete?: () => void;
  onEscalate?: () => void;
  onScheduleFollowUp?: () => void;
}

export function EmergencySessionFlow({
  isActive,
  onPhaseChange,
  onComplete,
  onEscalate,
  onScheduleFollowUp,
}: EmergencySessionFlowProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [_phaseTimeElapsed, setPhaseTimeElapsed] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [showResources, setShowResources] = useState(false);
  const resourcesShownRef = useRef(false);

  const currentPhase = PHASES[currentPhaseIndex];

  // Timer effect
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setPhaseTimeElapsed((prev) => prev + 1);
      setTotalTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  // Show resources when reaching resource provision phase
  useEffect(() => {
    if (currentPhase.id === "resource_provision" && !resourcesShownRef.current) {
      resourcesShownRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowResources(true);
    }
  }, [currentPhase.id]);

  // Manual phase advancement (emergency sessions should be user-controlled)
  const advancePhase = useCallback(() => {
    if (currentPhaseIndex < PHASES.length - 1) {
      const nextIndex = currentPhaseIndex + 1;
      setCurrentPhaseIndex(nextIndex);
      setPhaseTimeElapsed(0);
      onPhaseChange?.(PHASES[nextIndex].id, nextIndex);
    } else {
      onComplete?.();
    }
  }, [currentPhaseIndex, onPhaseChange, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-r from-red-500/20 to-orange-500/10 backdrop-blur-xl rounded-xl border-2 border-red-500/30 p-4"
    >
      {/* Emergency Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-10 h-10 rounded-lg bg-red-500/30 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </motion.div>
          <div>
            <h4 className="text-sm font-semibold text-white">Emergency Support</h4>
            <p className="text-xs text-red-300">Priority session - Take your time</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-white">{formatTime(totalTimeElapsed)}</p>
          <button
            onClick={onEscalate}
            className="text-xs text-red-400 hover:text-red-300 underline transition-colors"
          >
            Escalate to Human
          </button>
        </div>
      </div>

      {/* Safety Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10"
      >
        <p className="text-xs text-white/80 text-center">
          You are not alone. Your safety and wellbeing are our priority.
        </p>
      </motion.div>

      {/* Phase Progress - Visual */}
      <div className="mb-4 flex gap-1">
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;

          return (
            <div
              key={phase.id}
              className={`flex-1 h-2 rounded-full transition-all ${
                isCompleted
                  ? "bg-green-500"
                  : isCurrent
                  ? "bg-red-500"
                  : "bg-white/20"
              }`}
              title={phase.label}
            />
          );
        })}
      </div>

      {/* Current Phase */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhase.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="p-4 bg-white/5 rounded-lg mb-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              {(() => {
                const Icon = currentPhase.icon;
                return <Icon className="w-5 h-5 text-red-400" />;
              })()}
            </div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-white mb-1">{currentPhase.label}</h5>
              <p className="text-xs text-white/60 mb-3">{currentPhase.description}</p>
              <button
                onClick={advancePhase}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {currentPhaseIndex < PHASES.length - 1 ? "Continue to next step →" : "Complete session"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Crisis Resources */}
      <AnimatePresence>
        {showResources && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <p className="text-xs font-medium text-white/80 mb-2">Crisis Resources</p>
            {CRISIS_RESOURCES.map((resource, index) => (
              <motion.a
                key={resource.name}
                href={`tel:${resource.phone.replace(/\D/g, "")}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="block p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{resource.name}</p>
                    <p className="text-xs text-white/60">{resource.description}</p>
                    <p className="text-xs text-red-400 font-medium mt-1">{resource.phone}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                </div>
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Follow-up Scheduling */}
      {currentPhase.id === "follow_up" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
        >
          <p className="text-xs text-green-300 text-center mb-2">
            Would you like to schedule a follow-up check-in?
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={onScheduleFollowUp}
              className="px-4 py-2 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Schedule for Tomorrow
            </button>
            <button
              onClick={onComplete}
              className="px-4 py-2 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default EmergencySessionFlow;

