'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Clock, Play } from 'lucide-react';
import { playAlarmSound, stopAlarmSound } from '../../utils/sound.service';
import type { SoundFile } from '../../utils/sound.service';

export interface AlarmModalData {
  alarmId: string;
  title: string;
  message: string | null;
  soundFile: SoundFile;
  soundEnabled?: boolean; // Optional, defaults to true if not provided
  workoutPlanId: string | null;
  snoozeMinutes: number;
}

interface AlarmModalProps {
  isOpen: boolean;
  alarm: AlarmModalData | null;
  onDismiss: () => void;
  onSnooze: (alarmId: string, snoozeMinutes: number) => void;
  onAction?: (workoutPlanId: string) => void;
}

export function AlarmModal({
  isOpen,
  alarm,
  onDismiss,
  onSnooze,
  onAction,
}: AlarmModalProps) {
  const hasPlayedSound = useRef(false);

  useEffect(() => {
    console.log('[AlarmModal] Effect triggered:', { 
      isOpen, 
      alarm: alarm?.title,
      soundEnabled: alarm?.soundEnabled,
      soundFile: alarm?.soundFile,
    });
    
    if (isOpen && alarm && !hasPlayedSound.current) {
      // Only play sound if sound is enabled (defaults to true if not specified)
      const shouldPlaySound = alarm.soundEnabled !== false;
      
      if (shouldPlaySound) {
        console.log('[AlarmModal] Playing sound:', alarm.soundFile);
        // Play sound when modal opens
        playAlarmSound(alarm.soundFile, true);
      } else {
        console.log('[AlarmModal] Sound is disabled, skipping playback');
      }
      hasPlayedSound.current = true;
    }

    // Cleanup: stop sound when modal closes
    if (!isOpen) {
      console.log('[AlarmModal] Modal closed, stopping sound');
      stopAlarmSound();
      hasPlayedSound.current = false;
    }

    return () => {
      if (!isOpen) {
        stopAlarmSound();
      }
    };
  }, [isOpen, alarm]);

  const handleDismiss = () => {
    stopAlarmSound();
    hasPlayedSound.current = false;
    onDismiss();
  };

  const handleSnooze = () => {
    if (alarm) {
      stopAlarmSound();
      hasPlayedSound.current = false;
      onSnooze(alarm.alarmId, alarm.snoozeMinutes);
    }
  };

  const handleAction = () => {
    if (alarm?.workoutPlanId && onAction) {
      stopAlarmSound();
      hasPlayedSound.current = false;
      onAction(alarm.workoutPlanId);
    }
  };


  console.log('[AlarmModal] Render:', { isOpen, alarm: alarm?.title, hasAlarm: !!alarm });

  if (!alarm) {
    console.log('[AlarmModal] No alarm data, returning null');
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop with 3D depth effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-black/95 via-emerald-950/20 to-black/95 backdrop-blur-md z-[9998]"
            style={{ pointerEvents: 'none' }}
          />

          {/* Modal with 3D effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50, rotateX: -15 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50, rotateX: -15 }}
            transition={{ 
              type: 'spring', 
              damping: 20, 
              stiffness: 300,
              mass: 0.8
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 perspective-1000"
            style={{ pointerEvents: 'auto', perspective: '1000px' }}
          >
            {/* 3D Container with depth */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="relative max-w-md w-full"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Glow effect behind modal */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-emerald-600/20 to-emerald-400/30 rounded-3xl blur-2xl -z-10 scale-110" />
              
              {/* Main modal container with 3D depth */}
              <div className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 rounded-3xl shadow-[0_20px_60px_-15px_rgba(5,150,105,0.4),0_0_0_1px_rgba(5,150,105,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] border border-emerald-500/30 backdrop-blur-xl overflow-hidden transform-gpu">
                {/* Animated gradient overlay for depth */}
                <motion.div
                  animate={{
                    background: [
                      'linear-gradient(135deg, rgba(5,150,105,0.1) 0%, rgba(5,150,105,0.05) 50%, rgba(5,150,105,0.1) 100%)',
                      'linear-gradient(135deg, rgba(5,150,105,0.15) 0%, rgba(5,150,105,0.1) 50%, rgba(5,150,105,0.15) 100%)',
                      'linear-gradient(135deg, rgba(5,150,105,0.1) 0%, rgba(5,150,105,0.05) 50%, rgba(5,150,105,0.1) 100%)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 pointer-events-none"
                />

                {/* Header with 3D bell icon */}
                <div className="relative p-8 pb-6 border-b border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent">
                  <div className="flex items-center justify-center mb-6">
                    {/* 3D Bell Icon Container */}
                    <motion.div
                      animate={{
                        scale: [1, 1.15, 1],
                        rotate: [0, 5, -5, 0],
                        y: [0, -5, 0],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="relative"
                    >
                      {/* Outer glow ring */}
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 blur-xl"
                      />
                      
                      {/* Middle ring */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/50 to-emerald-700/50 blur-md scale-110" />
                      
                      {/* Main bell container with 3D effect */}
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 flex items-center justify-center shadow-[0_10px_30px_rgba(5,150,105,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.3)] transform hover:scale-105 transition-transform">
                        <Bell className="w-10 h-10 text-white drop-shadow-lg" strokeWidth={2.5} />
                      </div>
                    </motion.div>
                  </div>
                  
                  <h2 className="text-3xl font-bold text-white text-center mb-2 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)] tracking-tight">
                    {alarm.title}
                  </h2>
                  
                  {alarm.message && (
                    <p className="text-white/90 text-center text-sm font-medium leading-relaxed">
                      {alarm.message}
                    </p>
                  )}
                </div>

                {/* Content with 3D depth */}
                <div className="relative p-8 space-y-6">
                  {/* Time display with white text */}
                  <div className="flex items-center justify-center gap-3 text-white">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    >
                      <Clock className="w-5 h-5 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                    </motion.div>
                    <span className="text-lg font-semibold tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                      {new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Action Buttons with 3D effect */}
                  <div className="flex flex-col gap-4 pt-2">
                    {alarm.workoutPlanId && onAction && (
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98, y: 0 }}
                        onClick={handleAction}
                        className="relative w-full px-6 py-4 bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-[0_10px_30px_rgba(5,150,105,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_15px_40px_rgba(5,150,105,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 text-lg transform-gpu overflow-hidden group"
                      >
                        {/* Shine effect */}
                        <motion.div
                          animate={{
                            x: ['-100%', '100%'],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        />
                        <Play className="w-5 h-5 drop-shadow-lg group-hover:scale-110 transition-transform" />
                        <span className="drop-shadow-lg">Start Workout</span>
                      </motion.button>
                    )}

                    <div className="flex gap-4">
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95, y: 0 }}
                        onClick={handleSnooze}
                        className="relative flex-1 px-5 py-3.5 bg-gradient-to-br from-slate-700/90 via-slate-600/90 to-slate-700/90 hover:from-slate-600 hover:via-slate-500 hover:to-slate-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-[0_5px_15px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_8px_20px_rgba(5,150,105,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] border border-emerald-500/30 hover:border-emerald-500/50 flex items-center justify-center gap-2 transform-gpu"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Snooze ({alarm.snoozeMinutes}m)</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95, y: 0 }}
                        onClick={handleDismiss}
                        className="relative flex-1 px-5 py-3.5 bg-gradient-to-br from-slate-700/90 via-slate-600/90 to-slate-700/90 hover:from-slate-600 hover:via-slate-500 hover:to-slate-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-[0_5px_15px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_8px_20px_rgba(5,150,105,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] border border-emerald-500/30 hover:border-emerald-500/50 flex items-center justify-center gap-2 transform-gpu"
                      >
                        <X className="w-4 h-4" />
                        <span>Dismiss</span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

