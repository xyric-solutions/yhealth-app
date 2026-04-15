/**
 * @file Video frame capture utility
 * @description Captures a single frame from a video element as a compressed
 *              JPEG base64 string for sending to the AI coach endpoint.
 */

/** Capture dimensions for the JPEG frame */
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;

/** JPEG quality factor (0-1) */
const JPEG_QUALITY = 0.7;

/**
 * Capture the current video frame as a 320x240 JPEG base64 string.
 *
 * Returns the raw base64 payload (without the `data:image/jpeg;base64,` prefix)
 * so it can be sent directly to the coach API.
 *
 * @param video - The HTMLVideoElement currently displaying the camera feed
 * @returns Base64-encoded JPEG string, or null if the video has no frames
 */
export function captureFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  const canvas = document.createElement('canvas');
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
}
