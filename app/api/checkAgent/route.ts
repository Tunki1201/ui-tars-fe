import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Single API call to get all agent information
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

    // Get the complete response from the enhanced endpoint
    const data = await response.json()
    
    // Format the screenshot data if it exists
    let screenshot = null
    if (data.isRunning && data.screenshot) {
      screenshot = {
        dataUrl: `data:${data.screenshot.format || 'image/jpeg'};base64,${data.screenshot.base64}`,
        timestamp: data.screenshot.timestamp || new Date().toISOString()
      }
    }
    
    // Format task status data
    const taskStatus = {
      thinking: data.thinking || false,
      instructions: data.instruction || "",
      status: data.status || "IDLE",
      isRunning: data.isRunning || false
    }

    return NextResponse.json({
      isRunning: data.isRunning,
      status: data.status,
      timestamp: data.timestamp,
      taskId: data.taskId || null,
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
