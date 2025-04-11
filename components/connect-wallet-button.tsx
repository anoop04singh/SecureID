"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/hooks/use-wallet"
import { Loader2 } from "lucide-react"

interface ConnectWalletButtonProps {
  className?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export function ConnectWalletButton({ className, variant = "default", size = "default" }: ConnectWalletButtonProps) {
  const { isConnected, connect, disconnect, address } = useWallet()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      await connect()
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  if (isConnected) {
    return (
      <Button variant="outline" size={size} onClick={disconnect} className={className}>
        {address?.slice(0, 6)}...{address?.slice(-4)} ✕
      </Button>
    )
  }

  return (
    <Button variant={variant} size={size} onClick={handleConnect} disabled={isConnecting} className={className}>
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  )
}
