"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { OnboardingProvider, useOnboarding } from "@/src/features/onboarding/context/OnboardingContext";
import { ONBOARDING_STEPS } from "@/src/features/onboarding/constants/steps";
import { ProgressIndicator } from "./components/ProgressIndicator";
import { WelcomeStep } from "./steps/WelcomeStep";
import { AssessmentModeStep } from "./steps/AssessmentModeStep";
import { AssessmentStep } from "./steps/AssessmentStep";
import { DeepAssessmentStep } from "./steps/DeepAssessmentStep";
import { BodyImageUploadStep } from "./steps/BodyImageUploadStep";
import { GoalSetupStep } from "./steps/GoalSetupStep";
import { LifeGoalsStep } from "./steps/LifeGoalsStep";
import { PreferencesStep } from "./steps/PreferencesStep";
import { PlanGenerationStep } from "./steps/PlanGenerationStep";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { TOTAL_STEPS } from "@/src/features/onboarding/constants/steps";
import { Loader2, Sparkles, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function OnboardingContent() {
  const { currentStep, goToStep, assessmentMode } = useOnboarding();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/signin?callbackUrl=/onboarding");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-cyan-400/50"
            animate={{
              scale: [1, 1.3, 1.3],
              opacity: [0.5, 0, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Loading your journey...</span>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return <AssessmentModeStep />;
      case 2:
        // Render Deep or Quick assessment based on selected mode
        return assessmentMode === "deep" ? (
          <DeepAssessmentStep />
        ) : (
          <AssessmentStep />
        );
      case 3:
        return <BodyImageUploadStep />;
      case 4:
        return <GoalSetupStep />;
      case 5:
        return <LifeGoalsStep />;
      case 6:
        return <PreferencesStep />;
      case 7:
        return <PlanGenerationStep />;
      default:
        return <WelcomeStep />;
    }
  };

  // Don't show progress on plan generation step or deep assessment (has its own header)
  const isDeepAssessment = currentStep === 2 && assessmentMode === "deep";
  const showProgress = currentStep < 7 && !isDeepAssessment;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with Progress */}
      {showProgress && (
        <motion.header
          className="sticky top-0 z-50 bg-[#02000f]/90 backdrop-blur-xl border-b border-white/10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-[1286px] mx-auto px-3 sm:px-4 md:px-6">
            {/* Top bar: Back | Logo | Steps counter */}
            <motion.div
              className="relative flex items-center justify-between py-3 sm:py-4 md:py-5"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Back Button — compact on mobile */}
              <Link
                href="/"
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-white text-sm sm:text-base border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all group z-10"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-medium">Back</span>
              </Link>

              {/* Logo - Centered absolutely so it doesn't shift with button sizes */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-2.5">
                <Image src="/logo1.png" alt="Balencia" width={32} height={32} className="object-contain sm:w-[38px] sm:h-[38px]" />
                <span className="text-xl sm:text-2xl md:text-[28px] font-semibold text-white tracking-wide hidden sm:inline">
                  Balencia
                </span>
              </div>

              {/* Steps counter — hidden on small mobile, visible from sm+ */}
              <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 text-sm sm:text-base z-10">
                <span className="text-white/40 font-medium">Steps:</span>
                <span className="text-white font-medium">
                  {currentStep + 1}/{TOTAL_STEPS}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Stepper — below header line */}
          <div className="max-w-[1286px] mx-auto px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
            <ProgressIndicator
              steps={ONBOARDING_STEPS}
              currentStep={currentStep}
              onStepClick={goToStep}
            />
          </div>
        </motion.header>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      {showProgress && (
        <motion.footer
          className="py-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm sm:text-base md:text-lg text-white/80">
            Need help?{" "}
            <a
              href="#"
              className="text-sky-600 hover:text-sky-500 transition-colors font-medium"
            >
              Contact Support
            </a>
          </p>
        </motion.footer>
      )}
    </div>
  );
}

export default function OnboardingPageContent() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
