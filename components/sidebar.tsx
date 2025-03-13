"use client"

import type React from "react"

import { CheckSquare, Activity, Link2, Settings, MessageCircleMore } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function Sidebar() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Only show the theme-dependent content after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine logo source based on theme, but only after component has mounted
  const logoSrc = mounted ? (resolvedTheme === "dark" ? "/logo-b.png" : "/logo-light.png") : null

  return (
    <div className="w-20 flex flex-col items-center py-6 bg-card border-r border-border">
      <div className="mb-1 w-16 h-16 flex items-center justify-center">
        {mounted ? (
          <Image
            src={logoSrc || "/logo-light.png"} // Fallback to light logo if not mounted yet
            alt="Logo"
            width={16}
            height={16}
            className="object-contain w-6 h-6"
          />
        ) : (
          // Placeholder while loading to avoid hydration mismatch
          <div className="w-4 h-4 bg-muted rounded-sm"></div>
        )}
      </div>

      <nav className="flex-1 flex flex-col items-center space-y-6">
        <SidebarItem icon={<MessageCircleMore size={20} />} label="Chat" active />
        <SidebarItem icon={<CheckSquare size={20} />} label="Tasks" />
        <SidebarItem icon={<Activity size={20} />} label="Flows" />
        <SidebarItem icon={<Link2 size={20} />} label="Billing" />
        <SidebarItem icon={<Settings size={20} />} label="Settings" />
      </nav>
    </div>
  )
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "flex flex-col items-center justify-center h-auto space-y-1.5 p-0 hover:bg-transparent",
        active ? "text-[#EC560A]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-normal">{label}</span>
    </Button>
  )
}

