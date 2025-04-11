"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, X, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface RobustLivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function RobustLivenessDetection({ onComplete, isProcessing = false }: RobustLivenessDetectionProps) {
  // States
  const [step, setStep] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string>("Click 'Start' to begin the liveness check")
  const [progress, setProgress] = useState(0)
  const [verificationCode, setVerificationCode] = useState<string>("")
  const [userInput, setUserInput] = useState<string>("")
  const [motionData, setMotionData] = useState<number[]>([])
  const [motionDetected, setMotionDetected] = useState(false)
  const [colorSequence, setColorSequence] = useState<string[]>([])
  const [currentColorIndex, setCurrentColorIndex] = useState(0)
  const [colorResponses, setColorResponses] = useState<boolean[]>([])
  const [gestureComplete, setGestureComplete] = useState(false)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const motionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const colorIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastImageRef = useRef<ImageData | null>(null)

  // Generate a random verification code
  useEffect(() => {
    if (step === 2) {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      setVerificationCode(code)
    }
  }, [step])

  // Generate random color sequence
  useEffect(() => {
    if (step === 3) {
      const colors = ["red", "green", "blue", "yellow"]
      const sequence = Array(4)
        .fill(0)
        .map(() => colors[Math.floor(Math.random() * colors.length)])
      setColorSequence(sequence)
      startColorSequence()
    }

    return () => {
      if (colorIntervalRef.current) {
        clearInterval(colorIntervalRef.current)
      }
    }
  }, [step])

  // Start camera
  const startCamera = async () => {
    try {
      setError(null)

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
                setStep(1)
                setProgress(20)
                setInstructions("Please move your head or hand to verify motion")
                startMotionDetection()
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
    if (motionCheckIntervalRef.current) {
      clearInterval(motionCheckIntervalRef.current)
      motionCheckIntervalRef.current = null
    }

    if (colorIntervalRef.current) {
      clearInterval(colorIntervalRef.current)
      colorIntervalRef.current = null
    }

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

  // Start motion detection
  const startMotionDetection = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const context = canvas.getContext("2d", { willReadFrequently: true })

    if (!context) return

    // Set canvas size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Initialize motion data array
    setMotionData([])

    // Start motion detection interval
    motionCheckIntervalRef.current = setInterval(() => {
      if (!video.paused && !video.ended) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

        if (lastImageRef.current) {
          const motionScore = detectMotion(lastImageRef.current, imageData)

          // Add motion score to data array
          setMotionData((prev) => {
            const newData = [...prev, motionScore]
            // Keep only the last 10 values
            return newData.slice(-10)
          })

          // Check if enough motion is detected
          const avgMotion = motionData.reduce((sum, val) => sum + val, 0) / motionData.length

          if (avgMotion > 20 && !motionDetected) {
            console.log("Motion detected!")
            setMotionDetected(true)
            setProgress(40)

            // Move to next step after a short delay
            setTimeout(() => {
              if (motionCheckIntervalRef.current) {
                clearInterval(motionCheckIntervalRef.current)
                motionCheckIntervalRef.current = null
              }
              setStep(2)
              setProgress(60)
              setInstructions(`Please type the verification code shown: ${verificationCode}`)
            }, 1000)
          }
        }

        lastImageRef.current = imageData
      }
    }, 100)
  }

  // Detect motion between two frames
  const detectMotion = (prev: ImageData, curr: ImageData): number => {
    const dataLength = prev.data.length
    let diffCount = 0

    // Compare pixels (only every 10th pixel for performance)
    for (let i = 0; i < dataLength; i += 40) {
      // Compare RGB values (skip alpha)
      const rDiff = Math.abs(prev.data[i] - curr.data[i])
      const gDiff = Math.abs(prev.data[i + 1] - curr.data[i + 1])
      const bDiff = Math.abs(prev.data[i + 2] - curr.data[i + 2])

      // If the difference is significant, count it
      if (rDiff > 25 || gDiff > 25 || bDiff > 25) {
        diffCount++
      }
    }

    // Normalize the difference count
    return (diffCount / (dataLength / 40)) * 100
  }

  // Verify code input
  const verifyCode = () => {
    if (userInput === verificationCode) {
      setStep(3)
      setProgress(80)
      setInstructions("Follow the color sequence by pressing the matching color when it appears")
      setUserInput("")
    } else {
      setError("Incorrect code. Please try again.")
    }
  }

  // Start color sequence challenge
  const startColorSequence = () => {
    setCurrentColorIndex(0)
    setColorResponses([])

    // Show each color in sequence with a delay
    colorIntervalRef.current = setInterval(() => {
      setCurrentColorIndex((prev) => {
        const next = prev + 1
        if (next >= colorSequence.length) {
          if (colorIntervalRef.current) {
            clearInterval(colorIntervalRef.current)
          }
          return -1 // No color showing
        }
        return next
      })
    }, 2000)
  }

  // Handle color button click
  const handleColorClick = (color: string) => {
    if (currentColorIndex >= 0 && currentColorIndex < colorSequence.length) {
      const isCorrect = color === colorSequence[currentColorIndex]
      setColorResponses((prev) => [...prev, isCorrect])

      // Check if all responses are collected
      if (colorResponses.length + 1 >= colorSequence.length) {
        // Check if all responses are correct
        const allCorrect = [...colorResponses, isCorrect].every((r) => r)

        if (allCorrect) {
          setGestureComplete(true)
          setProgress(100)
          setInstructions("Liveness check complete!")

          // Complete the check after a short delay
          setTimeout(() => {
            stopCamera()
            onComplete(true)
          }, 1500)
        } else {
          setError("Color sequence incorrect. Please try again.")
          startColorSequence() // Restart the sequence
        }
      }
    }
  }

  // Skip verification
  const skipVerification = () => {
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

          {/* Canvas for processing (hidden) */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Step overlay */}
          {step === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <Camera className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-center px-4">{instructions}</p>
            </div>
          )}

          {/* Verification code overlay */}
          {step === 2 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <div className="text-center space-y-4">
                <h3 className="text-xl font-bold">{verificationCode}</h3>
                <p className="text-sm">Type this code to verify you're human</p>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="px-3 py-2 border rounded-md text-center text-lg w-32"
                  maxLength={6}
                  placeholder="Code"
                />
                <Button onClick={verifyCode} disabled={userInput.length !== 6}>
                  Verify
                </Button>
              </div>
            </div>
          )}

          {/* Color sequence overlay */}
          {step === 3 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-medium">Color Challenge</h3>

                {currentColorIndex >= 0 && currentColorIndex < colorSequence.length ? (
                  <div
                    className="w-24 h-24 mx-auto rounded-full"
                    style={{ backgroundColor: colorSequence[currentColorIndex] }}
                  ></div>
                ) : (
                  <p className="text-sm">Press the matching color when it appears</p>
                )}

                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    onClick={() => handleColorClick("red")}
                    className="w-12 h-12 p-0 rounded-full"
                    style={{ backgroundColor: "red" }}
                  ></Button>
                  <Button
                    onClick={() => handleColorClick("green")}
                    className="w-12 h-12 p-0 rounded-full"
                    style={{ backgroundColor: "green" }}
                  ></Button>
                  <Button
                    onClick={() => handleColorClick("blue")}
                    className="w-12 h-12 p-0 rounded-full"
                    style={{ backgroundColor: "blue" }}
                  ></Button>
                  <Button
                    onClick={() => handleColorClick("yellow")}
                    className="w-12 h-12 p-0 rounded-full"
                    style={{ backgroundColor: "yellow" }}
                  ></Button>
                </div>

                <div className="flex justify-center gap-1 mt-2">
                  {colorResponses.map((correct, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${correct ? "bg-green-500" : "bg-red-500"}`}></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Close button */}
          {cameraActive && step !== 2 && step !== 3 && (
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
        <div className="p-4 border-t">
          <div className="flex justify-between text-sm mb-1">
            <span>Liveness Check Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />

          {step !== 2 && step !== 3 && <div className="mt-2 text-sm text-muted-foreground">{instructions}</div>}

          {/* Step indicators */}
          <div className="flex justify-between mt-3">
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${step >= 1 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Motion</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${step >= 2 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Code</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${step >= 3 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Challenge</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${gestureComplete ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Complete</span>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {step === 0 ? (
          <Button onClick={startCamera} className="flex-1" disabled={isProcessing}>
            <Camera className="mr-2 h-4 w-4" />
            Start Liveness Check
          </Button>
        ) : null}

        {step !== 0 && step !== 2 && step !== 3 && (
          <Button
            onClick={() => {
              if (step === 1) {
                setStep(2)
                setProgress(60)
                setInstructions(`Please type the verification code shown: ${verificationCode}`)
                if (motionCheckIntervalRef.current) {
                  clearInterval(motionCheckIntervalRef.current)
                  motionCheckIntervalRef.current = null
                }
              }
            }}
            className="flex-1"
            disabled={isProcessing || (step === 1 && !motionDetected)}
          >
            Next Step
          </Button>
        )}

        <Button variant="outline" onClick={skipVerification} className="flex-1" disabled={isProcessing}>
          Skip for Now
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Your camera feed is processed locally and is not stored or sent to any server.
      </p>
    </div>
  )
}

export default RobustLivenessDetection
