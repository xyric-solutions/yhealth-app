'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAlarmSocket } from '@/app/(pages)/dashboard/hooks/useAlarmSocket';
import { AlarmModal } from '@/app/(pages)/dashboard/components/alarms/AlarmModal';

/**
 * Global Alarm Provider
 * Manages alarm socket connection and displays alarm modal on any page
 */
export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const prevConnectionState = useRef<boolean | null>(null);
  const prevAlarmState = useRef<string | null>(null);

  // Handle navigation to workout page when alarm action is clicked
  const handleNavigateToWorkout = (workoutPlanId: string) => {
    console.log('[AlarmProvider] Navigating to workout', { workoutPlanId });
    router.push(`/workouts${workoutPlanId ? `?planId=${workoutPlanId}` : ''}`);
  };

  // Use alarm socket hook to establish global connection
  const {
    isConnected: isAlarmSocketConnected,
    activeAlarm,
    dismissAlarm,
    snoozeAlarm,
  } = useAlarmSocket(handleNavigateToWorkout);

  // Log connection state changes
  useEffect(() => {
    if (prevConnectionState.current !== isAlarmSocketConnected) {
      console.log('[AlarmProvider] Connection state changed', {
        isConnected: isAlarmSocketConnected,
        previousState: prevConnectionState.current,
      });
      prevConnectionState.current = isAlarmSocketConnected;
    }
  }, [isAlarmSocketConnected]);

  // Log alarm state changes
  useEffect(() => {
    const currentAlarmId = activeAlarm?.alarmId || null;
    if (prevAlarmState.current !== currentAlarmId) {
      if (activeAlarm) {
        console.log('[AlarmProvider] ✅ Alarm activated', {
          alarmId: activeAlarm.alarmId,
          title: activeAlarm.title,
          workoutPlanId: activeAlarm.workoutPlanId,
          isConnected: isAlarmSocketConnected,
        });
      } else if (prevAlarmState.current !== null) {
        console.log('[AlarmProvider] Alarm dismissed', {
          previousAlarmId: prevAlarmState.current,
        });
      }
      prevAlarmState.current = currentAlarmId;
    }
  }, [activeAlarm, isAlarmSocketConnected]);

  // Log connection health periodically (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        console.log('[AlarmProvider] Connection health check', {
          isConnected: isAlarmSocketConnected,
          hasActiveAlarm: !!activeAlarm,
          activeAlarmId: activeAlarm?.alarmId || null,
        });
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAlarmSocketConnected, activeAlarm]);

  return (
    <>
      {children}
      {/* Global Alarm Modal - shows on any page */}
      <AlarmModal
        isOpen={!!activeAlarm}
        alarm={activeAlarm}
        onDismiss={dismissAlarm}
        onSnooze={snoozeAlarm}
        onAction={activeAlarm?.workoutPlanId ? handleNavigateToWorkout : undefined}
      />
    </>
  );
}

