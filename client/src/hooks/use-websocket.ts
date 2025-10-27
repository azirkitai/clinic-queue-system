import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { queryClient } from '@/lib/queryClient';

interface UseWebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { onConnect, onDisconnect } = options;

  useEffect(() => {
    // Create socket connection
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      onDisconnect?.();
    });

    socket.on('clinic:joined', (data) => {
      console.log('[WS] Joined clinic room:', data);
    });

    // Patient events - invalidate relevant queries
    socket.on('patient:created', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    });

    socket.on('patient:status-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/current-call'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    });

    socket.on('patient:priority-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    });

    socket.on('patient:deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    });

    socket.on('queue:reset', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/current-call'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    });

    // Window events
    socket.on('window:created', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/windows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    socket.on('window:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/windows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    socket.on('window:patient-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/windows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/current-call'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    // Settings/Theme events (already exist)
    socket.on('settings:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
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
  }, [onConnect, onDisconnect]);

  // Emit helper
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return {
    socket: socketRef.current,
    emit,
    connected: socketRef.current?.connected ?? false,
  };
}
