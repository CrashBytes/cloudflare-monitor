/**
 * Data Fetching Hook for Deployments
 * 
 * Implements SWR-like pattern with automatic refresh.
 */

import { useEffect, useState } from 'react';
import { useMonitoringStore } from '../stores/monitoringStore';
import { apiClient } from '../services/api';

export function useDeployments(projectId?: string) {
  const { deployments, setDeployments, setLoading, setError } = useMonitoringStore();
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchDeployments = async () => {
      setLoading(true);
      try {
        const data = projectId
          ? await apiClient.getProjectDeployments(projectId)
          : await apiClient.getDeployments();
        
        if (!cancelled) {
          setDeployments(data);
          setError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Failed to fetch deployments');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDeployments();

    return () => {
      cancelled = true;
    };
  }, [projectId, refetchTrigger, setDeployments, setLoading, setError]);

  const refetch = () => setRefetchTrigger(prev => prev + 1);

  return {
    deployments: projectId
      ? deployments.filter(d => d.projectId === projectId)
      : deployments,
    refetch,
  };
}
