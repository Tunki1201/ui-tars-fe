"use client";

import {
  CheckSquare,
  Activity,
  Link2,
  Settings,
  MessageCircleMore,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Sidebar() {
  return (
    <div className="w-20 flex flex-col items-center py-6 bg-card border-r border-border">
      <div className="mb-8">
        <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="2"
              width="4.5"
              height="4.5"
              rx="1.25"
              fill="currentColor"
            />
            <rect
              x="9.5"
              y="2"
              width="4.5"
              height="4.5"
              rx="1.25"
              fill="currentColor"
            />
            <rect
              x="2"
              y="9.5"
              width="4.5"
              height="4.5"
              rx="1.25"
              fill="currentColor"
            />
            <rect
              x="9.5"
              y="9.5"
              width="4.5"
              height="4.5"
              rx="1.25"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      <nav className="flex-1 flex flex-col items-center space-y-6">
        <SidebarItem
          icon={<MessageCircleMore size={20} />}
          label="Chat"
          active
        />
        <SidebarItem icon={<CheckSquare size={20} />} label="Tasks" />
        <SidebarItem icon={<Activity size={20} />} label="Flows" />
        <SidebarItem icon={<Link2 size={20} />} label="Billing" />
        <SidebarItem icon={<Settings size={20} />} label="Settings" />
      </nav>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "flex flex-col items-center justify-center h-auto space-y-1.5 p-0 hover:bg-transparent",
        active
          ? "text-[#EC560A]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-normal">{label}</span>
    </Button>
  );
}
