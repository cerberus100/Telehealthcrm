# 📢 **HANDOFF TO EUDAURA LANDER TEAM**

## **Clear Separation of Responsibilities**

**EUDAURA LANDER (Your Site):** Marketing site where people **SIGN UP**  
**TELEHEALTH PLATFORM (Our App):** Main app where people **USE SERVICES**

---

## 🎯 **WHAT EACH SITE DOES**

### **EUDAURA LANDER (eudaura.com) - YOUR RESPONSIBILITY**
**Purpose:** Marketing & User Acquisition

**What happens on YOUR site:**
- ✅ Marketing content (why choose telehealth)
- ✅ Signup forms (patients register here)
- ✅ Doctor application forms (providers apply here)
- ✅ Lead generation
- ✅ SEO content
- ✅ Landing pages

**What you DON'T do:**
- ❌ Video visits (happens in our app)
- ❌ Patient portal (happens in our app)
- ❌ Appointments (happens in our app)
- ❌ Medical records (happens in our app)

### **TELEHEALTH PLATFORM (app.eudaura.com) - OUR RESPONSIBILITY**
**Purpose:** Actual Telehealth Services

**What happens in OUR app:**
- ✅ Patient portal (view appointments, join video visits)
- ✅ Provider portal (see patients, conduct visits)
- ✅ Video visits (camera, audio, screen share)
- ✅ Appointment scheduling
- ✅ Medical records
- ✅ Prescriptions
- ✅ Lab orders
- ✅ Admin dashboard

---

## 🔄 **USER JOURNEY**

```
1. User visits: eudaura.com (YOUR LANDER)
        ↓
2. User fills signup form (YOUR FORM)
        ↓
3. YOUR backend calls: POST /api/patient/provisional
        ↓
4. Account created in telehealth system ✅
        ↓
5. User redirected to: app.eudaura.com (OUR APP)
        ↓
6. User logs into portal (OUR LOGIN)
        ↓
7. User books appointments, joins video visits (OUR FEATURES)
```

**HANDOFF POINT:** After signup → User goes to our app

---

## 📝 **EXACTLY WHAT YOU NEED TO BUILD**

### **1. Patient Signup Form (On Your Lander)**

```html
<!-- eudaura.com/signup -->
<form id="patientSignup">
  <h2>Join Our Telehealth Platform</h2>
  
  <input name="firstName" placeholder="First Name" required />
  <input name="lastName" placeholder="Last Name" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" type="tel" placeholder="Phone" required />
  <input name="dob" type="date" placeholder="Date of Birth" required />
  
  <!-- Address -->
  <input name="address" placeholder="Street Address" required />
  <input name="city" placeholder="City" required />
  <select name="state" required>
    <option value="">Select State</option>
    <option value="CA">California</option>
    <option value="TX">Texas</option>
    <!-- ... all states -->
  </select>
  <input name="zip" placeholder="ZIP Code" required />
  
  <button type="submit">Create Account</button>
</form>

<script>
document.getElementById('patientSignup').addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const formData = new FormData(e.target)
  
  // Call YOUR backend (not telehealth directly)
  const response = await fetch('/api/create-patient-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      dob: formData.get('dob'),
      address: {
        address1: formData.get('address'),
        city: formData.get('city'),
        state: formData.get('state'),
        postalCode: formData.get('zip')
      }
    })
  })

  const result = await response.json()
  
  if (result.success) {
    // Success! Redirect to main app
    alert('Account created! Redirecting to telehealth platform...')
    window.location.href = 'https://app.eudaura.com/portal/login'
  } else {
    alert('Signup failed: ' + result.error)
  }
})
</script>
```

### **2. Your Backend API Route**

```javascript
// YOUR backend: /api/create-patient-account
export async function POST(req) {
  const body = await req.json()

  try {
    // Call TELEHEALTH API to create patient
    const response = await fetch('https://api.eudaura.com/api/patient/provisional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dob: body.dob,
        address: body.address,
        insurance: { hasInsurance: false },
        preferredContact: 'Email',
        consent: true
      })
    })

    const result = await response.json()

    if (result.requestId) {
      // Patient created successfully!
      return { 
        success: true, 
        patientId: result.requestId,
        message: 'Account created! Check email for verification.'
      }
    } else {
      throw new Error('Failed to create patient account')
    }

  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    }
  }
}
```

### **3. Doctor Application Form (On Your Lander)**

```html
<!-- eudaura.com/doctors/apply -->
<form id="doctorApplication">
  <h2>Join Our Provider Network</h2>
  
  <input name="fullName" placeholder="Full Name (Dr. Jane Smith)" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" type="tel" placeholder="Phone" required />
  <input name="npi" placeholder="NPI Number" required />
  
  <!-- License Info -->
  <select name="state" required>
    <option value="">Licensed State</option>
    <option value="CA">California</option>
    <option value="TX">Texas</option>
  </select>
  <input name="licenseNumber" placeholder="License Number" required />
  <input name="expirationDate" type="date" required />
  
  <!-- Specialties -->
  <input name="specialty" placeholder="Primary Specialty" required />
  <label>
    <input name="pecosEnrolled" type="checkbox" />
    PECOS Enrolled
  </label>
  
  <button type="submit">Submit Application</button>
</form>

<script>
document.getElementById('doctorApplication').addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const formData = new FormData(e.target)
  
  // Call YOUR backend
  const response = await fetch('/api/doctor-application', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      npi: formData.get('npi'),
      state: formData.get('state'),
      licenseNumber: formData.get('licenseNumber'),
      expirationDate: formData.get('expirationDate'),
      specialty: formData.get('specialty'),
      pecosEnrolled: formData.get('pecosEnrolled') === 'on'
    })
  })

  const result = await response.json()
  
  if (result.success) {
    alert(`Application submitted! (ID: ${result.appId}) We'll email you when reviewed.`)
  } else {
    alert('Application failed: ' + result.error)
  }
})
</script>
```

### **4. Your Doctor Application Backend**

```javascript
// YOUR backend: /api/doctor-application
export async function POST(req) {
  const body = await req.json()

  try {
    // Call TELEHEALTH API
    const response = await fetch('https://api.eudaura.com/api/clinician/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          npi: body.npi
        },
        licenses: [{
          state: body.state,
          licenseNumber: body.licenseNumber,
          expirationDate: body.expirationDate
        }],
        flags: {
          pecosEnrolled: body.pecosEnrolled,
          modalities: ['Telemedicine'],
          specialties: [body.specialty]
        }
      })
    })

    const result = await response.json()

    return { 
      success: true, 
      appId: result.appId,
      message: 'Application submitted for review'
    }

  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    }
  }
}
```

---

## 🎯 **WHAT HAPPENS AFTER SIGNUP**

### **Patient Journey:**
```
1. Signs up on eudaura.com (YOUR LANDER)
        ↓
2. Gets verification email
        ↓  
3. Clicks verification link
        ↓
4. Redirected to: app.eudaura.com/portal (OUR APP)
        ↓
5. Logs in with email/password
        ↓
6. Can now:
   - Book appointments
   - Join video visits  
   - View test results
   - Manage prescriptions
```

### **Doctor Journey:**
```
1. Applies on eudaura.com (YOUR LANDER)
        ↓
2. Application goes to admin review
        ↓
3. Admin approves application
        ↓
4. Doctor gets approval email
        ↓
5. Redirected to: app.eudaura.com (OUR APP)
        ↓
6. Logs in as provider
        ↓
7. Can now:
   - See patient appointments
   - Conduct video visits
   - Write prescriptions
   - Order labs
```

---

## 📊 **SITE ARCHITECTURE**

```
EUDAURA.COM (Marketing Lander)
├── Landing pages
├── Patient signup form ← YOU BUILD THIS
├── Doctor application form ← YOU BUILD THIS
├── Marketing content
└── SEO pages

        ↓ (After signup)

APP.EUDAURA.COM (Telehealth Platform)  
├── Patient portal ← WE BUILT THIS
├── Provider portal ← WE BUILT THIS
├── Video visits ← WE BUILT THIS
├── Appointments ← WE BUILT THIS
├── Medical records ← WE BUILT THIS
└── Admin dashboard ← WE BUILT THIS
```

---

## 📞 **HANDOFF MESSAGE TO EUDAURA LANDER TEAM**

**"Hey Eudaura Lander Team,**

**🎯 SCOPE CLARIFICATION:**

**YOUR SITE (eudaura.com):** Marketing lander where people sign up  
**OUR APP (app.eudaura.com):** Telehealth platform where they use services

**🔧 WHAT YOU BUILD:**
- Signup forms (patients + doctors)
- Call our API when forms submitted
- Redirect to our app after signup

**🔧 WHAT WE BUILT:**
- Complete telehealth platform
- Video visits
- Patient/provider portals
- All medical functionality

**📝 YOUR INTEGRATION (Super Simple):**

**Patient Signup:**
```javascript
// When patient signs up on eudaura.com
fetch('https://api.eudaura.com/api/patient/provisional', {
  method: 'POST',
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+15551234567',
    dob: '1990-01-01',
    address: {
      address1: '123 Main St',
      city: 'Austin',
      state: 'TX', 
      postalCode: '78701'
    },
    insurance: { hasInsurance: false },
    preferredContact: 'Email',
    consent: true
  })
})

// Show: 'Account created! Check email for verification.'
// Redirect: window.location.href = 'https://app.eudaura.com/portal'
```

**Doctor Application:**
```javascript
// When doctor applies on eudaura.com
fetch('https://api.eudaura.com/api/clinician/apply', {
  method: 'POST',
  body: JSON.stringify({
    identity: {
      fullName: 'Dr. Jane Smith',
      email: 'jane@example.com', 
      phone: '+15551234567',
      npi: '1234567890'
    },
    licenses: [{
      state: 'TX',
      licenseNumber: 'MD12345',
      expirationDate: '2026-12-31'
    }],
    flags: {
      pecosEnrolled: true,
      modalities: ['Telemedicine'],
      specialties: ['Family Medicine']
    }
  })
})

// Show: 'Application submitted! We'll email when approved.'
```

**🎯 THAT'S IT!** Two API calls. Copy the code above.

**📋 YOUR CHECKLIST:**
- [ ] Build patient signup form
- [ ] Build doctor application form  
- [ ] Call our APIs when forms submitted
- [ ] Show success messages
- [ ] Redirect to app.eudaura.com

**⏱️ TIME NEEDED:** 2-3 hours

**🔗 API DOCS:** Check `FOR_EUDAURA_LANDER_DEV.md` in your repo

**❓ QUESTIONS?** Just implement the code above first, then ask.

**- Telehealth App Team"**

---

## 🚀 **READY TO LAUNCH**

**Backend:** ✅ Complete  
**App Frontend:** ✅ Complete  
**Lander Integration:** ⏳ Your turn (2-3 hours work)

**After lander implements:** Full telehealth platform ready! 🎊
