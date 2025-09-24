#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Bundle Security Check
 * Prevents localhost references and other security issues in production builds
 */

const BUNDLE_PATHS = [
  'apps/web/.next/static/chunks',
  'apps/web/out/_next/static/chunks'
]

const FORBIDDEN_PATTERNS = [
  // Network security issues
  'localhost',
  '127.0.0.1',
  '0.0.0.0',

  // Debug/development endpoints
  'console.log',
  'console.warn',
  'console.error',
  'debugger',

  // Sensitive data patterns
  'password',
  'secret',
  'key',
  'token',

  // Development flags
  'NEXT_PUBLIC_USE_MOCKS',
  'API_DEMO_MODE'
]

const ALLOWED_PATTERNS = [
  'localhost:3000', // Allow localhost for development builds
  '127.0.0.1:3000', // Allow local development server
  'console.log("WebSocket connected', // Allow specific logging in realtime
  'console.log("WebSocket disconnected', // Allow specific logging in realtime
  'console.log("Screen-pop received', // Allow specific logging in realtime
  'console.log("Approval update received', // Allow specific logging in realtime
  'console.log("Notification received', // Allow specific logging in realtime
  'NEXT_PUBLIC_API_BASE_URL', // Allow environment variable usage
  'NEXT_PUBLIC_WS_URL', // Allow environment variable usage
  'NEXT_PUBLIC_PORTAL_BASE_URL' // Allow environment variable usage
]

function checkBundle(bundlePath) {
  if (!fs.existsSync(bundlePath)) {
    console.log(`⚠️  Bundle path not found: ${bundlePath}`)
    return true
  }

  let hasIssues = false
  const files = fs.readdirSync(bundlePath).filter(f => f.endsWith('.js') || f.endsWith('.map'))

  console.log(`🔍 Checking ${files.length} bundle files in ${bundlePath}`)

  for (const file of files) {
    const filePath = path.join(bundlePath, file)
    const content = fs.readFileSync(filePath, 'utf8')

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (content.includes(pattern)) {
        // Check if it's allowed
        const isAllowed = ALLOWED_PATTERNS.some(allowed => pattern.includes(allowed.split(':')[0]) && allowed.includes(pattern))

        if (!isAllowed) {
          console.error(`❌ SECURITY ISSUE: Found "${pattern}" in ${filePath}`)
          console.error(`   This could leak sensitive information or create security vulnerabilities`)
          hasIssues = true
        } else {
          console.log(`✅ ALLOWED: "${pattern}" found in ${filePath} (development logging)`)
        }
      }
    }
  }

  return !hasIssues
}

function main() {
  console.log('🔒 Bundle Security Check')
  console.log('=======================')

  let allClean = true

  for (const bundlePath of BUNDLE_PATHS) {
    const isClean = checkBundle(bundlePath)
    allClean = allClean && isClean
  }

  if (allClean) {
    console.log('✅ All bundle checks passed!')
    process.exit(0)
  } else {
    console.error('❌ Bundle security issues found!')
    console.error('   Please fix the issues above before deploying to production.')
    process.exit(1)
  }
}

main()
