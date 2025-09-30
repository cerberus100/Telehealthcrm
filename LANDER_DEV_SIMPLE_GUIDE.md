# 🎯 For Lander Dev Team - Super Simple Integration Guide

## What You're Trying To Do

**Goal:** When someone signs up on your landing page → They get added to the telehealth app → They can schedule/join video visits

**Current Problem:** You're not sure how to connect your signups to our app

**Solution:** Call our API endpoint (we'll give you code to copy/paste)

---

## 🔑 The Missing Piece: Patient Account Creation

Right now you have:
- ✅ Video visit scheduling (we built this)
- ❌ Patient account creation (THIS is what you need)

**You need to create patients in OUR system first, before they can have video visits.**

---

## 📝 Step-by-Step: What To Build

### **Step 1: Create Patient in Telehealth System**

When someone signs up on your lander, call this API:

```javascript
// YOUR backend code (server-side only!)
async function createPatient(signupData) {
  const response = await fetch('http://api.eudaura.com/api/patient/provisional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      email: signupData.email,
      phone: signupData.phone,
      dob: signupData.dateOfBirth,
      address: {
        address1: signupData.street,
        city: signupData.city,
        state: signupData.state,
        postalCode: signupData.zip
      },
      insurance: {
        hasInsurance: signupData.hasInsurance || false,
        type: signupData.insuranceType || null  // 'Medicare' | 'Medicaid' | 'Commercial'
      },
      preferredContact: signupData.preferredContact || 'Email',  // 'Email' | 'SMS'
      consent: true
    })
  })

  const result = await response.json()
  
  return {
    patientId: result.requestId,  // Save this! You'll need it for video visits
    contact: result.contact
  }
}
```

**Returns:**
```json
{
  "requestId": "patient_12345",  // ← This is their patient ID
  "contact": "john@example.com"
}
```

**Save `requestId` in your database!** You'll need it later.

---

### **Step 2: Patient Verifies Email/Phone (Optional)**

If you want email/phone verification:

```javascript
// After they enter the 6-digit code you sent
async function verifyPatient(contact, code) {
  const response = await fetch('http://api.eudaura.com/api/patient/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact: contact,  // Email or phone from step 1
      code: code         // 6-digit code
    })
  })

  const result = await response.json()
  // result.next = '/onboarding/patient'
}
```

**OR skip verification** and let them use the app immediately.

---

### **Step 3: Schedule Video Visit (Already Built!)**

After patient is created, use the form we built:

```javascript
// Now you can schedule video visits using the patient ID from step 1
async function scheduleVideoVisit(patientId, preferences) {
  const response = await fetch('http://api.eudaura.com/api/visits', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_ADMIN_TOKEN',  // We'll give you this
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patientId: patientId,  // From step 1!
      clinicianId: 'clinician_auto',  // Backend auto-assigns
      scheduledAt: preferences.scheduledTime,
      channel: 'both'  // Send SMS + Email
    })
  })

  const result = await response.json()
  // result.visitId = "visit_12345"
  // Patient automatically receives SMS + Email with video link!
}
```

---

## 🎯 Complete Flow (What Happens)

```
User fills out lander signup form
         ↓
Your backend calls: POST /api/patient/provisional
         ↓
Returns: { patientId: "patient_12345" }
         ↓
You save patientId in YOUR database
         ↓
[Later] User wants video visit
         ↓
Your backend calls: POST /api/visits (with patientId)
         ↓
Backend schedules visit + sends SMS/Email with link
         ↓
Patient clicks link → Joins video visit
         ↓
Done! ✅
```

---

## 💻 Code Example (Full Integration)

### **Your Lander Signup Form:**

```typescript
// pages/signup.tsx
'use client'

import { useState } from 'react'

export default function SignupPage() {
  const [loading, setLoading] = useState(false)

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.target)
    
    try {
      // Call YOUR backend
      const response = await fetch('/api/create-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          dateOfBirth: formData.get('dob'),
          address: {
            street: formData.get('street'),
            city: formData.get('city'),
            state: formData.get('state'),
            zip: formData.get('zip')
          }
        })
      })

      const result = await response.json()

      if (result.success) {
        // Patient created! Show success message
        alert(`Welcome! Check ${result.contact} for verification code.`)
        
        // Optionally: Redirect to video visit booking
        window.location.href = '/book-visit?patientId=' + result.patientId
      }

    } catch (error) {
      alert('Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignup}>
      <input name="firstName" placeholder="First Name" required />
      <input name="lastName" placeholder="Last Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="phone" type="tel" placeholder="Phone" required />
      <input name="dob" type="date" placeholder="Date of Birth" required />
      <input name="street" placeholder="Street Address" required />
      <input name="city" placeholder="City" required />
      <input name="state" placeholder="State" required />
      <input name="zip" placeholder="ZIP Code" required />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  )
}
```

---

### **Your Backend API Route:**

```typescript
// app/api/create-patient/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    // Step 1: Create patient in TELEHEALTH system
    const telehealthResponse = await fetch('http://api.eudaura.com/api/patient/provisional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dob: body.dateOfBirth,
        address: body.address,
        insurance: { hasInsurance: false },  // Or collect this from form
        preferredContact: 'Email',
        consent: true
      })
    })

    const telehealth = await telehealthResponse.json()

    // Step 2: Save to YOUR database
    await yourDatabase.patients.create({
      id: telehealth.requestId,  // Use their patient ID
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      telehealthPatientId: telehealth.requestId,  // Important!
      createdAt: new Date()
    })

    // Step 3: Return success
    return NextResponse.json({
      success: true,
      patientId: telehealth.requestId,
      contact: telehealth.contact,
      message: 'Account created! Check your email for verification.'
    })

  } catch (error) {
    console.error('Patient creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
```

---

### **Later: Schedule Video Visit**

```typescript
// app/api/book-video-visit/route.ts
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_TOKEN = process.env.TELEHEALTH_ADMIN_TOKEN  // Backend gives you this

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    // Get patient from YOUR database
    const patient = await yourDatabase.patients.findOne({
      id: body.patientId
    })

    if (!patient) {
      throw new Error('Patient not found')
    }

    // Schedule video visit in TELEHEALTH system
    const visitResponse = await fetch('http://api.eudaura.com/api/visits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        patientId: patient.telehealthPatientId,  // From step 2!
        clinicianId: 'auto-assign',  // Backend assigns doctor
        scheduledAt: body.appointmentTime,
        channel: 'both'  // SMS + Email
      })
    })

    const visit = await visitResponse.json()

    // Telehealth automatically:
    // - Generates secure one-time links
    // - Sends SMS to patient's phone
    // - Sends email to patient's email
    // - Links expire in 20 minutes

    return NextResponse.json({
      success: true,
      visitId: visit.visitId,
      message: 'Video visit scheduled! Check your email/text for the link.'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to schedule visit' },
      { status: 500 }
    )
  }
}
```

---

## 📊 Data Flow Diagram

```
LANDER SIGNUP
    ↓
[User fills form on YOUR site]
    ↓
YOUR Backend: POST /api/create-patient
    ↓
TELEHEALTH API: POST /api/patient/provisional
    ↓
Returns: { patientId: "patient_123", contact: "user@email.com" }
    ↓
YOU save patientId in YOUR database
    ↓
[Later: User wants video visit]
    ↓
YOUR Backend: POST /api/book-video-visit (with patientId)
    ↓
TELEHEALTH API: POST /api/visits (creates visit + sends links)
    ↓
Patient receives SMS + Email with video link
    ↓
Patient clicks link → Joins video visit at /j/[shortCode]
    ↓
Video call happens! ✅
```

---

## 🔑 The Key Thing You Need to Understand

**You need to create patients in TWO places:**

1. **Your Database** - So you can track who signed up on your lander
2. **Telehealth System** - So they can use the app (video visits, portal, etc.)

**How:**
- Call `POST /api/patient/provisional` for each signup
- Save the returned `patientId` in your database
- Use that `patientId` when scheduling video visits

---

## 🎯 Simplified: The 2 API Calls You Need

### **API Call #1: Create Patient (On Signup)**

```javascript
// When user signs up on your lander
POST http://api.eudaura.com/api/patient/provisional

Body:
{
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+15551234567",
  dob: "1990-01-01",
  address: {
    address1: "123 Main St",
    city: "Austin",
    state: "TX",
    postalCode: "78701"
  },
  insurance: { hasInsurance: false },
  preferredContact: "Email",
  consent: true
}

Returns:
{
  requestId: "patient_abc123",  ← SAVE THIS!
  contact: "john@example.com"
}
```

### **API Call #2: Schedule Video Visit (When They Book)**

```javascript
// When patient wants to book a video visit
POST http://api.eudaura.com/api/visits
Authorization: Bearer <ADMIN_TOKEN>

Body:
{
  patientId: "patient_abc123",  ← From API call #1!
  clinicianId: "auto-assign",
  scheduledAt: "2025-09-30T15:00:00Z",
  channel: "both"
}

Returns:
{
  visitId: "visit_xyz789"
}

Side Effects:
- Patient automatically receives SMS
- Patient automatically receives Email
- Both have secure video link
- Links expire in 20 minutes
```

---

## 💡 Super Simple Version (Minimal Code)

### **Your Signup Form Handler:**

```javascript
// When user submits signup form on your lander
async function handleLanderSignup(formData) {
  
  // 1. Create patient in telehealth system
  const createPatientResponse = await fetch('http://api.eudaura.com/api/patient/provisional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      dob: formData.dateOfBirth,
      address: {
        address1: formData.address,
        city: formData.city,
        state: formData.state,
        postalCode: formData.zip
      },
      insurance: { hasInsurance: false },
      preferredContact: 'Email',
      consent: true
    })
  })

  const patient = await createPatientResponse.json()
  
  // 2. Save patient ID in YOUR database
  await yourDatabase.users.create({
    id: patient.requestId,  // Use their ID!
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    telehealthId: patient.requestId  // Important: link accounts
  })

  // 3. Show success
  return {
    success: true,
    patientId: patient.requestId,
    message: `Account created! Check ${patient.contact} for verification.`
  }
}
```

---

### **Later: Book Video Visit:**

```javascript
// When patient wants to schedule video visit
async function bookVideoVisit(userId, appointmentTime) {
  
  // 1. Get patient from YOUR database
  const user = await yourDatabase.users.findOne({ id: userId })
  
  // 2. Schedule visit in telehealth system
  const ADMIN_TOKEN = process.env.TELEHEALTH_ADMIN_TOKEN  // Backend gives you
  
  const visitResponse = await fetch('http://api.eudaura.com/api/visits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patientId: user.telehealthId,  // From step 2 above!
      clinicianId: 'auto-assign',
      scheduledAt: appointmentTime,
      channel: 'both'
    })
  })

  const visit = await visitResponse.json()

  // Patient automatically receives:
  // - SMS with video link
  // - Email with video link
  // - Calendar invite (.ics file)
  
  return {
    success: true,
    visitId: visit.visitId,
    message: 'Video visit scheduled! Check your email/text.'
  }
}
```

---

## 🗺️ Your Database Schema (What You Need)

```sql
-- Add this table to YOUR database
CREATE TABLE users (
  id UUID PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  telehealth_patient_id TEXT,  -- ← This links to our system!
  created_at TIMESTAMP DEFAULT now()
);

-- When creating patient:
INSERT INTO users (id, telehealth_patient_id, ...)
VALUES (patient_id, patient_id, ...);  -- Use same ID

-- When booking visit:
SELECT telehealth_patient_id FROM users WHERE id = user_id;
```

---

## 🎯 Simplified Architecture

```
YOUR LANDER
     ↓ (signup form)
YOUR DATABASE
     ↓ (stores: patient_id from telehealth)
TELEHEALTH API
     ↓ (creates patient account)
PATIENT ACCOUNT CREATED ✅
     ↓
[Later: Book video visit]
     ↓
YOUR BACKEND
     ↓ (uses saved patient_id)
TELEHEALTH API
     ↓ (schedules visit)
SMS + EMAIL SENT ✅
     ↓
PATIENT JOINS VIDEO ✅
```

---

## 📋 Checklist: What You Need

### **From Backend Team:**
- [ ] `TELEHEALTH_ADMIN_TOKEN` - API token for scheduling visits
- [ ] Confirmation that infrastructure is deployed
- [ ] API base URL: `http://api.eudaura.com` (or staging URL)

### **In Your Code:**
- [ ] Endpoint: `POST /api/create-patient` (calls our `/api/patient/provisional`)
- [ ] Endpoint: `POST /api/book-video-visit` (calls our `/api/visits`)
- [ ] Database: Column to store `telehealth_patient_id`
- [ ] Environment variable: `TELEHEALTH_ADMIN_TOKEN`

### **For Testing:**
- [ ] Use demo token: `mock_access_admin@demo.health`
- [ ] Test locally: `http://127.0.0.1:3001`
- [ ] Verify patient created
- [ ] Verify visit scheduled

---

## 🚨 Common Mistakes to Avoid

### **❌ WRONG: Calling API from client-side**
```javascript
// In browser JavaScript - NEVER DO THIS!
fetch('http://api.eudaura.com/api/visits', {
  headers: { 'Authorization': 'Bearer admin_token' }  // ← Exposes token!
})
```

### **✅ CORRECT: Calling from server-side**
```javascript
// In Next.js API route - ALWAYS DO THIS!
// app/api/your-endpoint/route.ts
export async function POST(req) {
  const ADMIN_TOKEN = process.env.TELEHEALTH_ADMIN_TOKEN  // Server-side env
  
  await fetch('http://api.eudaura.com/api/visits', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }  // Safe!
  })
}
```

---

## 💬 What To Ask Backend Team

**Message Template:**

> "Hi Backend Team!
>
> We're integrating the lander with telehealth. We understand we need to:
>
> 1. Call `POST /api/patient/provisional` when users sign up on our lander
> 2. Save the returned `patientId` in our database
> 3. Use that `patientId` when calling `POST /api/visits` to schedule video visits
>
> **We need from you:**
> - `TELEHEALTH_ADMIN_TOKEN` for calling your API endpoints
> - Confirmation that `api.eudaura.com` is live (or staging URL)
> - Is there a test patient ID we can use for testing?
>
> **We have ready:**
> - Signup form built ✅
> - API integration code ready ✅
> - Just need your token to test!
>
> Thanks!"

---

## 🎉 TL;DR (Too Long; Didn't Read)

**You need to make 2 API calls:**

1. **On Signup:** `POST /api/patient/provisional` → Get `patientId` → Save it
2. **On Booking:** `POST /api/visits` (with `patientId`) → Patient gets video link

**That's it!** 

**Code examples above** ↑  
**Full guide:** `docs/LANDER_VIDEO_INTEGRATION.md`

---

**Questions?** Ask backend team for the admin token and you're ready to go! 🚀
