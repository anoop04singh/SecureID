"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamically import components with no SSR
const CameraLivenessDetection = dynamic(
  () => import("./camera-liveness-detection").then((mod) => mod.CameraLivenessDetection),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-center">Loading camera liveness detection...</p>
      </div>
    ),
  },
)

const NoCameraVerification = dynamic(() => import("./no-camera-verification"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading verification system...</p>
    </div>
  ),
})

const FallbackLivenessDetection = dynamic(() => import("./fallback-liveness-detection"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading verification system...</p>
    </div>
  ),
})

interface SmartLivenessVerificationProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function SmartLivenessVerification({ onComplete, isProcessing = false }: SmartLivenessVerificationProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [useCameraMethod, setUseCameraMethod] = useState(true)
  const [cameraFailed, setCameraFailed] = useState(false)
  const [faceApiLoadError, setFaceApiLoadError] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Check if camera is likely to be available
    const checkCameraSupport = async () => {
      try {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.log("MediaDevices API not available, using fallback verification")
          setUseCameraMethod(false)
          return
        }

        // Try to access the camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })

        // Stop all tracks immediately
        stream.getTracks().forEach((track) => track.stop())

        // Try to load face-api
        try {
          // Just test if we can import the module
          await import("@vladmandic/face-api")
          console.log("Face-api loaded successfully")
        } catch (error) {
          console.error("Face-api failed to load:", error)
          setFaceApiLoadError(true)
          setUseCameraMethod(false)
          return
        }

        // Camera is available
        console.log("Camera access successful, using camera-based verification")
        setUseCameraMethod(true)
      } catch (error) {
        console.error("Camera access failed, using fallback verification:", error)
        setUseCameraMethod(false)
      }
    }

    checkCameraSupport()
  }, [])

  const handleCameraVerificationComplete = (success: boolean) => {
    if (!success && !cameraFailed) {
      // If camera verification failed, try the fallback method
      console.log("Camera verification failed, switching to fallback method")
      setCameraFailed(true)
      setUseCameraMethod(false)
    } else {
      // Otherwise, complete the verification
      onComplete(success)
    }
  }

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-center">Initializing verification system...</p>
      </div>
    )
  }

  if (faceApiLoadError) {
    return <FallbackLivenessDetection onComplete={onComplete} isProcessing={isProcessing} />
  }

  if (useCameraMethod && !cameraFailed) {
    return (
      <CameraLivenessDetection
        onComplete={(success) => {
          if (success) {
            onComplete(true)
          } else {
            // If camera detection fails, try again or show error
            // We don't fall back to captcha since verification is mandatory
            setUseCameraMethod(true)
          }
        }}
        isProcessing={isProcessing}
      />
    )
  } else {
    return <NoCameraVerification onComplete={onComplete} isProcessing={isProcessing} />
  }
}

export default SmartLivenessVerification
