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
    
    // Determine WebSocket URL with a different approach
    let wsUrl: string;
    
    // Let's try several connection strategies
    // 1. Use explicit environment variable if set
    if (process.env.NEXT_PUBLIC_WS_URL) {
      wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    } 
    // 2. For ngrok, try the /ws path specifically
    else if (window.location.hostname.includes('ngrok')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }
    // 3. Fallback to local development setup
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
          console.log('Received WebSocket message:', data);
          
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
          console.error('Error parsing WebSocket message:', parseError, event.data);
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
      socket.addEventListener('error', (event) => {
        console.error('WebSocket error occurred:', event);
        setError('WebSocket connection error');
        
        // Don't need to do anything here as the close handler will be called
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown connection error';
      
      setError(`Failed to create WebSocket connection: ${errorMessage}`);
      console.error('WebSocket connection error:', error);
      
      // Try an alternative connection method for ngrok
      if (window.location.hostname.includes('ngrok') && 
          connectionAttempts.current === 1) {
        console.log('Trying alternative connection method for ngrok...');
        // Try the root path instead of /ws
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const alternativeUrl = `${protocol}//${window.location.host}`;
        
        try {
          console.log(`Connecting to alternative WebSocket URL: ${alternativeUrl}`);
          const altSocket = new WebSocket(alternativeUrl);
          socketRef.current = altSocket;
          
          // Set up the same event handlers...
          altSocket.addEventListener('open', () => {
            setIsConnected(true);
            setError(null);
            connectionAttempts.current = 0;
            console.log('WebSocket connection established via alternative URL');
          });
          
          // Add other event listeners similarly...
          
        } catch (altError) {
          console.error('Alternative connection also failed:', altError);
        }
      }
      
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
