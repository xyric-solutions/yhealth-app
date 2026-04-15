'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api-client';
import { AVAILABLE_INTEGRATIONS } from '../components/integrations';

interface UseIntegrationsOptions {
  connectedIntegrations: string[];
  toggleIntegration: (integrationId: string) => void;
}

interface UseIntegrationsReturn {
  // State
  connecting: string | null;
  expandedSection: string | null;

  // Grouped integrations
  wearables: typeof AVAILABLE_INTEGRATIONS;
  platforms: typeof AVAILABLE_INTEGRATIONS;
  apps: typeof AVAILABLE_INTEGRATIONS;

  // Actions
  handleConnect: (integrationId: string) => Promise<void>;
  setExpandedSection: (section: string | null) => void;
}

/**
 * useIntegrations - Custom hook for managing integration connections
 *
 * Features:
 * - Loads integrations from API on mount
 * - Handles OAuth-style connection flow
 * - Groups integrations by type
 * - Manages accordion state
 */
export function useIntegrations({
  connectedIntegrations,
  toggleIntegration,
}: UseIntegrationsOptions): UseIntegrationsReturn {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('wearable');

  // Try to load integrations from API
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        await api.get('/integrations');
        // Could update local state with server data
      } catch {
        // Use local state as fallback
      }
    };
    loadIntegrations();
  }, []);

  const handleConnect = useCallback(
    async (integrationId: string) => {
      if (connecting) return;

      const isConnected = connectedIntegrations.includes(integrationId);
      if (isConnected) {
        toggleIntegration(integrationId);
        return;
      }

      setConnecting(integrationId);
      // Simulate OAuth connection
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toggleIntegration(integrationId);
      setConnecting(null);
    },
    [connecting, connectedIntegrations, toggleIntegration]
  );

  // Group integrations by type
  const wearables = useMemo(
    () => AVAILABLE_INTEGRATIONS.filter((i) => i.type === 'wearable'),
    []
  );

  const platforms = useMemo(
    () => AVAILABLE_INTEGRATIONS.filter((i) => i.type === 'platform'),
    []
  );

  const apps = useMemo(
    () => AVAILABLE_INTEGRATIONS.filter((i) => i.type === 'app'),
    []
  );

  return {
    // State
    connecting,
    expandedSection,

    // Grouped integrations
    wearables,
    platforms,
    apps,

    // Actions
    handleConnect,
    setExpandedSection,
  };
}
