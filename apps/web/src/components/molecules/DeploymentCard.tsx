/**
 * Deployment Card Component
 * 
 * Displays a single deployment with status and metadata
 */

import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, GitBranch, Clock } from 'lucide-react';
import { StatusBadge } from '../atoms/StatusBadge';
import type { CloudflareDeployment } from '@cloudflare-monitor/shared';

interface DeploymentCardProps {
  deployment: CloudflareDeployment;
}

export function DeploymentCard({ deployment }: DeploymentCardProps) {
  const timeAgo = formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true });

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {deployment.projectName}
              </h3>
              <StatusBadge status={deployment.status} showPulse />
            </div>
            
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {deployment.environment}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </div>
          
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-cf-orange transition-colors"
            title="View deployment"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {deployment.latestStage && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                Stage: <span className="font-medium text-gray-700">{deployment.latestStage.name}</span>
              </span>
              <span className="text-gray-400">
                {deployment.id.substring(0, 8)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
