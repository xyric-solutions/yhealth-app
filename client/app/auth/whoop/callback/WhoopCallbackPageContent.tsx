'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function WhoopCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const { mutate: completeOAuth, isSuccess, isError } = useApiMutation({
    onSuccess: () => {
      // Redirect to WHOOP dashboard after a short delay
      setTimeout(() => {
        router.push('/whoop');
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || 'Failed to complete WHOOP connection');
    },
  });

  // Use ref to ensure we only call once
  const hasCalledRef = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Prevent multiple calls
    if (hasCalledRef.current || isProcessingRef.current) {
      return;
    }

    // Handle OAuth error from WHOOP
    if (errorParam) {
      const errorMessage = errorDescription || errorParam || 'Authorization was denied or failed';
      setError(errorMessage);
      hasCalledRef.current = true;
      return;
    }

    // Validate required parameters
    if (!code) {
      setError('Authorization code not found in callback URL');
      hasCalledRef.current = true;
      return;
    }

    if (!state) {
      setError('State parameter not found in callback URL');
      hasCalledRef.current = true;
      return;
    }

    // Mark as processing to prevent duplicate calls
    isProcessingRef.current = true;
    hasCalledRef.current = true;

    // Complete OAuth flow by exchanging code for tokens
    completeOAuth('/integrations/oauth/complete', {
      provider: 'whoop',
      code,
      state,
    }).finally(() => {
      isProcessingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state, errorParam, errorDescription]); // Removed completeOAuth from deps

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl bg-red-500/10 border border-red-500/20 p-8 text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-2">Connection Failed</h1>
          <p className="text-red-300/70 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push('/whoop')}
              variant="outline"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
            >
              Go to WHOOP Dashboard
            </Button>
            <Button
              onClick={() => router.push('/settings?tab=integrations')}
              variant="outline"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
            >
              Go to Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl bg-green-500/10 border border-green-500/20 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4 animate-in fade-in duration-500" />
          <h1 className="text-2xl font-bold text-green-400 mb-2">Successfully Connected!</h1>
          <p className="text-green-300/70 mb-6">
            Your WHOOP account has been connected. Redirecting to dashboard...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-green-400 mx-auto" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl bg-red-500/10 border border-red-500/20 p-8 text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-2">Connection Failed</h1>
          <p className="text-red-300/70 mb-6">
            {error || 'Failed to complete WHOOP connection. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push('/whoop')}
              variant="outline"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
            >
              Go to WHOOP Dashboard
            </Button>
            <Button
              onClick={() => router.push('/settings?tab=integrations')}
              variant="outline"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
            >
              Go to Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-xl bg-white/5 border border-white/10 p-8 text-center">
        <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
        <h1 className="text-2xl font-bold text-white mb-2">Connecting to WHOOP</h1>
        <p className="text-slate-400 mb-6">
          Please wait while we complete the connection...
        </p>
      </div>
    </div>
  );
}

export default function WhoopCallbackPageContent() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl bg-white/5 border border-white/10 p-8 text-center">
            <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-white mb-2">Loading...</h1>
            <p className="text-slate-400 mb-6">Please wait...</p>
          </div>
        </div>
      }
    >
      <WhoopCallbackContent />
    </Suspense>
  );
}

