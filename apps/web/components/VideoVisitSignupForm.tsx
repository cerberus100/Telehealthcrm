/**
 * Video Visit Signup Form
 * For Landing Page Integration
 * 
 * Simple form that calls backend API to schedule video visits
 * All complexity handled by telehealth platform
 */

'use client'

import { useState } from 'react'
import { Calendar, Clock, Mail, Phone, User, Video, CheckCircle } from 'lucide-react'

export function VideoVisitSignupForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    
    try {
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
          reason: formData.get('reason'),
          channel: formData.get('channel') || 'both'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to schedule visit')
      }

      const result = await response.json()
      const date = new Date(`${formData.get('preferredDate')}T${formData.get('preferredTime')}:00`)
      setScheduledTime(date.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }))
      setSuccess(true)

      // Analytics tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'video_visit_scheduled', {
          visit_id: result.visitId,
          value: 150
        })
      }

    } catch (err: any) {
      setError(err.message || 'Unable to schedule visit. Please try again or call (555) 123-4567.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Success Message */}
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Video Visit Scheduled! 🎉
          </h2>

          <p className="text-lg text-gray-700 mb-6">
            Your appointment is confirmed for:
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6 text-left">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-xl font-semibold text-blue-900">
                {scheduledTime}
              </span>
            </div>
            <div className="flex items-center gap-3 text-blue-700">
              <Video className="w-4 h-4" />
              <span className="text-sm">30-minute video visit</span>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 text-left">
            <h3 className="font-bold text-gray-900 mb-4 text-lg">What Happens Next:</h3>
            <ol className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <strong>Check your inbox</strong>
                  <p className="text-sm text-gray-600">We've sent you a text and email with your video visit link</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <strong>Click the link when ready</strong>
                  <p className="text-sm text-gray-600">The link works best 5 minutes before your visit</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <strong>Test your camera and microphone</strong>
                  <p className="text-sm text-gray-600">Make sure you're in a quiet, well-lit place</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 text-left">
            <p className="text-sm text-amber-900">
              <strong>⏱️ Important:</strong> Your video link expires 20 minutes after you receive it for security. 
              Don't worry - if it expires, you can request a new one!
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={() => window.location.href = '/'}
            className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Back to Home
          </button>

          {/* Support */}
          <p className="text-sm text-gray-500 mt-6">
            Questions? Call us at <a href="tel:+15551234567" className="text-blue-600 hover:underline">(555) 123-4567</a>
          </p>

        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Schedule Video Visit</h2>
          <p className="text-gray-600">See a doctor from the comfort of your home</p>
        </div>

        <div className="space-y-6">
          
          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                First Name
              </label>
              <input
                name="firstName"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                name="lastName"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email Address
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              Phone Number
            </label>
            <input
              name="phone"
              type="tel"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Preferred Date
              </label>
              <input
                name="preferredDate"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Preferred Time
              </label>
              <select
                name="preferredTime"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Time</option>
                <option value="09:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="17:00">5:00 PM</option>
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Visit (Optional)
            </label>
            <textarea
              name="reason"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="E.g., Follow-up appointment, new symptoms, prescription refill..."
            />
          </div>

          {/* Notification Preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How should we send your video link?
            </label>
            <select
              name="channel"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="both">Text Message & Email (Recommended)</option>
              <option value="sms">Text Message Only</option>
              <option value="email">Email Only</option>
            </select>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input type="checkbox" required className="mt-1" />
            <span className="text-sm text-gray-700">
              I consent to receive telehealth services via video. I understand that video visit links 
              expire after 20 minutes for security and cannot be shared.
            </span>
          </label>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Scheduling...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Schedule Free Video Visit
              </>
            )}
          </button>

          {/* Privacy Notice */}
          <p className="text-xs text-gray-500 text-center">
            🔒 Your information is protected and HIPAA compliant. 
            You'll receive your secure video link via text and email.
          </p>

        </div>

      </form>
    </div>
  )
}
