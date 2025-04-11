import { ethers } from "ethers"
import { IdentityVerifierABI } from "./contract-abi"

// Contract address on Sepolia testnet
const CONTRACT_ADDRESS = "0x067423983d7dEC5d7e618dDC9299C21F4199CdE9" // Replace with actual contract address

// Function to hash a document reference ID to prevent reuse
export function hashDocumentId(referenceId: string): string {
  // Use solidityPack with "string" type
  const packed = ethers.solidityPacked(["string"], [referenceId])

  // Then hash the packed data
  return ethers.keccak256(packed)
}

// Function to store identity proof on the blockchain
export async function storeIdentityProof(
  signer: ethers.JsonRpcSigner,
  proof: any,
  documentReferenceId: string,
): Promise<ethers.TransactionResponse> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IdentityVerifierABI, signer)

    // Include liveness verification status in the proof data
    const proofData = {
      ...proof.proof,
      livenessVerified: proof.publicSignals.livenessVerified || false,
    }

    // Hash the document reference ID to prevent reuse
    const documentHash = hashDocumentId(documentReferenceId)

    // Store the proof on-chain
    const tx = await contract.storeProof(
      proof.proofId,
      proof.commitment,
      proof.publicSignals.isAdult,
      proof.publicSignals.livenessVerified || false, // Pass liveness status explicitly
      JSON.stringify(proofData),
      documentHash,
    )

    return tx
  } catch (error) {
    console.error("Error storing proof on chain:", error)
    throw new Error("Failed to store proof on blockchain")
  }
}

// Function to check if a document has been used before
export async function isDocumentUsed(signer: ethers.JsonRpcSigner, documentReferenceId: string): Promise<boolean> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IdentityVerifierABI, signer)

    // Hash the document reference ID
    const documentHash = hashDocumentId(documentReferenceId)

    // Check if the document has been used
    const isUsed = await contract.isDocumentUsed(documentHash)

    return isUsed
  } catch (error) {
    console.error("Error checking document usage:", error)
    throw new Error("Failed to check document usage")
  }
}

// Function to update liveness verification status
export async function updateLivenessStatus(
  signer: ethers.JsonRpcSigner,
  livenessVerified: boolean,
): Promise<ethers.TransactionResponse> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IdentityVerifierABI, signer)

    // Update liveness status on-chain
    const tx = await contract.updateLivenessStatus(livenessVerified)

    return tx
  } catch (error) {
    console.error("Error updating liveness status:", error)
    throw new Error("Failed to update liveness status on blockchain")
  }
}

// Function to get user identity from the blockchain
export async function getUserIdentity(signer: ethers.JsonRpcSigner): Promise<any> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IdentityVerifierABI, signer)

    const address = await signer.getAddress()

    // Get the user's identity from the contract
    const identity = await contract.getUserIdentity(address)

    // If the user has no identity or it's deleted, return null
    if (identity.proofId === "" || identity.isDeleted) {
      return null
    }

    // Try to parse the proof data to get liveness verification status
    let livenessVerified = identity.livenessVerified
    try {
      const proofData = await contract.getProofData(identity.proofId)
      const parsedProofData = JSON.parse(proofData)
      // Use the parsed value if available, otherwise use the one from identity
      livenessVerified =
        parsedProofData.livenessVerified !== undefined ? parsedProofData.livenessVerified : livenessVerified
    } catch (e) {
      console.error("Error parsing proof data:", e)
    }

    return {
      proofId: identity.proofId,
      commitment: identity.commitment,
      isAdult: identity.isAdult,
      livenessVerified: livenessVerified,
      timestamp: new Date(Number(identity.timestamp) * 1000),
      isDeleted: identity.isDeleted,
    }
  } catch (error) {
    console.error("Error getting user identity:", error)
    throw new Error("Failed to get user identity from blockchain")
  }
}

// Updated function to verify identity proof with code hash
export async function verifyIdentityProofWithCodeHash(
  signer: ethers.JsonRpcSigner,
  proofId: string,
  addressHash: string,
  verificationCode: string,
  codeHash: string,
  verificationType: string,
): Promise<{ verified: boolean; type: string; message: string }> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IdentityVerifierABI, signer)

    console.log("Verifying proof with code hash:", {
      proofId,
      addressHash,
      verificationCode,
      codeHash,
      verificationType,
    })

    // Ensure addressHash and codeHash are properly formatted as bytes32
    // Add 0x prefix if not present
    const formattedAddressHash = addressHash.startsWith("0x") ? addressHash : `0x${addressHash}`
    const formattedCodeHash = codeHash.startsWith("0x") ? codeHash : `0x${codeHash}`

    try {
      // Use staticCall to explicitly make this a read-only call that doesn't create a transaction
      const isValid = await contract.verifyProofWithCodeHash.staticCall(
        proofId,
        formattedAddressHash,
        verificationCode,
        formattedCodeHash,
      )

      if (!isValid) {
        return {
          verified: false,
          type: verificationType,
          message:
            "The proof could not be verified. It may be invalid, expired, or the verification code is incorrect.",
        }
      }

      // Return success message based on verification type without creating a transaction
      if (verificationType === "age") {
        return {
          verified: true,
          type: "age",
          message: "The person is verified to be over 18 years old.",
        }
      } else {
        return {
          verified: true,
          type: "identity",
          message: "The identity has been successfully verified.",
        }
      }
    } catch (error) {
      console.error("Contract call error details:", error)

      // Try to extract more detailed error information
      let errorMessage = "Failed to verify proof on blockchain"
      if (error.reason) {
        errorMessage = `Contract error: ${error.reason}`
      } else if (error.message) {
        errorMessage = error.message
      }

      throw new Error(errorMessage)
    }
  } catch (error) {
    console.error("Error verifying proof with code hash:", error)
    throw new Error(`Failed to verify proof: ${error.message || "Unknown error"}`)
  }
}

// Function to delete user identity
export async function deleteIdentity(signer: ethers.JsonRpcSigner): Promise<ethers.TransactionResponse> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IdentityVerifierABI, signer)

    // Delete identity on-chain
    const tx = await contract.deleteIdentity()

    return tx
  } catch (error) {
    console.error("Error deleting identity:", error)
    throw new Error("Failed to delete identity from blockchain")
  }
}
