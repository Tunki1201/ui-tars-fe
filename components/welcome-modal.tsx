"use client"

import { X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <Card
      className="w-[500px] relative"
      style={{
        background: `linear-gradient(0deg, var(--Module, rgba(246, 246, 246, 0.15)), var(--Module, rgba(246, 246, 246, 0.15))),
        radial-gradient(100% 100% at 50% 0%, rgba(236, 86, 10, 0.2) 0%, rgba(236, 86, 10, 0) 52.61%)`,
      }}
    >
      <Button
        onClick={onClose}
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
      >
        <X size={20} />
      </Button>

      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 flex items-center">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center mr-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="2" fill="white" />
                <rect x="14" y="3" width="7" height="7" rx="2" fill="white" />
                <rect x="3" y="14" width="7" height="7" rx="2" fill="white" />
                <rect x="14" y="14" width="7" height="7" rx="2" fill="white" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">sentia</h2>
          </div>

          <p className="text-gray-600 mb-6 max-w-md">
            This tool automates crypto trading for you. Just enter a trade action, and Sentius will execute it step by
            step while you watch in real time.
          </p>

        </div>
      </CardContent>
    </Card>
  )
}

