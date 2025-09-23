"use client"
import { useState } from 'react'

type PatientProfile = {
  id: string
  name: string
  email: string
  phone: string
  dateOfBirth: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
  }
  emergencyContact: {
    name: string
    relationship: string
    phone: string
  }
  insurance: {
    provider: string
    memberId: string
    groupNumber: string
  }
  medicalInfo: {
    bloodType: string
    allergies: string[]
    medications: string[]
    conditions: string[]
  }
}

const DEMO_PROFILE: PatientProfile = {
  id: 'p_demo_123',
  name: 'Jane Doe',
  email: 'jane.doe@email.com',
  phone: '(555) 123-4567',
  dateOfBirth: '1985-03-15',
  address: {
    street: '123 Main Street',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701'
  },
  emergencyContact: {
    name: 'John Doe',
    relationship: 'Spouse',
    phone: '(555) 987-6543'
  },
  insurance: {
    provider: 'Blue Cross Blue Shield',
    memberId: 'ABC123456789',
    groupNumber: 'GRP001'
  },
  medicalInfo: {
    bloodType: 'O+',
    allergies: ['Penicillin', 'Shellfish'],
    medications: ['Lisinopril 10mg', 'Metformin 500mg'],
    conditions: ['Hypertension', 'Type 2 Diabetes']
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(DEMO_PROFILE)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState(profile)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const handleInputChange = (section: keyof PatientProfile, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object' && prev[section] !== null
        ? { ...(prev[section] as any), [field]: value }
        : value
    }))
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setProfile(formData)
      setIsEditing(false)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleCancel = () => {
    setFormData(profile)
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Patient Profile</h1>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50"
                disabled={saveStatus === 'saving'}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-md text-sm">
          Profile updated successfully!
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
          Failed to update profile. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-medium mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', '', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', '', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', '', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <p className="text-slate-900">
                {new Date(profile.dateOfBirth).toLocaleDateString()} ({Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years old)
              </p>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-medium mb-4">Address</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => handleInputChange('address', 'street', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.address.street}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address', 'city', e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-slate-900">{profile.address.city}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address', 'state', e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-slate-900">{profile.address.state}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ZIP Code</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address.zipCode}
                  onChange={(e) => handleInputChange('address', 'zipCode', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.address.zipCode}</p>
              )}
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-medium mb-4">Emergency Contact</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.emergencyContact.name}
                  onChange={(e) => handleInputChange('emergencyContact', 'name', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.emergencyContact.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) => handleInputChange('emergencyContact', 'relationship', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.emergencyContact.relationship}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.emergencyContact.phone}
                  onChange={(e) => handleInputChange('emergencyContact', 'phone', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.emergencyContact.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Insurance Information */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-medium mb-4">Insurance Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Provider</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.insurance.provider}
                  onChange={(e) => handleInputChange('insurance', 'provider', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900">{profile.insurance.provider}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Member ID</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.insurance.memberId}
                  onChange={(e) => handleInputChange('insurance', 'memberId', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900 font-mono">{profile.insurance.memberId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Group Number</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.insurance.groupNumber}
                  onChange={(e) => handleInputChange('insurance', 'groupNumber', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-slate-900 font-mono">{profile.insurance.groupNumber}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Medical Information */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-medium mb-4">Medical Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-slate-900 mb-3">Blood Type</h3>
            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md font-mono font-bold">
              {profile.medicalInfo.bloodType}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-3">Allergies</h3>
            <div className="flex flex-wrap gap-2">
              {profile.medicalInfo.allergies.map((allergy, index) => (
                <span key={index} className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                  {allergy}
                </span>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="font-medium text-slate-900 mb-3">Current Medications</h3>
            <div className="space-y-2">
              {profile.medicalInfo.medications.map((med, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span>{med}</span>
                  <span className="text-xs text-slate-500">Active</span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="font-medium text-slate-900 mb-3">Medical Conditions</h3>
            <div className="flex flex-wrap gap-2">
              {profile.medicalInfo.conditions.map((condition, index) => (
                <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
