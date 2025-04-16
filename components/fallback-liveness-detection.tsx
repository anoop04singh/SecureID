"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"

interface FallbackLivenessDetectionProps {
  onComplete: (success: boolean) => void
  isProcessing?: boolean
}

export function FallbackLivenessDetection({ onComplete, isProcessing = false }: FallbackLivenessDetectionProps) {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [verificationCode, setVerificationCode] = useState<string>("")
  const [userInput, setUserInput] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Generate a random verification code
  useState(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setVerificationCode(code)
  })

  const handleVerify = () => {
    if (userInput === verificationCode) {
      setSuccess(true)
      setProgress(100)
      setTimeout(() => {
        onComplete(true)
      }, 1500)
    } else {
      setError("Incorrect verification code. Please try again.")
      setUserInput("")
    }
  }

  const startVerification = () => {
    setStep(1)
    setProgress(50)
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">Identity Verification</h3>
        <p className="text-sm text-muted-foreground">Complete this verification to continue</p>
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="text-center space-y-4">
            <p className="text-sm">Click the button below to start the verification process</p>
            <Button onClick={startVerification} className="w-full" disabled={isProcessing}>
              Start Verification
            </Button>
          </div>
        )}

        {step === 1 && !success && (
          <div className="text-center space-y-4">
            <Alert>
              <AlertTitle>Verification Code</AlertTitle>
              <AlertDescription>
                Please enter the following code to verify your identity:
                <div className="text-2xl font-bold mt-2">{verificationCode}</div>
              </AlertDescription>
            </Alert>

            <div className="mt-4">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full p-2 border rounded text-center text-xl"
                placeholder="Enter verification code"
                maxLength={6}
              />
            </div>

            <Button onClick={handleVerify} className="w-full" disabled={userInput.length !== 6 || isProcessing}>
              Verify
            </Button>
          </div>
        )}

        {success && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle className="text-green-800">Verification Successful</AlertTitle>
              <AlertDescription className="text-green-700">
                Your identity has been verified successfully.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Progress indicator */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Verification Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default FallbackLivenessDetection
