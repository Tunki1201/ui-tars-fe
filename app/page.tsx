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
    // reconnect,
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

  // Update UI based on socket status - completely rewritten for simplicity
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
      const screenshotUrl = `data:${socketAgentStatus.screenshot.format || 'image/jpeg'};base64,${socketAgentStatus.screenshot.base64}`
      console.log("New screenshot received, timestamp:", socketAgentStatus.screenshot.timestamp);
      
      // Always update the screenshot URL and force a refresh with timestamp
      setScreenshotTimestamp(Date.now());
      updateScreenshot(screenshotUrl);
    }
    
    // Update bot message with received data
    if (socketAgentStatus.isRunning || 
        (activeTaskIdRef.current && activeTaskIdRef.current === socketAgentStatus.taskId)) {
      
      setCurrentBotMessage(prev => {
        // Create a new message if there's no existing one
        if (!prev) {
          return {
            text: socketAgentStatus.instruction || `Agent is running with status: ${socketAgentStatus.status}`,
            isUser: false,
            isScreenshot: !!displayedScreenshotUrl,
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
        }
        
        // Update existing message with new status
        return {
          ...prev,
          isScreenshot: !!displayedScreenshotUrl,
          screenshotUrl: displayedScreenshotUrl,
          taskStatus: {
            thinking: socketAgentStatus.thinking ? "true" : "false",
            instructions: socketAgentStatus.instruction || prev.taskStatus?.instructions,
            status: socketAgentStatus.status || prev.taskStatus?.status,
            isRunning: socketAgentStatus.isRunning
          }
        };
      });
    }
    
    // Check for completed task
    if (!socketAgentStatus.isRunning && activeTaskIdRef.current) {
      if (socketAgentStatus.status === "END" || socketAgentStatus.status === "STOPPED") {
        // Task completed, clear active task
        activeTaskIdRef.current = null;
      }
    }
  }, [socketAgentStatus, displayedScreenshotUrl]);

  // Helper function to update screenshot with proper loading state
  const updateScreenshot = useCallback((url: string) => {
    if (!url) return;
    
    // Show loading state
    setIsImageLoading(true);
    
    // Preload the image
    const img = new window.Image();
    
    img.onload = () => {
      setDisplayedScreenshotUrl(url);
      setIsImageLoading(false);
    };
    
    img.onerror = () => {
      console.error("Error loading screenshot image");
      setIsImageLoading(false);
    };
    
    // Set src to start loading
    img.src = url;
  }, []);

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
          
          // Process screenshot if available
          if (data.screenshot?.dataUrl) {
            updateScreenshot(data.screenshot.dataUrl);
          }
          
          // Initialize bot message with available data
          setCurrentBotMessage({
            text: data.taskStatus?.instructions || `Agent is currently running with status: ${data.status}`,
            isUser: false,
            isScreenshot: !!data.screenshot?.dataUrl,
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
  }, [isConnected, updateScreenshot])

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
    
    // Reset status and screenshot for new conversation
    setAgentStatus("IDLE")
    setDisplayedScreenshotUrl(null)
    setScreenshotTimestamp(0)

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
      console.log("Run agent response:", data);

      // Set the task ID for reference (socket will handle the updates)
      if (data.taskId) {
        activeTaskIdRef.current = data.taskId
      }
      
      // Initialize bot message (WebSocket will update it)
      setCurrentBotMessage({
        text: "Processing...",
        isUser: false,
        isScreenshot: false,
        screenshotUrl: null,
        taskId: data.taskId,
        messageId: `bot-${Date.now()}`,
        timestamp: Date.now(),
        taskStatus: {
          thinking: "true",
          status: "RUNNING",
          isRunning: true
        }
      })
      
      // Start polling if WebSocket is not connected
      if (!isConnected && data._polling) {
        startPolling(data._polling.statusEndpoint, data._polling.pollingIntervalMs || 2000);
      }
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

      console.log("Stop agent response status:", response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to stop agent: ${response.statusText}`)
      }
      
      // Update UI immediately after successful stop, don't wait for WebSocket
      setAgentStatus("STOPPED")
      setCurrentBotMessage((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          taskStatus: {
            ...prev.taskStatus,
            status: "STOPPED",
            isRunning: false,
            instructions: "Agent was stopped by user request.",
          },
        }
      })
      
      // Clear the active task ID
      activeTaskIdRef.current = null
      
      // Make an additional status request to get the final state
      try {
        const statusResponse = await fetch(`/api/task-status/${taskId}`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log("Final task status after stopping:", statusData)
        }
      } catch (statusError) {
        console.error("Error getting final task status:", statusError)
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

  // Start polling for status if WebSocket is not connected
  const startPolling = useCallback((endpoint: string, interval: number) => {
    console.log(`Starting polling: ${endpoint} every ${interval}ms`);
    
    const poll = async () => {
      if (!activeTaskIdRef.current) {
        console.log("No active task to poll for");
        return;
      }
      
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          console.error("Error polling for status:", response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log("Polled status:", data);
        
        // Update UI with polled status
        const status = data.status || "RUNNING";
        setAgentStatus(status);
        
        // Update bot message
        setCurrentBotMessage(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            text: data.instructions || "Processing...",
            taskStatus: {
              thinking: data.thinking ? "true" : "false",
              instructions: data.instructions || prev.taskStatus?.instructions,
              status: status,
              isRunning: status !== "END" && status !== "STOPPED" && status !== "ERROR"
            }
          };
        });
        
        // Handle screenshot from polling
        if (data.screenshot) {
          console.log("Got screenshot in polling, updating it");
          setScreenshotTimestamp(Date.now()); // Force refresh
          updateScreenshot(data.screenshot);
          
          // Update bot message to show screenshot
          setCurrentBotMessage(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              isScreenshot: true,
              screenshotUrl: data.screenshot
            };
          });
        }
        
        // Continue polling if task is still running
        if (status !== "END" && status !== "STOPPED" && status !== "ERROR") {
          setTimeout(poll, interval);
        } else {
          console.log("Task completed, stopping polling");
        }
      } catch (error) {
        console.error("Error polling for status:", error);
      }
    };
    
    // Start polling
    poll();
  }, [updateScreenshot]);

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
                  src={`${displayedScreenshotUrl}?t=${screenshotTimestamp}`}
                  alt="Screenshot result"
                  width={1200}
                  height={900}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                  priority
                  unoptimized={true}
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
            <div key={currentBotMessage.messageId} className="mb-4 p-4">
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
                          src={`${displayedScreenshotUrl}?t=${screenshotTimestamp}`}
                          alt="Screenshot result"
                          width={800}
                          height={600}
                          className={`object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                          priority
                          unoptimized={true}
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
  // const tryReconnect = useCallback(() => {
  //   console.log("Manually triggering reconnection");
  //   reconnect();
  // }, [reconnect]);

  // // Add connection status UI back
  // const connectionStatus = !isConnected ? {
  //   message: isServerShuttingDown ? "Server shutting down" : "WebSocket disconnected",
  //   bgClass: isServerShuttingDown ? "bg-orange-100 dark:bg-orange-900" : "bg-red-100 dark:bg-red-900",
  //   textClass: isServerShuttingDown ? "text-orange-800 dark:text-orange-100" : "text-red-800 dark:text-red-100"
  // } : null;

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
          {/* {connectionStatus && (
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
          )} */}
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