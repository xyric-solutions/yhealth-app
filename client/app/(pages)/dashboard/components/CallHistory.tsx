"use client";

import { useState, useEffect } from "react";
import { Phone, Calendar, Clock, AlertCircle } from "lucide-react";
import { voiceCallService, type VoiceCall, type CallChannel } from "@/src/shared/services/voice-call.service";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function CallHistory() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadCalls = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await voiceCallService.getHistory({ page, limit: 20 });
      if (response.success) {
        // Paginated response: data is the array, meta contains pagination info
        const callsArray = Array.isArray(response.data) ? response.data : [];
        setCalls(callsArray);
        setTotalPages(response.meta?.totalPages || 1);
      } else {
        throw new Error(response.error?.message || "Failed to load call history");
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : null) || "Failed to load call history");
      setCalls([]); // Ensure calls is always an array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStatusColor = (status: VoiceCall["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "ended":
        return "bg-gray-500";
      case "failed":
      case "timeout":
        return "bg-red-500";
      case "initiating":
      case "connecting":
      case "ringing":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getChannelLabel = (channel: CallChannel) => {
    switch (channel) {
      case "mobile_app":
        return "Mobile App";
      case "whatsapp":
        return "WhatsApp";
      case "widget":
        return "Widget";
      default:
        return channel;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading && (!calls || calls.length === 0)) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-red-500 mb-4">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Button onClick={loadCalls} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!calls || calls.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Phone className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            No call history yet. Start your first call to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {(calls || []).map((call) => (
        <Card key={call.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="w-5 h-5" />
                {getChannelLabel(call.channel)}
              </CardTitle>
              <Badge className={getStatusColor(call.status)}>
                {call.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(call.initiated_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  {formatDistanceToNow(new Date(call.initiated_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>

              {call.call_duration && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Duration: {formatDuration(call.call_duration)}</span>
                </div>
              )}

              {call.call_summary && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {call.call_summary}
                  </p>
                </div>
              )}

              {call.error_message && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                  {call.error_message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

