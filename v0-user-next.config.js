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

    return config
  },
}

module.exports = nextConfig
