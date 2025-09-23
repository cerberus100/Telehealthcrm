"use client"
import { useState } from 'react'

type Message = {
  id: string
  from: string
  subject: string
  preview: string
  timestamp: string
  read: boolean
  urgent?: boolean
}

const DEMO_MESSAGES: Message[] = [
  {
    id: 'msg1',
    from: 'Dr. Sarah Johnson',
    subject: 'Lab Results Review',
    preview: 'Your recent blood work shows improvement in your cholesterol levels...',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    read: false,
    urgent: false
  },
  {
    id: 'msg2',
    from: 'Nurse Coordinator',
    subject: 'Upcoming Appointment Reminder',
    preview: 'Your telehealth visit is scheduled for tomorrow at 2:30 PM...',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    read: true,
    urgent: true
  },
  {
    id: 'msg3',
    from: 'Pharmacy',
    subject: 'Prescription Ready',
    preview: 'Your prescription for Lisinopril is ready for pickup...',
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    read: true,
    urgent: false
  }
]

export default function MessagesPage() {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [messages, setMessages] = useState(DEMO_MESSAGES)

  const markAsRead = (messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, read: true } : msg
    ))
  }

  const unreadCount = messages.filter(m => !m.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Messages</h1>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Messages List */}
        <div className="rounded border bg-white">
          <div className="p-4 border-b bg-slate-50">
            <h2 className="font-medium">Inbox</h2>
          </div>
          <div className="divide-y">
            {messages.map(message => (
              <div
                key={message.id}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedMessage?.id === message.id ? 'bg-slate-100' : ''
                } ${!message.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                onClick={() => {
                  setSelectedMessage(message)
                  markAsRead(message.id)
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{message.from}</p>
                      {message.urgent && (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                          URGENT
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate mt-1">
                      {message.subject}
                    </p>
                    <p className="text-sm text-slate-600 truncate mt-1">
                      {message.preview}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(message.timestamp).toLocaleDateString()} at{' '}
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  {!message.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Detail */}
        <div className="rounded border bg-white">
          {selectedMessage ? (
            <div className="p-4">
              <div className="border-b pb-4 mb-4">
                <h2 className="font-semibold text-lg">{selectedMessage.subject}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
                  <span>From: {selectedMessage.from}</span>
                  <span>{new Date(selectedMessage.timestamp).toLocaleString()}</span>
                  {selectedMessage.urgent && (
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                      URGENT
                    </span>
                  )}
                </div>
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-slate-800 leading-relaxed">
                  {selectedMessage.preview}
                </p>
                <p className="text-slate-800 leading-relaxed mt-4">
                  This is a demo message. In a real system, this would contain the full message content with proper formatting, attachments, and reply functionality.
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-50">
                  Reply
                </button>
                <button className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-50">
                  Archive
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
