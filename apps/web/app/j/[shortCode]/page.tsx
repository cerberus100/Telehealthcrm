/**
 * Video Visit Join Page (One-Time Token Flow)
 * HIPAA Compliant: No PHI in URLs, token-based auth
 * 
 * Flow:
 * 1. Resolve short code → full token
 * 2. Validate token (pre-join check)
 * 3. Show device preview + visit info
 * 4. User clicks "Join" → redeem token + start Connect session
 * 5. Render Chime SDK video client
 * 6. Handle call end → cleanup
 */

'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { VideoClient, ChimeMeetingInfo } from '../../../lib/video-client'
import { VideoDevicePreview } from '../../../components/VideoDevicePreview'
import { Video, Clock, AlertCircle, CheckCircle, Phone, PhoneOff, Mic, MicOff, VideoOff as VideoOffIcon, Monitor, MonitorOff } from 'lucide-react'

interface VisitInfo {
  visitId: string
  scheduledAt: string
  clinicianName: string
  duration: number
}

type PageState = 'loading' | 'expired' | 'invalid' | 'preview' | 'joining' | 'in-call' | 'ended'

export default function VideoJoinPage({ params }: { params: Promise<{ shortCode: string }> }) {
  const resolvedParams = use(params)
  const { shortCode } = resolvedParams
  const router = useRouter()

  const [state, setState] = useState<PageState>('loading')
  const [visitInfo, setVisitInfo] = useState<VisitInfo | null>(null)
  const [fullToken, setFullToken] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const [devicesReady, setDevicesReady] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState({ cameraId: '', microphoneId: '', speakerId: '' })

  // Video call state
  const [videoClient] = useState(() => new VideoClient({
    onAudioVideoStart: () => console.log('Call started'),
    onAudioVideoStop: () => handleCallEnded(),
    onError: (err) => console.error('Chime SDK error:', err)
  }))
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [sessionToken, setSessionToken] = useState<string>('')

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        // Step 1: Validate token
        const response = await fetch('/api/token/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: shortCode }) // Short code is the token in URL
        })

        const result = await response.json()

        if (result.valid) {
          setFullToken(shortCode)
          setVisitInfo(result.visit)
          setExpiresIn(result.expiresIn)
          setState('preview')
        } else if (result.action === 'REQUEST_NEW_LINK') {
          setState('expired')
          setError(result.error)
        } else {
          setState('invalid')
          setError(result.error)
        }
      } catch (err: any) {
        console.error('Validation failed', err)
        setState('invalid')
        setError('Failed to load visit link')
      }
    }

    validate()
  }, [shortCode])

  // Countdown timer
  useEffect(() => {
    if (state !== 'preview' || expiresIn <= 0) return

    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setState('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state, expiresIn])

  // Call duration timer
  useEffect(() => {
    if (state !== 'in-call') return

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  // Join visit
  async function handleJoin() {
    setState('joining')

    try {
      // Call backend to start Connect WebRTC session
      const response = await fetch(`/api/visits/${visitInfo!.visitId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fullToken,
          deviceInfo: {
            hasCamera: true,
            hasMicrophone: true,
            browser: navigator.userAgent.split(' ').pop() || 'unknown',
            os: navigator.platform
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start visit')
      }

      const { chimeJoinInfo, visitSession } = await response.json()
      setSessionToken(visitSession.sessionToken)

      // Initialize Chime SDK
      await videoClient.initialize(chimeJoinInfo)
      await videoClient.selectDevices(selectedDevices)
      await videoClient.start()
      await videoClient.startLocalVideo()

      // Bind video elements
      videoClient.callbacks.onVideoTileUpdate = (tileState) => {
        if (tileState.localTile && localVideoRef.current) {
          videoClient.bindVideoElement(tileState.tileId!, localVideoRef.current)
        } else if (!tileState.localTile && remoteVideoRef.current) {
          videoClient.bindVideoElement(tileState.tileId!, remoteVideoRef.current)
        }
      }

      setState('in-call')

    } catch (err: any) {
      console.error('Join failed', err)
      alert(`Failed to join visit: ${err.message}\n\nPlease try again or contact support.`)
      setState('preview')
    }
  }

  // End call
  async function handleEndCall() {
    if (!visitInfo) return

    try {
      // Stop Chime SDK
      await videoClient.stop()

      // Notify backend
      await fetch(`/api/visits/${visitInfo.visitId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          endReason: 'completed',
          duration: callDuration
        })
      })

      setState('ended')
    } catch (error) {
      console.error('End call failed', error)
    }
  }

  // Handle call ended (from Chime SDK)
  function handleCallEnded() {
    setState('ended')
  }

  // Toggle mute
  function toggleMute() {
    if (isMuted) {
      videoClient.unmuteAudio()
    } else {
      videoClient.muteAudio()
    }
    setIsMuted(!isMuted)
  }

  // Toggle video
  function toggleVideo() {
    if (isVideoOn) {
      videoClient.stopLocalVideo()
    } else {
      videoClient.startLocalVideo()
    }
    setIsVideoOn(!isVideoOn)
  }

  // Toggle screen share
  async function toggleScreenShare() {
    try {
      if (isScreenSharing) {
        await videoClient.stopScreenShare()
      } else {
        await videoClient.startScreenShare()
      }
      setIsScreenSharing(!isScreenSharing)
    } catch (error) {
      console.error('Screen share toggle failed', error)
    }
  }

  // Format duration
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format expiry countdown
  function formatExpiry(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  // --- RENDER STATES ---

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-lg text-gray-600">Verifying your visit link...</p>
        </div>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600 mb-6">
            This visit link has expired. Video visit links expire after 20 minutes for security.
          </p>
          <button
            onClick={() => {
              // TODO: Call /api/visits/:id/resend-link
              alert('Please contact support to request a new link.')
            }}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-4"
          >
            Request New Link
          </button>
          <a href="tel:+15551234567" className="text-sm text-gray-500 hover:text-gray-700">
            Need help? Call (555) 123-4567
          </a>
        </div>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-4">
            {error || 'This visit link is not valid.'}
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 space-y-2">
            <li>• The link may have been used already</li>
            <li>• The link may have expired</li>
            <li>• The link may have been cancelled</li>
          </ul>
          <a
            href="mailto:support@eudaura.com"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Contact Support
          </a>
        </div>
      </div>
    )
  }

  if (state === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Header: Visit Info */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Video Visit with Dr. {visitInfo?.clinicianName}
                </h1>
                <p className="text-gray-600">
                  {visitInfo && new Date(visitInfo.scheduledAt).toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  })}
                </p>
              </div>
              
              {/* Expiry countdown */}
              <div className="text-right">
                <div className="text-sm text-gray-500">Link expires in</div>
                <div className={`text-2xl font-bold ${expiresIn < 120 ? 'text-red-600' : 'text-blue-600'}`}>
                  {formatExpiry(expiresIn)}
                </div>
              </div>
            </div>
          </div>

          {/* Device Preview */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Camera & Microphone Check</h2>
            <VideoDevicePreview
              videoClient={videoClient}
              onReady={setDevicesReady}
              onDevicesSelected={setSelectedDevices}
            />
          </div>

          {/* Join Button */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button
              onClick={handleJoin}
              disabled={!devicesReady}
              className="w-full px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-3"
            >
              <Video className="w-6 h-6" />
              Join Video Visit
            </button>
            
            {!devicesReady && (
              <p className="text-center text-sm text-gray-500 mt-3">
                Waiting for camera and microphone access...
              </p>
            )}
          </div>

          {/* Help */}
          <div className="text-center mt-6">
            <a href="tel:+15551234567" className="text-sm text-gray-500 hover:text-gray-700">
              Need help? Call (555) 123-4567
            </a>
          </div>

        </div>
      </div>
    )
  }

  if (state === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4" />
          <p className="text-lg">Connecting to video visit...</p>
        </div>
      </div>
    )
  }

  if (state === 'in-call') {
    return (
      <div className="h-screen bg-gray-900 flex flex-col">
        
        {/* Video Grid */}
        <div className="flex-1 relative">
          
          {/* Remote video (main, full screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            aria-label="Remote participant video"
          />

          {/* Local video (PIP, bottom-right) */}
          <div className="absolute bottom-4 right-4 w-64 aspect-video bg-black rounded-lg overflow-hidden shadow-xl border-2 border-white/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
              aria-label="Your video"
            />
          </div>

          {/* Call info overlay (top) */}
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="font-medium">Call Duration: {formatDuration(callDuration)}</span>
            </div>
          </div>

        </div>

        {/* Controls Bar */}
        <div className="bg-gray-800 border-t border-gray-700 p-6">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
            
            {/* Mute/Unmute */}
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>

            {/* Video On/Off */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition ${
                !isVideoOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              aria-label={isVideoOn ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOffIcon className="w-6 h-6 text-white" />}
            </button>

            {/* Screen Share (optional, clinician only - hide for now) */}
            {/* <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full transition ${
                isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? <MonitorOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6 text-white" />}
            </button> */}

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition ml-4"
              aria-label="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>

          </div>
        </div>

      </div>
    )
  }

  if (state === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Call Ended</h1>
          <p className="text-gray-600 mb-6">
            Thank you for using our telehealth service.
          </p>
          <div className="text-sm text-gray-500 mb-6">
            Call duration: {formatDuration(callDuration)}
          </div>
          <button
            onClick={() => window.close()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }

  return null
}

