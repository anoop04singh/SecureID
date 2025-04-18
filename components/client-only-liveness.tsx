"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

// Update the import to use SmartLivenessVerification instead of NoCameraVerification
const SmartLivenessVerification = dynamic(() => import("./smart-liveness-verification"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading verification system...</p>
    </div>
  ),
})

interface ClientOnlyLivenessProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

// Update the component to use SmartLivenessVerification directly
export function ClientOnlyLiveness({ onComplete, isProcessing = false }: ClientOnlyLivenessProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-center">Initializing verification system...</p>
      </div>
    )
  }

  return <SmartLivenessVerification onComplete={onComplete} isProcessing={isProcessing} />
}
