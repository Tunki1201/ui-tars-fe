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
    
    // Return just the agent running status
    return NextResponse.json({
      isRunning: data.isRunning,
      status: data.status,
      timestamp: data.timestamp
    })
  } catch (error) {
    console.error('Error checking agent status:', error)
    return NextResponse.json(
      { error: 'Failed to check agent status', details: String(error) },
      { status: 500 }
    )
  }
}
