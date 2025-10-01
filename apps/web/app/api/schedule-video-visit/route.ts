/**
 * Schedule Video Visit API Route
 * For Lander Integration
 * 
 * This endpoint is called by your landing page signup form
 * It handles the communication with the telehealth backend API
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

const TELEHEALTH_API = process.env.TELEHEALTH_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'
const ADMIN_TOKEN = process.env.TELEHEALTH_ADMIN_TOKEN || 'mock_access_admin@demo.health'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate required fields
    const required = ['firstName', 'lastName', 'email', 'phone', 'preferredDate', 'preferredTime']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // In production, you would:
    // 1. Create patient record in YOUR database
    // 2. Assign appropriate clinician based on availability/specialty
    // 3. Store visit metadata
    
    // For demo/testing, we'll use mock IDs
    const patientId = `patient_${Date.now()}`
    const clinicianId = 'clinician_demo'  // Backend will assign real doctor

    // Format scheduled time
    const scheduledAt = new Date(`${body.preferredDate}T${body.preferredTime}:00`)
    
    // Validate date is in future
    if (scheduledAt < new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      )
    }

    // Step 1: Create visit in telehealth system
    const visitResponse = await fetch(`${TELEHEALTH_API}/api/visits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        patientId,
        clinicianId,
        scheduledAt: scheduledAt.toISOString(),
        duration: 30,
        visitType: 'initial',
        chiefComplaint: body.reason || 'General consultation',
        channel: body.channel || 'both'
      })
    })

    if (!visitResponse.ok) {
      const errorText = await visitResponse.text()
      console.error('Telehealth API error:', errorText)
      throw new Error('Failed to create visit')
    }

    const { visitId } = await visitResponse.json()

    // Step 2: Generate one-time join links
    const linksResponse = await fetch(`${TELEHEALTH_API}/api/visits/${visitId}/links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roles: ['patient', 'clinician'],
        ttlMinutes: 20
      })
    })

    if (!linksResponse.ok) {
      console.error('Failed to generate links')
      throw new Error('Failed to generate join links')
    }

    // Step 3: Send notifications (SMS + Email)
    const notifyResponse = await fetch(`${TELEHEALTH_API}/api/visits/${visitId}/notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: body.channel || 'both',
        recipientRole: 'patient',
        template: 'initial'
      })
    })

    if (!notifyResponse.ok) {
      console.warn('Notification sending failed, but visit was created')
      // Don't fail the request - visit is created, user can still join via portal
    }

    // Success!
    return NextResponse.json({
      success: true,
      visitId,
      scheduledAt: scheduledAt.toISOString(),
      message: 'Video visit scheduled successfully'
    })

  } catch (error: any) {
    console.error('Schedule video visit error:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to schedule visit',
        details: 'Please try again or contact support at (555) 123-4567'
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    service: 'video-visit-scheduler',
    status: 'ok',
    apiConnected: !!ADMIN_TOKEN,
    apiUrl: TELEHEALTH_API
  })
}
