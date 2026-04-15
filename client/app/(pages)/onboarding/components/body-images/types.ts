/**
 * @file Body Images component types
 */

import type { BodyImageType, BodyImage } from '@/src/features/onboarding/types';

export interface ImageCaptureCardProps {
  type: BodyImageType;
  image: BodyImage;
  onCapture: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export interface ImageGuidanceOverlayProps {
  type: BodyImageType;
  isActive: boolean;
}

export interface BodyImagePreviewProps {
  images: Record<BodyImageType, BodyImage>;
  onRemove: (type: BodyImageType) => void;
}

export interface PrivacyNoticeProps {
  isConsented: boolean;
  onConsentChange: (consented: boolean) => void;
}

export const BODY_IMAGE_CONFIG: Record<
  BodyImageType,
  {
    label: string;
    description: string;
    icon: string;
    guidance: string;
  }
> = {
  face: {
    label: 'Face',
    description: 'Clear front-facing photo',
    icon: 'user',
    guidance: 'Look directly at the camera with neutral expression',
  },
  front: {
    label: 'Front',
    description: 'Full body front view',
    icon: 'person-standing',
    guidance: 'Stand straight, arms at sides, facing the camera',
  },
  side: {
    label: 'Side',
    description: 'Full body side profile',
    icon: 'scan',
    guidance: 'Stand straight, arms at sides, facing sideways',
  },
  back: {
    label: 'Back',
    description: 'Full body back view',
    icon: 'move-3d',
    guidance: 'Stand straight, arms at sides, back to camera',
  },
};
