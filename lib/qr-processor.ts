import pako from "pako"

// Function to process QR code data according to the provided instructions
export async function processQrData(qrData: string): Promise<any> {
  try {
    // Convert base10 value to BigInteger
    const bigIntValue = BigInt(qrData)

    // Convert BigInteger to byte array
    const byteArray = bigIntToByteArray(bigIntValue)

    // Check if data is compressed with gzip
    let decompressedData
    try {
      // Try to decompress with gzip
      decompressedData = pako.inflate(byteArray)
    } catch (error) {
      // If decompression fails, use the original data
      decompressedData = byteArray
    }

    // Process the data according to the instructions
    const processedData = parseByteArray(decompressedData)

    return processedData
  } catch (error) {
    console.error("Error processing QR data:", error)
    throw new Error("Failed to process QR data")
  }
}

// Helper function to convert BigInt to byte array
function bigIntToByteArray(bigInt: bigint): Uint8Array {
  let hex = bigInt.toString(16)
  if (hex.length % 2) {
    hex = "0" + hex
  }

  const byteArray = new Uint8Array(hex.length / 2)
  for (let i = 0; i < byteArray.length; i++) {
    byteArray[i] = Number.parseInt(hex.substr(i * 2, 2), 16)
  }

  return byteArray
}

// Parse byte array according to the instructions
function parseByteArray(byteArray: Uint8Array): any {
  const result: any = {}
  let currentIndex = 0

  // Read Email_mobile_present_bit_indicator_value
  const delimiterIndex = findDelimiter(byteArray, currentIndex)
  const indicatorBytes = byteArray.slice(currentIndex, delimiterIndex)
  const indicator = Number.parseInt(bytesToString(indicatorBytes, "ISO-8859-1"))
  result.emailMobileIndicator = indicator

  currentIndex = delimiterIndex + 1

  // Read other fields until VTC
  // For this example, we'll extract some basic fields

  // Name
  const nameDelimiterIndex = findDelimiter(byteArray, currentIndex)
  result.name = bytesToString(byteArray.slice(currentIndex, nameDelimiterIndex), "ISO-8859-1")
  currentIndex = nameDelimiterIndex + 1

  // DOB
  const dobDelimiterIndex = findDelimiter(byteArray, currentIndex)
  result.dob = bytesToString(byteArray.slice(currentIndex, dobDelimiterIndex), "ISO-8859-1")
  currentIndex = dobDelimiterIndex + 1

  // Gender
  const genderDelimiterIndex = findDelimiter(byteArray, currentIndex)
  result.gender = bytesToString(byteArray.slice(currentIndex, genderDelimiterIndex), "ISO-8859-1")
  currentIndex = genderDelimiterIndex + 1

  // UID (Sample ID number)
  const uidDelimiterIndex = findDelimiter(byteArray, currentIndex)
  result.uid = bytesToString(byteArray.slice(currentIndex, uidDelimiterIndex), "ISO-8859-1")

  // For demo purposes, we'll skip the signature, email, and mobile extraction

  return result
}

// Find the next delimiter (255) in the byte array
function findDelimiter(byteArray: Uint8Array, startIndex: number): number {
  for (let i = startIndex; i < byteArray.length; i++) {
    if (byteArray[i] === 255) {
      return i
    }
  }
  return byteArray.length
}

// Convert byte array to string with specified encoding
function bytesToString(bytes: Uint8Array, encoding: string): string {
  // For simplicity, we'll just convert to ASCII
  // In a real implementation, you would use the specified encoding
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("")
}
