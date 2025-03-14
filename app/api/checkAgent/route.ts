import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Call the backend API to check if agent is running
    const response = await fetch('http://localhost:3333/v1/agent/running', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to check agent status' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // If agent is running, also fetch the current screenshot
    let screenshot = null
    if (data.isRunning) {
      try {
        const screenshotResponse = await fetch('http://localhost:3333/v1/screenshot/latest', {
          method: 'GET',
        })
        
        if (screenshotResponse.ok) {
          const screenshotBlob = await screenshotResponse.blob()
          const screenshotBase64 = await blobToBase64(screenshotBlob)
          screenshot = { dataUrl: screenshotBase64 }
        }
      } catch (screenshotError) {
        console.error('Error fetching screenshot:', screenshotError)
      }
    }
    
    // Also fetch task status to get any active task ID
    let taskId = null
    let taskStatus = null
    try {
      const taskStatusResponse = await fetch('http://localhost:3333/v1/task/current/status', {
        method: 'GET',
      })
      
      if (taskStatusResponse.ok) {
        const taskData = await taskStatusResponse.json()
        taskId = taskData.taskId
        taskStatus = {
          thinking: taskData.thinking,
          instructions: taskData.instructions,
          status: taskData.status,
          isRunning: data.isRunning
        }
      }
    } catch (taskError) {
      console.error('Error fetching task status:', taskError)
    }

    return NextResponse.json({
      isRunning: data.isRunning,
      status: data.status,
      timestamp: data.timestamp,
      taskId,
      taskStatus,
      screenshot
    })
  } catch (error) {
    console.error('Error checking agent status:', error)
    return NextResponse.json(
      { error: 'Failed to check agent status', details: String(error) },
      { status: 500 }
    )
  }
}

// Helper function to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}