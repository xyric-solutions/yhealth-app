/**
 * @file VoiceJournalSession Component
 * @description Main orchestrator: idle → recording → transcribing → AI responding → loop → reviewing → saved
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Keyboard, Sparkles, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceRecordButton } from "./VoiceRecordButton";
import { ConversationTranscript } from "./ConversationTranscript";
import { VoiceJournalSummaryView } from "./VoiceJournalSummary";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVoiceJournalSession } from "./useVoiceJournalSession";

interface VoiceJournalSessionProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function VoiceJournalSession({ onComplete, onCancel }: VoiceJournalSessionProps) {
  const recorder = useVoiceRecorder();
  const session = useVoiceJournalSession();
  const [textInput, setTextInput] = useState("");
  const [useTextMode, setUseTextMode] = useState(false);

  // Auto-start session on mount if idle
  useEffect(() => {
    if (session.phase === "idle") {
      session.startSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit voice when recording stops
  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob && session.phase === "conversation") {
      session.submitVoiceTurn(recorder.audioBlob);
      recorder.resetRecording();
    }
  }, [recorder.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to text mode if mic is denied
  useEffect(() => {
    if (recorder.permission === "denied" || recorder.permission === "unsupported") {
      setUseTextMode(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [recorder.permission]);

  const handleTextSubmit = useCallback(() => {
    if (textInput.trim() && session.phase === "conversation") {
      session.submitTextTurn(textInput.trim());
      setTextInput("");
    }
  }, [textInput, session]);

  // Saved state
  if (session.phase === "saved") {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-12 space-y-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Check className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-lg font-semibold text-white">Journal entry saved!</h3>
        <p className="text-sm text-slate-400">Your voice conversation has been captured.</p>
        <Button
          onClick={onComplete}
          variant="ghost"
          className="text-emerald-400 hover:text-emerald-300"
        >
          Done
        </Button>
      </motion.div>
    );
  }

  // Review/summary state
  if ((session.phase === "reviewing" || session.phase === "saving") && session.summary) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium">Review Summary</span>
        </div>
        <VoiceJournalSummaryView
          summary={session.summary}
          isSaving={session.phase === "saving"}
          onApprove={session.approveAndSave}
          onDiscard={session.abandonSession}
        />
      </div>
    );
  }

  // Starting / Loading
  if (session.phase === "starting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-slate-400">Starting voice journal...</p>
      </div>
    );
  }

  // Summarizing
  if (session.phase === "summarizing") {
    return (
      <div className="space-y-6">
        <ConversationTranscript transcript={session.transcript} />
        <div className="flex flex-col items-center py-8 space-y-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Generating your journal summary...</p>
        </div>
      </div>
    );
  }

  const isProcessing = session.phase === "processing_turn";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-400">
          <Mic className="w-5 h-5" />
          <span className="text-sm font-medium">Voice Journal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseTextMode(!useTextMode)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            {useTextMode ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
            {useTextMode ? "Voice" : "Text"}
          </button>
        </div>
      </div>

      {/* Error */}
      {session.error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{session.error}</p>
          <button onClick={session.clearError} className="text-red-400 hover:text-red-300 ml-auto text-xs">
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Conversation */}
      <ConversationTranscript
        transcript={session.transcript}
        isProcessing={isProcessing}
      />

      {/* Input area */}
      <div className="space-y-3">
        {useTextMode ? (
          <div className="flex gap-2">
            <Input
              placeholder="Type your thoughts..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              disabled={isProcessing}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
            >
              Send
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <VoiceRecordButton
              state={recorder.state}
              onStart={recorder.startRecording}
              onStop={recorder.stopRecording}
              disabled={isProcessing}
            />
          </div>
        )}

        {/* Summary button */}
        {session.readyToSummarize && session.transcript.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <Button
              onClick={session.requestSummary}
              disabled={isProcessing}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Summary
            </Button>
          </motion.div>
        )}
      </div>

      {/* Cancel */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => {
            session.abandonSession();
            onCancel?.();
          }}
          className="text-slate-500 hover:text-slate-300 text-xs"
        >
          Cancel & discard
        </Button>
      </div>
    </div>
  );
}
