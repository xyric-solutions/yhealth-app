"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";
import { VoiceAssistantTab } from "@/app/(pages)/dashboard/components/tabs/VoiceAssistantTab";

export function VoiceAssistantModal() {
  const { isOpen, closeVoiceAssistant } = useVoiceAssistant();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeVoiceAssistant}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal — 80% viewport height, centered, responsive */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-0 bottom-0 z-[101] flex items-center justify-center p-2 sm:p-4 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Voice Assistant Content — 80% height on desktop, taller on mobile */}
            <div className="w-full h-[92vh] sm:h-[88vh] md:h-[82vh] lg:h-[80vh] max-w-[1200px] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
              <VoiceAssistantTab />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
