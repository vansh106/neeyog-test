import type { NextConfig } from 'next'

/** Server-side proxy target when the browser uses same-origin `/api/*` (not `NEXT_PUBLIC_API_URL`). */
const backendInternal =
  (process.env.BACKEND_INTERNAL_URL || process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternal}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backendInternal}/health`,
      },
    ]
  },
}

export default nextConfig
