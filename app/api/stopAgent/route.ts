import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get taskId from request body
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Call the backend endpoint to stop screenshot monitoring
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3333'}/v1/screenshot/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    });

    // Parse the response
    const data = await response.json();

    // If the backend returned an error
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to stop task' },
        { status: response.status }
      );
    }

    // Return success response
    return NextResponse.json({
      status: 'success',
      message: data.message || 'Task stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
