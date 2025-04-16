/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Handle polyfills for browser APIs
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      util: false,
      path: false,
      crypto: false,
      stream: false,
      zlib: false,
      buffer: false,
    }

    // Add transpile modules for face-api.js
    config.module.rules.push({
      test: /\.m?js$/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    })

    return config
  },
}

module.exports = nextConfig
