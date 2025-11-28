/**
 * Status Badge Component
 * 
 * Visual indicator for deployment status
 */

import type { DeploymentStatus } from '@cloudflare-monitor/shared';

const statusConfig: Record<DeploymentStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  building: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Building' },
  deploying: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Deploying' },
  failure: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
  queued: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Queued' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
};

interface StatusBadgeProps {
  status: DeploymentStatus;
  showPulse?: boolean;
}

export function StatusBadge({ status, showPulse = false }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.queued;
  const isAnimated = showPulse && (status === 'building' || status === 'deploying');

  return (
    <span className={`status-badge ${config.bg} ${config.text}`}>
      {isAnimated && (
        <span className="relative flex h-2 w-2 mr-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {config.label}
    </span>
  );
}
