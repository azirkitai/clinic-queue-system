import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { queryClient } from '@/lib/queryClient';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  lastEvent: { event: string; data: any; timestamp: Date } | null;
}

interface WebSocketEvent {
  event: string;
  data: any;
  timestamp: Date;
}

/**
 * Custom hook for WebSocket connection with automatic reconnection
 * Handles clinic-specific room joining and real-time updates
 * @param disabled - Set true to skip creating a socket (e.g. TV standalone uses its own)
 */
export function useWebSocket(disabled = false): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

  useEffect(() => {
    if (disabled) return;

    // Initialize Socket.IO connection
    const socketInstance = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection handlers
    socketInstance.on('connect', () => {
      console.log('🔌✅ WebSocket connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌❌ WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Clinic room join confirmation
    socketInstance.on('clinic:joined', (data) => {
      console.log('🏥✅ Joined clinic room:', data);
      setLastEvent({ event: 'clinic:joined', data, timestamp: new Date() });
    });

    // Real-time patient call events
    socketInstance.on('patient:called', (data) => {
      console.log('📞 Patient called:', data);
      setLastEvent({ event: 'patient:called', data, timestamp: new Date() });
      
      // Invalidate lightweight patient queries only
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients/tv'] });
    });

    // Patient status updates
    socketInstance.on('patient:updated', (data) => {
      console.log('📋 Patient updated:', data);
      setLastEvent({ event: 'patient:updated', data, timestamp: new Date() });
      
      // Refresh lightweight queries only
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients/tv'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    // Queue updates
    socketInstance.on('queue:updated', (data) => {
      console.log('🎯 Queue updated:', data);
      setLastEvent({ event: 'queue:updated', data, timestamp: new Date() });
      
      // Refresh lightweight queries only (avoid heavy /api/dashboard)
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients/tv'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients/active'] });
    });

    // TV display events (for TV screens)
    socketInstance.on('tv:connected', (data) => {
      console.log('📺 TV connected:', data);
      setLastEvent({ event: 'tv:connected', data, timestamp: new Date() });
    });

    // Error handling
    socketInstance.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      setLastEvent({ event: 'error', data: error, timestamp: new Date() });
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('🔌🧹 Cleaning up WebSocket connection');
      socketInstance.disconnect();
    };
  }, [disabled]);

  // Emit wrapper function
  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      console.log(`📡 Emitting ${event}:`, data);
      socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket not connected, cannot emit:', event);
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    emit,
    lastEvent
  };
}

/**
 * Hook specifically for TV displays to connect with token
 */
export function useWebSocketTV(token?: string): UseWebSocketReturn {
  const webSocket = useWebSocket();

  useEffect(() => {
    if (webSocket.socket && webSocket.isConnected && token) {
      // Connect as TV display with token
      webSocket.emit('tv:connect', { token });
    }
  }, [webSocket.socket, webSocket.isConnected, token, webSocket.emit]);

  return webSocket;
}