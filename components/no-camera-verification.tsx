"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface NoCameraVerificationProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function NoCameraVerification({ onComplete, isProcessing = false }: NoCameraVerificationProps) {
  // States
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string>("Click 'Start' to begin verification")

  // Captcha states
  const [captchaQuestion, setCaptchaQuestion] = useState<string>("")
  const [captchaAnswer, setCaptchaAnswer] = useState<string>("")
  const [userCaptchaInput, setUserCaptchaInput] = useState<string>("")

  // Pattern challenge states
  const [pattern, setPattern] = useState<number[]>([])
  const [userPattern, setUserPattern] = useState<number[]>([])
  const [patternComplete, setPatternComplete] = useState<boolean>(false)
  const [originalPattern, setOriginalPattern] = useState<number[]>([])

  // Device motion detection
  const [motionDetected, setMotionDetected] = useState<boolean>(false)
  const motionDataRef = useRef<number[]>([])

  // Generate a math captcha
  const generateCaptcha = () => {
    const operations = ["+", "-", "*"]
    const operation = operations[Math.floor(Math.random() * operations.length)]

    let num1, num2, answer

    switch (operation) {
      case "+":
        num1 = Math.floor(Math.random() * 10) + 1
        num2 = Math.floor(Math.random() * 10) + 1
        answer = (num1 + num2).toString()
        break
      case "-":
        num1 = Math.floor(Math.random() * 10) + 10
        num2 = Math.floor(Math.random() * 10) + 1
        answer = (num1 - num2).toString()
        break
      case "*":
        num1 = Math.floor(Math.random() * 5) + 1
        num2 = Math.floor(Math.random() * 5) + 1
        answer = (num1 * num2).toString()
        break
      default:
        num1 = Math.floor(Math.random() * 10) + 1
        num2 = Math.floor(Math.random() * 10) + 1
        answer = (num1 + num2).toString()
    }

    setCaptchaQuestion(`What is ${num1} ${operation} ${num2}?`)
    setCaptchaAnswer(answer)
  }

  // Generate a random pattern
  const generatePattern = () => {
    const length = 4
    const newPattern = Array(length)
      .fill(0)
      .map(() => Math.floor(Math.random() * 9) + 1)
    setPattern(newPattern)
    setOriginalPattern(newPattern) // Store the original pattern
  }

  // Start verification
  const startVerification = () => {
    setStep(1)
    setProgress(25)
    setInstructions("Please solve the math problem")
    generateCaptcha()

    // Start listening for device motion
    if (window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", handleDeviceMotion)
    }
  }

  // Handle device motion
  const handleDeviceMotion = (event: DeviceMotionEvent) => {
    const acceleration = event.accelerationIncludingGravity

    if (acceleration && acceleration.x && acceleration.y && acceleration.z) {
      // Calculate total acceleration magnitude
      const magnitude = Math.sqrt(
        Math.pow(acceleration.x, 2) + Math.pow(acceleration.y, 2) + Math.pow(acceleration.z, 2),
      )

      // Add to motion data
      motionDataRef.current.push(magnitude)

      // Keep only the last 20 values
      if (motionDataRef.current.length > 20) {
        motionDataRef.current.shift()
      }

      // Calculate variance to detect significant motion
      if (motionDataRef.current.length >= 10) {
        const avg = motionDataRef.current.reduce((sum, val) => sum + val, 0) / motionDataRef.current.length
        const variance =
          motionDataRef.current.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / motionDataRef.current.length

        if (variance > 1.5 && !motionDetected) {
          setMotionDetected(true)
        }
      }
    }
  }

  // Verify captcha
  const verifyCaptcha = () => {
    if (userCaptchaInput === captchaAnswer) {
      setStep(2)
      setProgress(50)
      setInstructions("Press the button when you're ready to continue")
    } else {
      setError("Incorrect answer. Please try again.")
      generateCaptcha()
      setUserCaptchaInput("")
    }
  }

  // Handle continue button click
  const handleContinueClick = () => {
    setStep(2.5) // Use a half-step for the acknowledgment screen
    setProgress(60)
    setInstructions("IMPORTANT: You will see a pattern of numbers. Remember this pattern!")
  }

  // Handle acknowledgment button click
  const handleAcknowledgeClick = () => {
    setStep(3)
    setProgress(75)
    generatePattern()

    // Show pattern for 5 seconds then hide
    setTimeout(() => {
      setPattern([])
      setInstructions("Now enter the pattern you just saw")
    }, 5000)
  }

  // Handle pattern button click
  const handlePatternClick = (num: number) => {
    const newUserPattern = [...userPattern, num]
    setUserPattern(newUserPattern)

    // Check if pattern is complete
    if (newUserPattern.length === 4) {
      // Fixed length of 4
      // Check if pattern matches
      const matches = newUserPattern.every((val, i) => val === originalPattern[i])

      if (matches) {
        setPatternComplete(true)
        setProgress(100)
        setInstructions("Verification complete!")

        // Complete verification after a short delay
        setTimeout(() => {
          onComplete(true)
        }, 1500)
      } else {
        setError("Pattern incorrect. Please try again.")
        setUserPattern([])

        // Show the original pattern again
        setPattern(originalPattern)

        // Show pattern briefly then hide
        setTimeout(() => {
          setPattern([])
          setInstructions("Now enter the pattern you just saw")
        }, 5000)
      }
    }
  }

  // Skip verification
  const skipVerification = () => {
    onComplete(false)
  }

  // Clean up event listeners
  useEffect(() => {
    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener("devicemotion", handleDeviceMotion)
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Human Verification</h3>
        <p className="text-sm text-muted-foreground">This helps verify you're a real person and prevents fraud</p>
      </div>

      <Card className="overflow-hidden">
        <div className="p-6">
          {step === 0 && (
            <div className="text-center space-y-4">
              <p className="text-sm">{instructions}</p>
              <Button onClick={startVerification} disabled={isProcessing} className="w-full">
                Start Verification
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">{captchaQuestion}</h3>
              <input
                type="text"
                value={userCaptchaInput}
                onChange={(e) => setUserCaptchaInput(e.target.value)}
                className="px-3 py-2 border rounded-md text-center text-lg w-32"
                placeholder="Answer"
              />
              <Button onClick={verifyCaptcha} disabled={!userCaptchaInput} className="w-full">
                Submit Answer
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Continue to Next Step</h3>
              <p className="text-sm">Press the button when you're ready to continue</p>

              <Button onClick={handleContinueClick} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 2.5 && (
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Pattern Challenge</h3>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You will be shown a sequence of 4 numbers. You'll need to remember and enter them in the correct
                  order.
                </AlertDescription>
              </Alert>
              <p className="text-sm">Click the button when you're ready to see the pattern.</p>

              <Button onClick={handleAcknowledgeClick} className="w-full">
                I'm Ready
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Pattern Challenge</h3>

              {pattern.length > 0 ? (
                <>
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Remember this pattern! It will disappear in a few seconds.</AlertDescription>
                  </Alert>
                  <div className="flex justify-center mb-4">
                    <div className="bg-primary/10 p-4 rounded-md">
                      {pattern.map((num, i) => (
                        <span key={i} className="text-2xl font-bold mx-2">
                          {num}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm">{instructions}</p>
                  <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <Button key={num} onClick={() => handlePatternClick(num)} className="h-12 w-12" variant="outline">
                        {num}
                      </Button>
                    ))}
                  </div>

                  <div className="flex justify-center gap-2 mt-2">
                    {userPattern.map((num, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white"
                      >
                        {num}
                      </div>
                    ))}
                    {Array(4 - userPattern.length)
                      .fill(0)
                      .map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-muted"></div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Progress indicator */}
        <div className="p-4 border-t">
          <div className="flex justify-between text-sm mb-1">
            <span>Verification Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Step indicators */}
          <div className="flex justify-between mt-3">
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${step >= 1 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Captcha</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${step >= 2 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Prepare</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${step >= 3 ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span className="text-xs">Pattern</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-1 ${patternComplete ? "bg-green-500" : "bg-gray-300"}`}></div>
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

      {step > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            {motionDetected ? "✓ Device motion detected" : "Detecting device motion..."}
          </p>
          <Button variant="outline" onClick={skipVerification} size="sm" disabled={isProcessing}>
            Skip for Now
          </Button>
        </div>
      )}
    </div>
  )
}

export default NoCameraVerification
