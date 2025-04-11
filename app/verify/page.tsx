"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { VerificationQrScanner } from "@/components/verification-qr-scanner"
import { verifyIdentityProofWithCodeHash } from "@/lib/contract-interactions"
import { CheckCircle2, XCircle, QrCode } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function VerifyIdentity() {
  const { toast } = useToast()
  const { isConnected, connect, signer } = useWallet()
  const [isProcessing, setIsProcessing] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean
    type: string
    message: string
  } | null>(null)
  const [qrData, setQrData] = useState<any>(null)
  const [verificationCode, setVerificationCode] = useState<string>("")
  const [step, setStep] = useState<"code" | "scan" | "result">("code")

  // Handle verification code input
  const handleProceedToScan = () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit verification code.",
        variant: "destructive",
      })
      return
    }

    setStep("scan")
    toast({
      title: "Verification Code Entered",
      description: "Now scan the QR code to complete verification.",
    })
  }

  const handleQrCodeScanned = async (data: string) => {
    if (!signer) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to verify identities.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      console.log("Processing verification QR data:", data)

      // Parse QR data - this should be JSON data from our generated QR codes
      let qrData
      try {
        qrData = JSON.parse(data)
      } catch (error) {
        console.error("Error parsing QR data:", error)
        throw new Error("Invalid QR code format. Please scan a valid identity verification QR code.")
      }

      // Validate the QR data structure - check for the fields we know are in the data
      if (!qrData.proofId || !qrData.addressHash || !qrData.type || !qrData.codeHash) {
        console.error("Missing required fields in QR data:", qrData)
        throw new Error("Invalid QR code data. Missing required verification information.")
      }

      // Store QR data
      setQrData(qrData)

      // Verify the proof using the verification code and code hash
      await verifyWithCodeHash(qrData)
    } catch (error: any) {
      console.error("Error processing QR code:", error)
      toast({
        title: "Error Processing QR Code",
        description: error.message || "There was an error processing the QR code. Please try again.",
        variant: "destructive",
      })
      setStep("scan")
    } finally {
      setIsProcessing(false)
    }
  }

  // Verify with code hash
  const verifyWithCodeHash = async (qrData: any) => {
    if (!signer) return

    setIsProcessing(true)
    try {
      console.log("Verifying proof with code hash:", verificationCode, qrData)

      // Use the verifyIdentityProofWithCodeHash function directly
      const result = await verifyIdentityProofWithCodeHash(
        signer,
        qrData.proofId,
        qrData.addressHash, // This should be without 0x prefix from the QR code
        verificationCode,
        qrData.codeHash, // This should be without 0x prefix from the QR code
        qrData.type,
      )

      if (result.verified) {
        toast({
          title: "Verification Successful",
          description: `The ${qrData.type} has been verified successfully.`,
        })
      } else {
        toast({
          title: "Verification Failed",
          description: "The proof could not be verified.",
          variant: "destructive",
        })
      }

      setVerificationResult(result)
      setStep("result")
    } catch (error: any) {
      console.error("Error verifying proof:", error)
      toast({
        title: "Error Verifying Proof",
        description: error.message || "There was an error verifying the proof. Please try again.",
        variant: "destructive",
      })

      setVerificationResult({
        verified: false,
        type: qrData.type || "unknown",
        message: error.message || "Invalid QR code, proof data, or verification code.",
      })
      setStep("result")
    } finally {
      setIsProcessing(false)
    }
  }

  const resetVerification = () => {
    setVerificationResult(null)
    setQrData(null)
    setVerificationCode("")
    setStep("code")
  }

  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Verify Identity</CardTitle>
          <CardDescription>Verify someone's identity securely</CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Connect your wallet</AlertTitle>
                <AlertDescription>You need to connect your wallet to verify identities.</AlertDescription>
              </Alert>
              <Button onClick={connect} className="w-full">
                Connect Wallet
              </Button>
            </div>
          ) : step === "code" ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Enter Verification Code</AlertTitle>
                <AlertDescription>
                  First, enter the verification code provided by the person you're verifying.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>

              <Button onClick={handleProceedToScan} className="w-full" disabled={verificationCode.length !== 6}>
                <QrCode className="mr-2 h-4 w-4" />
                Proceed to Scan QR Code
              </Button>
            </div>
          ) : step === "scan" ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Scan QR Code</AlertTitle>
                <AlertDescription>Now scan the QR code provided by the person you're verifying.</AlertDescription>
              </Alert>

              <div className="bg-muted/30 p-3 rounded-lg mb-4">
                <p className="text-sm font-medium mb-1">Verification Code</p>
                <p className="text-xl font-bold tracking-wider">{verificationCode}</p>
              </div>

              <VerificationQrScanner onScan={handleQrCodeScanned} isProcessing={isProcessing} />

              <Button variant="outline" onClick={() => setStep("code")} className="w-full" disabled={isProcessing}>
                Back to Code Entry
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center py-4">
                {verificationResult?.verified ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                ) : (
                  <XCircle className="h-16 w-16 text-red-500" />
                )}
              </div>

              <Alert
                className={verificationResult?.verified ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}
              >
                <AlertTitle>
                  {verificationResult?.verified ? "Verification Successful" : "Verification Failed"}
                </AlertTitle>
                <AlertDescription>{verificationResult?.message}</AlertDescription>
              </Alert>

              {verificationResult?.verified && verificationResult?.type === "identity" && (
                <div className="text-sm text-center text-muted-foreground">
                  The identity has been verified without revealing any personal information.
                </div>
              )}

              {verificationResult?.verified && verificationResult?.type === "age" && (
                <div className="text-sm text-center text-muted-foreground">
                  The person is verified to be over 18 years old without revealing their actual age.
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          {step === "result" && (
            <Button onClick={resetVerification} className="w-full">
              Verify Another
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
