# Face-API.js Models

This folder must contain the following model files for face-api.js:

1. `tiny_face_detector_model-weights_manifest.json`
2. `tiny_face_detector_model-shard1`
3. `face_landmark_68_model-weights_manifest.json`
4. `face_landmark_68_model-shard1`

## How to Get the Model Files

If the liveness detection isn't working, please make sure all these files are present in this directory.

You can download them from the official face-api.js repository:
https://github.com/vladmandic/face-api/tree/master/model

Simply download these four files and place them in this directory.

## Troubleshooting

If you're experiencing issues with the liveness detection:

1. Ensure all model files are present in this directory
2. Make sure you're using a modern browser with WebGL support
3. Allow camera permissions when prompted
4. Make sure your face is well-lit and facing the camera
5. Try moving closer to the camera for better detection
