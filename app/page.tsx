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
  screenshotUrl?: string | null  // Allow null value
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

// Define the AgentStatus type
interface AgentStatus {
  status?: string
  taskId?: string
  thinking?: boolean
  instruction?: string
  isRunning?: boolean
  screenshot?: {
    format?: string
    base64?: string
    timestamp?: string
  }
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
  
  // Add a ref to track the URL we're currently loading
  const loadingUrlRef = useRef<string | null>(null)
  const previousScreenshotUrlRef = useRef<string | null>(null)

  const { theme } = useTheme()
  const activeTaskIdRef = useRef<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<string>("IDLE")
  
  // Use the WebSocket hook with enhanced properties
  const { 
    agentStatus: socketAgentStatus, 
    isConnected, 
    isServerShuttingDown,
    // reconnect
  } = useAgentSocket()

  // Memoize the bot message update function to prevent infinite loops
  const updateBotMessage = useCallback((status: AgentStatus) => {
    // Convert screenshot to data URL format if needed
    let screenshotUrl: string | null = null
    if (status.screenshot && status.screenshot.base64) {
      screenshotUrl = `data:${status.screenshot.format || 'image/jpeg'};base64,${status.screenshot.base64}`
    }
    
    // Update bot message with received data
    if (status.isRunning || 
        (currentBotMessage && activeTaskIdRef.current === status.taskId)) {
      
      setCurrentBotMessage(prev => {
        // Create a new message if there's no existing one
        if (!prev) {
          return {
            text: status.instruction || `Agent is running with status: ${status.status}`,
            isUser: false,
            isScreenshot: !!screenshotUrl,
            screenshotUrl,  // This can be null
            messageId: `bot-${Date.now()}`,
            timestamp: Date.now(),
            taskId: status.taskId,
            taskStatus: {
              thinking: status.thinking ? "true" : "false",
              instructions: status.instruction,
              status: status.status,
              isRunning: status.isRunning
            }
          };
        }
        
        // Don't update if nothing changed
        if (prev.screenshotUrl === screenshotUrl && 
            prev.taskStatus?.status === status.status &&
            prev.taskStatus?.thinking === (status.thinking ? "true" : "false") && 
            prev.taskStatus?.instructions === status.instruction) {
          return prev;  // Return the same object to prevent re-render
        }
        
        // Update existing message
        return {
          ...prev,
          screenshotUrl: screenshotUrl || prev.screenshotUrl,
          taskStatus: {
            thinking: status.thinking ? "true" : "false",
            instructions: status.instruction || prev.taskStatus?.instructions,
            status: status.status || prev.taskStatus?.status,
            isRunning: status.isRunning
          }
        };
      });
    }
  }, [currentBotMessage]);

  // Update UI based on socket status
  useEffect(() => {
    if (socketAgentStatus) {
      // Update agent status
      setAgentStatus(socketAgentStatus.status || "IDLE")
      
      // Update active task ID
      if (socketAgentStatus.taskId) {
        activeTaskIdRef.current = socketAgentStatus.taskId
      }
      
      // Use the memoized function to update bot message
      updateBotMessage(socketAgentStatus);
      
      // Check for completed task
      if (!socketAgentStatus.isRunning && activeTaskIdRef.current) {
        if (socketAgentStatus.status === "END" || socketAgentStatus.status === "STOPPED") {
          // Task completed, clear active task
          activeTaskIdRef.current = null;
        }
      }
    }
  }, [socketAgentStatus, updateBotMessage]);

  // Handle screenshot loading with fixed dependencies
  useEffect(() => {
    const url = currentBotMessage?.screenshotUrl;
    
    // Skip if no URL or it's the same as what we're already displaying or loading
    if (!url || url === displayedScreenshotUrl || url === loadingUrlRef.current) {
      return;
    }
    
    // Skip if it's the same as the previous URL we processed (prevents loops)
    if (url === previousScreenshotUrlRef.current) {
      return;
    }
    
    // Update our reference to what we're currently processing
    previousScreenshotUrlRef.current = url;
    loadingUrlRef.current = url;
    
    // Show loading state
    setIsImageLoading(true);
    
    // Preload the image
    const img = new window.Image()
    img.onload = () => {
      // Only update if this is still the URL we want to show
      if (loadingUrlRef.current === url) {
        setDisplayedScreenshotUrl(url);
        setIsImageLoading(false);
        loadingUrlRef.current = null;
      }
    };
    
    img.onerror = () => {
      // Clear loading state on error
      if (loadingUrlRef.current === url) {
        setIsImageLoading(false);
        loadingUrlRef.current = null;
      }
    };
    
    // Start loading
    img.src = url;
    
  }, [currentBotMessage?.screenshotUrl, displayedScreenshotUrl]);

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
    previousScreenshotUrlRef.current = null;
    loadingUrlRef.current = null;

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

    if (!taskId) return

    try {
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
      
      // The socket will update our UI once the agent is actually stopped
      
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
            instructions: "Network error while stopping task. Please try again.",
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
                  src={displayedScreenshotUrl || "/placeholder.svg"}
                  alt="Screenshot result"
                  width={1200}
                  height={900}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                  priority
                  unoptimized={displayedScreenshotUrl.startsWith("data:")}
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
                          src={displayedScreenshotUrl}
                          alt="Screenshot result"
                          width={800}
                          height={600}
                          className={`object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                          priority
                          unoptimized={displayedScreenshotUrl.startsWith("data:")}
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

  // Show connection status message if disconnected or server shutting down
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
                  onClick={reconnect}
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
            // disabled={isServerShuttingDown || !isConnected}
          />
        </div>
      </main>
    </div>
  )
}