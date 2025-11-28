/**
 * useProjects Hook
 * 
 * Fetches and manages projects data
 */

import { useEffect, useState } from 'react';
import { useMonitoringStore } from '../stores/monitoringStore';
import { api } from '../services/api';

export function useProjects() {
  const { projects, setProjects, setError } = useMonitoringStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await api.getProjects();
        
        if (mounted && response.success && response.data) {
          setProjects(response.data);
        }
      } catch (error) {
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to fetch projects');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();

    // Refresh every 30 seconds
    const interval = setInterval(fetchProjects, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setProjects, setError]);

  return { projects, isLoading };
}
