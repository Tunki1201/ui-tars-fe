"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Sidebar from "@/components/sidebar"
import ChatHeader from "@/components/chat-header"
import WelcomeModal from "@/components/welcome-modal"
import ChatInput from "@/components/chat-input"
import TradeActions from "@/components/trade-actions"
import BackgroundLogo from "@/components/background-logo"
import { Card } from "@/components/ui/card"
import { useTheme } from "next-themes"
import Image from "next/image"
import { useAgentSocket } from "@/hooks/useAgentSocket"

// Define message type
interface MessageType {
  text: string
  isUser: boolean
  isScreenshot?: boolean
  screenshotUrl?: string | null
  taskId?: string
  taskStatus?: {
    thinking?: string
    instructions?: string
    status?: string
    isRunning?: boolean
  }
  isError?: boolean
  messageId: string
  timestamp: number
}

// Define polling data interface
interface PollingData {
  statusEndpoint: string
  pollingIntervalMs: number
}

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [viewMode, setViewMode] = useState<"chat" | "browser">("chat")
  const [inputValue, setInputValue] = useState("")

  // Instead of tracking all messages, just track the current request/response
  const [currentUserMessage, setCurrentUserMessage] = useState<MessageType | null>(null)
  const [currentBotMessage, setCurrentBotMessage] = useState<MessageType | null>(null)

  // Add state to prevent image flickering
  const [displayedScreenshotUrl, setDisplayedScreenshotUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  
  // Track the last updated timestamp to force image refreshes
  const [screenshotTimestamp, setScreenshotTimestamp] = useState<number>(0)
  
  const { theme } = useTheme()
  const activeTaskIdRef = useRef<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<string>("IDLE")
  
  // Use the WebSocket hook with enhanced properties
  const { 
    agentStatus: socketAgentStatus, 
    isConnected, 
    isServerShuttingDown,
    reconnect,
    error: socketError
  } = useAgentSocket()

  // Add debugging useEffect to track WebSocket status
  useEffect(() => {
    console.log("WebSocket connection status:", isConnected);
    console.log("WebSocket error:", socketError);
  }, [isConnected, socketError]);

  // Add debugging for socket agent status
  useEffect(() => {
    if (socketAgentStatus) {
      console.log("Received agent status update:", socketAgentStatus);
    }
  }, [socketAgentStatus]);

  // Function to properly format and update screenshot
  const updateScreenshot = useCallback((base64Data: string | null, format: string = 'image/jpeg') => {
    if (!base64Data) return;
    
    // Make sure the format is correct
    let screenshotUrl = '';
    if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
      // Already a data URL
      screenshotUrl = base64Data;
    } else {
      // Create a properly formatted data URL
      screenshotUrl = `data:${format};base64,${base64Data}`;
    }
    
    // Update timestamp to force refresh
    setScreenshotTimestamp(Date.now());
    
    // Preload the image
    const img = new window.Image();
    img.onload = () => {
      setDisplayedScreenshotUrl(screenshotUrl);
      setIsImageLoading(false);
    };
    
    img.onerror = (error) => {
      console.error("Error loading image:", error);
      setIsImageLoading(false);
    };
    
    setIsImageLoading(true);
    img.src = screenshotUrl;
  }, []);

  // Update UI based on socket status
  useEffect(() => {
    if (!socketAgentStatus) return;
    
    // Update agent status
    setAgentStatus(socketAgentStatus.status || "IDLE")
    
    // Update active task ID
    if (socketAgentStatus.taskId) {
      activeTaskIdRef.current = socketAgentStatus.taskId
    }
    
    // Process screenshot if available
    if (socketAgentStatus.screenshot && socketAgentStatus.screenshot.base64) {
      console.log("New screenshot received, timestamp:", socketAgentStatus.screenshot.timestamp);
      
      // Use the updateScreenshot function with correct format
      updateScreenshot(
        socketAgentStatus.screenshot.base64,
        `image/${socketAgentStatus.screenshot.format || 'jpeg'}`
      );
    }
    
    // Update bot message with received data
    if (socketAgentStatus.isRunning || 
        (currentBotMessage && activeTaskIdRef.current === socketAgentStatus.taskId)) {
        
      setCurrentBotMessage(prev => {
        // Create a new message if there's no existing one
        if (!prev) {
          const newMessage: MessageType = {
            text: socketAgentStatus.instruction || `Agent is running with status: ${socketAgentStatus.status}`,
            isUser: false,
            isScreenshot: !!socketAgentStatus.screenshot,
            screenshotUrl: displayedScreenshotUrl,
            messageId: `bot-${Date.now()}`,
            timestamp: Date.now(),
            taskId: socketAgentStatus.taskId,
            taskStatus: {
              thinking: socketAgentStatus.thinking ? "true" : "false",
              instructions: socketAgentStatus.instruction,
              status: socketAgentStatus.status,
              isRunning: socketAgentStatus.isRunning
            }
          };
          
          return newMessage;
        }
        
        // Check if anything has actually changed to prevent unnecessary updates
        const hasStatusChange = 
          socketAgentStatus.thinking !== (prev.taskStatus?.thinking === "true") ||
          socketAgentStatus.status !== prev.taskStatus?.status ||
          socketAgentStatus.isRunning !== prev.taskStatus?.isRunning ||
          socketAgentStatus.instruction !== prev.taskStatus?.instructions;
            
        // Only update if something has changed
        if (hasStatusChange) {
          // Update existing message
          return {
            ...prev,
            screenshotUrl: displayedScreenshotUrl, // Use the current displayed URL
            isScreenshot: !!displayedScreenshotUrl,
            taskStatus: {
              thinking: socketAgentStatus.thinking ? "true" : "false",
              instructions: socketAgentStatus.instruction || prev.taskStatus?.instructions,
              status: socketAgentStatus.status || prev.taskStatus?.status,
              isRunning: socketAgentStatus.isRunning
            }
          };
        }
        
        // Return previous state if nothing changed
        return prev;
      });
    }
    
    // Check for completed task
    if (!socketAgentStatus.isRunning && activeTaskIdRef.current) {
      if (socketAgentStatus.status === "END" || socketAgentStatus.status === "STOPPED") {
        // Task completed, clear active task
        activeTaskIdRef.current = null;
      }
    }
  }, [socketAgentStatus, currentBotMessage, displayedScreenshotUrl, updateScreenshot]);

  // Added proper typing for the polling function
  const startPolling = useCallback((pollingData: PollingData, taskId: string) => {
    console.log('-----------this is the react component--', taskId)
    const pollInterval = pollingData.pollingIntervalMs || 2000;
    let pollCount = 0;
    
    const poll = async () => {
      if (pollCount > 100) {
        console.log("Polling stopped after max attempts");
        return;
      }
      
      try {
        const response = await fetch(pollingData.statusEndpoint);
        if (!response.ok) {
          console.error("Polling error:", response.status);
          setTimeout(poll, pollInterval);
          pollCount++;
          return;
        }
        
        const data = await response.json();
        console.log("Polling data:", data);
        
        // Update UI with polled data
        setAgentStatus(data.status || "RUNNING");
        
        // Update bot message with latest data
        setCurrentBotMessage(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            text: data.thinking ? "Thinking..." : (data.instructions || prev.text),
            taskStatus: {
              thinking: data.thinking ? "true" : "false",
              instructions: data.instructions || prev.taskStatus?.instructions,
              status: data.status || prev.taskStatus?.status,
              isRunning: data.isRunning !== undefined ? data.isRunning : prev.taskStatus?.isRunning
            }
          };
        });
        
        // Check for screenshot in polled data
        if (data.screenshot && data.screenshot.base64) {
          updateScreenshot(
            data.screenshot.base64,
            `image/${data.screenshot.format || 'jpeg'}`
          );
        }
        
        // Continue polling if task is still running
        if (data.isRunning || data.status === "RUNNING" || data.status === "THINKING") {
          setTimeout(poll, pollInterval);
          pollCount++;
        } else {
          console.log("Polling complete - task finished with status:", data.status);
        }
      } catch (error) {
        console.error("Error during polling:", error);
        setTimeout(poll, pollInterval);
        pollCount++;
      }
    };
    
    // Start polling
    poll();
  }, [updateScreenshot]);

  // API request with proper typing
  // const fetchData = async <T,>(endpoint: string, options?: RequestInit): Promise<T> => {
  //   const response = await fetch(endpoint, options);
  //   if (!response.ok) {
  //     throw new Error(`API error: ${response.status}`);
  //   }
  //   return response.json() as Promise<T>;
  // };

  // Check initial agent status on mount
  useEffect(() => {
    const checkInitialAgentStatus = async () => {
      try {
        const response = await fetch('/api/checkAgent')
        if (!response.ok) return
        
        const data = await response.json()
        
        if (data.isRunning) {
          // If agent is running, update the status
          setAgentStatus(data.status || "RUNNING")
          
          // Store the active task ID if available
          if (data.taskId) {
            activeTaskIdRef.current = data.taskId
          }
          
          // Initialize bot message with available data
          setCurrentBotMessage({
            text: data.taskStatus?.instructions || `Agent is currently running with status: ${data.status}`,
            isUser: false,
            isScreenshot: !!data.screenshot,
            screenshotUrl: data.screenshot?.dataUrl || null,
            messageId: `bot-${Date.now()}`,
            timestamp: Date.now(),
            taskId: data.taskId,
            taskStatus: data.taskStatus
          })
        }
      } catch (error) {
        console.error("Error checking agent status:", error)
      }
    }
    
    // Only check initial status if WebSocket is not connected yet
    if (!isConnected) {
      checkInitialAgentStatus()
    }
  }, [isConnected])

  const handleSendMessage = async (message: string) => {
    // Don't allow sending messages if server is shutting down
    if (isServerShuttingDown) {
      console.log("Cannot send message - server is shutting down")
      return
    }

    setShowWelcome(false)

    // Set the current user message
    const userMessage: MessageType = {
      text: message,
      isUser: true,
      messageId: `user-${Date.now()}`,
      timestamp: Date.now(),
    }

    setCurrentUserMessage(userMessage)
    setAgentStatus("IDLE")

    // Reset screenshot state for new conversation
    setDisplayedScreenshotUrl(null)
    // loadingUrlRef.current = null;

    try {
      const response = await fetch("/api/runAgent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response from agent")
      }

      const data = await response.json()

      // Set the task ID for reference (socket will handle the updates)
      if (data.taskId) {
        activeTaskIdRef.current = data.taskId
      }
      
      // Start polling if _polling data is available and WebSocket isn't connected
      if (data._polling && !isConnected) {
        startPolling(data._polling, data.taskId);
      }
      
      // Initialize bot message (WebSocket will update it)
      setCurrentBotMessage({
        text: "Processing...",
        isUser: false,
        isScreenshot: false,
        taskId: data.taskId,
        messageId: `bot-${Date.now()}`,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error("Error sending message:", error)

      // Set error message
      setCurrentBotMessage({
        text: "Sorry, there was an error processing your request.",
        isUser: false,
        isError: true,
        messageId: `error-${Date.now()}`,
        timestamp: Date.now(),
      })
    }
  }

  const stopTask = async (taskId: string) => {
    // Don't allow stopping tasks if server is shutting down
    if (isServerShuttingDown) {
      console.log("Cannot stop task - server is shutting down")
      return
    }

    if (!taskId) {
      console.log("No taskId provided for stopTask")
      return
    }

    console.log(`Attempting to stop task: ${taskId}`)

    try {
      // First, update the UI immediately to show the stopping action
      setAgentStatus("STOPPING")
      setCurrentBotMessage((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          taskStatus: {
            ...prev.taskStatus,
            status: "STOPPING",
            isRunning: true,
            instructions: "Stopping agent...",
          },
        }
      })

      // Make the API call
      const response = await fetch("/api/stopAgent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      })

      if (!response.ok) {
        throw new Error("Failed to stop agent")
      }
      
      // Update UI after successful stop
      setAgentStatus("STOPPED")
      setCurrentBotMessage((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          taskStatus: {
            ...prev.taskStatus,
            status: "STOPPED",
            isRunning: false,
            instructions: "Agent stopped successfully",
          },
        }
      })
      
      // Clear active task ID
      activeTaskIdRef.current = null
      
      // Get final status just to be sure
      try {
        const statusResponse = await fetch(`/api/taskStatus/${taskId}`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log("Final task status after stopping:", statusData)
        }
      } catch (statusError) {
        console.warn("Error fetching final task status:", statusError)
      }
      
    } catch (error) {
      console.error("Error stopping task:", error)
      
      // Update UI with error state
      setAgentStatus("ERROR")
      setCurrentBotMessage((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          taskStatus: {
            ...prev.taskStatus,
            status: "ERROR",
            isRunning: false,
            instructions: "Error stopping task. Please try again.",
          },
        }
      })
    }
  }

  // Render the current message based on view mode
  const renderCurrentMessage = () => {
    if (viewMode === "browser") {
      // In browser mode, only show bot message with screenshot
      if (currentBotMessage?.isScreenshot && displayedScreenshotUrl) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full">
              {/* Use a container with fixed dimensions */}
              <div className="w-full h-full overflow-hidden">
                <Image
                  src={displayedScreenshotUrl}
                  alt="Screenshot result"
                  width={1200}
                  height={900}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                  priority
                  unoptimized={true}
                  key={screenshotTimestamp}
                />
              </div>

              {/* Loading indicator */}
              {isImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </div>
        )
      }
      return null
    } else {
      // In chat mode, show both user and bot messages
      return (
        <>
          {currentUserMessage && (
            <div key={currentUserMessage.messageId} className="mb-4 p-4">
              <Card className="inline-block p-3 max-w-[80%] text-primary">{currentUserMessage.text}</Card>
            </div>
          )}

          {currentBotMessage && (
            <div key={`${currentBotMessage.messageId}-${screenshotTimestamp}`} className="mb-4 p-4">
              <Card className="inline-block p-3 max-w-[80%] text-secondary-foreground">
                {currentBotMessage.isScreenshot ? (
                  <div className="space-y-3">
                    {currentBotMessage.taskStatus && (
                      <div className="mb-3 text-sm">
                        <div className="font-medium mb-1">Status: {currentBotMessage.taskStatus?.status}</div>

                        {currentBotMessage.taskStatus?.instructions && (
                          <div className="mb-2">
                            <div className="font-medium">Instructions:</div>
                            <div className="pl-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {currentBotMessage.taskStatus?.instructions}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Add screenshot in chat mode */}
                    {displayedScreenshotUrl && (
                      <div className="relative mt-3">
                        <div className="overflow-hidden rounded-md">
                          <Image
                            src={displayedScreenshotUrl}
                            alt="Screenshot result"
                            width={800}
                            height={600}
                            className={`object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                            priority
                            unoptimized={true}
                            key={screenshotTimestamp} // Force re-render when new screenshot arrives
                          />
                        </div>
                        
                        {isImageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  currentBotMessage.text
                )}
              </Card>
            </div>
          )}
        </>
      )
    }
  }

  // Add explicit reconnection function
  const tryReconnect = useCallback(() => {
    console.log("Manually triggering reconnection");
    reconnect();
  }, [reconnect]);

  // Add connection status UI back
  const connectionStatus = !isConnected ? {
    message: isServerShuttingDown ? "Server shutting down" : "WebSocket disconnected",
    bgClass: isServerShuttingDown ? "bg-orange-100 dark:bg-orange-900" : "bg-red-100 dark:bg-red-900",
    textClass: isServerShuttingDown ? "text-orange-800 dark:text-orange-100" : "text-red-800 dark:text-red-100"
  } : null;

  return (
    <div className={`flex h-screen ${theme === "light" ? "light-mode-gradient" : "bg-background"}`}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader 
          viewMode={viewMode} 
          onViewModeChange={setViewMode} 
          agentStatus={agentStatus} 
          isConnected={isConnected}
          isServerShuttingDown={isServerShuttingDown}
        />
        <div className="flex-1 m-8 overflow-y-auto border rounded-lg relative">
          <BackgroundLogo />
          {renderCurrentMessage()}
          {showWelcome && (
            <div className="absolute inset-0 flex items-center justify-center">
              <WelcomeModal onClose={() => setShowWelcome(false)} />
            </div>
          )}
          
          {/* Show connection status */}
          {connectionStatus && (
            <div className={`absolute bottom-4 right-4 ${connectionStatus.bgClass} ${connectionStatus.textClass} px-3 py-1 rounded-md text-sm flex items-center`}>
              <span>{connectionStatus.message}</span>
              {!isServerShuttingDown && (
                <button 
                  onClick={tryReconnect}
                  className="ml-2 underline text-xs hover:text-opacity-80"
                >
                  Try reconnect
                </button>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          <TradeActions setInputValue={setInputValue} />
          <ChatInput
            onSendMessage={handleSendMessage}
            agentStatus={agentStatus}
            activeTaskId={activeTaskIdRef.current}
            inputValue={inputValue}
            setInputValue={setInputValue}
            onStopTask={stopTask}
            // disabled={isServerShuttingDown} // Only disable on server shutdown
          />
        </div>
      </main>
    </div>
  )
}