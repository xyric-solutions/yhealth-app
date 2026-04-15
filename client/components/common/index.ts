/**
 * @file Common components barrel export
 */

export { AvatarUploader, type AvatarUploaderProps } from './avatar-uploader';
export { BackButton, type BackButtonProps } from './back-button';
export { ErrorState, type ErrorStateProps } from './error-state';
export { FloatingVoiceAssistant } from './floating-voice-assistant';
export { FormInputField, type FormInputFieldProps } from './form-input-field';
export { LanguageSelector } from './language-selector';
export { LoadingScreen, type LoadingScreenProps } from './loading-screen';
export { RadialNetwork } from './radial-network';
export { BackgroundNetwork } from './background-network';
export { HorizontalWaves } from './horizontal-waves';
export { GlowingOrbWaves } from './glowing-orb-waves';
export { Logo, type LogoProps } from './logo';
export { SuccessModal, type SuccessModalProps } from './success-modal';
export { ThemeToggle } from './theme-toggle';

// Motion components and variants
export {
  // Variants
  fadeIn,
  fadeUp,
  fadeDown,
  fadeLeft,
  fadeRight,
  scaleUp,
  staggerContainer,
  staggerItem,
  slideInLeft,
  slideInRight,
  bounce,
  rotateIn,
  // Components
  FadeIn,
  FadeUp,
  FadeLeft,
  FadeRight,
  ScaleUp,
  StaggerContainer,
  StaggerItem,
  Parallax,
  HoverScale,
  Float,
  Pulse,
  TextReveal,
  Counter,
} from './motion';
