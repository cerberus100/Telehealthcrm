/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      // Allow API, websockets, and WebRTC (Chime)
      "connect-src 'self' https: http: ws: wss: http://localhost:3001 ws://localhost:3001 ws://localhost:3000 http://127.0.0.1:3001 ws://127.0.0.1:3001 ws://127.0.0.1:3000 https://*.chime.aws wss://*.chime.aws https://*.awsapps.com",
      // Allow framing Connect CCP for video
      "frame-src 'self' https://*.awsapps.com https://*.my.connect.aws",
      // Allow media from Chime
      "media-src 'self' https://*.chime.aws blob:",
      "frame-ancestors 'none'"
    ].join('; ')
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(self https://*.awsapps.com), microphone=(self https://*.awsapps.com), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
        ]
      }
    ]
  }
}

module.exports = nextConfig
