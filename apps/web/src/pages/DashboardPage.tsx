/**
 * Dashboard Page
 * 
 * Main overview with stats and recent deployments
 */

import { Activity, CheckCircle, XCircle, Clock, Layers } from 'lucide-react';
import { StatsCard, DeploymentCard } from '../components';
import { LoadingState } from '../components/atoms/Spinner';
import { useMonitoringStore } from '../stores/monitoringStore';
import { useDeployments } from '../hooks/useDeployments';
import { useProjects } from '../hooks/useProjects';

export default function DashboardPage() {
  const { deployments, isLoading: deploymentsLoading } = useDeployments();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { error } = useMonitoringStore();

  const isLoading = deploymentsLoading || projectsLoading;

  // Calculate stats
  const totalDeployments = deployments.length;
  const activeDeployments = deployments.filter(d => d.status === 'active').length;
  const buildingDeployments = deployments.filter(d => d.status === 'building' || d.status === 'deploying').length;
  const failedDeployments = deployments.filter(d => d.status === 'failure').length;

  // Get recent deployments (sorted by date)
  const recentDeployments = [...deployments]
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, 10);

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Connection Error</h2>
        <p className="text-gray-500 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Monitor your Cloudflare deployments in real-time</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Projects"
          value={projects.length}
          icon={Layers}
          description="Active projects"
          to="/projects"
        />
        <StatsCard
          title="Active Deployments"
          value={activeDeployments}
          icon={CheckCircle}
          description={`of ${totalDeployments} total`}
          to="/deployments?status=active"
        />
        <StatsCard
          title="In Progress"
          value={buildingDeployments}
          icon={Activity}
          description="Building or deploying"
          to="/deployments?status=building"
        />
        <StatsCard
          title="Failed"
          value={failedDeployments}
          icon={XCircle}
          description="Require attention"
          className={failedDeployments > 0 ? 'border-red-200 bg-red-50/50' : ''}
          to="/deployments?status=failure"
        />
      </div>

      {/* Recent Deployments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Deployments</h2>
          <span className="text-sm text-gray-500">Last 10 deployments</span>
        </div>
        
        {recentDeployments.length === 0 ? (
          <div className="card p-8 text-center">
            <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No deployments yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Deployments will appear here once your Cloudflare projects are synced
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentDeployments.map(deployment => (
              <DeploymentCard key={deployment.id} deployment={deployment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
