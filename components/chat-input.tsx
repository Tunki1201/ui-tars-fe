"use client";

import { useState } from "react";
import { Loader, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ChatInput({
  onSendMessage,
  agentStatus = "",
  activeTaskId = null,
  onStopTask,
  inputValue,
  setInputValue,
}: {
  onSendMessage: (message: string) => void;
  agentStatus?: string;
  activeTaskId?: string | null;
  onStopTask?: (taskId: string) => Promise<void>;
  inputValue: string;
  setInputValue: (value: string) => void;
}) {
  const { theme } = useTheme();
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Check if task is currently running
  const isTaskRunning = agentStatus?.toLowerCase() === 'running' || 
                        agentStatus?.toLowerCase() === 'init' || 
                        agentStatus?.toLowerCase() === 'max_loop';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isTaskRunning) {
      setShowWarningModal(true);

      // If task is running, show warning modal instead of stopping directly
      if (inputValue.trim()) {
        setShowWarningModal(true);
      }
    } else if (inputValue.trim() && !isProcessing) {
      // Send a new message if no task is running
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  const handleProceed = async () => {
    if (!activeTaskId || !onStopTask) return;
    
    setIsProcessing(true);
    try {
      // First stop the current task
      await onStopTask(activeTaskId);
      setIsProcessing(false);
      
      // Then send the new message
      // const messageToSend = inputValue;
      setInputValue("");
      setShowWarningModal(false);
      
      // // Small delay to ensure the stop request completes
      // setTimeout(() => {
      //   onSendMessage(messageToSend);
      //   setIsProcessing(false);
      // }, 500);
    } catch (error) {
      console.error("Error processing request:", error);
      setIsProcessing(false);
    }
  };

  // Get a readable status label for the placeholder
  const getStatusLabel = () => {
    const status = agentStatus?.toLowerCase();
    if (status === 'running') return "Agent is running...";
    if (status === 'init') return "Agent is initializing...";
    if (status === 'max_loop') return "Agent reached max iterations...";
    return "Describe a trade action";
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <form onSubmit={handleSubmit} className="flex items-center">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={getStatusLabel()}
          disabled={isTaskRunning}
          className={`flex-1 h-10 rounded-full ${
            theme === "light"
              ? "bg-white/50 text-gray-800 placeholder:text-gray-500"
              : "bg-secondary text-secondary-foreground placeholder:text-muted-foreground"
          }`}
        />
        <Button
          type="submit"
          size="icon"
          className="ml-2 w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={{
            background:
              "conic-gradient(from 90deg at 50% 50%, #0E5DFA 0deg, #EC560A 154.05deg, #FDC160 360deg)",
          }}
          title={isTaskRunning ? "Stop task" : "Send message"}
          // disabled={isProcessing}
        >
          {isTaskRunning ? <Loader size={18} className="animate-spin" />  : <Send size={18} />}
        </Button>
      </form>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Already Running</DialogTitle>
            <DialogDescription>
              There is already an agent task in progress. Do you want to stop the current task and send a new instruction?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowWarningModal(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleProceed}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? "Processing..." : "Stop & Send New Instruction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
