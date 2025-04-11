"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface LivenessDetectionV2Props {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function LivenessDetectionV2({ onComplete, isProcessing = false }: LivenessDetectionV2Props) {
  // State
  const [isLoading, setIsLoading] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string>("Initializing...")
  const [detectionProgress, setDetectionProgress] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [faceDetected, setFaceDetected] = useState(false)
  const [blinkDetected, setBlinkDetected] = useState(false)
  const [headTurnDetected, setHeadTurnDetected] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const faceApiRef = useRef<any>(null)
  const detectorRef = useRef<any>(null)

  // Detection tracking refs
  const blinkCountRef = useRef(0)
  const headTurnCountRef = useRef(0)
  const lastEarRef = useRef<number>(0.3)
  const lastFacePosRef = useRef<{ x: number; y: number } | null>(null)
  const lastBlinkTimeRef = useRef(0)
  const lastTurnTimeRef = useRef(0)

  // Load face-api
  useEffect(() => {
    async function loadFaceApi() {
      try {
        setIsLoading(true)
        setInstructions("Loading face detection...")

        // Import face-api dynamically
        const faceapi = await import("@vladmandic/face-api")
        faceApiRef.current = faceapi

        console.log("Face API loaded, loading models...")

        // Load models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        ])

        console.log("Models loaded successfully")

        // Create detector
        detectorRef.current = new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5,
        })

        setIsLoading(false)
        setInstructions("Ready! Click 'Start Liveness Check' to begin")
      } catch (error) {
        console.error("Error loading face detection:", error)
        setError("Failed to load face detection. Please refresh and try again.")
        setIsLoading(false)
      }
    }

    loadFaceApi()

    return () => {
      stopCamera()
    }
  }, [])

  // Start camera
  const startCamera = async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in your browser")
      }

      // Request camera access
      console.log("Requesting camera access...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        // Set up video element
        videoRef.current.srcObject = stream

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                console.log("Camera started successfully")
                setCameraActive(true)
                setInstructions("Position your face in the center of the frame")

                // Reset detection state
                setFaceDetected(false)
                setBlinkDetected(false)
                setHeadTurnDetected(false)
                setDetectionProgress(0)
                blinkCountRef.current = 0
                headTurnCountRef.current = 0
                lastEarRef.current = 0.3
                lastFacePosRef.current = null
                lastBlinkTimeRef.current = 0
                lastTurnTimeRef.current = 0

                // Start detection loop
                requestAnimationFrame(detectFace)
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
      stopCamera()
    }
  }

  // Stop camera
  const stopCamera = () => {
    console.log("Stopping camera...")

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.pause()
    }

    setCameraActive(false)
  }

  // Face detection loop
  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive || !faceApiRef.current || !detectorRef.current) {
      return
    }

    try {
      const faceapi = faceApiRef.current
      const video = videoRef.current
      const canvas = canvasRef.current

      // Make sure video is playing and has dimensions
      if (video.paused || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameRef.current = requestAnimationFrame(detectFace)
        return
      }

      // Set canvas dimensions
      const displaySize = { width: video.videoWidth, height: video.videoHeight }
      faceapi.matchDimensions(canvas, displaySize)

      // Detect faces with landmarks
      const detections = await faceapi.detectAllFaces(video, detectorRef.current).withFaceLandmarks()

      // Clear canvas
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }

      // Draw detections
      const resizedDetections = faceapi.resizeResults(detections, displaySize)
      faceapi.draw.drawDetections(canvas, resizedDetections)
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

      // Process detection results
      if (detections.length > 0) {
        // Face detected
        if (!faceDetected) {
          console.log("Face detected!")
          setFaceDetected(true)
          setInstructions("Face detected! Now please blink a few times")
          setDetectionProgress(33)
        }

        const detection = detections[0]
        const landmarks = detection.landmarks
        const leftEye = landmarks.getLeftEye()
        const rightEye = landmarks.getRightEye()

        // Calculate eye aspect ratio (EAR)
        const leftEAR = calculateEAR(leftEye)
        const rightEAR = calculateEAR(rightEye)
        const currentEAR = (leftEAR + rightEAR) / 2

        // Get face position
        const facePos = {
          x: detection.detection.box.x + detection.detection.box.width / 2,
          y: detection.detection.box.y + detection.detection.box.height / 2,
        }

        // Update debug info
        setDebugInfo(
          `Face: (${Math.round(facePos.x)}, ${Math.round(facePos.y)}) | EAR: ${currentEAR.toFixed(2)} | Blinks: ${blinkCountRef.current} | Turns: ${headTurnCountRef.current}`,
        )

        // Blink detection
        if (faceDetected && !blinkDetected) {
          const now = Date.now()

          // Detect blink when EAR drops significantly
          if (
            lastEarRef.current > 0.2 &&
            currentEAR < 0.2 &&
            now - lastBlinkTimeRef.current > 1000 && // Prevent double counting
            blinkCountRef.current < 3
          ) {
            blinkCountRef.current++
            lastBlinkTimeRef.current = now
            console.log(`Blink detected (${blinkCountRef.current}/3)`)

            if (blinkCountRef.current >= 3) {
              console.log("Blink detection complete!")
              setBlinkDetected(true)
              setInstructions("Great! Now please turn your head slightly left and right")
              setDetectionProgress(66)
            }
          }
        }

        // Head turn detection
        if (blinkDetected && !headTurnDetected && lastFacePosRef.current) {
          const now = Date.now()
          const xDiff = Math.abs(facePos.x - lastFacePosRef.current.x)

          // Detect head turn when face position changes significantly
          if (
            xDiff > 40 &&
            now - lastTurnTimeRef.current > 1000 && // Prevent double counting
            headTurnCountRef.current < 2
          ) {
            headTurnCountRef.current++
            lastTurnTimeRef.current = now
            console.log(`Head turn detected (${headTurnCountRef.current}/2)`)

            if (headTurnCountRef.current >= 2) {
              console.log("Head turn detection complete!")
              setHeadTurnDetected(true)
              setInstructions("Liveness check complete!")
              setDetectionProgress(100)

              // Complete the check after a short delay
              setTimeout(() => {
                stopCamera()
                onComplete(true)
              }, 1500)
            }
          }
        }

        // Update references for next frame
        lastEarRef.current = currentEAR
        lastFacePosRef.current = facePos
      } else {
        // No face detected
        if (faceDetected) {
          setInstructions("Face lost. Please position your face in the center of the frame")
        }
      }
    } catch (error) {
      console.error("Error in face detection:", error)
    }

    // Continue detection loop
    if (cameraActive) {
      animationFrameRef.current = requestAnimationFrame(detectFace)
    }
  }

  // Calculate eye aspect ratio
  const calculateEAR = (eye: any) => {
    if (!eye || eye.length < 6) {
      return 0.3 // Default value
    }

    try {
      // Vertical distances
      const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2))
      const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2))

      // Horizontal distance
      const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2))

      // Calculate EAR
      return h === 0 ? 0.3 : (v1 + v2) / (2.0 * h)
    } catch (error) {
      console.error("Error calculating EAR:", error)
      return 0.3 // Default value on error
    }
  }

  // Cancel check
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
          {/* Video element */}
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />

          {/* Canvas overlay */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10" />

          {/* Loading overlay */}
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

          {/* Debug info */}
          {showDebug && cameraActive && (
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

            {/* Step indicators */}
            <div className="flex justify-between mt-3">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${faceDetected ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Face</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${blinkDetected ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Blink</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${headTurnDetected ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Turn</span>
              </div>
            </div>
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
        <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="text-xs">
          {showDebug ? "Hide Debug" : "Debug"}
        </Button>
      </div>
    </div>
  )
}

export default LivenessDetectionV2
