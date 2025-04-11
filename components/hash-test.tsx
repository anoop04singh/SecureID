"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ethers } from "ethers"

export function HashTest() {
  const [code, setCode] = useState("951301")
  const [address, setAddress] = useState("0x66a50A05e8e86d5BBC3b5784E07E11b373943F52")
  const [results, setResults] = useState<string[]>([])

  const testHashing = () => {
    const newResults = []

    // Method 1: Using solidityPackedKeccak256 (incorrect for address)
    const hash1 = ethers.solidityPackedKeccak256(["string"], [`${code}:${address}`])
    newResults.push(`Method 1 (solidityPackedKeccak256 with string): ${hash1}`)

    // Method 2: Using keccak256 and toUtf8Bytes (incorrect for address)
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes(`${code}:${address}`))
    newResults.push(`Method 2 (keccak256 + toUtf8Bytes): ${hash2}`)

    // Method 3: Using solidityPack with correct types (CORRECT APPROACH)
    const packed = ethers.solidityPack(["string", "string", "address"], [code, ":", address])
    const hash3 = ethers.keccak256(packed)
    newResults.push(`Method 3 (solidityPack + keccak256): ${hash3}`)
    newResults.push(`Packed data: ${packed}`)
    newResults.push(`Packed length: ${(packed.length - 2) / 2} bytes`)

    // Expected hash for 951301:0x66a50A05e8e86d5BBC3b5784E07E11b373943F52
    newResults.push(`Expected hash: 0x43d837e8ea3e1bd18ea963445fdbfbc2ba50558d93bfd4dc6a444526482c9e79`)

    // Test address hashing
    const addressPacked = ethers.solidityPack(["address"], [address])
    const addressHash = ethers.keccak256(addressPacked)
    newResults.push(`Address packed: ${addressPacked}`)
    newResults.push(`Address hash: ${addressHash}`)

    setResults(newResults)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hash Testing Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Verification Code</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Wallet Address</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <Button onClick={testHashing}>Test Hashing</Button>

        {results.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-md">
            <pre className="text-xs overflow-auto">
              {results.map((result, index) => (
                <div key={index}>{result}</div>
              ))}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
