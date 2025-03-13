import { NextResponse } from 'next/server';

// This endpoint initiates the task and returns initial data
export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    // Call the task API to create a new task
    const taskResponse = await fetch('http://localhost:3333/v1/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task: message }),
    });
    
    if (!taskResponse.ok) {
      throw new Error(`Task API returned status ${taskResponse.status}`);
    }
    
    const taskData = await taskResponse.json();
    const { taskId } = taskData;
    
    // Just return the initial response with taskId
    // The frontend will use this taskId to poll for updates
    return NextResponse.json({
      ...taskData,
      // Include instructions for the frontend
      _polling: {
        statusEndpoint: `/api/task-status/${taskId}`,
        pollingIntervalMs: 2000 // Recommend polling interval
      }
    });
    
  } catch (error) {
    console.error('Error in run-agent API route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}