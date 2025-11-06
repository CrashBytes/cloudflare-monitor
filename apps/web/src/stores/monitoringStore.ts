/**
 * Zustand Store for Monitoring State
 * 
 * Centralized state management following Flux architecture principles.
 */

import { create } from 'zustand';
import type { CloudflareProject, CloudflareDeployment, MonitoringMetrics } from '@cloudflare-monitor/shared';

interface MonitoringState {
  projects: CloudflareProject[];
  deployments: CloudflareDeployment[];
  metrics: MonitoringMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  isConnected: boolean;
  
  setProjects: (projects: CloudflareProject[]) => void;
  setDeployments: (deployments: CloudflareDeployment[]) => void;
  setMetrics: (metrics: MonitoringMetrics) => void;
  updateDeployment: (deployment: CloudflareDeployment) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setLastUpdated: (timestamp: string) => void;
}

export const useMonitoringStore = create<MonitoringState>((set) => ({
  projects: [],
  deployments: [],
  metrics: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  isConnected: false,
  
  setProjects: (projects) => set({ projects, lastUpdated: new Date().toISOString() }),
  setDeployments: (deployments) => set({ deployments, lastUpdated: new Date().toISOString() }),
  setMetrics: (metrics) => set({ metrics, lastUpdated: new Date().toISOString() }),
  updateDeployment: (updatedDeployment) => set((state) => ({
    deployments: state.deployments.map((d) =>
      d.id === updatedDeployment.id ? updatedDeployment : d
    ),
    lastUpdated: new Date().toISOString(),
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setConnected: (isConnected) => set({ isConnected }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
