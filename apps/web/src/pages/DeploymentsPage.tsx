/**
 * Deployments Page
 * 
 * Shows deployments with filtering by status.
 * Provides detailed view including timestamps and stage info.
 */

import { useSearchParams, Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, 
  ExternalLink, 
  GitBranch, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { StatusBadge } from '../components/atoms/StatusBadge';
import { LoadingState } from '../components/atoms/Spinner';
import { useDeployments } from '../hooks/useDeployments';
import type { CloudflareDeployment, DeploymentStatus } from '@cloudflare-monitor/shared';

const STATUS_CONFIG: Record<DeploymentStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: 'Active', icon: CheckCircle, color: 'text-green-600' },
  building: { label: 'Building', icon: Loader2, color: 'text-blue-600' },
  deploying: { label: 'Deploying', icon: Loader2, color: 'text-blue-600' },
  failure: { label: 'Failed', icon: XCircle, color: 'text-red-600' },
  queued: { label: 'Queued', icon: Clock, color: 'text-yellow-600' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, color: 'text-gray-600' },
};

function DeploymentDetailCard({ deployment }: { deployment: CloudflareDeployment }) {
  const createdDate = new Date(deployment.createdAt);
  const modifiedDate = new Date(deployment.modifiedAt);
  const config = STATUS_CONFIG[deployment.status];
  const StatusIcon = config.icon;

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link 
                to={`/projects/${deployment.projectId}`}
                className="text-base font-semibold text-gray-900 hover:text-cf-orange transition-colors truncate"
              >
                {deployment.projectName}
              </Link>
              <StatusBadge status={deployment.status} showPulse />
            </div>
            <p className="mt-1 text-sm text-gray-500 font-mono">{deployment.id.substring(0, 12)}...</p>
          </div>
          
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-cf-orange transition-colors"
            title="View deployment"
          >
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">
              Environment: <span className="font-medium text-gray-900 capitalize">{deployment.environment}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon className={`h-4 w-4 ${config.color}`} />
            <span className="text-gray-600">
              Status: <span className={`font-medium ${config.color}`}>{config.label}</span>
            </span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Created</span>
            </div>
            <div className="text-right">
              <span className="font-medium text-gray-900">
                {format(createdDate, 'MMM d, yyyy h:mm a')}
              </span>
              <span className="text-gray-500 ml-2">
                ({formatDistanceToNow(createdDate, { addSuffix: true })})
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Last Modified</span>
            </div>
            <div className="text-right">
              <span className="font-medium text-gray-900">
                {format(modifiedDate, 'MMM d, yyyy h:mm a')}
              </span>
              <span className="text-gray-500 ml-2">
                ({formatDistanceToNow(modifiedDate, { addSuffix: true })})
              </span>
            </div>
          </div>
        </div>

        {/* Stage Info (if available) */}
        {deployment.latestStage && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Build Stage</h4>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {deployment.latestStage.name}
              </span>
              <StatusBadge 
                status={deployment.latestStage.status === 'success' ? 'active' : 
                        deployment.latestStage.status === 'failure' ? 'failure' : 'queued'} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeploymentsPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') as DeploymentStatus | null;
  
  const { deployments, isLoading } = useDeployments();

  // Filter deployments by status if specified
  const filteredDeployments = statusFilter
    ? deployments.filter(d => d.status === statusFilter)
    : deployments;

  // Sort by most recent first
  const sortedDeployments = [...filteredDeployments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const config = statusFilter ? STATUS_CONFIG[statusFilter] : null;
  const pageTitle = statusFilter 
    ? `${config?.label || statusFilter} Deployments` 
    : 'All Deployments';

  if (isLoading) {
    return <LoadingState message="Loading deployments..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-cf-orange mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-3">
          {config && (
            <div className={`p-2 rounded-lg ${statusFilter === 'failure' ? 'bg-red-100' : 'bg-gray-100'}`}>
              <config.icon className={`h-6 w-6 ${config.color}`} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-gray-500 mt-1">
              {sortedDeployments.length} deployment{sortedDeployments.length !== 1 ? 's' : ''} found
              {statusFilter === 'failure' && sortedDeployments.length > 0 && (
                <span className="ml-2 text-red-600">• Review and resolve these issues</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        <Link
          to="/deployments"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !statusFilter 
              ? 'bg-cf-orange text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All ({deployments.length})
        </Link>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = deployments.filter(d => d.status === status).length;
          if (count === 0 && status !== statusFilter) return null;
          return (
            <Link
              key={status}
              to={`/deployments?status=${status}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-cf-orange text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cfg.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* Deployments List */}
      {sortedDeployments.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">
            {statusFilter === 'failure' ? 'No Failed Deployments' : 'No Deployments Found'}
          </h2>
          <p className="text-gray-500 mt-2">
            {statusFilter === 'failure' 
              ? 'All your deployments are healthy!' 
              : 'Deployments will appear here once synced from Cloudflare.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedDeployments.map(deployment => (
            <DeploymentDetailCard key={deployment.id} deployment={deployment} />
          ))}
        </div>
      )}
    </div>
  );
}
