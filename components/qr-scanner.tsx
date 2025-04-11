"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, Upload, AlertCircle, X } from "lucide-react"
import { SecureQRDecoder } from "@/lib/secure-qr-decoder"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface QrScannerProps {
  onScan: (data: any) => void
  isProcessing?: boolean
}

export function QrScanner({ onScan, isProcessing = false }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [cameraActive, setCameraActive] = useState(false)

  const decoderRef = useRef<SecureQRDecoder | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Initialize the decoder
  useEffect(() => {
    if (typeof window !== "undefined" && !decoderRef.current) {
      try {
        decoderRef.current = new SecureQRDecoder()
        console.log("QR decoder initialized successfully")
      } catch (err) {
        console.error("Failed to initialize QR decoder:", err)
        setError("Failed to initialize QR scanner. Please try refreshing the page.")
      }
    }

    return () => {
      // Clean up
      decoderRef.current = null
      stopCamera()
    }
  }, [])

  // Start camera when the camera tab is active
  useEffect(() => {
    if (activeTab === "camera" && !cameraActive && !isProcessing) {
      startCamera()
    } else if (activeTab !== "camera" && cameraActive) {
      stopCamera()
    }

    return () => {
      if (cameraActive) {
        stopCamera()
      }
    }
  }, [activeTab, isProcessing])

  const startCamera = async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in your browser")
      }

      const constraints = {
        video: {
          facingMode: "environment", // Use the back camera on mobile devices
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true)
          scanQrCodeFromCamera()
        }
      }
    } catch (error: any) {
      console.error("Error starting camera:", error)
      setError(error.message || "Failed to access camera. Please check your camera permissions.")
    }
  }

  const stopCamera = () => {
    // Stop the animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraActive(false)
  }

  const scanQrCodeFromCamera = async () => {
    if (!videoRef.current || !decoderRef.current || !cameraActive) return

    try {
      const video = videoRef.current

      // Create a canvas to capture the current video frame
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
          },
          "image/jpeg",
          0.95,
        )
      })

      // Create a File object from the blob
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" })

      // Try to decode the QR code
      const result = await decoderRef.current.decodeFromFile(file)

      if (result) {
        console.log("QR code found in camera feed:", result)

        // Stop camera and process the QR code
        stopCamera()
        onScan(result)
        return
      }
    } catch (error) {
      // Just log the error but continue scanning
      console.error("Error scanning QR from camera:", error)
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
      console.log("Processing file:", file.name, file.type, file.size)

      if (!decoderRef.current) {
        decoderRef.current = new SecureQRDecoder()
      }

      const result = await decoderRef.current.decodeFromFile(file)
      console.log("QR code decoded successfully:", result)
      onScan(result)
    } catch (error: any) {
      console.error("Error scanning QR code:", error)
      setError(error.message || "Failed to scan QR code. Please try again with a clearer image.")
    } finally {
      setIsScanning(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setError(null)
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
              <p className="text-sm text-muted-foreground">Upload your ID card with QR code</p>
            </div>

            {(isScanning || isProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </Card>

          <Button onClick={triggerFileInput} className="w-full mt-2" disabled={isScanning || isProcessing}>
            <Upload className="mr-2 h-4 w-4" />
            Upload ID Card
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
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
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

          {!cameraActive && (
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
        Your ID card will be processed locally and securely. No data is sent to any server.
      </p>
    </div>
  )
}
