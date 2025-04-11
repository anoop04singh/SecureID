"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface LivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function LivenessDetection({ onComplete, isProcessing = false }: LivenessDetectionProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isDetecting, setIsDetecting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string>("Initializing face detection...")
  const [detectionProgress, setDetectionProgress] = useState(0)
  const [detectionSteps, setDetectionSteps] = useState<{
    faceDetected: boolean
    blinkDetected: boolean
    headTurnDetected: boolean
  }>({
    faceDetected: false,
    blinkDetected: false,
    headTurnDetected: false,
  })
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const modelsLoadedRef = useRef(false)
  const faceApiRef = useRef<any>(null)

  // Previous face landmarks for tracking changes
  const prevEyeAspectRatioRef = useRef<number | null>(null)
  const prevFacePositionRef = useRef<{ x: number; y: number } | null>(null)
  const blinkCountRef = useRef(0)
  const headTurnCountRef = useRef(0)
  const lastBlinkTimeRef = useRef(0)
  const lastHeadTurnTimeRef = useRef(0)

  // Load face-api models
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return

    async function loadFaceApi() {
      try {
        // Dynamically import face-api.js
        const faceapi = await import("@vladmandic/face-api")
        faceApiRef.current = faceapi
        console.log("Face API library imported successfully")
        return faceapi
      } catch (error) {
        console.error("Error importing face-api:", error)
        setError("Failed to load face detection library. Please refresh and try again.")
        setIsLoading(false)
        return null
      }
    }

    async function loadModels() {
      try {
        setIsLoading(true)
        setInstructions("Loading face detection models...")

        const faceapi = await loadFaceApi()
        if (!faceapi) return

        // Set the models path
        const MODEL_URL = "/models"

        // Log models we're trying to load
        console.log("Attempting to load models from:", MODEL_URL)

        // Load the required models
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        console.log("TinyFaceDetector model loaded successfully")

        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        console.log("FaceLandmark68 model loaded successfully")

        console.log("All face detection models loaded successfully")
        modelsLoadedRef.current = true
        setInstructions("Models loaded. Click 'Start Liveness Check' to begin.")
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading face detection models:", error)
        setError(
          `Failed to load face detection models: ${error instanceof Error ? error.message : "Unknown error"}. Please refresh and try again.`,
        )
        setIsLoading(false)
      }
    }

    loadModels()

    return () => {
      stopCamera()
    }
  }, [])

  // Start camera
  const startCamera = async () => {
    try {
      setError(null)
      setIsDetecting(true)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in your browser")
      }

      // Request front camera
      const constraints = {
        video: {
          facingMode: "user", // Use front camera
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      }

      console.log("Requesting camera access...")
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
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
                setInstructions("Position your face in the center of the frame")

                // Reset detection state
                setDetectionSteps({
                  faceDetected: false,
                  blinkDetected: false,
                  headTurnDetected: false,
                })
                setDetectionProgress(0)
                blinkCountRef.current = 0
                headTurnCountRef.current = 0
                prevEyeAspectRatioRef.current = null
                prevFacePositionRef.current = null
                lastBlinkTimeRef.current = 0
                lastHeadTurnTimeRef.current = 0

                // Start detection process
                startDetection()
              })
              .catch((err) => {
                console.error("Error playing video:", err)
                setError("Failed to start camera feed. Please try again.")
                stopCamera()
              })
          }
        }
      }
    } catch (error: any) {
      console.error("Error starting camera:", error)
      setError(error.message || "Failed to access camera. Please check your camera permissions.")
      setIsDetecting(false)
    }
  }

  // Stop camera
  const stopCamera = () => {
    console.log("Stopping camera...")

    // Stop the animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("Camera track stopped")
      })
      streamRef.current = null
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.pause()
    }

    setCameraActive(false)
    setIsDetecting(false)
  }

  // Start face detection process
  const startDetection = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      return
    }

    console.log("Starting face detection process")
    detectFace()
  }

  // Detect face and perform liveness checks
  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive || !faceApiRef.current) {
      return
    }

    try {
      const faceapi = faceApiRef.current
      const video = videoRef.current
      const canvas = canvasRef.current

      // Make sure video dimensions are available
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log("Video dimensions not ready yet")
        animationFrameRef.current = requestAnimationFrame(detectFace)
        return
      }

      const displaySize = { width: video.videoWidth, height: video.videoHeight }

      // Resize canvas to match video dimensions
      faceapi.matchDimensions(canvas, displaySize)

      // Detect face with landmarks
      const detections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          }),
        )
        .withFaceLandmarks()

      // Clear canvas
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }

      // Check if we got any detections
      if (detections.length === 0) {
        setDebugInfo("No faces detected")

        // No face detected
        if (detectionSteps.faceDetected) {
          setInstructions("Face lost. Please position your face in the center of the frame")
        }

        animationFrameRef.current = requestAnimationFrame(detectFace)
        return
      }

      // Draw detections
      const resizedDetections = faceapi.resizeResults(detections, displaySize)
      faceapi.draw.drawDetections(canvas, resizedDetections)
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

      // Face detected - update state if this is the first time
      if (!detectionSteps.faceDetected) {
        console.log("Face detected for the first time")
        setDetectionSteps((prev) => ({ ...prev, faceDetected: true }))
        setInstructions("Face detected! Now please blink a few times")
        setDetectionProgress(33)
      }

      const detection = detections[0]
      const landmarks = detection.landmarks
      const leftEye = landmarks.getLeftEye()
      const rightEye = landmarks.getRightEye()

      // Calculate eye aspect ratio (EAR) for blink detection
      const leftEAR = calculateEyeAspectRatio(leftEye)
      const rightEAR = calculateEyeAspectRatio(rightEye)
      const earAvg = (leftEAR + rightEAR) / 2

      // Get face position for head turn detection
      const facePosition = {
        x: detection.detection.box.x + detection.detection.box.width / 2,
        y: detection.detection.box.y + detection.detection.box.height / 2,
      }

      setDebugInfo(
        `Face: ${Math.round(facePosition.x)},${Math.round(facePosition.y)} | EAR: ${earAvg.toFixed(2)} | Blinks: ${blinkCountRef.current} | Turns: ${headTurnCountRef.current}`,
      )

      // Blink detection
      if (!detectionSteps.blinkDetected) {
        if (prevEyeAspectRatioRef.current !== null) {
          const now = Date.now()
          const timeSinceLastBlink = now - lastBlinkTimeRef.current

          // Blink is detected when EAR drops significantly and then returns
          // Only count blinks that are spaced apart to avoid double-counting
          if (
            prevEyeAspectRatioRef.current > 0.2 &&
            earAvg < 0.2 &&
            timeSinceLastBlink > 1000 && // 1 second between blinks
            blinkCountRef.current < 3
          ) {
            blinkCountRef.current++
            lastBlinkTimeRef.current = now
            console.log(`Blink detected (${blinkCountRef.current}/3)`)

            if (blinkCountRef.current >= 3) {
              console.log("Blink detection completed")
              setDetectionSteps((prev) => ({ ...prev, blinkDetected: true }))
              setInstructions("Great! Now please turn your head slightly left and right")
              setDetectionProgress(66)
            }
          }
        }
      }

      // Head turn detection
      if (detectionSteps.blinkDetected && !detectionSteps.headTurnDetected) {
        if (prevFacePositionRef.current !== null) {
          const xDiff = Math.abs(facePosition.x - prevFacePositionRef.current.x)
          const now = Date.now()
          const timeSinceLastTurn = now - lastHeadTurnTimeRef.current

          // Head turn is detected when face position changes significantly
          // Only count turns that are spaced apart to avoid double-counting
          if (
            xDiff > 30 &&
            timeSinceLastTurn > 1000 && // 1 second between turns
            headTurnCountRef.current < 2
          ) {
            headTurnCountRef.current++
            lastHeadTurnTimeRef.current = now
            console.log(`Head turn detected (${headTurnCountRef.current}/2)`)

            if (headTurnCountRef.current >= 2) {
              console.log("Head turn detection completed")
              setDetectionSteps((prev) => ({ ...prev, headTurnDetected: true }))
              setInstructions("Liveness check complete!")
              setDetectionProgress(100)

              // Complete the liveness check after a short delay
              setTimeout(() => {
                stopCamera()
                onComplete(true)
              }, 1500)
            }
          }
        }
      }

      // Update previous values for next frame
      prevEyeAspectRatioRef.current = earAvg
      prevFacePositionRef.current = facePosition
    } catch (error) {
      console.error("Error in face detection:", error)
    }

    // Continue detection loop
    if (cameraActive) {
      animationFrameRef.current = requestAnimationFrame(detectFace)
    }
  }

  // Calculate eye aspect ratio for blink detection
  const calculateEyeAspectRatio = (eye: any) => {
    if (!eye || eye.length < 6) {
      return 0.3 // Default EAR when no valid eye landmarks
    }

    // Vertical eye landmarks distances
    const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2))
    const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2))

    // Horizontal eye landmarks distance
    const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2))

    // Return eye aspect ratio (avoid division by zero)
    return h === 0 ? 0.3 : (v1 + v2) / (2.0 * h)
  }

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
  }

  // Cancel liveness check
  const cancelCheck = () => {
    stopCamera()
    onComplete(false)
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Liveness Detection</h3>
        <p className="text-sm text-muted-foreground">This helps verify you're a real person and prevents fraud</p>
      </div>

      <Card className="relative overflow-hidden">
        <div className="aspect-video relative bg-muted/50">
          {/* Video element for camera feed */}
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />

          {/* Canvas overlay for drawing face landmarks */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10" />

          {/* Loading or instructions overlay */}
          {(isLoading || !cameraActive) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              ) : (
                <Camera className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <p className="text-sm text-center px-4">{instructions}</p>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Close button when camera is active */}
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

          {/* Debug information */}
          {debugMode && cameraActive && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 z-20 rounded">
              {debugInfo}
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {cameraActive && (
          <div className="p-4 border-t">
            <div className="flex justify-between text-sm mb-1">
              <span>Liveness Check Progress</span>
              <span>{detectionProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${detectionProgress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{instructions}</div>
          </div>
        )}
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {!cameraActive && !isProcessing && (
          <Button onClick={startCamera} className="flex-1" disabled={isLoading || isProcessing}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Start Liveness Check
              </>
            )}
          </Button>
        )}

        <Button variant="outline" onClick={cancelCheck} className="flex-1" disabled={isProcessing}>
          Skip for Now
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Your camera feed is processed locally and is not stored or sent to any server.
        </p>
        <Button variant="ghost" size="sm" onClick={toggleDebugMode} className="text-xs">
          {debugMode ? "Hide Debug" : "Debug"}
        </Button>
      </div>
    </div>
  )
}

export default LivenessDetection
