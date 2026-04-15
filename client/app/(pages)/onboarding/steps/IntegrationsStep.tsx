'use client';

import { AnimatePresence } from 'framer-motion';
import { Watch, Activity, Heart } from 'lucide-react';
import { useOnboarding } from '@/src/features/onboarding/context/OnboardingContext';
import { useIntegrations } from '../hooks/useIntegrations';
import {
  IntegrationsHeader,
  IntegrationSection,
  ConnectedStatusBanner,
  SecurityInfoCard,
  MinimumIntegrationBanner,
  IntegrationsNavigation,
} from '../components/integrations';

/**
 * IntegrationsStep - Connect health devices and apps
 *
 * Features:
 * - OAuth-style connection flow
 * - Grouped by type (wearables, platforms, apps)
 * - Collapsible sections
 * - Requires at least one integration
 */
export function IntegrationsStep() {
  const { connectedIntegrations, toggleIntegration, nextStep, prevStep } = useOnboarding();

  const {
    connecting,
    expandedSection,
    wearables,
    platforms,
    apps,
    handleConnect,
    setExpandedSection,
  } = useIntegrations({
    connectedIntegrations,
    toggleIntegration,
  });

  const hasConnections = connectedIntegrations.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      {/* Header */}
      <IntegrationsHeader />

      {/* Connected Status */}
      <AnimatePresence>
        <ConnectedStatusBanner connectedCount={connectedIntegrations.length} />
      </AnimatePresence>

      {/* Integration Sections */}
      <IntegrationSection
        title="Wearables"
        icon={<Watch className="w-5 h-5 text-blue-400" />}
        integrations={wearables}
        description="Smart watches and fitness trackers"
        connectedIntegrations={connectedIntegrations}
        isExpanded={expandedSection === 'wearable'}
        onToggle={() => setExpandedSection(expandedSection === 'wearable' ? null : 'wearable')}
        connecting={connecting}
        onConnect={handleConnect}
      />

      <IntegrationSection
        title="Health Platforms"
        icon={<Activity className="w-5 h-5 text-green-400" />}
        integrations={platforms}
        description="Native health apps on your devices"
        connectedIntegrations={connectedIntegrations}
        isExpanded={expandedSection === 'platform'}
        onToggle={() => setExpandedSection(expandedSection === 'platform' ? null : 'platform')}
        connecting={connecting}
        onConnect={handleConnect}
      />

      <IntegrationSection
        title="Fitness & Nutrition Apps"
        icon={<Heart className="w-5 h-5 text-pink-400" />}
        integrations={apps}
        description="Workout and meal tracking apps"
        connectedIntegrations={connectedIntegrations}
        isExpanded={expandedSection === 'app'}
        onToggle={() => setExpandedSection(expandedSection === 'app' ? null : 'app')}
        connecting={connecting}
        onConnect={handleConnect}
      />

      {/* Security Info */}
      <SecurityInfoCard />

      {/* Minimum Integration Requirement Banner */}
      <AnimatePresence>
        <MinimumIntegrationBanner isVisible={!hasConnections} />
      </AnimatePresence>

      {/* Navigation */}
      <IntegrationsNavigation
        hasConnections={hasConnections}
        onBack={prevStep}
        onNext={nextStep}
      />
    </div>
  );
}
