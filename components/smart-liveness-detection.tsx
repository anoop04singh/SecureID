"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamically import components with no SSR
const TensorflowLivenessDetection = dynamic(() => import("./tensorflow-liveness-detection"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading advanced liveness detection...</p>
    </div>
  ),
})

const ChallengeResponseLiveness = dynamic(() => import("./challenge-response-liveness"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading liveness detection...</p>
    </div>
  ),
})

interface SmartLivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function SmartLivenessDetection({ onComplete, isProcessing = false }: SmartLivenessDetectionProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [useTensorflow, setUseTensorflow] = useState(true)

  useEffect(() => {
    setIsMounted(true)

    // Check if TensorFlow.js is likely to work in this browser
    const checkTensorflowSupport = async () => {
      try {
        // Try to import TensorFlow to check if it works
        const tf = await import("@tensorflow/tfjs")

        // Check if WebGL is available (required for TensorFlow.js)
        const webGLSupported = await tf
          .ready()
          .then(() => {
            return tf.getBackend() === "webgl"
          })
          .catch(() => false)

        setUseTensorflow(webGLSupported)
        console.log("TensorFlow.js support check:", webGLSupported ? "Using TensorFlow" : "Using fallback")
      } catch (error) {
        console.error("TensorFlow.js not supported, using fallback:", error)
        setUseTensorflow(false)
      }
    }

    checkTensorflowSupport()
  }, [])

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-center">Initializing liveness detection...</p>
      </div>
    )
  }

  if (useTensorflow) {
    return (
      <TensorflowLivenessDetection
        onComplete={(success) => {
          if (!success) {
            // If TensorFlow detection fails, try the fallback
            setUseTensorflow(false)
          } else {
            onComplete(true)
          }
        }}
        isProcessing={isProcessing}
      />
    )
  } else {
    return <ChallengeResponseLiveness onComplete={onComplete} isProcessing={isProcessing} />
  }
}

export default SmartLivenessDetection
