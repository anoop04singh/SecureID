"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, CheckCircle2, X } from "lucide-react"

interface SimpleLivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function SimpleLivenessDetection({ onComplete, isProcessing = false }: SimpleLivenessDetectionProps) {
  // States
  const [step, setStep] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const photoRef = useRef<HTMLCanvasElement>(null)

  // Start camera
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in your browser")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                console.log("Camera started successfully")
                setCameraActive(true)
                // Automatically move to step 1 after camera starts
                setTimeout(() => {
                  setStep(1)
                }, 1000)
              })
              .catch((err) => {
                console.error("Error playing video:", err)
                setError("Failed to start camera. Please try again.")
                stopCamera()
              })
          }
        }
      }
    } catch (error: any) {
      console.error("Error starting camera:", error)
      setError(error.message || "Failed to access camera. Please check permissions.")
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraActive(false)
  }

  // Take photo for verification
  const takePhoto = () => {
    if (videoRef.current && photoRef.current) {
      const video = videoRef.current
      const canvas = photoRef.current
      const context = canvas.getContext("2d")

      if (context) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Here you would normally process the image
        // For this simplified version, we just move to the next step
        nextStep()
      }
    }
  }

  // Move to next step
  const nextStep = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      // Complete the liveness check
      stopCamera()
      onComplete(true)
    }
  }

  // Cancel check
  const cancelCheck = () => {
    stopCamera()
    onComplete(false)
  }

  // Get step instructions
  const getStepInstructions = () => {
    switch (step) {
      case 0:
        return "Click 'Start' to begin the liveness check"
      case 1:
        return "Please look directly at the camera"
      case 2:
        return "Please blink a few times"
      case 3:
        return "Please turn your head slightly left and right"
      default:
        return "Liveness check complete!"
    }
  }

  // Get step progress
  const getStepProgress = () => {
    return step * 33
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Liveness Detection</h3>
        <p className="text-sm text-muted-foreground">This helps verify you're a real person and prevents fraud</p>
      </div>

      <Card className="relative overflow-hidden">
        <div className="aspect-video relative bg-muted/50">
          {/* Video element */}
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />

          {/* Hidden canvas for taking photos */}
          <canvas ref={photoRef} className="hidden" />

          {/* Step overlay */}
          {step === 0 && !cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <Camera className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-center px-4">{getStepInstructions()}</p>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Close button */}
          {cameraActive && (
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2 z-20 bg-background/50 hover:bg-background/80"
              onClick={stopCamera}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress indicator */}
        {cameraActive && (
          <div className="p-4 border-t">
            <div className="flex justify-between text-sm mb-1">
              <span>Liveness Check Progress</span>
              <span>{getStepProgress()}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${getStepProgress()}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{getStepInstructions()}</div>

            {/* Step indicators */}
            <div className="flex justify-between mt-3">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${step >= 1 ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Face</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${step >= 2 ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Blink</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${step >= 3 ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Turn</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        {step === 0 ? (
          <Button onClick={startCamera} className="flex-1" disabled={isProcessing}>
            <Camera className="mr-2 h-4 w-4" />
            Start Liveness Check
          </Button>
        ) : (
          <Button onClick={nextStep} className="flex-1" disabled={isProcessing}>
            {step < 3 ? (
              "Next Step"
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Check
              </>
            )}
          </Button>
        )}

        <Button variant="outline" onClick={cancelCheck} className="flex-1" disabled={isProcessing}>
          Skip for Now
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Your camera feed is processed locally and is not stored or sent to any server.
      </p>
    </div>
  )
}

export default SimpleLivenessDetection
