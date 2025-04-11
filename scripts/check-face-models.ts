/**
 * This is a utility script to check if face-api models are correctly installed.
 * Run using: npx ts-node scripts/check-face-models.ts
 */

import * as fs from "fs"
import * as path from "path"

const requiredModelFiles = [
  "face_landmark_68_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "tiny_face_detector_model-weights_manifest.json",
]

const modelsDir = path.join(process.cwd(), "public", "models")

function checkModels() {
  console.log("Checking face-api model files in:", modelsDir)

  if (!fs.existsSync(modelsDir)) {
    console.error("❌ Error: models directory does not exist!")
    console.log("Please create the directory:", modelsDir)
    return false
  }

  let allFilesExist = true
  const existingFiles = fs.readdirSync(modelsDir)

  console.log("Files found in models directory:")
  existingFiles.forEach((file) => {
    console.log(`- ${file}`)
  })

  console.log("\nChecking required model files:")
  requiredModelFiles.forEach((file) => {
    if (existingFiles.includes(file)) {
      console.log(`✅ ${file}: Found`)
    } else {
      console.log(`❌ ${file}: Missing`)
      allFilesExist = false
    }
  })

  if (allFilesExist) {
    console.log("\n✅ All required model files are present!")
  } else {
    console.error("\n❌ Some required model files are missing!")
    console.log("\nPlease download the missing files from:")
    console.log("https://github.com/vladmandic/face-api/tree/master/model")
    console.log("\nAnd place them in:", modelsDir)
  }

  return allFilesExist
}

checkModels()
