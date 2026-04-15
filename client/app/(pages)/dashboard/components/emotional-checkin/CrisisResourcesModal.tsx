"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Phone, MessageSquare, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface CrisisResourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrisisResourcesModal({
  open,
  onOpenChange,
}: CrisisResourcesModalProps) {
  const resources = [
    {
      name: "National Suicide Prevention Lifeline",
      number: "988",
      type: "phone",
      description:
        "24/7 free and confidential support for people in distress",
    },
    {
      name: "Crisis Text Line",
      number: "Text HOME to 741741",
      type: "text",
      description: "Free 24/7 crisis support via text message",
    },
    {
      name: "Emergency Services",
      number: "911",
      type: "emergency",
      description: "For life-threatening emergencies",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#0f0f18] border-white/[0.06]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-400" />
            </div>
            Support Resources
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-slate-400 leading-relaxed">
            I want to make sure you have the support you need right now.
            Here are some resources that can help:
          </p>

          <div className="space-y-2.5">
            {resources.map((resource, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 shrink-0">
                  {resource.type === "text" ? (
                    <MessageSquare className="h-4 w-4 text-pink-400" />
                  ) : resource.type === "emergency" ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Phone className="h-4 w-4 text-pink-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white mb-0.5">
                    {resource.name}
                  </h3>
                  <p className="text-pink-400 font-mono text-base font-semibold mb-1">
                    {resource.number}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {resource.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
            <p className="text-xs text-amber-200/80 leading-relaxed">
              <strong className="text-amber-200">Remember:</strong>{" "}
              You&apos;re not alone. Reaching out for help is a sign of
              strength. If you&apos;re in immediate danger, please call 911
              or go to your nearest emergency room.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
