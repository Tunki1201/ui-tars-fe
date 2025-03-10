"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import ChatHeader from "@/components/chat-header";
import WelcomeModal from "@/components/welcome-modal";
import ChatInput from "@/components/chat-input";
import TradeActions from "@/components/trade-actions";
import BackgroundLogo from "@/components/background-logo";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [messages, setMessages] = useState<{ text: string; isUser: boolean }[]>(
    []
  );
  const { theme } = useTheme();

  const handleSendMessage = (message: string) => {
    setShowWelcome(false); // Hide welcome modal when first message is sent
    setMessages([...messages, { text: message, isUser: true }]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          text: "I've processed your request. Your trade is being executed.",
          isUser: false,
        },
      ]);
    }, 1000);
  };

  return (
    <div
      className={`flex h-screen ${
        theme === "light" ? "light-mode-gradient" : "bg-background"
      }`}
    >
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader />
        <div className="flex-1 m-8 overflow-y-auto border rounded-lg relative">
          <BackgroundLogo />
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-4 p-4`}
            >
              <Card
                className={`inline-block p-3 max-w-[80%] ${
                  msg.isUser
                    ? "text-primary"
                    : "text-secondary-foreground"
                }`}
              >
                {msg.text}
              </Card>
            </div>
          ))}
          {showWelcome && (
            <div className="absolute inset-0 flex items-center justify-center">
              <WelcomeModal onClose={() => setShowWelcome(false)} />
            </div>
          )}
        </div>
        <div className="p-4">
          <TradeActions />
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </main>
    </div>
  );
}
