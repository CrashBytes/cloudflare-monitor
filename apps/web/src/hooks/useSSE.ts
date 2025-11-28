/**
 * SSE Hook for Real-Time Updates
 * 
 * Manages Server-Sent Events connection with automatic reconnection.
 */

import { useEffect } from 'react';
import { useMonitoringStore } from '../stores/monitoringStore';
import type { CloudflareDeployment } from '@cloudflare-monitor/shared';

const SSE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useSSE() {
  const { setConnected, updateDeployment, setError } = useMonitoringStore();

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      console.log('[SSE] Connecting to:', `${SSE_URL}/api/events`);
      eventSource = new EventSource(`${SSE_URL}/api/events?topics=*`);

      eventSource.onopen = () => {
        console.log('[SSE] Connected');
        setConnected(true);
        setError(null);
      };

      eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Handshake confirmed:', data);
        } catch (e) {
          console.log('[SSE] Connected event received');
        }
      });

      eventSource.addEventListener('deployment_update', (event) => {
        try {
          const deployment: CloudflareDeployment = JSON.parse(event.data);
          console.log('[SSE] Deployment update:', deployment);
          updateDeployment(deployment);
        } catch (error) {
          console.error('[SSE] Failed to parse deployment_update:', error);
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        // Keep-alive signal received
        console.debug('[SSE] Heartbeat received');
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        setConnected(false);
        eventSource?.close();
        
        // Reconnect after delay
        reconnectTimeout = setTimeout(() => {
          console.log('[SSE] Attempting reconnection...');
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      eventSource?.close();
      setConnected(false);
    };
  }, [setConnected, updateDeployment, setError]);
}
