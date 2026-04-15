/**
 * Simple logger for WebRTC client
 */

export const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log("[VoiceCallClient]", ...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error("[VoiceCallClient]", ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn("[VoiceCallClient]", ...args);
  },
};

