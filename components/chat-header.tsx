"use client"

import { MessageSquare, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ChatHeader() {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex-1"></div>
      <div className="flex space-x-2">
        <Button
          className="flex items-center px-4 py-2 rounded-full text-white"
          style={{
            background: "linear-gradient(92.58deg, #0E5DFA 0%, #EC560A 50%, #FDC160 100%)",
          }}
        >
          <MessageSquare size={18} className="mr-2" />
          Chat
        </Button>
        <Button variant="outline" className="flex items-center px-4 py-2 rounded-full">
          <Globe size={18} className="mr-2" />
          Browser
        </Button>
      </div>
      <div className="flex-1 flex justify-end items-center space-x-4">
        <div className="flex items-center px-3 py-1 rounded-full border border-border">
          <span className="text-sm">0xA4...F5D2</span>
          <Badge variant="destructive" className="ml-2 w-6 h-6 rounded-full flex items-center justify-center">
            2
          </Badge>
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}
