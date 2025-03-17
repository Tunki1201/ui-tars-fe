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

  const connect = useCallback(() => {
    if (serverShuttingDown.current) {
      console.log('Not reconnecting because server is shutting down');
      return;
    }

    connectionAttempts.current += 1;
    
    // Determine WebSocket URL - this is the key change
    let wsUrl: string;
    
    if (process.env.NEXT_PUBLIC_WS_URL) {
      // Use the full WebSocket URL if provided
      wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // For ngrok, we need to use the ngrok URL without appending the port
      if (window.location.hostname.includes('ngrok')) {
        // Use the same hostname but with WebSocket protocol
        wsUrl = `${protocol}//${window.location.host}`;
        console.log(`Using ngrok WebSocket URL: ${wsUrl}`);
      } else {
        // For local development, construct URL with port as before
        const host = process.env.NEXT_PUBLIC_API_HOST || window.location.hostname;
        const port = process.env.NEXT_PUBLIC_WS_PORT || '3334';
        wsUrl = `${protocol}//${host}:${port}`;
      }
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
        console.log('WebSocket connection established');
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
          console.error('Error parsing WebSocket message:', parseError);
        }
      });

      // Connection closed
      socket.addEventListener('close', (event) => {
        setIsConnected(false);
        console.log('WebSocket connection closed', event.code, event.reason);
        
        if (!serverShuttingDown.current && connectionAttempts.current < 5) {
          const backoffTime = Math.min(1000 * (2 ** connectionAttempts.current), 30000);
          
          console.log(`Will attempt to reconnect in ${backoffTime}ms`);
          
          setTimeout(() => {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
              connect();
            }
          }, backoffTime);
        } else if (connectionAttempts.current >= 5) {
          console.log('Maximum reconnection attempts reached. Please try manual reconnection.');
          setError('Maximum reconnection attempts reached. Please try manual reconnection.');
        } else {
          console.log('Not attempting to reconnect because server is shutting down');
        }
      });

      // Connection error
      socket.addEventListener('error', (event) => {
        console.error('WebSocket error occurred:', event);
        setError('WebSocket connection error');
      });
      
      return () => {
        socket.close();
      };
    } catch (error:unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown connection error';
      
      setError(`Failed to create WebSocket connection: ${errorMessage}`);
      console.error('WebSocket connection error:', error);
      
      if (!serverShuttingDown.current && connectionAttempts.current < 5) {
        const backoffTime = Math.min(1000 * (2 ** connectionAttempts.current), 30000);
        
        setTimeout(() => {
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, backoffTime);
      }
    }
  }, []);

  useEffect(() => {
    serverShuttingDown.current = false;
    connectionAttempts.current = 0;
    
    const cleanup = connect();
    
    return () => {
      if (cleanup) cleanup();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    serverShuttingDown.current = false;
    connectionAttempts.current = 0;
    
    if (socketRef.current) {
      socketRef.current.close();
    }
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