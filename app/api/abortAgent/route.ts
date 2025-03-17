import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json();
    
    if (!taskId) {
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });
    }
    
    // Using the correct API base URL with environment variable
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333';
    
    // Use the updated abort endpoint
    const response = await fetch(`${apiBaseUrl}/v1/task/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('Error aborting agent:', data);
      return NextResponse.json(data, { status: response.status });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: data.message || 'Agent abort request sent',
      ...data
    });
    
  } catch (error) {
    console.log('Error aborting agent:', error);
    return NextResponse.json(
      { error: 'Failed to abort agent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
