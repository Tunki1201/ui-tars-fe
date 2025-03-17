import { useEffect, useState, useRef, useCallback } from 'react';

export interface AgentStatus {
  isRunning: boolean;
  status: string;
  timestamp: string;
  thinking?: boolean;
  taskId?: string;
  instruction?: string;
  screenshot?: {
    format: string;
    base64: string;
    timestamp: string;
  };
}

export function useAgentSocket() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const serverShuttingDown = useRef<boolean>(false);
  const connectionAttempts = useRef<number>(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Clear any existing reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    
    if (serverShuttingDown.current) {
      console.log('Not reconnecting because server is shutting down');
      return;
    }

    // Close any existing socket before creating a new one
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN || 
          socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }

    connectionAttempts.current += 1;
    
    // Determine WebSocket URL - using the ngrok URL directly
    let wsUrl: string;
    
    // Use explicit environment variable if set
    if (process.env.NEXT_PUBLIC_WS_URL) {
      wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    } 
    // Use the specific ngrok URL you've established
    else if (window.location.hostname.includes('ngrok')) {
      wsUrl = 'wss://7d50-159-100-29-254.ngrok-free.app';
    }
    // Fallback to local development setup
    else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NEXT_PUBLIC_API_HOST || window.location.hostname;
      const port = process.env.NEXT_PUBLIC_WS_PORT || '3334';
      wsUrl = `${protocol}//${host}:${port}`;
    }

    console.log(`Connecting to WebSocket at ${wsUrl} (attempt ${connectionAttempts.current})`);

    try {
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      // Connection opened
      socket.addEventListener('open', () => {
        setIsConnected(true);
        setError(null);
        connectionAttempts.current = 0; // Reset counter on successful connection
        console.log('WebSocket connection established successfully');
      });

      // Listen for messages
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'agentStatus') {
            setAgentStatus(data);
          } 
          else if (data.type === 'serverStatus') {
            console.log('Received server status:', data);
            
            if (data.status === 'SHUTDOWN') {
              serverShuttingDown.current = true;
              setError(`Server is shutting down: ${data.message}`);
              setIsConnected(false);
            }
          }
        } catch (parseError) {
          console.log('Error parsing WebSocket message:', parseError);
        }
      });

      // Connection closed
      socket.addEventListener('close', (event) => {
        setIsConnected(false);
        console.log('WebSocket connection closed', event.code, event.reason);
        
        if (!serverShuttingDown.current && connectionAttempts.current < 5) {
          // Use exponential backoff for reconnection
          const backoffTime = Math.min(1000 * Math.pow(1.5, connectionAttempts.current), 30000);
          console.log(`Will attempt to reconnect in ${backoffTime}ms`);
          
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, backoffTime);
        } else if (connectionAttempts.current >= 5) {
          console.log('Maximum reconnection attempts reached. Please try manual reconnection.');
          setError('Maximum reconnection attempts reached. Please try manual reconnection.');
        } else {
          console.log('Not attempting to reconnect because server is shutting down');
        }
      });

      // Connection error
      socket.addEventListener('error', () => {
        console.log('WebSocket error occurred');
        setError('WebSocket connection error');
        // Don't need to reconnect here - the close handler will be called
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown connection error';
      
      setError(`Failed to create WebSocket connection: ${errorMessage}`);
      console.log('WebSocket connection error:', error);
      
      // Schedule reconnect if appropriate
      if (!serverShuttingDown.current && connectionAttempts.current < 5) {
        const backoffTime = Math.min(1000 * Math.pow(1.5, connectionAttempts.current), 30000);
        
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, backoffTime);
      }
    }
  }, []);

  useEffect(() => {
    serverShuttingDown.current = false;
    connectionAttempts.current = 0;
    
    connect();
    
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    serverShuttingDown.current = false;
    connectionAttempts.current = 0;
    
    connect();
  }, [connect]);

  return {
    agentStatus,
    isConnected,
    error,
    reconnect,
    isServerShuttingDown: serverShuttingDown.current
  };
}