# 🌐 Landing Page Integration Guide - Video Visits

## For Frontend Lander Team

**Purpose:** Integrate your marketing landing page with the telehealth video visit system  
**API Endpoint:** `https://api.eudaura.com`  
**Auth:** Admin service token (provided separately)

---

## 🎯 User Journey

```
Landing Page Form
     ↓
Patient fills form (name, email/phone, preferred time)
     ↓
Lander calls POST /api/visits (creates visit + generates links)
     ↓
Lander calls POST /api/visits/:id/notify (sends SMS + Email)
     ↓
Patient receives message with deep link
     ↓
Patient clicks link → Joins video visit page
     ↓
Video visit conducted
```

---

## 📝 Step 1: Collect Patient Information

### Required Fields

```html
<form id="videoVisitSignup">
  
  <!-- Personal Info -->
  <input name="firstName" placeholder="First Name" required />
  <input name="lastName" placeholder="Last Name" required />
  <input name="dateOfBirth" type="date" required />
  
  <!-- Contact (at least one required) -->
  <input name="email" type="email" placeholder="Email Address" />
  <input name="phone" type="tel" placeholder="Phone Number" />
  
  <!-- Scheduling -->
  <input name="preferredDate" type="date" required />
  <select name="preferredTime" required>
    <option value="09:00">9:00 AM</option>
    <option value="10:00">10:00 AM</option>
    <option value="11:00">11:00 AM</option>
    <option value="14:00">2:00 PM</option>
    <option value="15:00">3:00 PM</option>
    <option value="16:00">4:00 PM</option>
  </select>
  
  <!-- Visit Details -->
  <select name="visitType">
    <option value="initial">Initial Consultation</option>
    <option value="follow-up">Follow-up Visit</option>
  </select>
  
  <textarea name="chiefComplaint" placeholder="Reason for visit" rows="3"></textarea>
  
  <!-- Communication Preference -->
  <select name="notificationChannel">
    <option value="both">SMS and Email</option>
    <option value="sms">SMS Only</option>
    <option value="email">Email Only</option>
  </select>
  
  <!-- Consent -->
  <label>
    <input type="checkbox" name="consent" required />
    I consent to telehealth services and understand video visit links expire after 20 minutes for security
  </label>
  
  <button type="submit">Schedule Video Visit</button>
  
</form>
```

---

## 🔌 Step 2: Call Backend API

### Create Visit + Generate Links

**Single Combined Request (Recommended):**

```javascript
async function scheduleVideoVisit(formData) {
  const API_BASE = 'https://api.eudaura.com';
  const ADMIN_TOKEN = process.env.LANDER_ADMIN_TOKEN; // Stored securely

  try {
    // Step 1: Create visit
    const visitResponse = await fetch(`${API_BASE}/api/visits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        patientId: formData.patientId,        // From your patient DB
        clinicianId: formData.selectedDoctorId, // From provider selection
        scheduledAt: new Date(`${formData.preferredDate}T${formData.preferredTime}:00Z`).toISOString(),
        duration: 30,
        visitType: formData.visitType,
        chiefComplaint: formData.chiefComplaint,
        channel: formData.notificationChannel
      })
    });

    if (!visitResponse.ok) {
      const error = await visitResponse.json();
      throw new Error(error.error || 'Failed to schedule visit');
    }

    const { visitId } = await visitResponse.json();

    // Step 2: Generate join links
    const linksResponse = await fetch(`${API_BASE}/api/visits/${visitId}/links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roles: ['patient', 'clinician'],
        ttlMinutes: 20  // 20-minute expiry
      })
    });

    if (!linksResponse.ok) {
      throw new Error('Failed to generate links');
    }

    const { patient, clinician } = await linksResponse.json();

    // Step 3: Send notifications
    const notifyResponse = await fetch(`${API_BASE}/api/visits/${visitId}/notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: formData.notificationChannel,
        recipientRole: 'both',
        template: 'initial'
      })
    });

    if (!notifyResponse.ok) {
      console.warn('Notification sending failed (visit still created)');
    }

    return {
      success: true,
      visitId,
      patientLink: patient.link,
      scheduledAt: formData.preferredDate
    };

  } catch (error) {
    console.error('Schedule video visit failed', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### Usage in Your Form

```javascript
document.getElementById('videoVisitSignup').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Show loading state
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Scheduling...';
  
  // Collect form data
  const formData = new FormData(e.target);
  const data = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    preferredDate: formData.get('preferredDate'),
    preferredTime: formData.get('preferredTime'),
    visitType: formData.get('visitType'),
    chiefComplaint: formData.get('chiefComplaint'),
    notificationChannel: formData.get('notificationChannel'),
    
    // These you'll need to provide from your system:
    patientId: await getOrCreatePatient({ /* patient data */ }),
    selectedDoctorId: await assignDoctor({ /* routing logic */ })
  };
  
  // Schedule visit
  const result = await scheduleVideoVisit(data);
  
  if (result.success) {
    // Show success message
    showSuccessMessage(result);
  } else {
    // Show error
    alert(`Error: ${result.error}`);
    submitButton.disabled = false;
    submitButton.textContent = 'Schedule Video Visit';
  }
});

function showSuccessMessage(result) {
  // Replace form with success message
  document.getElementById('videoVisitSignup').innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
      <h2>Video Visit Scheduled!</h2>
      <p>Your visit is confirmed for ${result.scheduledAt}</p>
      <p style="margin-top: 20px; color: #666;">
        We've sent you a text message and email with your video visit link.
        <br>
        <strong>Important:</strong> The link expires 20 minutes after you receive it for security.
      </p>
      <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #1e40af;">
          💡 <strong>Tip:</strong> Make sure you're in a quiet place with good lighting
          and have your camera and microphone ready!
        </p>
      </div>
    </div>
  `;
}
```

---

## 🔐 Security Best Practices

### 1. Protect Admin Token

**❌ WRONG (Exposed in Client-Side Code):**
```javascript
const ADMIN_TOKEN = 'Bearer abc123...'; // NEVER do this!
```

**✅ CORRECT (Server-Side Only):**
```javascript
// Call your own backend endpoint that has the admin token
const result = await fetch('/api/schedule-visit', {
  method: 'POST',
  body: JSON.stringify(formData)
});

// Your backend then calls telehealth API:
// server.js:
app.post('/api/schedule-visit', async (req, res) => {
  const ADMIN_TOKEN = process.env.TELEHEALTH_ADMIN_TOKEN; // Server-side env var
  
  const response = await fetch('https://api.eudaura.com/api/visits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  
  const data = await response.json();
  res.json(data);
});
```

### 2. Validate Input on Server

```javascript
// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate phone (E.164 format)
function isValidPhone(phone) {
  return /^\+?1?\d{10,15}$/.test(phone.replace(/\D/g, ''));
}

// Sanitize text input (prevent XSS)
function sanitize(text) {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 1000); // Max length
}
```

### 3. Handle Errors Gracefully

```javascript
async function scheduleVideoVisit(formData) {
  try {
    // ... API calls ...
    
  } catch (error) {
    // Log error (server-side only, never expose to client)
    console.error('Schedule video visit error:', {
      timestamp: new Date().toISOString(),
      formData: { /* no PHI */ },
      error: error.message
    });
    
    // Return user-friendly message (no technical details)
    return {
      success: false,
      error: 'Unable to schedule visit. Please try again or contact support at (555) 123-4567.'
    };
  }
}
```

---

## 📱 SMS/Email Preview

### What Patients Receive

**SMS (160 characters max):**
```
Your video visit with Dr. Jane starts at 3:00 PM.
Tap to join: visit.eudaura.com/j/a1b2c3d4
Expires in 20 min. Reply HELP for support.
```

**Email Subject:**
```
Your Video Visit Link - Friday, September 29 at 3:00 PM EDT
```

**Email Body:**
- Branded header (your logo)
- Big "Join Video Visit" button
- Scheduled date/time
- Expiry warning (20 minutes)
- Device requirements (camera, mic, Chrome/Safari)
- Calendar .ics attachment
- Support contact info

---

## 🧪 Testing in Development

### Mock API Responses

For development/testing, you can mock the API responses:

```javascript
// mock-api.js
const MOCK_RESPONSES = {
  createVisit: {
    visitId: 'visit_mock_123',
    status: 'SCHEDULED',
    scheduledAt: '2025-09-29T15:00:00Z',
    createdAt: '2025-09-29T14:00:00Z'
  },
  generateLinks: {
    patient: {
      token: 'eyJhbGc...',
      link: 'http://localhost:3000/j/mocktokn',
      expiresAt: '2025-09-29T14:20:00Z',
      tokenId: 'token_mock_456'
    },
    clinician: {
      token: 'eyJhbGc...',
      link: 'http://localhost:3000/j/mockdoc1',
      expiresAt: '2025-09-29T14:20:00Z',
      tokenId: 'token_mock_789'
    }
  }
};

// Use in development
const USE_MOCKS = process.env.NODE_ENV === 'development';

async function scheduleVideoVisit(formData) {
  if (USE_MOCKS) {
    console.log('Using mock API responses');
    return {
      success: true,
      ...MOCK_RESPONSES.createVisit,
      patientLink: MOCK_RESPONSES.generateLinks.patient.link
    };
  }
  
  // Real API calls here...
}
```

---

## 📋 Checklist for Your Team

### Before Integration
- [ ] Get admin API token from telehealth team
- [ ] Store token securely (server-side env var only)
- [ ] Set up CORS (add your lander domain to whitelist)
- [ ] Review API contracts in this doc
- [ ] Test with mock responses

### During Integration
- [ ] Implement form with all required fields
- [ ] Add server-side endpoint to proxy API calls
- [ ] Validate all inputs before sending
- [ ] Handle success/error states
- [ ] Show confirmation message with next steps

### After Integration
- [ ] Test end-to-end flow in staging
- [ ] Verify SMS/Email delivered correctly
- [ ] Test link expiry behavior
- [ ] Verify patient can join video visit
- [ ] Load test with 100 concurrent signups

### Go-Live
- [ ] Monitor first 100 signups
- [ ] Check delivery rates (SMS + Email)
- [ ] Verify join success rate
- [ ] Collect patient feedback

---

## 🚨 Error Handling

### Common Errors

#### Error 1: "Clinician not licensed in patient state"

**Response:**
```json
{
  "error": "Clinician not licensed in TX",
  "statusCode": 422
}
```

**Resolution:**
- Your lander must pass a clinician who is licensed in the patient's state
- Implement state-based provider matching logic
- Or: Let our API auto-assign provider (future feature)

---

#### Error 2: "Clinician already booked at this time"

**Response:**
```json
{
  "error": "Clinician already has a visit scheduled at this time",
  "statusCode": 409
}
```

**Resolution:**
- Check clinician availability before showing time slots
- Implement real-time availability check via GET /api/providers/:id/availability
- Or: Show alternative time slots

---

#### Error 3: "Invalid email/phone format"

**Response:**
```json
{
  "error": "Invalid payload",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email address"],
      "phone": ["Phone must be in E.164 format"]
    }
  },
  "statusCode": 400
}
```

**Resolution:**
- Validate email: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Validate phone: E.164 format `+15551234567` (10-15 digits)

---

## 📊 Analytics & Tracking

### Events to Track

```javascript
// Google Analytics / Segment
analytics.track('Video Visit Scheduled', {
  visitId: result.visitId,
  channel: formData.notificationChannel,
  visitType: formData.visitType,
  scheduledDate: formData.preferredDate
});

analytics.track('Video Visit Link Sent', {
  visitId: result.visitId,
  sentVia: ['sms', 'email'] // or just one
});

// Later: Track join success (via webhook or pixel)
analytics.track('Video Visit Joined', {
  visitId: result.visitId,
  timeToJoin: seconds // Time from link sent to join
});
```

### Conversion Funnel

```
Landing Page Visit
     ↓ (Track: Page View)
Form Started
     ↓ (Track: Form Interaction)
Form Submitted
     ↓ (Track: Video Visit Scheduled)
Link Sent
     ↓ (Track: Notification Sent)
Link Clicked
     ↓ (Track: Link Clicked - via email tracking)
Visit Joined
     ↓ (Track: Video Visit Started)
Visit Completed
     ↓ (Track: Video Visit Completed)
```

---

## 🎨 UI/UX Best Practices

### Success Confirmation Page

**Good Example:**
```html
<div class="success-page">
  <div class="icon">✅</div>
  <h1>Video Visit Scheduled!</h1>
  
  <div class="visit-details">
    <p><strong>When:</strong> Friday, Sept 29 at 3:00 PM EDT</p>
    <p><strong>With:</strong> Dr. Jane Smith</p>
    <p><strong>Duration:</strong> 30 minutes</p>
  </div>
  
  <div class="next-steps">
    <h3>What Happens Next:</h3>
    <ol>
      <li>
        <strong>Check your inbox</strong>
        <br>We've sent you a text and email with your video visit link
      </li>
      <li>
        <strong>Click the link 5 minutes before your visit</strong>
        <br>The link expires 20 minutes after you receive it for security
      </li>
      <li>
        <strong>Test your camera and microphone</strong>
        <br>Make sure you're in a quiet, well-lit place
      </li>
    </ol>
  </div>
  
  <div class="warning">
    ⚠️ <strong>Important:</strong> Don't share your video visit link with anyone.
    It's unique to you and expires for security.
  </div>
  
  <button onclick="window.location.href='/'">Back to Home</button>
</div>
```

### Error States

**User-Friendly Error Messages:**

```javascript
const ERROR_MESSAGES = {
  // API errors → User-friendly messages
  'Clinician not licensed in TX': 'This doctor is not available in your state. Please select a different provider.',
  'Clinician already has a visit scheduled': 'This time slot is no longer available. Please choose a different time.',
  'Invalid payload': 'Please check all required fields and try again.',
  'Visit not found': 'Something went wrong. Please try again or contact support.',
  
  // Generic fallback
  default: 'Unable to schedule visit. Please try again or call us at (555) 123-4567.'
};

function displayError(apiError) {
  const userMessage = ERROR_MESSAGES[apiError] || ERROR_MESSAGES.default;
  alert(userMessage); // Or show in UI banner
}
```

---

## 🔄 Advanced: Availability Check (Optional)

### Check Provider Availability Before Scheduling

```javascript
// Optional: Check if time slot is available
async function checkAvailability(clinicianId, dateTime) {
  const response = await fetch(
    `https://api.eudaura.com/api/providers/${clinicianId}/availability?date=${dateTime}`,
    {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    }
  );
  
  const { available, nextAvailable } = await response.json();
  
  if (!available) {
    return {
      available: false,
      message: `This time is no longer available. Next opening: ${nextAvailable}`
    };
  }
  
  return { available: true };
}

// Use before scheduling
async function handleFormSubmit(formData) {
  const dateTime = `${formData.preferredDate}T${formData.preferredTime}:00Z`;
  const check = await checkAvailability(formData.selectedDoctorId, dateTime);
  
  if (!check.available) {
    alert(check.message);
    return;
  }
  
  // Proceed with scheduling
  await scheduleVideoVisit(formData);
}
```

---

## 📞 Support & Questions

**For Integration Questions:**
- Email: dev@eudaura.com
- Slack: #lander-integration

**For API Token Request:**
- Contact: DevOps team
- Include: Your server IP addresses for whitelisting

**For CORS Configuration:**
- Provide: Your lander domains (e.g., `https://yourlander.com`, `https://www.yourlander.com`)
- We'll add them to the API CORS whitelist

---

## 🎯 Complete Example (React/Next.js)

```typescript
'use client'

import { useState } from 'react'

export function VideoVisitScheduleForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    
    try {
      // Call your backend (which calls telehealth API)
      const response = await fetch('/api/schedule-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          preferredDate: formData.get('preferredDate'),
          preferredTime: formData.get('preferredTime'),
          visitType: formData.get('visitType'),
          chiefComplaint: formData.get('chiefComplaint'),
          channel: formData.get('channel')
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message)
      }

      const result = await response.json()
      setSuccess(true)

      // Track conversion
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'video_visit_scheduled', {
          visit_id: result.visitId,
          value: 150 // Visit value in dollars
        })
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center p-8 bg-green-50 rounded-lg">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Video Visit Scheduled!</h2>
        <p className="text-gray-600">
          Check your email and text messages for your video visit link.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
      <input name="firstName" placeholder="First Name" required className="w-full px-4 py-2 border rounded" />
      <input name="lastName" placeholder="Last Name" required className="w-full px-4 py-2 border rounded" />
      <input name="email" type="email" placeholder="Email" required className="w-full px-4 py-2 border rounded" />
      <input name="phone" type="tel" placeholder="Phone" required className="w-full px-4 py-2 border rounded" />
      
      <input name="preferredDate" type="date" required className="w-full px-4 py-2 border rounded" />
      <select name="preferredTime" required className="w-full px-4 py-2 border rounded">
        <option value="">Select Time</option>
        <option value="09:00">9:00 AM</option>
        <option value="15:00">3:00 PM</option>
      </select>
      
      <textarea name="chiefComplaint" placeholder="Reason for visit" rows={3} className="w-full px-4 py-2 border rounded" />
      
      <select name="channel" required className="w-full px-4 py-2 border rounded">
        <option value="both">Send via SMS and Email</option>
        <option value="sms">SMS Only</option>
        <option value="email">Email Only</option>
      </select>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Scheduling...' : 'Schedule Video Visit'}
      </button>
    </form>
  )
}
```

---

## ✅ Integration Complete!

**Your lander now:**
- Collects patient information securely
- Schedules video visits via our API
- Automatically sends SMS + Email with join links
- Provides great UX with clear confirmation messages

**Next Steps:**
1. Get admin API token from our team
2. Implement server-side proxy endpoint
3. Test in staging environment
4. Monitor conversion rates
5. Go live! 🚀

**Questions?** Contact dev@eudaura.com or join #lander-integration Slack channel.

