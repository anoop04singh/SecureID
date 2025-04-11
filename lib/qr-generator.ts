import QRCode from "qrcode"

// Function to generate QR code for identity or age verification
export async function generateQrCode(data: any): Promise<string> {
  try {
    // Convert data to JSON string
    const jsonData = JSON.stringify(data)

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(jsonData, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })

    return qrCodeDataUrl
  } catch (error) {
    console.error("Error generating QR code:", error)
    throw new Error("Failed to generate QR code")
  }
}
