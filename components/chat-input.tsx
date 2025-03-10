"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export default function ChatInput({
  onSendMessage,
}: {
  onSendMessage: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const { theme } = useTheme();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <form onSubmit={handleSubmit} className="flex items-center">
        <Input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe a trade action"
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
        >
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}
