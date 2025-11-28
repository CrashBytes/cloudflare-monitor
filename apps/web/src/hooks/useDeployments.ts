/**
 * useDeployments Hook
 * 
 * Fetches and manages deployments data
 */

import { useEffect, useState } from 'react';
import { useMonitoringStore } from '../stores/monitoringStore';
import { api } from '../services/api';

export function useDeployments() {
  const { deployments, setDeployments, setError } = useMonitoringStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchDeployments = async () => {
      try {
        setIsLoading(true);
        const response = await api.getDeployments();
        
        if (mounted && response.success && response.data) {
          setDeployments(response.data);
        }
      } catch (error) {
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to fetch deployments');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDeployments();

    // Refresh every 10 seconds (SSE provides real-time updates, this is a fallback)
    const interval = setInterval(fetchDeployments, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setDeployments, setError]);

  return { deployments, isLoading };
}
