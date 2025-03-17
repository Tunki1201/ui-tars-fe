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
  // Add a ref to track if server is shutting down
  const serverShuttingDown = useRef<boolean>(false);

  const connect = useCallback(() => {
    // Don't try to reconnect if server is shutting down
    if (serverShuttingDown.current) {
      console.log('Not reconnecting because server is shutting down');
      return;
    }

    // Determine WebSocket URL (use secure WebSocket if on HTTPS)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_HOST || window.location.hostname;
    const port = process.env.NEXT_PUBLIC_WS_PORT || '3334'; // Updated to use WS_PORT (3334)
    const wsUrl = `${protocol}//${host}:${port}`;

    console.log(`Connecting to WebSocket at ${wsUrl}`);

    try {
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      // Connection opened
      socket.addEventListener('open', () => {
        setIsConnected(true);
        setError(null);
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
            // Handle server status messages
            console.log('Received server status:', data);
            
            if (data.status === 'SHUTDOWN') {
              // Mark server as shutting down to prevent reconnection attempts
              serverShuttingDown.current = true;
              
              // Update UI with shutdown message
              setError(`Server is shutting down: ${data.message}`);
              console.log(`Server shutdown notification: ${data.message}`);
              
              // We can still mark as disconnected for UI purposes
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
        
        // Try to reconnect after a delay, but only if server isn't shutting down
        if (!serverShuttingDown.current) {
          setTimeout(() => {
            if (socketRef.current?.readyState !== WebSocket.OPEN) {
              connect();
            }
          }, 5000);
        } else {
          console.log('Not attempting to reconnect because server is shutting down');
        }
      });

      // Connection error
      socket.addEventListener('error', () => {
        setError('WebSocket connection error');
        // Log a more controlled message instead of the entire event
        // console.error('WebSocket error occurred');
      });
      
      return () => {
        socket.close();
      };
    } catch (error:unknown) {
      // Properly type the error
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown connection error';
      
      setError(`Failed to create WebSocket connection: ${errorMessage}`);
      console.error('WebSocket connection error:', error);
      
      // Try to reconnect after a delay if server isn't shutting down
      if (!serverShuttingDown.current) {
        setTimeout(() => {
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 5000);
      }
    }
  }, []);

  // Set up connection on mount
  useEffect(() => {
    // Reset shutdown flag on mount
    serverShuttingDown.current = false;
    
    const cleanup = connect();
    
    // Clean up on unmount
    return () => {
      if (cleanup) cleanup();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    // Allow manual reconnection to override shutdown state
    serverShuttingDown.current = false;
    
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
    // Export a property to check if shutdown is in progress
    isServerShuttingDown: serverShuttingDown.current
  };
}