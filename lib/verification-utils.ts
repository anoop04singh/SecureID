import { ethers } from "ethers"

/**
 * Generate a random 6-digit verification code
 * @returns string - 6-digit code
 */
export function generateVerificationCode(): string {
  // Generate a random number between 100000 and 999999
  const randomNumber = Math.floor(100000 + Math.random() * 900000)
  // Convert to string and ensure it's 6 digits
  return randomNumber.toString().padStart(6, "0")
}

/**
 * Hash a verification code with a wallet address using the same method as the contract
 * @param code - The verification code
 * @param address - The wallet address
 * @returns string - The hashed value (without 0x prefix)
 */
export function hashVerificationCode(code: string, address: string): string {
  // First pack the data with the correct types
  // This is crucial: we need to specify "address" type to ensure it's encoded as a 20-byte value
  const packed = ethers.solidityPacked(["string", "string", "address"], [code, ":", address])

  //console.log("packedCode",packed);

  // Then hash the packed data
  const hash = ethers.keccak256(packed)
  //console.log("HashedCode",hash);
  // Return without 0x prefix for QR code
  return hash
}

/**
 * Hash an address for QR code using the same method as the contract
 * @param address - The wallet address
 * @returns string - The hashed address (without 0x prefix)
 */
export function hashAddress(address: string): string {
  // Use solidityPack with "address" type to ensure correct encoding
  const packed = ethers.solidityPacked(["address"], [address])
  //console.log("packedaddress",packed)
  // Then hash the packed data
  const hash = ethers.keccak256(packed)
  //sconsole.log("hashedaddress",hash)
  // Return without 0x prefix for QR code
  return hash
}

/**
 * Verify a code against a hash
 * @param code - The verification code to verify
 * @param hash - The hash to verify against
 * @param address - The wallet address
 * @returns boolean - Whether the code is valid
 */
export function verifyCode(code: string, hash: string, address: string): boolean {
  const computedHash = hashVerificationCode(code, address)
  // Compare without 0x prefix
  return computedHash === (hash.startsWith("0x") ? hash.substring(2) : hash)
}
