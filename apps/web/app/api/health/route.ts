/**
 * Health Check Endpoint for Web Application
 * Used by: ALB health checks, CloudWatch monitoring, deployment verification
 */

export async function GET() {
  return Response.json({
    status: 'healthy',
    service: 'web',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}

