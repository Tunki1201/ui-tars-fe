"use client"

import { MessageSquare, Globe, Activity, Circle, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"

interface ChatHeaderProps {
  viewMode: "chat" | "browser";
  onViewModeChange: (mode: "chat" | "browser") => void;
  agentStatus?: string | null;
}

export default function ChatHeader({ 
  viewMode, 
  onViewModeChange, 
  agentStatus
}: ChatHeaderProps) {
  // Determine styling based on status
  let statusColor = "text-gray-400";
  let statusBg = "bg-gray-500/10";
  let statusBorder = "border-gray-500/30";
  let StatusIcon = Circle;
  
  const status = agentStatus?.toLowerCase();
  
  if (status === "running" || status === "processing") {
    statusColor = "text-amber-500";
    statusBg = "bg-amber-500/10";
    statusBorder = "border-amber-500/30";
    StatusIcon = Activity;
  } else if (status === "end" || status === "completed") {
    statusColor = "text-green-500";
    statusBg = "bg-green-500/10";
    statusBorder = "border-green-500/30";
    StatusIcon = CheckCircle2;
  } else if (status === "stopped" || status === "error") {
    statusColor = "text-red-500";
    statusBg = "bg-red-500/10";
    statusBorder = "border-red-500/30";
    StatusIcon = XCircle;
  } else if (status === "init") {
    statusColor = "text-blue-500";
    statusBg = "bg-blue-500/10";
    statusBorder = "border-blue-500/30";
    StatusIcon = Circle;
  } else if (status === "max_loop") {
    statusColor = "text-purple-500";
    statusBg = "bg-purple-500/10";
    statusBorder = "border-purple-500/30";
    StatusIcon = Activity;
  }
  
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex-1"></div>
      <div className="flex space-x-2">
        <Button
          className={`flex items-center px-4 py-2 rounded-full ${
            viewMode === "chat" ? "text-white" : ""
          }`}
          style={{
            background: viewMode === "chat" 
              ? "linear-gradient(92.58deg, #0E5DFA 0%, #EC560A 50%, #FDC160 100%)"
              : "transparent"
          }}
          variant={viewMode === "chat" ? "default" : "outline"}
          onClick={() => onViewModeChange("chat")}
        >
          <MessageSquare size={18} className="mr-2" />
          Chat
        </Button>
        <Button 
          variant={viewMode === "browser" ? "default" : "outline"} 
          className={`flex items-center px-4 py-2 rounded-full ${
            viewMode === "browser" ? "text-white" : ""
          }`}
          style={{
            background: viewMode === "browser" 
              ? "linear-gradient(92.58deg, #0E5DFA 0%, #EC560A 50%, #FDC160 100%)"
              : "transparent"
          }}
          onClick={() => onViewModeChange("browser")}
        >
          <Globe size={18} className="mr-2" />
          Browser
        </Button>
      </div>
      <div className="flex-1 flex justify-end items-center space-x-4">
        <div className={`flex items-center px-3 py-1 rounded-full ${statusBg} border ${statusBorder} ${statusColor}`}>
          <StatusIcon size={14} className={`mr-1 ${agentStatus === "RUNNING" || agentStatus === "PROCESSING" ? "animate-pulse" : ""}`} />
          <span className="text-sm font-medium">
            {agentStatus ? `Agent ${agentStatus}` : "Agent Idle"}
          </span>
        </div>
        <div className="flex items-center px-3 py-1 rounded-full border border-border">
        <Image
            src={"/group.png"} // Fallback to light logo if not mounted yet
            alt="Logo"
            width={16}
            height={16}
            className="object-contain w-6 mr-1 h-6"
          />
          <span className="text-sm">0xA4...F5D2</span>
          <Image
            src={"/broken-chain.png"} // Fallback to light logo if not mounted yet
            alt="Logo"
            width={16}
            height={16}
            className="object-contain w-4 ml-1 h-4"
          />
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}