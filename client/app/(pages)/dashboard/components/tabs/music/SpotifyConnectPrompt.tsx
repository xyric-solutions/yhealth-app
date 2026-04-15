"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2, Music2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface SpotifyConnectPromptProps {
  isConfigured: boolean;
  hasJamendoFallback?: boolean;
}

export function SpotifyConnectPrompt({ isConfigured, hasJamendoFallback }: SpotifyConnectPromptProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await api.post<{ authUrl: string }>("/spotify/auth/connect", {});
      if (response.success && response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else {
        toast.error("Failed to initiate Spotify connection");
      }
    } catch {
      toast.error("Failed to connect Spotify");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900/20 via-slate-900/40 to-emerald-900/10 border border-green-500/10 p-6 sm:p-8"
    >
      {/* Background glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/[0.06] rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/[0.04] rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mb-5 border border-green-500/20 shadow-lg shadow-green-500/10"
        >
          <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </motion.div>

        <h3 className="text-lg font-bold text-white mb-1.5">
          Connect Spotify
        </h3>
        <p className="text-sm text-slate-400 max-w-sm mb-5 leading-relaxed">
          Link your Spotify for personalized playlists, full playback, and AI-matched music for your activities.
        </p>

        {isConfigured ? (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-shadow disabled:opacity-50 text-sm"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Music2 className="w-4 h-4" />
            )}
            Connect Spotify
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        ) : (
          <div className="text-xs text-yellow-400/80 bg-yellow-500/[0.08] border border-yellow-500/15 rounded-xl px-4 py-2.5 font-medium">
            Spotify integration requires server configuration
          </div>
        )}

        <p className="text-[11px] text-slate-600 mt-4 max-w-xs">
          {hasJamendoFallback
            ? "Free CC-licensed music is available below \u2014 connect Spotify for your personal library"
            : "You can still browse curated playlists without connecting"}
        </p>
      </div>
    </motion.div>
  );
}
