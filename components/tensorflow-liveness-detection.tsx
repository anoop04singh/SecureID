"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface TensorflowLivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function TensorflowLivenessDetection({ onComplete, isProcessing = false }: TensorflowLivenessDetectionProps) {
  // States
  const [isLoading, setIsLoading] = useState(true)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string>("Loading face detection...")
  const [detectionProgress, setDetectionProgress] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [showDebug, setShowDebug] = useState(false)

  // Detection states
  const [faceDetected, setFaceDetected] = useState(false)
  const [blinkDetected, setBlinkDetected] = useState(false)
  const [headTurnDetected, setHeadTurnDetected] = useState(false)

  // Challenge states
  const [currentChallenge, setCurrentChallenge] = useState<string | null>(null)
  const [challengeCompleted, setChallengeCompleted] = useState(false)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const tfRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const landmarksModelRef = useRef<any>(null)

  // Detection tracking refs
  const blinkCountRef = useRef(0)
  const headTurnCountRef = useRef(0)
  const lastEyeOpenRef = useRef(true)
  const lastFacePosRef = useRef<{ x: number; y: number } | null>(null)
  const lastBlinkTimeRef = useRef(0)
  const lastTurnTimeRef = useRef(0)
  const detectionStartTimeRef = useRef(0)

  // Load TensorFlow.js and models
  useEffect(() => {
    async function loadTensorflow() {
      try {
        setIsLoading(true)
        setInstructions("Loading face detection models...")

        // Import TensorFlow.js and models
        const tf = await import("@tensorflow/tfjs")
        const blazeface = await import("@tensorflow-models/blazeface")
        const faceLandmarksDetection = await import("@tensorflow-models/face-landmarks-detection")

        tfRef.current = tf

        // Initialize TensorFlow backend
        await tf.ready()
        console.log("TensorFlow.js initialized with backend:", tf.getBackend())

        // Load BlazeFace model
        console.log("Loading BlazeFace model...")
        const model = await blazeface.load()
        modelRef.current = model
        console.log("BlazeFace model loaded")

        // Load face landmarks model
        console.log("Loading face landmarks model...")
        const landmarksModel = await faceLandmarksDetection.load(
          faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
          { maxFaces: 1 },
        )
        landmarksModelRef.current = landmarksModel
        console.log("Face landmarks model loaded")

        setModelLoaded(true)
        setIsLoading(false)
        setInstructions("Ready! Click 'Start Liveness Check' to begin")
      } catch (error) {
        console.error("Error loading TensorFlow models:", error)
        setError("Failed to load face detection models. Please try again or use a different browser.")
        setIsLoading(false)
      }
    }

    loadTensorflow()

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
                setChallengeCompleted(false)
                setCurrentChallenge(null)
                setDetectionProgress(0)
                blinkCountRef.current = 0
                headTurnCountRef.current = 0
                lastEyeOpenRef.current = true
                lastFacePosRef.current = null
                lastBlinkTimeRef.current = 0
                lastTurnTimeRef.current = 0
                detectionStartTimeRef.current = Date.now()

                // Start detection loop
                detectFace()
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
    if (!videoRef.current || !canvasRef.current || !cameraActive || !modelRef.current) {
      return
    }

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")

      // Make sure video is playing and has dimensions
      if (video.paused || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameRef.current = requestAnimationFrame(detectFace)
        return
      }

      // Set canvas dimensions
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Clear canvas
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }

      // Detect faces
      const predictions = await modelRef.current.estimateFaces(video, false)

      // Check if we have any faces
      if (predictions.length > 0) {
        const face = predictions[0]

        // Draw face box
        if (ctx) {
          ctx.strokeStyle = "#00FF00"
          ctx.lineWidth = 2

          const start = face.topLeft
          const end = face.bottomRight
          const size = [end[0] - start[0], end[1] - start[1]]

          ctx.strokeRect(start[0], start[1], size[0], size[1])

          // Draw landmarks
          face.landmarks.forEach((landmark: number[]) => {
            ctx.fillStyle = "#FF0000"
            ctx.fillRect(landmark[0], landmark[1], 5, 5)
          })
        }

        // Face detected
        if (!faceDetected) {
          console.log("Face detected!")
          setFaceDetected(true)
          setInstructions("Face detected! Now please blink a few times")
          setDetectionProgress(25)

          // Set random challenge after face detection
          if (!currentChallenge) {
            const challenges = ["blink", "turn_left", "turn_right", "nod"]
            const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)]
            setCurrentChallenge(randomChallenge)

            switch (randomChallenge) {
              case "blink":
                setInstructions("Please blink a few times")
                break
              case "turn_left":
                setInstructions("Please turn your head slightly to the left")
                break
              case "turn_right":
                setInstructions("Please turn your head slightly to the right")
                break
              case "nod":
                setInstructions("Please nod your head up and down")
                break
            }
          }
        }

        // Get face position
        const facePos = {
          x: (face.topLeft[0] + face.bottomRight[0]) / 2,
          y: (face.topLeft[1] + face.bottomRight[1]) / 2,
        }

        // Get face size
        const faceWidth = face.bottomRight[0] - face.topLeft[0]
        const faceHeight = face.bottomRight[1] - face.topLeft[1]

        // Detect blinks using landmarks
        if (faceDetected && !blinkDetected && currentChallenge === "blink") {
          // Use landmarks to detect blinks
          const leftEye = face.landmarks[1] // Left eye
          const rightEye = face.landmarks[0] // Right eye

          // Get eye height ratio (simplified)
          const leftEyeTop = face.landmarks[2][1] // Left eye top
          const leftEyeBottom = face.landmarks[3][1] // Left eye bottom
          const rightEyeTop = face.landmarks[4][1] // Right eye top
          const rightEyeBottom = face.landmarks[5][1] // Right eye bottom

          const leftEyeHeight = Math.abs(leftEyeTop - leftEyeBottom)
          const rightEyeHeight = Math.abs(rightEyeTop - rightEyeBottom)

          // Normalize by face height
          const eyeHeightRatio = (leftEyeHeight + rightEyeHeight) / 2 / faceHeight

          // Detect blink
          const now = Date.now()
          const isEyeOpen = eyeHeightRatio > 0.03 // Threshold for open eyes

          if (lastEyeOpenRef.current && !isEyeOpen && now - lastBlinkTimeRef.current > 500) {
            // Eye closed after being open (blink detected)
            blinkCountRef.current++
            lastBlinkTimeRef.current = now
            console.log(`Blink detected (${blinkCountRef.current}/3)`)

            if (blinkCountRef.current >= 3) {
              console.log("Blink challenge completed!")
              setBlinkDetected(true)
              setChallengeCompleted(true)
              setDetectionProgress(75)
              setInstructions("Great! Now please turn your head slightly left and right")

              // Move to head turn detection
              setTimeout(() => {
                setCurrentChallenge("turn_left")
              }, 1000)
            }
          }

          lastEyeOpenRef.current = isEyeOpen

          // Debug info
          setDebugInfo(
            `Face: (${Math.round(facePos.x)}, ${Math.round(facePos.y)}) | Eye ratio: ${eyeHeightRatio.toFixed(3)} | Blinks: ${blinkCountRef.current}`,
          )
        }

        // Detect head turns
        if (
          blinkDetected &&
          !headTurnDetected &&
          (currentChallenge === "turn_left" || currentChallenge === "turn_right")
        ) {
          if (lastFacePosRef.current) {
            const now = Date.now()
            const xDiff = facePos.x - lastFacePosRef.current.x

            // Detect significant horizontal movement
            if (Math.abs(xDiff) > faceWidth * 0.15 && now - lastTurnTimeRef.current > 500) {
              const turnDirection = xDiff < 0 ? "right" : "left"

              if (
                (currentChallenge === "turn_left" && turnDirection === "left") ||
                (currentChallenge === "turn_right" && turnDirection === "right")
              ) {
                headTurnCountRef.current++
                lastTurnTimeRef.current = now
                console.log(`Head turn detected: ${turnDirection}`)

                if (headTurnCountRef.current >= 1) {
                  console.log("Head turn challenge completed!")
                  setHeadTurnDetected(true)
                  setChallengeCompleted(true)
                  setDetectionProgress(100)
                  setInstructions("Liveness check complete!")

                  // Complete the check after a short delay
                  setTimeout(() => {
                    stopCamera()
                    onComplete(true)
                  }, 1500)
                }
              }
            }

            // Debug info
            setDebugInfo(
              `Face: (${Math.round(facePos.x)}, ${Math.round(facePos.y)}) | Move: ${xDiff.toFixed(1)} | Turns: ${headTurnCountRef.current}`,
            )
          }
        }

        // Update face position reference
        lastFacePosRef.current = facePos

        // Check for timeout
        const elapsedTime = Date.now() - detectionStartTimeRef.current
        if (elapsedTime > 30000 && !challengeCompleted) {
          // 30 second timeout
          setError("Liveness check timed out. Please try again.")
          stopCamera()
          return
        }
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
                <span className="text-xs">Challenge 1</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-1 ${headTurnDetected ? "bg-green-500" : "bg-gray-300"}`}></div>
                <span className="text-xs">Challenge 2</span>
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
          <Button onClick={startCamera} className="flex-1" disabled={isLoading || isProcessing || !modelLoaded}>
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

export default TensorflowLivenessDetection
