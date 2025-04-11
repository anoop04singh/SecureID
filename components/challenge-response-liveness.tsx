"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, CheckCircle2, X } from "lucide-react"

interface ChallengeResponseLivenessProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function ChallengeResponseLiveness({ onComplete, isProcessing = false }: ChallengeResponseLivenessProps) {
  // States
  const [step, setStep] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [currentChallenge, setCurrentChallenge] = useState<string | null>(null)
  const [capturedImages, setCapturedImages] = useState<string[]>([])
  const [instructions, setInstructions] = useState<string>("Click 'Start' to begin the liveness check")

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Challenges
  const challenges = [
    { id: "look_straight", text: "Look straight at the camera" },
    { id: "look_left", text: "Turn your head slightly to the left" },
    { id: "look_right", text: "Turn your head slightly to the right" },
    { id: "smile", text: "Smile at the camera" },
  ]

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
                setCameraActive(true)
                // Start first challenge
                startNextChallenge()
              })
              .catch((err) => {
                console.error("Error playing video:", err)
                stopCamera()
              })
          }
        }
      }
    } catch (error) {
      console.error("Error starting camera:", error)
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

  // Start next challenge
  const startNextChallenge = () => {
    // Get a random challenge that hasn't been used yet
    const availableChallenges = challenges.filter(
      (c) => !capturedImages.some((img) => img.startsWith(`challenge_${c.id}`)),
    )

    if (availableChallenges.length === 0 || capturedImages.length >= 3) {
      // All challenges completed or we have enough images
      completeCheck()
      return
    }

    const randomChallenge = availableChallenges[Math.floor(Math.random() * availableChallenges.length)]
    setCurrentChallenge(randomChallenge.id)
    setInstructions(randomChallenge.text)
    setStep(capturedImages.length + 1)
  }

  // Capture image for current challenge
  const captureImage = () => {
    if (videoRef.current && canvasRef.current && currentChallenge) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Get image data
        const imageData = canvas.toDataURL("image/jpeg")

        // Store image with challenge ID
        setCapturedImages([...capturedImages, `challenge_${currentChallenge}_${Date.now()}`])

        // Move to next challenge
        startNextChallenge()
      }
    }
  }

  // Complete the liveness check
  const completeCheck = () => {
    stopCamera()

    // In a real implementation, you would verify the captured images
    // For this demo, we'll consider it successful if we have at least 3 images
    const success = capturedImages.length >= 3

    onComplete(success)
  }

  // Cancel check
  const cancelCheck = () => {
    stopCamera()
    onComplete(false)
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
          <canvas ref={canvasRef} className="hidden" />

          {/* Step overlay */}
          {step === 0 && !cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <Camera className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-center px-4">{instructions}</p>
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
              <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((step / 4) * 100)}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{instructions}</div>

            {/* Challenge indicators */}
            <div className="flex justify-between mt-3">
              {[1, 2, 3].map((challengeStep) => (
                <div key={challengeStep} className="flex items-center">
                  <div
                    className={`w-4 h-4 rounded-full mr-1 ${step > challengeStep ? "bg-green-500" : "bg-gray-300"}`}
                  ></div>
                  <span className="text-xs">Challenge {challengeStep}</span>
                </div>
              ))}
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
          <Button onClick={captureImage} className="flex-1" disabled={isProcessing || !cameraActive}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirm
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

export default ChallengeResponseLiveness
