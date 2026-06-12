import { useState, useEffect, useRef } from 'react';
import type { ServerResponse } from '../types';

interface UseWebSocketProps {
  onMessage: (response: ServerResponse) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketProps) {
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socketUrl = `ws://${window.location.hostname}:8080/ws`;
    let socket: WebSocket;

    function connect() {
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        setWsStatus('connected');
        console.log('Connected to WebSocket server');
      };

      socket.onclose = () => {
        setWsStatus('disconnected');
        console.log('Disconnected from WebSocket. Reconnecting in 3s...');
        setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      socket.onmessage = (event) => {
        try {
          const response: ServerResponse = JSON.parse(event.data);
          onMessage(response);
        } catch (e) {
          console.error('Failed to parse server response:', e);
        }
      };

      wsRef.current = socket;
    }

    connect();

    return () => {
      if (socket) socket.close();
    };
  }, []);

  const sendRequest = (text: string, canvasState: any[]): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }

    const payload = {
      text,
      canvas_state: canvasState,
    };

    wsRef.current.send(JSON.stringify(payload));
    return true;
  };

  return { wsStatus, sendRequest };
}
