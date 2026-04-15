"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Phone, Shield, X } from "lucide-react";
import { useState, useEffect } from "react";

interface CrisisHotline {
  name: string;
  number: string;
  type: 'suicide_prevention' | 'crisis_text' | 'emergency' | 'local';
  description?: string;
}

interface EmergencyResourcesProps {
  resources?: {
    country?: string;
    hotlines: CrisisHotline[];
  };
  isOpen: boolean;
  onClose: () => void;
}

// Default US crisis resources (cached for offline use)
const DEFAULT_RESOURCES: EmergencyResourcesProps['resources'] = {
  country: 'US',
  hotlines: [
    {
      name: 'National Suicide Prevention Lifeline',
      number: '988',
      type: 'suicide_prevention',
      description: '24/7 free and confidential support for people in distress',
    },
    {
      name: 'Crisis Text Line',
      number: 'Text HOME to 741741',
      type: 'crisis_text',
      description: 'Free 24/7 crisis support via text message',
    },
    {
      name: 'Emergency Services',
      number: '911',
      type: 'emergency',
      description: 'For life-threatening emergencies',
    },
  ],
};

export function EmergencyResources({
  resources = DEFAULT_RESOURCES,
  isOpen,
  onClose,
}: EmergencyResourcesProps) {
  const [cachedResources] = useState(resources || DEFAULT_RESOURCES);

  useEffect(() => {
    // Cache resources in localStorage for offline use
    if (resources) {
      try {
        localStorage.setItem('crisis_resources', JSON.stringify(resources));
      } catch (error) {
        console.error('Error caching crisis resources', error);
      }
    }
  }, [resources]);

  // Load cached resources on mount (for offline use)
  useEffect(() => {
    if (!resources && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('crisis_resources');
        if (cached) {
          // Use cached resources (already set as default)
          JSON.parse(cached);
        }
      } catch (error) {
        console.error('Error loading cached crisis resources', error);
      }
    }
  }, [resources]);

  const displayResources = resources || cachedResources || DEFAULT_RESOURCES;

  if (!displayResources) {
    return null;
  }

  const getHotlineIcon = (type: CrisisHotline['type']) => {
    switch (type) {
      case 'suicide_prevention':
      case 'crisis_text':
        return Phone;
      case 'emergency':
        return Shield;
      default:
        return Phone;
    }
  };

  const getHotlineColor = (type: CrisisHotline['type']) => {
    switch (type) {
      case 'suicide_prevention':
      case 'crisis_text':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'emergency':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-white/70 bg-white/5 border-white/10';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl rounded-2xl border-2 border-red-500/30 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-r from-red-600/20 to-orange-600/20 border-b border-red-500/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Emergency Support</h2>
                    <p className="text-sm text-white/70 mt-1">
                      Immediate resources are available
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white leading-relaxed">
                  <strong className="text-white">I&apos;m here for you.</strong> If you&apos;re in immediate
                  danger, please call emergency services right away. The resources below are
                  available 24/7 for support.
                </p>
              </div>
            </div>

            {/* Resources */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {displayResources.hotlines.map((hotline, index) => {
                const Icon = getHotlineIcon(hotline.type);
                const colors = getHotlineColor(hotline.type);
                const [colorClass, bgClass, borderClass] = colors.split(' ');

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-xl backdrop-blur-xl border-2 ${bgClass} ${borderClass} hover:bg-opacity-30 transition-all`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${bgClass}`}>
                        <Icon className={`w-5 h-5 ${colorClass}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-base font-semibold ${colorClass} mb-1`}>
                          {hotline.name}
                        </h3>
                        <a
                          href={
                            hotline.type === 'crisis_text'
                              ? undefined
                              : `tel:${hotline.number.replace(/\D/g, '')}`
                          }
                          className={`text-lg font-bold ${colorClass} hover:underline block mb-2`}
                          onClick={async (e) => {
                            if (hotline.type === 'emergency') {
                              e.preventDefault();
                              const { confirm: confirmAction } = await import("@/components/common/ConfirmDialog");
                              const confirmed = await confirmAction({
                                title: "Emergency Services",
                                description: "Calling emergency services (911). Continue?",
                                confirmText: "Call",
                                cancelText: "Cancel",
                                variant: "destructive",
                              });
                              if (confirmed) {
                                window.location.href = `tel:${hotline.number.replace(/\D/g, '')}`;
                              }
                            }
                          }}
                        >
                          {hotline.number}
                        </a>
                        {hotline.description && (
                          <p className="text-xs text-white/70">{hotline.description}</p>
                        )}
                        {hotline.type === 'crisis_text' && (
                          <button
                            onClick={() => {
                              if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
                                window.location.href = 'sms:741741&body=HOME';
                              } else {
                                window.location.href = 'sms:741741?body=HOME';
                              }
                            }}
                            className="mt-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg border border-blue-500/30 transition-colors"
                          >
                            Open Text Message
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-900/50 border-t border-white/10">
              <p className="text-xs text-white/60 text-center">
                These resources are provided for immediate support. For ongoing care, please
                consult with a mental health professional.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

