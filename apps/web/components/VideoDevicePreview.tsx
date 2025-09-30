/**
 * Video Device Preview Component
 * HIPAA Compliant: Device permission handling with user-friendly UI
 * 
 * Features:
 * - Camera preview (mirrored for user)
 * - Microphone level meter
 * - Device selector dropdowns
 * - Permission request flow
 * - Accessibility: keyboard navigation, ARIA labels
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { VideoClient, DeviceInfo } from '../lib/video-client'
import { Video, VideoOff, Mic, MicOff, Settings, AlertCircle, CheckCircle } from 'lucide-react'

interface DevicePreviewProps {
  videoClient: VideoClient
  onReady: (ready: boolean) => void
  onDevicesSelected: (devices: { cameraId: string; microphoneId: string; speakerId: string }) => void
}

export function VideoDevicePreview({ videoClient, onReady, onDevicesSelected }: DevicePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [permissions, setPermissions] = useState({ camera: false, microphone: false })
  const [devices, setDevices] = useState<DeviceInfo>({ cameras: [], microphones: [], speakers: [] })
  const [selectedDevices, setSelectedDevices] = useState({ cameraId: '', microphoneId: '', speakerId: '' })
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isTestingAudio, setIsTestingAudio] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Request permissions and list devices
  useEffect(() => {
    async function init() {
      try {
        // Request permissions
        const perms = await videoClient.requestPermissions()
        setPermissions(perms)

        if (!perms.camera || !perms.microphone) {
          onReady(false)
          return
        }

        // List devices
        const deviceList = await videoClient.listDevices()
        setDevices(deviceList)

        // Auto-select first available devices
        const selected = {
          cameraId: deviceList.cameras[0]?.deviceId || '',
          microphoneId: deviceList.microphones[0]?.deviceId || '',
          speakerId: deviceList.speakers[0]?.deviceId || ''
        }
        setSelectedDevices(selected)
        onDevicesSelected(selected)

        // Start local preview
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selected.cameraId },
          audio: { deviceId: selected.microphoneId }
        })

        setStream(mediaStream)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }

        // Setup audio level monitoring
        setupAudioLevelMonitoring(mediaStream)

        onReady(true)

      } catch (error) {
        console.error('Device initialization failed', error)
        onReady(false)
      }
    }

    init()

    return () => {
      // Cleanup: stop all tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Audio level monitoring
  function setupAudioLevelMonitoring(mediaStream: MediaStream) {
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    const microphone = audioContext.createMediaStreamSource(mediaStream)
    microphone.connect(analyser)
    analyser.fftSize = 256

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    function updateLevel() {
      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      setAudioLevel(average / 255) // Normalize to 0-1
      requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  // Handle device change
  async function handleDeviceChange(deviceType: 'camera' | 'microphone' | 'speaker', deviceId: string) {
    const updated = { ...selectedDevices }

    if (deviceType === 'camera') {
      updated.cameraId = deviceId

      // Restart camera preview
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0]
        videoTrack?.stop()

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId },
          audio: false
        })

        const newVideoTrack = newStream.getVideoTracks()[0]
        if (newVideoTrack) {
          stream.removeTrack(videoTrack)
          stream.addTrack(newVideoTrack)
        }
      }
    }

    if (deviceType === 'microphone') {
      updated.microphoneId = deviceId
      // Audio switching handled by Chime SDK
    }

    if (deviceType === 'speaker') {
      updated.speakerId = deviceId
    }

    setSelectedDevices(updated)
    onDevicesSelected(updated)
  }

  // Test speaker
  async function testSpeaker() {
    setIsTestingAudio(true)
    const audio = new Audio('/test-tone.mp3')
    
    try {
      // Set output device (if supported)
      if ('setSinkId' in audio && selectedDevices.speakerId) {
        await (audio as any).setSinkId(selectedDevices.speakerId)
      }
      await audio.play()
      setTimeout(() => setIsTestingAudio(false), 2000)
    } catch (error) {
      console.error('Speaker test failed', error)
      setIsTestingAudio(false)
    }
  }

  if (!permissions.camera || !permissions.microphone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 rounded-lg border-2 border-red-200">
        <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Camera and Microphone Access Required</h2>
        <p className="text-gray-600 text-center mb-6 max-w-md">
          To join your video visit, please grant access to your camera and microphone when prompted by your browser.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Grant Permissions
        </button>
        <details className="mt-6 text-sm text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">How to enable permissions</summary>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li><strong>Chrome:</strong> Click the camera icon in address bar → Allow</li>
            <li><strong>Safari:</strong> Safari menu → Settings → Websites → Camera/Microphone</li>
            <li><strong>Firefox:</strong> Click the lock icon → Permissions → Allow</li>
          </ul>
        </details>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Video Preview */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]" // Mirror for user
          aria-label="Camera preview"
        />
        
        {/* Overlay: Audio level meter */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-3">
            {audioLevel > 0.1 ? (
              <Mic className="w-5 h-5 text-green-400" />
            ) : (
              <MicOff className="w-5 h-5 text-gray-400" />
            )}
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 transition-all duration-100"
                style={{ width: `${audioLevel * 100}%` }}
                role="progressbar"
                aria-label="Microphone level"
                aria-valuenow={Math.round(audioLevel * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition"
          aria-label="Device settings"
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Device Selectors (collapsible) */}
      {showSettings && (
        <div className="space-y-4 p-6 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Device Settings
          </h3>

          {/* Camera selector */}
          <div>
            <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
              Camera
            </label>
            <select
              id="camera-select"
              value={selectedDevices.cameraId}
              onChange={(e) => handleDeviceChange('camera', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {devices.cameras.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Microphone selector */}
          <div>
            <label htmlFor="microphone-select" className="block text-sm font-medium text-gray-700 mb-2">
              Microphone
            </label>
            <select
              id="microphone-select"
              value={selectedDevices.microphoneId}
              onChange={(e) => handleDeviceChange('microphone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {devices.microphones.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker selector */}
          <div>
            <label htmlFor="speaker-select" className="block text-sm font-medium text-gray-700 mb-2">
              Speaker
            </label>
            <div className="flex gap-2">
              <select
                id="speaker-select"
                value={selectedDevices.speakerId}
                onChange={(e) => handleDeviceChange('speaker', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {devices.speakers.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <button
                onClick={testSpeaker}
                disabled={isTestingAudio}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 font-medium"
              >
                {isTestingAudio ? 'Playing...' : 'Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-join checklist */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-medium text-green-900">Camera Ready</div>
            <div className="text-sm text-green-700">{devices.cameras.length} device(s) detected</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-medium text-green-900">Microphone Ready</div>
            <div className="text-sm text-green-700">{devices.microphones.length} device(s) detected</div>
          </div>
        </div>
      </div>

      {/* Browser compatibility check */}
      <BrowserCompatibilityCheck />

    </div>
  )
}

function BrowserCompatibilityCheck() {
  const userAgent = navigator.userAgent
  const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent)
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent)
  const isFirefox = /Firefox/.test(userAgent)
  const isEdge = /Edg/.test(userAgent)

  const isSupported = isChrome || isSafari || isFirefox || isEdge

  if (!isSupported) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-amber-900">Browser Compatibility</div>
          <div className="text-sm text-amber-700 mt-1">
            For the best experience, please use Chrome, Safari, Firefox, or Edge.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div>
        <div className="font-medium text-blue-900">Browser Compatible</div>
        <div className="text-sm text-blue-700">
          {isChrome && 'Chrome detected'}
          {isSafari && 'Safari detected'}
          {isFirefox && 'Firefox detected'}
          {isEdge && 'Edge detected'}
        </div>
      </div>
    </div>
  )
}

