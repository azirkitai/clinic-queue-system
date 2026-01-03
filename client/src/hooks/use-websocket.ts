import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { queryClient } from '@/lib/queryClient';

interface UseWebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { onConnect, onDisconnect } = options;
  
  // Stable callbacks to prevent useEffect re-runs
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onConnect, onDisconnect]);

  useEffect(() => {
    // Create socket connection with exponential backoff reconnection
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000, // Start at 2s (not 1s)
      reconnectionDelayMax: 30000, // Max 30s between retries (not 5s)
      randomizationFactor: 0.5, // Add jitter to prevent thundering herd
      reconnectionAttempts: Infinity, // ✅ Never give up reconnecting!
      timeout: 20000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      setIsConnected(true);
      
      // Refetch ONLY critical queries on reconnect (not heavy dashboard endpoints!)
      // This prevents bandwidth spike from refetching dashboard/current-call + history
      queryClient.refetchQueries({ queryKey: ['/api/patients'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/active'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Lightweight TV endpoint
      queryClient.refetchQueries({ queryKey: ['/api/windows'] });
      
      onConnectRef.current?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      setIsConnected(false);
      onDisconnectRef.current?.();
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[WS] Reconnection attempt:', attemptNumber);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('[WS] Reconnection error:', error.message);
    });

    socket.on('clinic:joined', (data) => {
      console.log('[WS] Joined clinic room:', data);
    });

    // Patient events - use optimistic cache updates to reduce HTTP refetches
    socket.on('patient:created', (data: any) => {
      // Optimistic update: Add patient to BOTH caches instead of refetching
      if (data.patient) {
        queryClient.setQueryData(['/api/patients'], (old: any) => {
          if (!old) return old;
          return [...old, data.patient];
        });
        
        // Also add to active patients cache (new patients are always active)
        queryClient.setQueryData(['/api/patients/active'], (old: any) => {
          if (!old) return old;
          return [...old, data.patient];
        });
      }
      // Invalidate lightweight queries (stats + TV)
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates
    });

    socket.on('patient:status-updated', (data: any) => {
      // Optimistic update: Update patient in BOTH caches
      if (data.patient) {
        queryClient.setQueryData(['/api/patients'], (old: any) => {
          if (!old) return old;
          return old.map((p: any) => 
            p.id === data.patient.id ? data.patient : p
          );
        });
        
        // Update active patients cache
        if (data.patient.status === 'completed') {
          // Remove completed patients from active cache
          queryClient.setQueryData(['/api/patients/active'], (old: any) => {
            if (!old) return old;
            return old.filter((p: any) => p.id !== data.patient.id);
          });
        } else {
          // Update active patients (waiting, called, in-progress, dispensary)
          queryClient.setQueryData(['/api/patients/active'], (old: any) => {
            if (!old) return old;
            return old.map((p: any) => 
              p.id === data.patient.id ? data.patient : p
            );
          });
        }
      }
      
      // Invalidate dependent queries (lightweight)
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates
    });

    socket.on('patient:priority-updated', (data: any) => {
      // Optimistic update: Update patient priority in BOTH caches
      if (data.patient) {
        queryClient.setQueryData(['/api/patients'], (old: any) => {
          if (!old) return old;
          return old.map((p: any) => 
            p.id === data.patient.id ? data.patient : p
          );
        });
        
        queryClient.setQueryData(['/api/patients/active'], (old: any) => {
          if (!old) return old;
          return old.map((p: any) => 
            p.id === data.patient.id ? data.patient : p
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates
    });

    socket.on('patient:deleted', (data: any) => {
      // Optimistic update: Remove patient from BOTH caches
      if (data.patientId) {
        queryClient.setQueryData(['/api/patients'], (old: any) => {
          if (!old) return old;
          return old.filter((p: any) => p.id !== data.patientId);
        });
        
        queryClient.setQueryData(['/api/patients/active'], (old: any) => {
          if (!old) return old;
          return old.filter((p: any) => p.id !== data.patientId);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates
    });

    socket.on('queue:reset', () => {
      // Queue reset affects everything - full invalidation needed for all patient caches
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients/active'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates
    });

    // Window events - optimistic updates
    socket.on('window:created', (data: any) => {
      // Optimistic update: Add window to cache
      if (data.window) {
        queryClient.setQueryData(['/api/windows'], (old: any) => {
          if (!old) return old;
          return [...old, data.window];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    socket.on('window:updated', (data: any) => {
      // Optimistic update: Update window in cache
      if (data.window) {
        queryClient.setQueryData(['/api/windows'], (old: any) => {
          if (!old) return old;
          return old.map((w: any) => 
            w.id === data.window.id ? data.window : w
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates (room names)
    });

    socket.on('window:patient-updated', (data: any) => {
      // Optimistic update: Update window with new patient assignment
      if (data.window) {
        queryClient.setQueryData(['/api/windows'], (old: any) => {
          if (!old) return old;
          return old.map((w: any) => 
            w.id === data.window.id ? data.window : w
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/patients/tv'] }); // ✅ Force immediate refetch for real-time updates (assignments)
    });

    // Settings/Theme events (already exist)
    socket.on('settings:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/tv'] });
    });

    socket.on('themes:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/active'] });
    });

    socket.on('text-groups:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/text-groups/active'] });
    });

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect_attempt');
      socket.off('reconnect_error');
      socket.off('clinic:joined');
      socket.off('patient:created');
      socket.off('patient:status-updated');
      socket.off('patient:priority-updated');
      socket.off('patient:deleted');
      socket.off('queue:reset');
      socket.off('window:created');
      socket.off('window:updated');
      socket.off('window:patient-updated');
      socket.off('settings:updated');
      socket.off('themes:updated');
      socket.off('text-groups:updated');
      socket.disconnect();
    };
  }, []); // ✅ Empty deps - only run once on mount

  // Emit helper
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return {
    socket: socketRef.current,
    emit,
    connected: isConnected,
  };
}
