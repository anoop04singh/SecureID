"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, Upload, AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import jsQR from "jsqr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface VerificationQrScannerProps {
  onScan: (data: string) => void
  isProcessing?: boolean
}

export function VerificationQrScanner({ onScan, isProcessing = false }: VerificationQrScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [cameraActive, setCameraActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Initialize canvas for QR scanning
  useEffect(() => {
    if (typeof window !== "undefined" && !canvasRef.current) {
      canvasRef.current = document.createElement("canvas")
    }

    return () => {
      // Clean up
      stopCamera()
      canvasRef.current = null
    }
  }, [])

  // Clean up camera when component unmounts
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Start/stop camera based on tab and processing state
  useEffect(() => {
    if (activeTab === "camera" && !cameraActive && !isProcessing) {
      startCamera()
    } else if ((activeTab !== "camera" || isProcessing) && cameraActive) {
      stopCamera()
    }
  }, [activeTab, isProcessing, cameraActive])

  const startCamera = async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in your browser")
      }

      // Stop any existing stream first
      stopCamera()

      const constraints = {
        video: {
          facingMode: "environment", // Use the back camera on mobile devices
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
                scanQrCodeFromCamera()
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
      stopCamera()
    }
  }

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
  }

  const scanQrCodeFromCamera = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      // Video not ready yet, try again in the next frame
      animationFrameRef.current = requestAnimationFrame(scanQrCodeFromCamera)
      return
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data from canvas
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      // Try to find QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      })

      if (code) {
        console.log("QR code found in camera feed:", code.data)

        // Stop camera and process the QR code
        stopCamera()

        try {
          // Validate QR data
          let qrData
          try {
            qrData = JSON.parse(code.data)
            console.log("Camera scan - parsed QR data:", qrData)

            // Basic validation - check for required fields
            // Note: We're checking for addressHash instead of address
            if (!qrData.proofId || !qrData.addressHash || !qrData.type) {
              console.error("Missing required fields in camera QR data:", qrData)
              throw new Error("Invalid QR code format. Missing required fields.")
            }
          } catch (e) {
            console.error("Error parsing camera QR data:", e, "Raw data:", code.data)
            throw new Error("Invalid QR code format. Please scan a valid verification QR code.")
          }

          // If validation passes, send the data
          onScan(code.data)
          return
        } catch (error: any) {
          setError(error.message)
          // Restart camera after error
          setTimeout(() => {
            if (activeTab === "camera") {
              startCamera()
            }
          }, 2000)
        }
      }
    } catch (error) {
      console.error("Error processing camera frame:", error)
      // Continue scanning despite error
    }

    // Continue scanning if no QR code was found
    animationFrameRef.current = requestAnimationFrame(scanQrCodeFromCamera)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setIsScanning(true)

    try {
      console.log("Processing verification QR code from file:", file.name, file.type, file.size)

      // Use a more efficient approach to prevent UI freezing
      setTimeout(async () => {
        try {
          const qrData = await scanQrCodeFromFile(file)

          if (qrData) {
            console.log("Verification QR code scanned successfully:", qrData)

            try {
              // Validate QR data
              let parsedData
              try {
                parsedData = JSON.parse(qrData)
                console.log("Parsed QR data:", parsedData)

                // Basic validation - check for required fields
                // Note: We're checking for addressHash instead of address
                if (!parsedData.proofId || !parsedData.addressHash || !parsedData.type) {
                  console.error("Missing required fields in QR data:", parsedData)
                  throw new Error("Invalid QR code format. Missing required fields.")
                }
              } catch (e) {
                console.error("Error parsing QR data:", e, "Raw data:", qrData)
                throw new Error("Invalid QR code format. Please scan a valid verification QR code.")
              }

              // If validation passes, send the data
              onScan(qrData)
            } catch (error: any) {
              setError(error.message)
            }
          } else {
            throw new Error("No QR code found in the image")
          }
        } catch (error: any) {
          console.error("Error scanning verification QR code:", error)
          setError(error.message || "Failed to scan QR code. Please try again with a clearer image.")
        } finally {
          setIsScanning(false)
          // Reset the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }
      }, 100) // Small delay to allow UI to update
    } catch (error: any) {
      console.error("Error preparing file scan:", error)
      setError(error.message || "Failed to process the image file.")
      setIsScanning(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const scanQrCodeFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const img = new Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
          try {
            console.log(`Image loaded, dimensions: ${img.width}x${img.height}`)

            // Try multiple processing methods to improve QR detection
            const result = tryMultipleProcessingMethods(img)

            if (result) {
              console.log("QR code found in image:", result)
              resolve(result)
            } else {
              console.error("No QR code found in image")
              reject(new Error("No QR code found in the image. Please try a clearer image or different lighting."))
            }
          } catch (error) {
            console.error("Error processing image:", error)
            reject(new Error(`Error processing image: ${error instanceof Error ? error.message : String(error)}`))
          }
        }

        img.onerror = () => {
          console.error("Failed to load image")
          reject(new Error("Failed to load the image"))
        }

        img.src = e.target?.result as string
      }

      reader.onerror = () => {
        console.error("Failed to read file")
        reject(new Error("Failed to read the file"))
      }

      reader.readAsDataURL(file)
    })
  }

  // Add this new function to try multiple processing methods
  const tryMultipleProcessingMethods = (img: HTMLImageElement): string | null => {
    // Try different sizes to handle various image resolutions
    const sizes = [
      { width: img.width, height: img.height }, // Original size
      { width: 800, height: 800 * (img.height / img.width) },
      { width: 1000, height: 1000 * (img.height / img.width) },
      { width: 1200, height: 1200 * (img.height / img.width) },
      { width: 600, height: 600 * (img.height / img.width) }, // Try smaller size too
    ]

    // Try different processing methods
    const processingMethods = [
      { name: "original", process: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {} },
      {
        name: "highContrast",
        process: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          for (let i = 0; i < data.length; i += 4) {
            // Increase contrast
            for (let j = 0; j < 3; j++) {
              data[i + j] = data[i + j] < 128 ? 0 : 255
            }
          }
          ctx.putImageData(imageData, 0, 0)
        },
      },
      {
        name: "grayscale",
        process: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
            data[i] = data[i + 1] = data[i + 2] = avg
          }
          ctx.putImageData(imageData, 0, 0)
        },
      },
    ]

    // Try each combination of size and processing method
    for (const size of sizes) {
      const canvas = document.createElement("canvas")
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext("2d")

      if (!ctx) continue

      for (const method of processingMethods) {
        // Clear canvas and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Apply processing method
        method.process(canvas, ctx)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // Try both inversion methods
        for (const inversion of ["dontInvert", "attemptBoth", "onlyInvert"] as const) {
          try {
            console.log(`Trying method: ${method.name}, size: ${size.width}x${size.height}, inversion: ${inversion}`)
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: inversion,
            })

            if (code) {
              console.log(
                `QR code found with method: ${method.name}, size: ${size.width}x${size.height}, inversion: ${inversion}`,
              )
              return code.data
            }
          } catch (error) {
            console.error(`Error with method ${method.name}:`, error)
          }
        }
      }
    }

    return null
  }

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setError(null)

    // Stop camera if switching away from camera tab
    if (value !== "camera" && cameraActive) {
      stopCamera()
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="upload" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="camera">Camera</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <Card className="flex items-center justify-center h-64 bg-muted/50 relative">
            <div className="text-center p-4">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Upload an image with a QR code</p>
            </div>

            {(isScanning || isProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </Card>

          <Button onClick={triggerFileInput} className="w-full mt-2" disabled={isScanning || isProcessing}>
            <Upload className="mr-2 h-4 w-4" />
            Upload QR Code
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isScanning || isProcessing}
          />
        </TabsContent>

        <TabsContent value="camera" className="mt-4">
          <Card className="flex items-center justify-center h-64 bg-muted/50 relative overflow-hidden">
            {cameraActive ? (
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
            ) : (
              <div className="text-center p-4">
                <Camera className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Camera will activate to scan QR codes</p>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {cameraActive && (
              <Button
                variant="outline"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-background/50 hover:bg-background/80"
                onClick={stopCamera}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </Card>

          {!cameraActive && !isProcessing && (
            <Button onClick={startCamera} className="w-full mt-2" disabled={isProcessing}>
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-center text-muted-foreground mt-2">
        Scan a QR code to verify someone's identity without revealing their personal information.
      </p>
    </div>
  )
}
