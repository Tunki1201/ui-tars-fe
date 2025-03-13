import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: { taskId: string } }
) {
  try {
    // Properly await the params object
    const { taskId } = context.params;
    
    // Get the task status
    const statusResponse = await fetch(`http://localhost:3333/v1/task/${taskId}/status`);
    let taskStatus = null;
    
    if (statusResponse.ok) {
      taskStatus = await statusResponse.json();
    } else {
      console.warn(`Could not fetch task status: ${statusResponse.status}`);
      // Set status to "end" to stop polling when the API call fails
      taskStatus = {
        status: "end",
        isRunning: false,
        thinking: "",
        instructions: "Could not fetch task status. Task may have completed or encountered an error."
      };
    }
    
    // Get the latest screenshot
    const screenshotUrl = `http://localhost:3333/v1/screenshot/${taskId}`;
    const screenshotResponse = await fetch(screenshotUrl);
    
    let screenshotData = null;
    if (screenshotResponse.ok) {
      const screenshotBuffer = await screenshotResponse.arrayBuffer();
      const base64Screenshot = Buffer.from(screenshotBuffer).toString('base64');
      
      screenshotData = {
        dataUrl: `data:image/jpeg;base64,${base64Screenshot}`,
        timestamp: new Date().toISOString()
      };
    } else {
      console.warn(`Could not fetch screenshot: ${screenshotResponse.status}`);
    }
    
    // Return the current status and latest screenshot
    return NextResponse.json({
      taskId,
      taskStatus,
      screenshot: screenshotData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching task status:', error);
    // Return "end" status on general errors to stop polling
    return NextResponse.json({
      taskId: context.params.taskId,
      taskStatus: {
        status: "end",
        isRunning: false,
        thinking: "",
        instructions: "An error occurred while fetching task status."
      },
      timestamp: new Date().toISOString()
    });
  }
}
