/**
 * Integration Component Types
 */

import type { Integration } from '@/src/types';

export interface IntegrationBranding {
  bg: string;
  text: string;
  border: string;
  glow: string;
  logo: string;
}

export interface IntegrationCardProps {
  integration: Integration;
  isConnected: boolean;
  isConnecting: boolean;
  branding: IntegrationBranding;
  onConnect: (integrationId: string) => void;
}

export interface IntegrationSectionProps {
  title: string;
  icon: React.ReactNode;
  integrations: Integration[];
  description: string;
  connectedIntegrations: string[];
  isExpanded: boolean;
  onToggle: () => void;
  connecting: string | null;
  onConnect: (integrationId: string) => void;
}

export interface ConnectedStatusBannerProps {
  connectedCount: number;
}

export interface SecurityInfoCardProps {
  onLearnMore?: () => void;
}

export interface MinimumIntegrationBannerProps {
  isVisible: boolean;
}

export interface IntegrationsHeaderProps {
  title?: string;
  subtitle?: string;
}

export interface IntegrationsNavigationProps {
  hasConnections: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
}
