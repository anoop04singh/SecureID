import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-8">
      <h1 className="text-4xl font-bold text-center">SecureID</h1>
      <p className="text-center text-muted-foreground max-w-md">
        A professional, secure way to verify your identity using zero-knowledge proofs and blockchain technology.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Create Identity</CardTitle>
            <CardDescription>Register your identity and generate your decentralized ID</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Upload your identity card with QR code to create a secure, decentralized identity that protects your
              privacy.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/create" className="w-full">
              <Button className="w-full">Get Started</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>User Dashboard</CardTitle>
            <CardDescription>Manage your identity and generate verification QR codes</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Access your dashboard to view your identity details and generate QR codes for verification.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button className="w-full" variant="outline">
                Access Dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Verify Identity</CardTitle>
            <CardDescription>Scan QR codes to verify user identities</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Verify a user's identity by scanning their QR code without accessing their personal information.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/verify" className="w-full">
              <Button className="w-full" variant="outline">
                Verify Someone
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
