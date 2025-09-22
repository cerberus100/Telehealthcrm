import React from 'react'

interface ErrorBannerProps {
  title: string
  message?: string
  action?: React.ReactNode
  className?: string
}

export function ErrorBanner({
  title,
  message,
  action,
  className = ''
}: ErrorBannerProps) {
  return (
    <div className={`border-l-4 border-gold bg-red-50 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          {message && (
            <p className="text-sm text-red-700 mt-1">{message}</p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

export default ErrorBanner
