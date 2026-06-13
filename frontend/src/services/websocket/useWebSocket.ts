import { useEffect, useRef } from 'react';
import type { CanvasElement, ServerResponse } from '../../types';
import { ServerResponseSchema } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface UseWebSocketProps {
  onMessage: (response: ServerResponse) => void | Promise<void>;
}

export function useWebSocket({ onMessage }: UseWebSocketProps) {
  const setWsStatus = useAppStore((state) => state.setWsStatus);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_DELAY = 10000; // max 10 seconds
    const BASE_DELAY = 1000; // start with 1s
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let heartbeatInterval: ReturnType<typeof setInterval>;
    let isComponentMounted = true;

    function connect() {
      if (!isComponentMounted) return;
      
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        setWsStatus('connected');
        reconnectAttempts = 0; // reset on successful connection
        console.log('Connected to WebSocket server');
        
        // Start Heartbeat
        heartbeatInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ text: "__ping__" }));
          }
        }, 30000); // Send ping every 30 seconds
      };

      socket.onclose = () => {
        setWsStatus('disconnected');
        clearInterval(heartbeatInterval);
        if (!isComponentMounted) return;

        // Exponential backoff with jitter
        const delay = Math.min(MAX_RECONNECT_DELAY, BASE_DELAY * Math.pow(1.5, reconnectAttempts));
        const jitter = Math.random() * 500; // 0-500ms jitter
        const finalDelay = delay + jitter;

        reconnectAttempts++;
        console.log(`Disconnected from WebSocket. Reconnecting in ${Math.round(finalDelay / 1000)}s...`);
        
        reconnectTimeout = setTimeout(connect, finalDelay);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      socket.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data);
          const result = ServerResponseSchema.safeParse(rawData);
          if (!result.success) {
            console.warn('Zod validation failed, dropping malformed server response:', result.error);
            return;
          }
          onMessageRef.current(result.data);
        } catch (e) {
          console.error('Failed to parse server response:', e);
        }
      };

      wsRef.current = socket;
    }

    connect();

    return () => {
      isComponentMounted = false;
      clearTimeout(reconnectTimeout);
      clearInterval(heartbeatInterval);
      if (socket) socket.close();
    };
  }, [setWsStatus]);

  const sendRequest = (text: string, canvasState: CanvasElement[], error?: string, base64Image?: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }

    const payload = {
      text,
      canvas_state: canvasState,
      error,
      base64_image: base64Image,
    };

    wsRef.current.send(JSON.stringify(payload));
    return true;
  };

  return { sendRequest };
}
