# 🎯 Frontend Quick Start - Video Visit Integration

## For Landing Page Developers

**You are here:** Frontend lander team  
**Your job:** Add a signup form that schedules video visits  
**Time needed:** 2-3 hours

---

## ✅ What's Already Done For You

**You DON'T need to build:**
- ❌ Video call interface (already built at `/j/[shortCode]`)
- ❌ Camera/microphone testing (already built)
- ❌ Device selection UI (already built)
- ❌ Video controls (mute, video off, end call) (already built)
- ❌ Patient portal integration (already built)

**You ONLY need to build:**
- ✅ Signup form on your landing page (HTML/React form)
- ✅ Backend endpoint that calls our API (Node.js/Next.js API route)
- ✅ Confirmation page ("Check your email!")

---

## 🚀 Quick Integration (30 Minutes)

### **Step 1: Create Signup Form Component**

Create: `components/VideoVisitSignupForm.tsx` (or `.jsx`)

```typescript
'use client'

import { useState } from 'react'

export function VideoVisitSignupForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    
    try {
      // Call YOUR backend (not telehealth API directly)
      const response = await fetch('/api/schedule-video-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          preferredDate: formData.get('preferredDate'),
          preferredTime: formData.get('preferredTime'),
          reason: formData.get('reason')
        })
      })

      if (!response.ok) {
        throw new Error('Failed to schedule visit')
      }

      const result = await response.json()
      setSuccess(true)

      // Track conversion (optional)
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'video_visit_scheduled', {
          value: 150
        })
      }

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <div className="text-center p-8 bg-green-50 rounded-lg">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-4">Video Visit Scheduled!</h2>
        <p className="text-gray-700 mb-4">
          We've sent you a text message and email with your video visit link.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <p className="text-sm text-blue-900">
            <strong>Important:</strong> The link expires 20 minutes after you receive it for security.
            Click it when you're ready to join your visit.
          </p>
        </div>
        <p className="text-sm text-gray-600">
          Need help? Call (555) 123-4567
        </p>
      </div>
    )
  }

  // Form state
  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Schedule Your Video Visit</h2>

      {/* Personal Info */}
      <div className="grid grid-cols-2 gap-4">
        <input
          name="firstName"
          placeholder="First Name"
          required
          className="px-4 py-2 border rounded-lg"
        />
        <input
          name="lastName"
          placeholder="Last Name"
          required
          className="px-4 py-2 border rounded-lg"
        />
      </div>

      {/* Contact */}
      <input
        name="email"
        type="email"
        placeholder="Email Address"
        required
        className="w-full px-4 py-2 border rounded-lg"
      />
      <input
        name="phone"
        type="tel"
        placeholder="Phone Number (e.g., 555-123-4567)"
        required
        className="w-full px-4 py-2 border rounded-lg"
      />

      {/* Scheduling */}
      <div className="grid grid-cols-2 gap-4">
        <input
          name="preferredDate"
          type="date"
          required
          min={new Date().toISOString().split('T')[0]}
          className="px-4 py-2 border rounded-lg"
        />
        <select
          name="preferredTime"
          required
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Select Time</option>
          <option value="09:00">9:00 AM</option>
          <option value="10:00">10:00 AM</option>
          <option value="11:00">11:00 AM</option>
          <option value="14:00">2:00 PM</option>
          <option value="15:00">3:00 PM</option>
          <option value="16:00">4:00 PM</option>
        </select>
      </div>

      {/* Reason */}
      <textarea
        name="reason"
        placeholder="Reason for visit (optional)"
        rows={3}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {/* Consent */}
      <label className="flex items-start gap-3">
        <input type="checkbox" required className="mt-1" />
        <span className="text-sm text-gray-700">
          I consent to receive telehealth services. I understand video visit links 
          expire after 20 minutes for security.
        </span>
      </label>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {loading ? 'Scheduling...' : 'Schedule Free Video Visit'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By scheduling, you'll receive SMS and email with your secure video visit link
      </p>
    </form>
  )
}
```

**Usage:**
```typescript
// In your landing page
import { VideoVisitSignupForm } from '@/components/VideoVisitSignupForm'

export default function LandingPage() {
  return (
    <div>
      <h1>Get Medical Care from Home</h1>
      <VideoVisitSignupForm />
    </div>
  )
}
```

---

### **Step 2: Create Backend API Route**

Create: `app/api/schedule-video-visit/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

// IMPORTANT: Store this token securely in environment variables
const TELEHEALTH_API = process.env.TELEHEALTH_API_URL || 'https://api.eudaura.com'
const ADMIN_TOKEN = process.env.TELEHEALTH_ADMIN_TOKEN || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Create or get patient ID (from your database)
    // For demo, we'll use a mock patient ID
    const patientId = 'patient_' + Date.now()
    
    // Step 2: Assign a clinician (from your system)
    // For demo, we'll use a mock clinician ID
    const clinicianId = 'clinician_demo'

    // Step 3: Format scheduled time
    const scheduledAt = new Date(`${body.preferredDate}T${body.preferredTime}:00`)
    
    // Step 4: Call telehealth API to create visit
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
        channel: 'both'  // Send SMS and Email
      })
    })

    if (!visitResponse.ok) {
      const error = await visitResponse.json()
      throw new Error(error.error || 'Failed to create visit')
    }

    const { visitId } = await visitResponse.json()

    // Step 5: Generate join links
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
      throw new Error('Failed to generate links')
    }

    await linksResponse.json()

    // Step 6: Send notifications (SMS + Email)
    const notifyResponse = await fetch(`${TELEHEALTH_API}/api/visits/${visitId}/notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: 'both',
        recipientRole: 'patient',
        template: 'initial'
      })
    })

    if (!notifyResponse.ok) {
      console.warn('Notification failed, but visit was created')
    }

    // Success!
    return NextResponse.json({
      success: true,
      visitId,
      scheduledAt: scheduledAt.toISOString()
    })

  } catch (error: any) {
    console.error('Schedule video visit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to schedule visit' },
      { status: 500 }
    )
  }
}
```

---

### **Step 3: Add Environment Variables**

Create/update: `.env.local`

```bash
# Telehealth API Configuration
TELEHEALTH_API_URL=https://api.eudaura.com
TELEHEALTH_ADMIN_TOKEN=your-admin-token-here  # Backend team will provide this

# Or for local testing:
# TELEHEALTH_API_URL=http://127.0.0.1:3001
# TELEHEALTH_ADMIN_TOKEN=mock_access_admin@demo.health
```

⚠️ **Ask backend team for:**
- `TELEHEALTH_ADMIN_TOKEN` - Secure admin token for scheduling visits

---

### **Step 4: Test Locally**

```bash
# Terminal 1: Start backend (if testing locally)
cd apps/api
API_DEMO_MODE=true npm run dev

# Terminal 2: Start your frontend
cd apps/web
npm run dev

# Browser: Go to your landing page with the form
# Fill out form and submit
# You should see success message!
```

**To test the video join page:**
```bash
# Visit: http://localhost:3000/j/testtoken
# You'll see the camera/mic preview page
# (Won't actually connect without real backend, but you can see the UI)
```

---

### **Step 5: Deploy to Production**

**Add to Amplify environment variables:**
```bash
TELEHEALTH_API_URL=https://api.eudaura.com
TELEHEALTH_ADMIN_TOKEN=<provided-by-backend-team>
```

**Deploy:**
```bash
git add .
git commit -m "feat: Add video visit signup form"
git push origin main

# Amplify auto-deploys
```

---

## 🎯 That's It!

### **What You Built:**
1. ✅ Signup form component (copy/paste from above)
2. ✅ Backend API route (copy/paste from above)
3. ✅ Environment variables (2 lines)

### **What Users Get:**
1. Fill out form on your lander
2. Submit → Visit scheduled
3. Receive SMS + Email with link
4. Click link → Join video visit
5. Video call with doctor!

---

## 📞 Need Help?

**For Integration Questions:**
- Read: `docs/LANDER_VIDEO_INTEGRATION.md` (complete guide)
- Ask: Backend team for admin token
- Test: Use demo mode first (`API_DEMO_MODE=true`)

**For Video Issues:**
- Not your problem! Video page is already built
- Backend handles all video functionality
- You just schedule appointments

---

## ✅ Checklist

- [x] Pull latest code
- [x] Install dependencies (pnpm install)
- [ ] Copy signup form component (see above)
- [ ] Create API route (see above)
- [ ] Get admin token from backend team
- [ ] Test locally
- [ ] Deploy to production

**You're 90% done! Just copy the code above and you're ready!** 🚀
