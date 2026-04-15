"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

function VerifyContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") ?? null;
  const token = searchParams?.get("token") ?? null;
  const { verifyEmail, resendVerification, isLoading } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (token) {
      verifyEmail({ token }).then((success) => {
        if (success) setIsVerified(true);
      });
    }
  }, [token, verifyEmail]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (email && countdown === 0) {
      const success = await resendVerification(email);
      if (success) {
        setCountdown(60);
      }
    }
  };

  if (isVerified) {
    return (
      <div className="space-y-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
        >
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold">Email Verified!</h1>
          <p className="text-muted-foreground">
            Your email has been verified successfully. You can now sign in to your account.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button asChild className="w-full h-12">
            <Link href="/auth/signin">
              <ArrowRight className="mr-2 h-4 w-4" />
              Continue to Sign In
            </Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center"
      >
        <Mail className="w-10 h-10 text-primary" />
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold">Check Your Email</h1>
        <p className="text-muted-foreground">
          We&apos;ve sent a verification link to
          {email && (
            <span className="block font-medium text-foreground mt-1">
              {email}
            </span>
          )}
        </p>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground"
      >
        <p>
          Click the link in the email to verify your account. If you don&apos;t see the email, check your spam folder.
        </p>
      </motion.div>

      {/* Resend Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={handleResend}
          disabled={isLoading || countdown > 0 || !email}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          {countdown > 0
            ? `Resend in ${countdown}s`
            : "Resend Verification Email"}
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link href="/auth/signin">Back to Sign In</Link>
        </Button>
      </motion.div>
    </div>
  );
}

export default function VerifyPageContent() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
