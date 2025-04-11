"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Remove the RobustLivenessDetection import and only keep NoCameraVerification
const NoCameraVerification = dynamic(() => import("./no-camera-verification"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading verification...</p>
    </div>
  ),
})

interface SmartVerificationProps {
  onComplete: (result: any) => void
  isProcessing?: boolean
}

// Replace the entire component implementation with a simpler version that only uses NoCameraVerification
export function SmartVerification({ onComplete, isProcessing = false }: SmartVerificationProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-center">Initializing verification...</p>
      </div>
    )
  }

  return <NoCameraVerification onComplete={onComplete} isProcessing={isProcessing} />
}

export default SmartVerification
