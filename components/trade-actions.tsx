"use client"

import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

interface TradeActionsProps {
  setInputValue: (value: string) => void;
}

export default function TradeActions({ setInputValue }: TradeActionsProps) {
  const { theme } = useTheme()
  const actions = [
    "Buy 200 USDC worth of WIF on Raydium.",
    "Swap 150 USDC for SOL on Jupiter.",
    "Send 0.5 SOL to 0xA4...F5D2.",
    "Place a limit order to buy 0.5 SOL at $85.",
  ]

  return (
    <div className="flex justify-center gap-2 mb-4 max-w-3xl mx-auto cursor-pointer">
      {actions.map((action, i) => (
        <Button
          key={i}
          variant="secondary"
          className={`px-4 h-8 rounded-full text-sm ${theme === "light" ? "bg-white/50" : "bg-white/5"}`}
          onClick={() => setInputValue(action)}
        >
          {action}
        </Button>
      ))}
    </div>
  )
}