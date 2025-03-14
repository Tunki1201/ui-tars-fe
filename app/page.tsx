"use client"

import { useState, useEffect, useRef } from "react"
import Sidebar from "@/components/sidebar"
import ChatHeader from "@/components/chat-header"
import WelcomeModal from "@/components/welcome-modal"
import ChatInput from "@/components/chat-input"
import TradeActions from "@/components/trade-actions"
import BackgroundLogo from "@/components/background-logo"
import { Card } from "@/components/ui/card"
import { useTheme } from "next-themes"
import Image from "next/image"

// Define message type
interface MessageType {
  text: string
  isUser: boolean
  isScreenshot?: boolean
  screenshotUrl?: string
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

  const { theme } = useTheme()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const activeTaskIdRef = useRef<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<string>("IDLE")

  // Preload image to prevent flickering
  const preloadImage = (url: string) => {
    return new Promise((resolve, reject) => {
      const img = new globalThis.Image() // Use globalThis.Image to reference the browser's Image constructor
      img.onload = () => resolve(url)
      img.onerror = reject
      img.src = url
    })
  }

  // Update displayed screenshot URL when bot message changes
  useEffect(() => {
    if (currentBotMessage?.screenshotUrl && currentBotMessage.screenshotUrl !== displayedScreenshotUrl) {
      // Only update if we have a new URL
      if (!displayedScreenshotUrl) {
        // First time, set immediately
        setDisplayedScreenshotUrl(currentBotMessage.screenshotUrl || null)
      } else {
        // For subsequent updates, preload the image first
        setIsImageLoading(true)
        preloadImage(currentBotMessage.screenshotUrl)
          .then(() => {
            // Use null as fallback if screenshotUrl is undefined
            setDisplayedScreenshotUrl(currentBotMessage.screenshotUrl || null)
            setIsImageLoading(false)
          })
          .catch(() => {
            // console.error("Failed to load image:", currentBotMessage.screenshotUrl)
            setIsImageLoading(false)
          })
      }
    }
  }, [currentBotMessage?.screenshotUrl, displayedScreenshotUrl])

  useEffect(() => {
    const checkAgentStatus = async () => {
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
          
          // If there's a screenshot, update the display state
          if (data.screenshot?.dataUrl) {
            setDisplayedScreenshotUrl(data.screenshot.dataUrl)
          }
          
          // Start polling for updates if there's an active task
          if (data.taskId) {
            startPolling(data.taskId)
          }
        }
      } catch (error) {
        console.error("Error checking agent status:", error)
      }
    }
    
    checkAgentStatus()
  }, []) // Run only on mount

  // Clean up polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Start polling for updates
  const startPolling = (taskId: string) => {
    // Store the active task ID
    activeTaskIdRef.current = taskId

    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    // Start polling for updates
    pollingRef.current = setInterval(async () => {
      try {
        // Fetch the latest status and screenshot
        const response = await fetch(`/api/task-status/${taskId}`)
        if (!response.ok) throw new Error("Failed to get task status")

        const data = await response.json()

        // If this isn't the current active task anymore, stop polling
        if (activeTaskIdRef.current !== taskId) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          return
        }

        // Update the bot message with new data
        setCurrentBotMessage((prev) => {
          if (!prev) return prev

          return {
            ...prev,
            taskStatus: data.taskStatus,
            screenshotUrl: data.screenshot?.dataUrl || prev.screenshotUrl,
            text: data.taskStatus ? `Status: ${JSON.stringify(data.taskStatus.status)}` : prev.text,
          }
        })

        setAgentStatus(data.taskStatus?.status || "IDLE")

        // If task is complete, stop polling
        if (
          data.taskStatus &&
          (data.taskStatus.status === "END" || (!data.taskStatus.thinking && !data.taskStatus.isRunning))
        ) {
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      } catch (error) {
        console.error("Error polling for updates:", error)
        // Stop polling on error
        if (pollingRef.current) clearInterval(pollingRef.current)
      }
    }, 2000) // Poll every 2 seconds
  }

  const handleSendMessage = async (message: string) => {
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

      // Set the current bot message
      const botMessage: MessageType = {
        text: data.taskStatus ? `Status: ${JSON.stringify(data.taskStatus.status)}` : "Processing...",
        isUser: false,
        isScreenshot: true,
        screenshotUrl: data.screenshot?.dataUrl || "/fallback-screenshot.png",
        taskId: data.taskId,
        taskStatus: data.taskStatus,
        messageId: `bot-${Date.now()}`,
        timestamp: Date.now(),
      }

      setCurrentBotMessage(botMessage)

      // If we have a taskId, start polling for updates
      if (data.taskId) {
        // Start polling immediately
        startPolling(data.taskId)
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
    if (!taskId) return

    try {
      const response = await fetch("/api/stopAgent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      })

      const data = await response.json()

      // Clear the polling interval regardless of response status
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }

      // Update the active task status
      activeTaskIdRef.current = null

      if (!response.ok) {
        console.warn("Issue stopping agent:", data.error || "Unknown error")

        // Show error in the bot message but still update status
        setCurrentBotMessage((prev) => {
          if (!prev) return prev

          return {
            ...prev,
            taskStatus: {
              ...prev.taskStatus,
              status: "ERROR",
              isRunning: false,
              instructions: `Error stopping task: ${data.error || "Unknown error"}`,
            },
          }
        })

        // Still update global status to stopped
        setAgentStatus("ERROR")
      } else {
        // Update the global agent status state on success
        setAgentStatus("STOPPED")

        // Update the bot message to indicate task was stopped
        setCurrentBotMessage((prev) => {
          if (!prev) return prev

          return {
            ...prev,
            taskStatus: {
              ...prev.taskStatus,
              status: "STOPPED",
              isRunning: false,
            },
          }
        })
      }
    } catch (error) {
      console.error("Error stopping task:", error)

      // Clear polling and update UI even if there's a client-side error
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }

      activeTaskIdRef.current = null
      setAgentStatus("ERROR")

      // Update the bot message to show the error
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

  return (
    <div className={`flex h-screen ${theme === "light" ? "light-mode-gradient" : "bg-background"}`}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader viewMode={viewMode} onViewModeChange={setViewMode} agentStatus={agentStatus} />
        <div className="flex-1 m-8 overflow-y-auto border rounded-lg relative">
          <BackgroundLogo />
          {renderCurrentMessage()}
          {showWelcome && (
            <div className="absolute inset-0 flex items-center justify-center">
              <WelcomeModal onClose={() => setShowWelcome(false)} />
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
          />
        </div>
      </main>
    </div>
  )
}
