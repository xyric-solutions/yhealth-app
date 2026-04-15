/**
 * @file Sound Service
 * Utility for playing and managing alarm sounds
 */

let currentAudio: HTMLAudioElement | null = null;

export const AVAILABLE_SOUNDS = [
  { value: 'alarm.wav', label: 'Alarm' },
  { value: 'azan1.mp3', label: 'Azan 1' },
  { value: 'azan2.mp3', label: 'Azan 2' },
  { value: 'azan3.mp3', label: 'Azan 3' },
] as const;

export type SoundFile = typeof AVAILABLE_SOUNDS[number]['value'];

/**
 * Get list of available sound files
 */
export function getAvailableSounds(): typeof AVAILABLE_SOUNDS {
  return AVAILABLE_SOUNDS;
}

/**
 * Play alarm sound from public folder
 * @param soundFile - Name of the sound file (e.g., 'alarm.wav')
 * @param loop - Whether to loop the sound (default: true)
 */
export function playAlarmSound(soundFile: SoundFile, loop: boolean = true): void {
  // Stop any currently playing sound
  stopAlarmSound();

  try {
    // Sound files are in /public directory, accessed directly as /filename
    const soundPath = `/${soundFile}`;
    console.log('[SoundService] Playing alarm sound:', { soundFile, soundPath, loop });
    
    const audio = new Audio(soundPath);
    audio.loop = loop;
    audio.volume = 0.8; // Slightly lower volume for better UX

    // Add error handlers for debugging
    audio.addEventListener('error', (e) => {
      console.error('[SoundService] Audio error:', {
        error: e,
        code: audio.error?.code,
        message: audio.error?.message,
        soundPath,
        soundFile,
      });
    });

    audio.addEventListener('loadstart', () => {
      console.log('[SoundService] Audio load started:', soundPath);
    });

    audio.addEventListener('canplay', () => {
      console.log('[SoundService] Audio can play:', soundPath);
    });

    audio.addEventListener('canplaythrough', () => {
      console.log('[SoundService] Audio can play through:', soundPath);
    });

    // Handle play promise (browsers require user interaction for autoplay)
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[SoundService] ✅ Sound playing successfully:', soundPath);
          currentAudio = audio;
        })
        .catch((error) => {
          // Extract error information safely
          const errorInfo: Record<string, unknown> = {
            soundPath,
            soundFile,
            hint: 'Browser may block autoplay - user interaction may be required',
          };

          // Safely extract error properties
          if (error instanceof Error) {
            errorInfo.errorMessage = error.message;
            errorInfo.errorName = error.name;
            errorInfo.errorStack = error.stack;
          } else if (error && typeof error === 'object') {
            errorInfo.error = String(error);
            if ('message' in error) errorInfo.errorMessage = String(error.message);
            if ('name' in error) errorInfo.errorName = String(error.name);
          } else {
            errorInfo.error = String(error);
          }

          // Add audio element error info if available
          if (audio.error) {
            errorInfo.audioErrorCode = audio.error.code;
            errorInfo.audioErrorMessage = audio.error.message;
          }

          console.error('[SoundService] ❌ Error playing alarm sound:', errorInfo);
          
          // Some browsers block autoplay, but we'll still set currentAudio
          // so the modal can show and user can manually trigger
          currentAudio = audio;
        });
    } else {
      currentAudio = audio;
    }

    // Handle audio end (if not looping)
    if (!loop) {
      audio.addEventListener('ended', () => {
        console.log('[SoundService] Sound ended:', soundPath);
        currentAudio = null;
      });
    }
  } catch (error) {
    console.error('[SoundService] ❌ Error creating audio element:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      soundFile,
    });
  }
}

/**
 * Stop currently playing alarm sound
 */
export function stopAlarmSound(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    } catch (error) {
      console.error('Error stopping alarm sound:', error);
    }
  }
}

/**
 * Check if a sound is currently playing
 */
export function isSoundPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * Set volume for current sound (0.0 to 1.0)
 */
export function setSoundVolume(volume: number): void {
  if (currentAudio) {
    currentAudio.volume = Math.max(0, Math.min(1, volume));
  }
}

