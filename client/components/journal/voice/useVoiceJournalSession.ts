/**
 * @file useVoiceJournalSession Hook
 * @description Manages voice journal session API state and conversation flow
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { voiceJournalService } from "@/src/shared/services/wellbeing.service";
import type {
  VoiceJournalSession,
  VoiceJournalTranscriptEntry,
  VoiceJournalSummary,
} from "@shared/types/domain/wellbeing";

export type SessionPhase =
  | "idle"
  | "starting"
  | "conversation"
  | "processing_turn"
  | "summarizing"
  | "reviewing"
  | "saving"
  | "saved"
  | "error";

interface UseVoiceJournalSessionReturn {
  phase: SessionPhase;
  session: VoiceJournalSession | null;
  transcript: VoiceJournalTranscriptEntry[];
  summary: VoiceJournalSummary | null;
  readyToSummarize: boolean;
  error: string | null;
  journalEntryId: string | null;
  startSession: () => Promise<void>;
  submitVoiceTurn: (audioBlob: Blob) => Promise<void>;
  submitTextTurn: (text: string) => Promise<void>;
  requestSummary: () => Promise<void>;
  approveAndSave: (editedText?: string) => Promise<void>;
  abandonSession: () => Promise<void>;
  clearError: () => void;
}

export function useVoiceJournalSession(): UseVoiceJournalSessionReturn {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [session, setSession] = useState<VoiceJournalSession | null>(null);
  const [transcript, setTranscript] = useState<VoiceJournalTranscriptEntry[]>([]);
  const [summary, setSummary] = useState<VoiceJournalSummary | null>(null);
  const [readyToSummarize, setReadyToSummarize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);

  // Check for existing active session on mount
  useEffect(() => {
    voiceJournalService.getActiveSession().then((res) => {
      if (res.success && res.data?.session) {
        const s = res.data.session;
        setSession(s);
        setTranscript(s.transcript);
        if (s.status === "review") {
          setSummary({
            mood: s.summaryMood || "neutral",
            themes: s.summaryThemes || [],
            lessons: s.summaryLessons || [],
            actionItems: s.summaryActionItems || [],
            journalText: s.summaryText || "",
          });
          setPhase("reviewing");
        } else {
          setPhase("conversation");
          setReadyToSummarize(s.exchangeCount >= 3);
        }
      }
    }).catch(() => {});
  }, []);

  const startSession = useCallback(async () => {
    setPhase("starting");
    setError(null);
    try {
      const res = await voiceJournalService.startSession();
      if (res.success && res.data?.session) {
        setSession(res.data.session);
        setTranscript([]);
        setSummary(null);
        setReadyToSummarize(false);
        setJournalEntryId(null);
        setPhase("conversation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setPhase("error");
    }
  }, []);

  const submitVoiceTurn = useCallback(async (audioBlob: Blob) => {
    if (!session) return;
    setPhase("processing_turn");
    setError(null);
    try {
      const res = await voiceJournalService.submitVoiceTurn(session.id, audioBlob);
      if (res.success && res.data) {
        const userEntry: VoiceJournalTranscriptEntry = {
          role: "user",
          text: res.data.userTranscript,
          timestamp: new Date().toISOString(),
        };
        const aiEntry: VoiceJournalTranscriptEntry = {
          role: "ai",
          text: res.data.aiResponse,
          timestamp: new Date().toISOString(),
        };
        setTranscript((prev) => [...prev, userEntry, aiEntry]);
        setReadyToSummarize(res.data.readyToSummarize);
        setPhase("conversation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process voice");
      setPhase("conversation");
    }
  }, [session]);

  const submitTextTurn = useCallback(async (text: string) => {
    if (!session) return;
    setPhase("processing_turn");
    setError(null);
    try {
      const res = await voiceJournalService.submitTextTurn(session.id, text);
      if (res.success && res.data) {
        const userEntry: VoiceJournalTranscriptEntry = {
          role: "user",
          text: res.data.userTranscript,
          timestamp: new Date().toISOString(),
        };
        const aiEntry: VoiceJournalTranscriptEntry = {
          role: "ai",
          text: res.data.aiResponse,
          timestamp: new Date().toISOString(),
        };
        setTranscript((prev) => [...prev, userEntry, aiEntry]);
        setReadyToSummarize(res.data.readyToSummarize);
        setPhase("conversation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process message");
      setPhase("conversation");
    }
  }, [session]);

  const requestSummary = useCallback(async () => {
    if (!session) return;
    setPhase("summarizing");
    setError(null);
    try {
      const res = await voiceJournalService.generateSummary(session.id);
      if (res.success && res.data?.summary) {
        setSummary(res.data.summary);
        setPhase("reviewing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
      setPhase("conversation");
    }
  }, [session]);

  const approveAndSave = useCallback(async (editedText?: string) => {
    if (!session) return;
    setPhase("saving");
    setError(null);
    try {
      const res = await voiceJournalService.approveAndSave(session.id, editedText);
      if (res.success && res.data) {
        setJournalEntryId(res.data.journalEntryId);
        setPhase("saved");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
      setPhase("reviewing");
    }
  }, [session]);

  const abandonSession = useCallback(async () => {
    if (!session) return;
    try {
      await voiceJournalService.abandonSession(session.id);
    } catch {
      // Best effort
    }
    setSession(null);
    setTranscript([]);
    setSummary(null);
    setReadyToSummarize(false);
    setPhase("idle");
  }, [session]);

  const clearError = useCallback(() => setError(null), []);

  return {
    phase,
    session,
    transcript,
    summary,
    readyToSummarize,
    error,
    journalEntryId,
    startSession,
    submitVoiceTurn,
    submitTextTurn,
    requestSummary,
    approveAndSave,
    abandonSession,
    clearError,
  };
}
