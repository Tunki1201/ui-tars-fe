import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Using the API base URL from environment variables
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333';
    
    // Call the backend API endpoint
    const response = await fetch(`${apiBaseUrl}/v1/agent/running`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Make sure to include the next cache option to prevent caching
      cache: 'no-store',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }
    
    // Parse and forward the response data
    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error checking running agent:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check running agent', 
        details: error instanceof Error ? error.message : 'Unknown error',
        isRunning: false 
      },
      { status: 500 }
    );
  }
}