"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { getUserIdentity, deleteIdentity, updateLivenessStatus } from "@/lib/contract-interactions"
import { generateQrCode } from "@/lib/qr-generator"
import { Loader2, RefreshCw, Shield, ShieldCheck, Trash2, AlertTriangle, QrCode } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import dynamic from "next/dynamic"

// Import the verification utilities
import { generateVerificationCode, hashVerificationCode, hashAddress } from "@/lib/verification-utils"

// Dynamically import the NoCameraVerification component
const NoCameraVerification = dynamic(() => import("@/components/no-camera-verification"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-center">Loading verification system...</p>
    </div>
  ),
})

export default function Dashboard() {
  const { toast } = useToast()
  const { isConnected, connect, address, signer } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [identityData, setIdentityData] = useState<any>(null)
  const [identityQr, setIdentityQr] = useState<string | null>(null)
  const [ageQr, setAgeQr] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [addressHash, setAddressHash] = useState<string | null>(null)
  const [codeHash, setCodeHash] = useState<string | null>(null)
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>("")
  const [showLivenessVerification, setShowLivenessVerification] = useState<boolean>(false)
  const [isProcessingLiveness, setIsProcessingLiveness] = useState<boolean>(false)
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [showQrCodes, setShowQrCodes] = useState<boolean>(false)

  useEffect(() => {
    if (isConnected && signer) {
      loadIdentityData()
    }
  }, [isConnected, signer])

  const loadIdentityData = async () => {
    if (!signer) return

    setIsLoading(true)
    try {
      const identity = await getUserIdentity(signer)
      setIdentityData(identity)

      // Reset QR codes and verification code when loading identity
      setIdentityQr(null)
      setAgeQr(null)
      setVerificationCode(null)
      setCodeHash(null)
      setAddressHash(null)
      setCodeExpiry(null)
      setShowQrCodes(false)
    } catch (error) {
      console.error("Error loading identity data:", error)
      toast({
        title: "Error Loading Identity",
        description: "There was an error loading your identity data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Update the generateQrCodes function in the dashboard page
  const generateQrCodes = async (identity: any, codeHash: string, addrHash: string) => {
    try {
      // Generate QR codes with the address hash and code hash only (not the code itself)
      // Make sure we're using the hashes without 0x prefix to match the contract
      const identityQrCode = await generateQrCode({
        type: "identity",
        proofId: identity.proofId,
        addressHash: addrHash, // This should be without 0x prefix
        codeHash: codeHash, // This should be without 0x prefix
      })

      const ageQrCode = await generateQrCode({
        type: "age",
        proofId: identity.proofId,
        addressHash: addrHash, // This should be without 0x prefix
        codeHash: codeHash, // This should be without 0x prefix
      })

      setIdentityQr(identityQrCode)
      setAgeQr(ageQrCode)
      setShowQrCodes(true)
    } catch (error) {
      console.error("Error generating QR codes:", error)
      toast({
        title: "Error Generating QR Codes",
        description: "There was an error generating your verification QR codes.",
        variant: "destructive",
      })
    }
  }

  // Update the handleGenerateVerificationCode function
  const handleGenerateVerificationCode = async () => {
    if (!address) return

    setIsGeneratingCode(true)
    try {
      // Generate a random verification code locally
      const code = generateVerificationCode()

      // Hash the code with the user's address (without 0x prefix)
      const hash = hashVerificationCode(code, address)

      // Hash the address for QR code (without 0x prefix)
      const addrHash = hashAddress(address)

      // Set state
      setVerificationCode(code)
      setCodeHash(hash)
      setAddressHash(addrHash)

      // Set expiry time to 5 minutes from now
      const expiry = new Date()
      expiry.setMinutes(expiry.getMinutes() + 5)
      setCodeExpiry(expiry)

      toast({
        title: "Verification Code Generated",
        description: "Your verification code will expire in 5 minutes.",
      })

      // Generate QR codes with the code hash only (not the code itself)
      if (identityData) {
        await generateQrCodes(identityData, hash, addrHash)
      }
    } catch (error) {
      console.error("Error generating verification code:", error)
      toast({
        title: "Error Generating Code",
        description: "There was an error generating your verification code. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const handleCompleteLiveness = async (success: boolean) => {
    setIsProcessingLiveness(true)
    try {
      if (success && signer) {
        // Update liveness verification status on the blockchain
        const tx = await updateLivenessStatus(signer, true)
        await tx.wait()

        toast({
          title: "Liveness Verification Complete",
          description: "Your identity has been updated with liveness verification.",
        })

        // Reload identity data
        await loadIdentityData()
      }
    } catch (error) {
      console.error("Error updating liveness status:", error)
      toast({
        title: "Error Updating Liveness",
        description: "There was an error updating your liveness verification status.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingLiveness(false)
      setShowLivenessVerification(false)
    }
  }

  const handleDeleteIdentity = async () => {
    if (!signer) return

    if (deleteConfirmation !== address) {
      toast({
        title: "Confirmation Failed",
        description: "The wallet address you entered doesn't match your current address.",
        variant: "destructive",
      })
      return
    }

    setIsDeleting(true)
    try {
      const tx = await deleteIdentity(signer)
      await tx.wait()

      toast({
        title: "Identity Deleted",
        description: "Your identity has been permanently deleted from the blockchain.",
      })

      // Reset state
      setIdentityData(null)
      setIdentityQr(null)
      setAgeQr(null)
      setVerificationCode(null)
      setAddressHash(null)
      setCodeHash(null)
      setCodeExpiry(null)
      setDeleteConfirmation("")
      setShowQrCodes(false)
    } catch (error) {
      console.error("Error deleting identity:", error)
      toast({
        title: "Error Deleting Identity",
        description: "There was an error deleting your identity. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="container max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>User Dashboard</CardTitle>
            <CardDescription>Connect your wallet to access your identity</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Wallet not connected</AlertTitle>
              <AlertDescription>You need to connect your wallet to access your identity dashboard.</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={connect} className="w-full">
              Connect Wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>User Dashboard</CardTitle>
            <CardDescription>Loading your identity data...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!identityData) {
    return (
      <div className="container max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>User Dashboard</CardTitle>
            <CardDescription>No identity found</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>No Identity Found</AlertTitle>
              <AlertDescription>
                You don't have a decentralized identity yet. Create one to get started.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => (window.location.href = "/create")} className="w-full">
              Create Identity
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (showLivenessVerification) {
    return (
      <div className="container max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Liveness Verification</CardTitle>
            <CardDescription>Complete the verification to enhance your identity security</CardDescription>
          </CardHeader>
          <CardContent>
            <NoCameraVerification onComplete={handleCompleteLiveness} isProcessing={isProcessingLiveness} />
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setShowLivenessVerification(false)} className="w-full">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Dashboard</CardTitle>
              <CardDescription>Manage your decentralized identity</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadIdentityData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Identity verification status */}
          <div className="mb-4 flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center">
              {identityData.livenessVerified ? (
                <ShieldCheck className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <Shield className="h-5 w-5 text-amber-500 mr-2" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {identityData.livenessVerified ? "Liveness Verified" : "Basic Identity"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {identityData.livenessVerified
                    ? "Your identity has enhanced security with liveness verification"
                    : "Your identity does not include liveness verification"}
                </p>
              </div>
            </div>
            {!identityData.livenessVerified && (
              <Button size="sm" onClick={() => setShowLivenessVerification(true)}>
                Verify
              </Button>
            )}
          </div>

          {/* Verification code section */}
          <div className="mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Verification Code</p>
              <Button size="sm" onClick={handleGenerateVerificationCode} disabled={isGeneratingCode}>
                {isGeneratingCode ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate New Code"
                )}
              </Button>
            </div>
            {verificationCode ? (
              <div className="text-center">
                <p className="text-2xl font-bold tracking-wider my-2">{verificationCode}</p>
                <p className="text-xs text-muted-foreground">Valid until: {codeExpiry?.toLocaleTimeString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share this code with verifiers for enhanced security
                </p>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Generate a verification code to create your secure QR codes
                </p>
                <Button onClick={handleGenerateVerificationCode} className="mt-2" disabled={isGeneratingCode}>
                  {isGeneratingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Generate Verification Code
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {showQrCodes && (
            <Tabs defaultValue="identity">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="identity">Identity QR</TabsTrigger>
                <TabsTrigger value="age">Age Verification</TabsTrigger>
              </TabsList>
              <TabsContent value="identity" className="mt-4">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">Use this QR code to verify your identity</p>

                    {identityQr ? (
                      <div className="flex justify-center">
                        <div className="border p-4 rounded-lg bg-white">
                          <Image
                            src={identityQr || "/placeholder.svg"}
                            alt="Identity QR Code"
                            width={200}
                            height={200}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  <Alert>
                    <AlertDescription>
                      This QR code contains a zero-knowledge proof of your identity. When scanned, it will verify your
                      identity without revealing your personal information.
                      {verificationCode && (
                        <p className="mt-1 font-medium">
                          Remember to share your verification code ({verificationCode}) with the verifier.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
              <TabsContent value="age" className="mt-4">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">Use this QR code to verify your age</p>

                    {ageQr ? (
                      <div className="flex justify-center">
                        <div className="border p-4 rounded-lg bg-white">
                          <Image
                            src={ageQr || "/placeholder.svg"}
                            alt="Age Verification QR Code"
                            width={200}
                            height={200}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  <Alert>
                    <AlertDescription>
                      This QR code contains a zero-knowledge proof that you are{" "}
                      {identityData.isAdult ? "over" : "under"} 18 years old. It does not reveal your actual age or any
                      other personal information.
                      {verificationCode && (
                        <p className="mt-1 font-medium">
                          Remember to share your verification code ({verificationCode}) with the verifier.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {!showQrCodes && verificationCode && (
            <div className="text-center py-4">
              <Alert>
                <AlertDescription>
                  Your verification code has been generated. QR codes are being created...
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!showQrCodes && !verificationCode && (
            <div className="text-center py-4">
              <Alert>
                <AlertTitle>Generate a Verification Code</AlertTitle>
                <AlertDescription>
                  Generate a verification code to create QR codes for identity verification.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.navigator.clipboard.writeText(address || "")}
          >
            Copy Wallet Address
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Identity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Identity</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. Your identity will be permanently deleted from the blockchain.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Deleting your identity will remove all your verification data. You will need to create a new
                    identity to use the system again.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="confirm-address">Enter your wallet address to confirm deletion</Label>
                  <Input
                    id="confirm-address"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={address || ""}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmation("")}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteIdentity}
                  disabled={deleteConfirmation !== address || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Identity"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  )
}
