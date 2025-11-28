/**
 * Project Detail Page
 * 
 * Shows details and deployments for a specific project
 */

import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, GitBranch, Calendar, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DeploymentCard } from '../components/molecules/DeploymentCard';
import { LoadingState } from '../components/atoms/Spinner';
import { useProjects } from '../hooks/useProjects';
import { useDeployments } from '../hooks/useDeployments';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { deployments, isLoading: deploymentsLoading } = useDeployments();

  const isLoading = projectsLoading || deploymentsLoading;

  const project = projects.find(p => p.id === projectId);
  const projectDeployments = deployments
    .filter(d => d.projectId === projectId)
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  if (isLoading) {
    return <LoadingState message="Loading project..." />;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-gray-900">Project Not Found</h2>
        <p className="text-gray-500 mt-2">The requested project could not be found.</p>
        <Link to="/projects" className="mt-4 inline-block btn-primary">
          Back to Projects
        </Link>
      </div>
    );
  }

  const productionDeployments = projectDeployments.filter(d => d.environment === 'production');
  const previewDeployments = projectDeployments.filter(d => d.environment === 'preview');

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-cf-orange transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Project Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              {project.production_branch && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-4 w-4" />
                  {project.production_branch}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          
          <a
            href={`https://dash.cloudflare.com/?to=/:account/pages/view/${project.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Cloudflare
          </a>
        </div>
      </div>

      {/* Deployment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Deployments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{projectDeployments.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Production</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{productionDeployments.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Preview</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{previewDeployments.length}</p>
        </div>
      </div>

      {/* Deployments List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Deployments</h2>
        
        {projectDeployments.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500">No deployments found for this project.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectDeployments.map(deployment => (
              <DeploymentCard key={deployment.id} deployment={deployment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
