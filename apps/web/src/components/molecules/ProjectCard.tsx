/**
 * Project Card Component
 * 
 * Displays a project with deployment count
 */

import { Link } from 'react-router-dom';
import { Folder, GitBranch, ArrowRight } from 'lucide-react';
import type { CloudflareProject } from '@cloudflare-monitor/shared';

interface ProjectCardProps {
  project: CloudflareProject;
  deploymentCount?: number;
}

export function ProjectCard({ project, deploymentCount = 0 }: ProjectCardProps) {
  return (
    <Link to={`/projects/${project.id}`} className="block">
      <div className="card hover:shadow-md hover:border-cf-orange/20 transition-all group">
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-cf-orange/10 transition-colors">
                <Folder className="h-5 w-5 text-gray-600 group-hover:text-cf-orange transition-colors" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-cf-orange transition-colors">
                  {project.name}
                </h3>
                {project.production_branch && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <GitBranch className="h-3 w-3" />
                    {project.production_branch}
                  </p>
                )}
              </div>
            </div>
            
            <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-cf-orange transition-colors" />
          </div>
          
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <span>{deploymentCount} deployment{deploymentCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
