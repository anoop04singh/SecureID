"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Camera, X } from "lucide-react"
import { Card } from "@/components/ui/card"

interface CameraLivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function CameraLivenessDetection({ onComplete, isProcessing = false }: CameraLivenessDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionMessage, setDetectionMessage] = useState("Click Start to begin detection")
  const [detectionProgress, setDetectionProgress] = useState(0)
  const [detectionSuccess, setDetectionSuccess] = useState(false)
  const [facesDetected, setFacesDetected] = useState(0)
  const [movementDetected, setMovementDetected] = useState(false)
  const [blinkDetected, setBlinkDetected] = useState(false)
  const [lastFacePosition, setLastFacePosition] = useState({ x: 0, y: 0 })
  const [cameraError, setCameraError] = useState(false)
  const [faceApiLoaded, setFaceApiLoaded] = useState<any>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  // Load face-api.js and models
  useEffect(() => {
    const loadFaceApiAndModels = async () => {
      try {
        setIsLoading(true)
        setDetectionError(null)

        // Import face-api.js
        const faceapi = await import("@vladmandic/face-api")

        // Define models URL - using jsdelivr CDN for reliability
        const modelsUrl = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"

        console.log("Loading face-api.js models from:", modelsUrl)

        // Load all required models sequentially
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl)
        console.log("✓ Loaded tinyFaceDetector model")

        await faceapi.nets.faceLandmark68Net.loadFromUri(modelsUrl)
        console.log("✓ Loaded faceLandmark68Net model")

        await faceapi.nets.faceExpressionNet.loadFromUri(modelsUrl)
        console.log("✓ Loaded faceExpressionNet model")

        // Explicitly load the SsdMobilenetv1 model
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelsUrl)
        console.log("✓ Loaded ssdMobilenetv1 model")

        // Verify models are loaded
        const tinyFaceDetectorLoaded = faceapi.nets.tinyFaceDetector.isLoaded
        const faceLandmarksLoaded = faceapi.nets.faceLandmark68Net.isLoaded
        const faceExpressionLoaded = faceapi.nets.faceExpressionNet.isLoaded
        const ssdMobilenetLoaded = faceapi.nets.ssdMobilenetv1.isLoaded

        console.log("Models loaded status:", {
          tinyFaceDetector: tinyFaceDetectorLoaded,
          faceLandmarks: faceLandmarksLoaded,
          faceExpression: faceExpressionLoaded,
          ssdMobilenet: ssdMobilenetLoaded,
        })

        if (tinyFaceDetectorLoaded && faceLandmarksLoaded && faceExpressionLoaded && ssdMobilenetLoaded) {
          setFaceApiLoaded(faceapi)
          setModelsLoaded(true)
          setIsLoading(false)
          setDetectionMessage("Click Start to begin detection")
        } else {
          throw new Error("Not all models were loaded successfully")
        }
      } catch (error) {
        console.error("Error loading face-api or models:", error)
        setDetectionError(error instanceof Error ? error.message : "Failed to load face detection models")
        setIsLoading(false)
      }
    }

    loadFaceApiAndModels()

    // Cleanup function
    return () => {
      stopCamera()
    }
  }, [])

  const handleCameraError = useCallback((error: string | DOMException) => {
    console.error("Camera error:", error)
    setCameraError(true)
    setDetectionMessage("Camera access denied or not available")
    setDetectionError("Camera access denied or not available. Please check your camera permissions.")
  }, [])

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        stopCamera()
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
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
                startDetection()
              })
              .catch((err) => {
                console.error("Error playing video:", err)
                handleCameraError(err)
              })
          }
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      handleCameraError(error instanceof Error ? error.message : "Camera error")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startDetection = useCallback(() => {
    if (!faceApiLoaded) {
      setDetectionError("Face detection not initialized yet")
      return
    }

    setDetectionError(null)
    setIsDetecting(true)
    setDetectionMessage("Please look at the camera")
    setDetectionProgress(0)
    setDetectionSuccess(false)
    setFacesDetected(0)
    setMovementDetected(false)
    setBlinkDetected(false)
    setLastFacePosition({ x: 0, y: 0 })
  }, [faceApiLoaded])

  const resetDetection = useCallback(() => {
    setIsDetecting(false)
    setDetectionMessage("Click Start to begin detection")
    setDetectionProgress(0)
    setDetectionSuccess(false)
    setFacesDetected(0)
    setMovementDetected(false)
    setBlinkDetected(false)
    setDetectionError(null)
    stopCamera()
  }, [])

  const cancelDetection = useCallback(() => {
    resetDetection()
    onComplete(false)
  }, [onComplete, resetDetection])

  const detectFaces = useCallback(async () => {
    if (!isDetecting || !videoRef.current || !canvasRef.current || !faceApiLoaded) return

    const faceapi = faceApiLoaded
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || video.paused || video.ended || !video.videoWidth || !video.videoHeight) {
      // Video not ready yet
      return
    }

    const displaySize = { width: video.videoWidth, height: video.videoHeight }

    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      faceapi.matchDimensions(canvas, displaySize)
    }

    try {
      // Use SsdMobilenetv1 instead of TinyFaceDetector for better reliability
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceExpressions()

      const resizedDetections = faceapi.resizeResults(detections, displaySize)

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw face detections
        faceapi.draw.drawDetections(canvas, resizedDetections)
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

        // Check if a face is detected
        if (resizedDetections.length > 0) {
          setFacesDetected((prev) => prev + 1)

          const face = resizedDetections[0]
          const box = face.detection.box

          // Check for movement by comparing current position with last position
          if (lastFacePosition.x !== 0 && lastFacePosition.y !== 0) {
            const movement = Math.abs(lastFacePosition.x - box.x) + Math.abs(lastFacePosition.y - box.y)
            if (movement > 5) {
              setMovementDetected(true)
            }
          }

          setLastFacePosition({ x: box.x, y: box.y })

          // Check for blinking
          if (face.landmarks) {
            const leftEye = face.landmarks.getLeftEye()
            const rightEye = face.landmarks.getRightEye()

            const leftEyeAspectRatio = getEyeAspectRatio(leftEye)
            const rightEyeAspectRatio = getEyeAspectRatio(rightEye)

            const eyeAspectRatio = (leftEyeAspectRatio + rightEyeAspectRatio) / 2

            if (eyeAspectRatio < 0.2) {
              setBlinkDetected(true)
            }
          }

          // Update progress based on checks - removed blinking requirement
          let progress = 0
          if (facesDetected > 10) progress += 50
          if (movementDetected) progress += 50

          setDetectionProgress(progress)

          // Update message based on progress - removed blinking step
          if (progress < 50) {
            setDetectionMessage("Face detected. Please stay still...")
          } else if (progress < 100) {
            setDetectionMessage("Good! Now slightly move your head...")
          } else {
            setDetectionMessage("Liveness verified successfully!")
            setDetectionSuccess(true)
            setIsDetecting(false)

            // Notify parent component of success
            setTimeout(() => {
              stopCamera()
              onComplete(true)
            }, 1500)
          }
        } else {
          setDetectionMessage("No face detected. Please position your face in the frame.")
        }
      }
    } catch (error) {
      console.error("Error in face detection:", error)
      setDetectionError("Error during face detection. Please try again.")
      setIsDetecting(false)
    }
  }, [isDetecting, lastFacePosition, facesDetected, movementDetected, blinkDetected, faceApiLoaded, onComplete])

  // Helper function to calculate eye aspect ratio
  const getEyeAspectRatio = (eye: any[]) => {
    if (eye.length < 6) return 1

    // Calculate the vertical distances
    const v1 = distance(eye[1], eye[5])
    const v2 = distance(eye[2], eye[4])

    // Calculate the horizontal distance
    const h = distance(eye[0], eye[3])

    // Calculate the eye aspect ratio
    return (v1 + v2) / (2.0 * h)
  }

  // Helper function to calculate distance between two points
  const distance = (pt1: { x: number; y: number }, pt2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2))
  }

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isDetecting) {
      interval = setInterval(detectFaces, 100)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isDetecting, detectFaces])

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Liveness Detection</h3>
        <p className="text-sm text-muted-foreground">This helps verify you're a real person and prevents fraud</p>
      </div>

      <Card className="relative overflow-hidden">
        <div className="aspect-video relative bg-muted/50">
          {/* Video element */}
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />

          {/* Canvas overlay for drawing face landmarks */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10" />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p className="text-sm text-center px-4">Loading face detection models...</p>
            </div>
          )}

          {/* Camera inactive overlay */}
          {!isDetecting && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <Camera className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-center px-4">{detectionMessage}</p>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Close button when camera is active */}
          {isDetecting && (
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2 z-20 bg-background/50 hover:bg-background/80"
              onClick={resetDetection}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress indicator */}
        <div className="p-4 border-t">
          <div className="flex justify-between text-sm mb-1">
            <span>Liveness Check Progress</span>
            <span>{detectionProgress}%</span>
          </div>
          <Progress value={detectionProgress} className="h-2" />
          <div className="mt-2 text-sm text-muted-foreground">{detectionMessage}</div>

          {/* Step indicators */}
          <div className="flex justify-around mt-3">
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${facesDetected > 10 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Face Detection</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${movementDetected ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Movement Verification</span>
            </div>
          </div>
        </div>
      </Card>

      {detectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{detectionError}</AlertDescription>
        </Alert>
      )}

      {detectionSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success!</AlertTitle>
          <AlertDescription className="text-green-700">Liveness verification completed successfully.</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {!isDetecting && !detectionSuccess && (
          <Button
            onClick={startCamera}
            className="w-full"
            disabled={isLoading || isProcessing || cameraError || !modelsLoaded}
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
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

        {isDetecting && (
          <Button variant="outline" onClick={resetDetection} className="w-full" disabled={isProcessing}>
            Cancel and Retry
          </Button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Your camera feed is processed locally and is not stored or sent to any server.
      </p>
    </div>
  )
}
