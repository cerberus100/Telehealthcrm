/**
 * Patient Portal - Join Visit (Authenticated Flow)
 * HIPAA Compliant: Uses Cognito session instead of one-time token
 * 
 * Flow:
 * 1. Verify user is authenticated (Cognito)
 * 2. Verify user has access to this visit
 * 3. Show device preview
 * 4. Call /api/visits/:id/start with session token (no one-time token)
 * 5. Join Chime SDK meeting
 */

'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../../lib/auth'
import { VideoClient } from '../../../../../lib/video-client'
import { VideoDevicePreview } from '../../../../../components/VideoDevicePreview'
import { Video, Phone, PhoneOff, Mic, MicOff, VideoOff as VideoOffIcon, ArrowLeft } from 'lucide-react'

type PageState = 'loading' | 'preview' | 'joining' | 'in-call' | 'ended'

export default function PortalJoinPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { id: visitId } = resolvedParams
  const { token, userId } = useAuth()
  const router = useRouter()

  const [state, setState] = useState<PageState>('loading')
  const [visit, setVisit] = useState<any>(null)
  const [devicesReady, setDevicesReady] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState({ cameraId: '', microphoneId: '', speakerId: '' })

  const [videoClient] = useState(() => new VideoClient({
    onAudioVideoStart: () => console.log('Call started'),
    onAudioVideoStop: () => handleCallEnded()
  }))

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  // Load visit details
  useEffect(() => {
    async function loadVisit() {
      try {
        const response = await fetch(`/api/visits/${visitId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load visit')
        }

        const data = await response.json()
        setVisit(data)
        setState('preview')
      } catch (error) {
        console.error('Failed to load visit', error)
        router.push('/portal/visits')
      }
    }

    if (token) {
      loadVisit()
    }
  }, [token, visitId, router])

  // Call duration timer
  useEffect(() => {
    if (state !== 'in-call') return

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  // Join visit (authenticated flow - no one-time token)
  async function handleJoin() {
    setState('joining')

    try {
      // For portal users, backend validates Cognito session instead of token
      const response = await fetch(`/api/visits/${visitId}/start-authenticated`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceInfo: {
            hasCamera: true,
            hasMicrophone: true,
            browser: navigator.userAgent.split(' ').pop() || 'unknown',
            os: navigator.platform
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start visit')
      }

      const { chimeJoinInfo } = await response.json()

      // Initialize Chime SDK
      await videoClient.initialize(chimeJoinInfo)
      await videoClient.selectDevices(selectedDevices)
      await videoClient.start()
      await videoClient.startLocalVideo()

      videoClient.callbacks.onVideoTileUpdate = (tileState) => {
        if (tileState.localTile && localVideoRef.current) {
          videoClient.bindVideoElement(tileState.tileId!, localVideoRef.current)
        } else if (!tileState.localTile && remoteVideoRef.current) {
          videoClient.bindVideoElement(tileState.tileId!, remoteVideoRef.current)
        }
      }

      setState('in-call')

    } catch (error: any) {
      console.error('Join failed', error)
      alert(`Failed to join visit: ${error.message}`)
      setState('preview')
    }
  }

  // End call
  async function handleEndCall() {
    try {
      await videoClient.stop()

      await fetch(`/api/visits/${visitId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endReason: 'completed',
          duration: callDuration
        })
      })

      router.push(`/portal/visits/${visitId}/feedback`)
    } catch (error) {
      console.error('End call failed', error)
      router.push('/portal/visits')
    }
  }

  function handleCallEnded() {
    setState('ended')
  }

  function toggleMute() {
    if (isMuted) {
      videoClient.unmuteAudio()
    } else {
      videoClient.muteAudio()
    }
    setIsMuted(!isMuted)
  }

  function toggleVideo() {
    if (isVideoOn) {
      videoClient.stopLocalVideo()
    } else {
      videoClient.startLocalVideo()
    }
    setIsVideoOn(!isVideoOn)
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // --- RENDER STATES ---

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (state === 'preview' && visit) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Back button */}
          <button
            onClick={() => router.push('/portal/visits')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Visits
          </button>

          {/* Visit Info */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Video Visit with Dr. {visit.clinician.firstName} {visit.clinician.lastName}
            </h1>
            <p className="text-gray-600">
              {new Date(visit.scheduledAt).toLocaleString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
              })}
            </p>
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
          <button
            onClick={handleJoin}
            disabled={!devicesReady}
            className="w-full px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-3"
          >
            <Video className="w-6 h-6" />
            Join Video Visit
          </button>

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
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            aria-label="Doctor video"
          />

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

          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="font-medium">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 border-t border-gray-700 p-6">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
            
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition ${!isVideoOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              aria-label={isVideoOn ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOffIcon className="w-6 h-6 text-white" />}
            </button>

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

  return null
}

