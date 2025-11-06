/**
 * Data Fetching Hook for Projects
 * 
 * Implements SWR-like pattern with automatic refresh.
 */

import { useEffect, useState } from 'react';
import { useMonitoringStore } from '../stores/monitoringStore';
import { apiClient } from '../services/api';

export function useProjects() {
  const { projects, setProjects, setLoading, setError } = useMonitoringStore();
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchProjects = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getProjects();
        
        if (!cancelled) {
          setProjects(data);
          setError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Failed to fetch projects');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, [refetchTrigger, setProjects, setLoading, setError]);

  const refetch = () => setRefetchTrigger(prev => prev + 1);

  return {
    projects,
    refetch,
  };
}
