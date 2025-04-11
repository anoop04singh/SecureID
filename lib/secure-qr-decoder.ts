/**
 * Secure QR Code Decoder
 * Processes data from a QR code following the UIDAI Secure QR Code specification
 * Handles decompression, parsing, and data extraction while skipping signature verification
 */

import pako from "pako"
import jsQR from "jsqr"

export class SecureQRDecoder {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null

  constructor() {
    // Create canvas for image processing
    if (typeof window !== "undefined") {
      this.canvas = document.createElement("canvas")
      this.ctx = this.canvas.getContext("2d")
    } else {
      // Handle server-side rendering
      this.canvas = {} as HTMLCanvasElement
      this.ctx = null
    }
    console.log("SecureQRDecoder initialized")
  }

  /**
   * Main method to scan and decode a QR code from an image file
   * @param {File} imageFile - The image file containing the QR code
   * @returns {Promise<Object>} - The decoded QR code data as a structured object
   */
  async decodeFromFile(imageFile: File): Promise<any> {
    try {
      console.log("Starting to decode from file:", imageFile.name)
      // First scan the QR code to get the raw data
      const rawData = await this.scanFromFile(imageFile)
      console.log("Raw QR data obtained:", rawData.substring(0, 50) + "...")
      // Process the raw data to extract the structured information
      return this.processSecureQRData(rawData)
    } catch (error: any) {
      console.error("Error in decodeFromFile:", error)
      throw new Error(`QR Code decoding failed: ${error.message}`)
    }
  }

  /**
   * Scan QR code from an image file with enhanced processing
   */
  private async scanFromFile(imageFile: File): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log("Starting to scan QR code from file")

      if (!imageFile || !imageFile.type.match(/image.*/)) {
        console.error("Invalid file type")
        reject(new Error("Please select a valid image file"))
        return
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        console.log("File loaded, creating image")
        const img = new Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
          console.log(`Image loaded, dimensions: ${img.width}x${img.height}`)
          try {
            // Try multiple processing methods to improve QR detection
            const result = this.tryMultipleProcessingMethods(img)

            if (result) {
              console.log("QR code found in image")
              resolve(result)
            } else {
              console.error("No QR code found in image")
              reject(new Error("No QR code found in the image. Please try a clearer image or different lighting."))
            }
          } catch (error) {
            console.error("Error processing image:", error)
            reject(new Error(`Error processing image: ${error instanceof Error ? error.message : String(error)}`))
          }
        }

        img.onerror = () => {
          console.error("Failed to load image")
          reject(new Error("Failed to load the image"))
        }

        img.src = e.target?.result as string
      }

      reader.onerror = () => {
        console.error("Failed to read file")
        reject(new Error("Failed to read the file"))
      }

      reader.readAsDataURL(imageFile)
    })
  }

  /**
   * Try multiple processing methods to improve QR detection
   */
  private tryMultipleProcessingMethods(img: HTMLImageElement): string | null {
    if (!this.ctx) {
      throw new Error("Canvas context not available")
    }

    // Try different sizes to handle various image resolutions
    const sizes = [
      { width: img.width, height: img.height },
      { width: 800, height: 800 * (img.height / img.width) },
      { width: 1000, height: 1000 * (img.height / img.width) },
      { width: 1200, height: 1200 * (img.height / img.width) },
    ]

    // Try different processing methods
    const processingMethods = [
      { name: "original", process: (ctx: CanvasRenderingContext2D) => {} },
      { name: "highContrast", process: this.applyHighContrast },
      { name: "grayscale", process: this.applyGrayscale },
      { name: "binarize", process: this.applyBinarize },
      { name: "sharpen", process: this.applySharpen },
    ]

    // Try each combination of size and processing method
    for (const size of sizes) {
      this.canvas.width = size.width
      this.canvas.height = size.height

      for (const method of processingMethods) {
        // Clear canvas and draw image
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)

        // Apply processing method
        method.process(this.ctx)

        // Get image data
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)

        // Try both inversion methods
        const inversionMethods = ["dontInvert", "attemptBoth"] as const

        for (const inversion of inversionMethods) {
          try {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: inversion,
            })

            if (code) {
              console.log(
                `QR code found with method: ${method.name}, size: ${size.width}x${size.height}, inversion: ${inversion}`,
              )
              return code.data
            }
          } catch (error) {
            console.error(`Error with method ${method.name}:`, error)
          }
        }
      }
    }

    return null
  }

  // Image processing functions
  private applyHighContrast(ctx: CanvasRenderingContext2D) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      // Increase contrast
      for (let j = 0; j < 3; j++) {
        data[i + j] = data[i + j] < 128 ? 0 : 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

  private applyGrayscale(ctx: CanvasRenderingContext2D) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      data[i] = data[i + 1] = data[i + 2] = avg
    }

    ctx.putImageData(imageData, 0, 0)
  }

  private applyBinarize(ctx: CanvasRenderingContext2D) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data

    // First convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      data[i] = data[i + 1] = data[i + 2] = avg
    }

    // Calculate threshold (Otsu's method simplified)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i]
    }
    const threshold = sum / (data.length / 4)

    // Apply threshold
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] < threshold ? 0 : 255
      data[i] = data[i + 1] = data[i + 2] = value
    }

    ctx.putImageData(imageData, 0, 0)
  }

  private applySharpen(ctx: CanvasRenderingContext2D) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data
    const width = ctx.canvas.width
    const height = ctx.canvas.height

    // Create a copy of the original data
    const original = new Uint8ClampedArray(data)

    // Apply a simple sharpening kernel
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4

        for (let c = 0; c < 3; c++) {
          const i = idx + c

          // Apply a simple sharpening kernel
          data[i] = Math.min(
            255,
            Math.max(
              0,
              5 * original[i] -
                original[i - width * 4] - // pixel above
                original[i - 4] - // pixel to the left
                original[i + 4] - // pixel to the right
                original[i + width * 4], // pixel below
            ),
          )
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Process secure QR code data according to the specification
   * @param {string} rawData - Raw data from the QR code
   * @returns {Object} - Structured data from the QR code
   */
  processSecureQRData(rawData: string): any {
    try {
      console.log("Processing Secure QR data")

      // 1. Convert base10 value to BigInteger and then to byte array
      const byteArray = this.convertBase10ToByteArray(rawData)
      console.log(`Converted to byte array, length: ${byteArray.length}`)

      // 2. Decompress the byte array using gzip
      const decompressedBytes = this.decompressData(byteArray)
      console.log(`Decompressed byte array, length: ${decompressedBytes.length}`)

      // 3. Extract the data fields according to the specification
      return this.extractDataFields(decompressedBytes)
    } catch (error: any) {
      console.error("Error in processSecureQRData:", error)
      throw new Error(`Data processing failed: ${error.message}`)
    }
  }

  /**
   * Convert the base10 string from QR code to a byte array
   * @param {string} base10String - The base10 string from QR code
   * @returns {Uint8Array} - The resulting byte array
   */
  convertBase10ToByteArray(base10String: string): Uint8Array {
    try {
      console.log("Converting base10 string to byte array")

      // Create a BigInteger from the base10 string
      // Using BigInt for native JavaScript support
      const bigInt = BigInt(base10String)
      console.log("BigInt created")

      // Convert to hex string first (easier to work with)
      let hexString = bigInt.toString(16)

      // Ensure even length
      if (hexString.length % 2 !== 0) {
        hexString = "0" + hexString
      }
      console.log(`Hex string length: ${hexString.length}`)

      // Convert hex string to byte array
      const byteArray = new Uint8Array(hexString.length / 2)
      for (let i = 0; i < byteArray.length; i++) {
        const byteValue = Number.parseInt(hexString.substring(i * 2, i * 2 + 2), 16)
        byteArray[i] = byteValue
      }

      return byteArray
    } catch (error: any) {
      console.error("Error in convertBase10ToByteArray:", error)
      throw new Error(`Failed to convert base10 to byte array: ${error.message}`)
    }
  }

  /**
   * Decompress data using gzip
   * @param {Uint8Array} compressedData - Compressed byte array
   * @returns {Uint8Array} - Decompressed byte array
   */
  decompressData(compressedData: Uint8Array): Uint8Array {
    try {
      console.log("Attempting to decompress data")
      // Using pako for gzip decompression
      return pako.inflate(compressedData)
    } catch (error) {
      // Try without decompression if it fails (data might not be compressed)
      console.warn("Decompression failed, trying without decompression:", error)
      return compressedData
    }
  }

  /**
   * Extract data fields from the byte array according to the specification
   * @param {Uint8Array} byteArray - Decompressed byte array
   * @returns {Object} - Structured data from the QR code
   */
  extractDataFields(byteArray: Uint8Array): any {
    console.log("Extracting data fields from byte array")

    // Delimiter value is 255 according to the specification
    const DELIMITER = 255
    let currentIndex = 0
    const result: any = {}
    const fieldValues: string[] = []

    try {
      // First pass: Read all field values into an array
      let index = 0
      while (index < byteArray.length) {
        let endIndex = index

        // Find the next delimiter
        while (endIndex < byteArray.length && byteArray[endIndex] !== DELIMITER) {
          endIndex++
        }

        // Extract the bytes for this field
        const fieldBytes = byteArray.slice(index, endIndex)

        // Convert to string
        const value = this.bytesToString(fieldBytes)
        fieldValues.push(value)

        // Move to next field (skip delimiter)
        index = endIndex + 1

        // Break if we've read enough fields (to avoid reading too much data)
        if (fieldValues.length > 15) break
      }

      console.log("Read field values:", fieldValues)

      // Check for the special case: Email/Mobile is NaN and next field is "3"
      const firstFieldValue = fieldValues[0].trim()
      const parsedFirstValue = Number.parseInt(firstFieldValue, 10)
      const secondFieldValue = fieldValues[1]

      let fieldShift = false

      if (isNaN(parsedFirstValue) && secondFieldValue === "3") {
        console.log("Detected special case: Email/Mobile is NaN and Reference ID is 3")
        fieldShift = true

        // Apply the workaround - shift fields backward
        result.emailMobilePresent = 3 // Hardcode to 3

        // Shift all other fields backward
        for (let i = 1; i < fieldValues.length - 1; i++) {
          fieldValues[i] = fieldValues[i + 1]
        }
      } else {
        // Normal case - parse email/mobile indicator
        result.emailMobilePresent = isNaN(parsedFirstValue) ? 0 : parsedFirstValue
      }

      console.log(`Email/Mobile indicator: ${result.emailMobilePresent}`)

      // Now process the rest of the fields
      result.referenceId = fieldValues[1]
      result.name = fieldValues[2]
      result.dateOfBirth = fieldValues[3]
      result.gender = fieldValues[4]

      // Continue with address fields
      result.careOf = fieldValues[5]
      result.district = fieldValues[6]
      result.landmark = fieldValues[7]
      result.house = fieldValues[8]
      result.location = fieldValues[9]
      result.pinCode = fieldValues[10]
      result.postOffice = fieldValues[11]
      result.state = fieldValues[12]
      result.street = fieldValues[13]
      result.subDistrict = fieldValues[14]

      if (fieldValues.length > 15) {
        result.vtc = fieldValues[15]
      }

      // Skip to the end of the text fields
      for (let i = 0; i < fieldValues.length; i++) {
        const fieldLength = fieldValues[i].length
        currentIndex += fieldLength + 1 // +1 for the delimiter
      }

      console.log("Finished extracting text fields")
      console.log(`Current index: ${currentIndex}, Total byte length: ${byteArray.length}`)

      // Calculate the position for signature, email, and mobile
      const dataLength = byteArray.length

      // Signature size is fixed 256 bytes at the end
      const SIGNATURE_SIZE = 256
      const signatureStartIndex = dataLength - SIGNATURE_SIZE
      console.log(`Signature starts at index: ${signatureStartIndex}`)

      // Handle email and mobile based on indicator
      if (result.emailMobilePresent === 3 || fieldShift) {
        // Both email and mobile present (32 bytes each)
        const mobileStartIndex = signatureStartIndex - 32
        const emailStartIndex = mobileStartIndex - 32

        result.mobileHash = this.bytesToHexString(byteArray.slice(mobileStartIndex, mobileStartIndex + 32))
        result.emailHash = this.bytesToHexString(byteArray.slice(emailStartIndex, emailStartIndex + 32))
        console.log("Extracted both mobile and email hashes")

        // Photo ends before email
        const photoEndIndex = emailStartIndex
        result.photo = byteArray.slice(currentIndex, photoEndIndex)
      } else if (result.emailMobilePresent === 2) {
        // Only mobile present
        const mobileStartIndex = signatureStartIndex - 32

        result.mobileHash = this.bytesToHexString(byteArray.slice(mobileStartIndex, mobileStartIndex + 32))
        console.log("Extracted mobile hash only")

        // Photo ends before mobile
        const photoEndIndex = mobileStartIndex
        result.photo = byteArray.slice(currentIndex, photoEndIndex)
      } else if (result.emailMobilePresent === 1) {
        // Only email present
        const emailStartIndex = signatureStartIndex - 32

        result.emailHash = this.bytesToHexString(byteArray.slice(emailStartIndex, emailStartIndex + 32))
        console.log("Extracted email hash only")

        // Photo ends before email
        const photoEndIndex = emailStartIndex
        result.photo = byteArray.slice(currentIndex, photoEndIndex)
      } else {
        // No email or mobile
        // Photo ends before signature
        const photoEndIndex = signatureStartIndex
        result.photo = byteArray.slice(currentIndex, photoEndIndex)
        console.log("No email or mobile present")
      }

      console.log(`Photo data length: ${result.photo.length}`)

      // Extract signature (skipping verification as requested)
      result.signature = byteArray.slice(signatureStartIndex, dataLength)
      console.log(`Signature data length: ${result.signature.length}`)

      // Calculate age from date of birth
      if (result.dateOfBirth) {
        const dob = this.parseDateOfBirth(result.dateOfBirth)
        if (dob) {
          result.age = this.calculateAge(dob)
          result.isAdult = result.age >= 18
          console.log(`Calculated age: ${result.age}, isAdult: ${result.isAdult}`)
        }
      }

      return result
    } catch (error: any) {
      console.error("Error during field extraction:", error)
      throw new Error(`Failed to extract data fields: ${error.message} (at index ${currentIndex})`)
    }
  }

  /**
   * Calculate age from date of birth
   * @param {Date} dob - Date of birth
   * @returns {number} - Age in years
   */
  calculateAge(dob: Date): number {
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()

    // Check if birthday has occurred this year
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    return age
  }

  /**
   * Parse date of birth string into a Date object
   * @param {string} dobString - Date of birth string from QR code
   * @returns {Date|null} - Date object or null if parsing fails
   */
  parseDateOfBirth(dobString: string): Date | null {
    try {
      console.log(`Parsing date of birth: ${dobString}`)

      // Clean the string
      const cleanDob = dobString.trim()

      // Expected formats: DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD
      let dob: Date

      if (cleanDob.includes("/")) {
        // DD/MM/YYYY format
        const parts = cleanDob.split("/")
        if (parts.length !== 3) {
          console.error("Invalid date format, expected DD/MM/YYYY")
          return null
        }

        const day = Number.parseInt(parts[0], 10)
        const month = Number.parseInt(parts[1], 10)
        const year = Number.parseInt(parts[2], 10)

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          console.error("Invalid date components:", { day, month, year })
          return null
        }

        dob = new Date(year, month - 1, day)
        console.log(`Parsed date: ${dob.toISOString()}`)
      } else if (cleanDob.includes("-")) {
        // If the first part is 4 digits then assume YYYY-MM-DD, otherwise assume DD-MM-YYYY
        const parts = cleanDob.split("-")
        if (parts.length !== 3) {
          console.error("Invalid date format, expected DD-MM-YYYY or YYYY-MM-DD")
          return null
        }

        let day: number, month: number, year: number
        if (parts[0].length === 4) {
          // YYYY-MM-DD format
          year = Number.parseInt(parts[0], 10)
          month = Number.parseInt(parts[1], 10)
          day = Number.parseInt(parts[2], 10)
        } else {
          // DD-MM-YYYY format
          day = Number.parseInt(parts[0], 10)
          month = Number.parseInt(parts[1], 10)
          year = Number.parseInt(parts[2], 10)
        }

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          console.error("Invalid date components:", { day, month, year })
          return null
        }

        dob = new Date(year, month - 1, day)
        console.log(`Parsed date: ${dob.toISOString()}`)
      } else {
        // Try direct parsing
        dob = new Date(cleanDob)
        console.log(`Direct parsed date: ${dob.toISOString()}`)
      }

      // Validate the date
      if (isNaN(dob.getTime())) {
        console.error("Invalid date of birth:", cleanDob)
        return null
      }

      // Sanity check - make sure the date is in the past and not too far in the past
      const today = new Date()
      if (dob > today) {
        console.error("Date of birth is in the future")
        return null
      }

      const maxAge = 120
      const minDate = new Date()
      minDate.setFullYear(today.getFullYear() - maxAge)

      if (dob < minDate) {
        console.error("Date of birth is too far in the past")
        return null
      }

      return dob
    } catch (error) {
      console.error("Error parsing date of birth:", error)
      return null
    }
  }

  /**
   * Convert a byte array to a string using ISO-8859-1 encoding
   * @param {Uint8Array} bytes - The bytes to convert
   * @returns {string} - The resulting string
   */
  bytesToString(bytes: Uint8Array): string {
    let result = ""
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i])
    }
    return result
  }

  /**
   * Convert a byte array to a hex string
   * @param {Uint8Array} bytes - The bytes to convert
   * @returns {string} - The resulting hex string
   */
  bytesToHexString(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }
}
