/**
 * Projects Page
 * 
 * Lists all Cloudflare Pages projects
 */

import { Folder } from 'lucide-react';
import { ProjectCard } from '../components/molecules/ProjectCard';
import { LoadingState } from '../components/atoms/Spinner';
import { useProjects } from '../hooks/useProjects';
import { useDeployments } from '../hooks/useDeployments';

export default function ProjectsPage() {
  const { projects, isLoading: projectsLoading } = useProjects();
  const { deployments, isLoading: deploymentsLoading } = useDeployments();

  const isLoading = projectsLoading || deploymentsLoading;

  // Count deployments per project
  const deploymentCounts = deployments.reduce((acc, d) => {
    acc[d.projectId] = (acc[d.projectId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return <LoadingState message="Loading projects..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} synced from Cloudflare
          </p>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <Folder className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">No Projects Found</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Ensure your Cloudflare API token has the correct permissions and your account has Pages projects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              deploymentCount={deploymentCounts[project.id] || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
