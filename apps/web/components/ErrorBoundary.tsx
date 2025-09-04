"use client"
import React, { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorId?: string
  isRetrying: boolean
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<{ error?: Error; reset: () => void; errorId?: string }>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  isolate?: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      isRetrying: false,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorId,
      isRetrying: false,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    const { errorId } = this.state

    // Send to Sentry with additional context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', true)
      scope.setTag('errorId', errorId)
      scope.setContext('errorInfo', {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
      })
      scope.setLevel('error')
      Sentry.captureException(error)
    })

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorId: undefined,
      isRetrying: true,
    })

    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }

    // Reset retry state after a short delay
    this.retryTimeoutId = setTimeout(() => {
      this.setState({ isRetrying: false })
    }, 1000)
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    const { hasError, error, errorId, isRetrying } = this.state
    const { children, fallback: Fallback, isolate } = this.props

    if (hasError) {
      if (Fallback) {
        return <Fallback error={error} reset={this.handleReset} errorId={errorId} />
      }

      return (
        <DefaultErrorFallback
          error={error}
          reset={this.handleReset}
          errorId={errorId}
          isRetrying={isRetrying}
          isolate={isolate}
        />
      )
    }

    return children
  }
}

interface DefaultErrorFallbackProps {
  error?: Error
  reset: () => void
  errorId?: string
  isRetrying: boolean
  isolate?: boolean
}

function DefaultErrorFallback({ 
  error, 
  reset, 
  errorId, 
  isRetrying, 
  isolate = false 
}: DefaultErrorFallbackProps) {
  const isNetworkError = error?.message.includes('fetch') || error?.message.includes('network')
  const isChunkError = error?.message.includes('ChunkLoadError') || error?.message.includes('Loading chunk')

  if (isolate) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2 text-red-800 mb-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Component Error</span>
        </div>
        <p className="text-sm text-red-700 mb-3">
          This section encountered an error and couldn't load properly.
        </p>
        <button
          onClick={reset}
          disabled={isRetrying}
          className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded border border-red-300 disabled:opacity-50"
        >
          {isRetrying ? 'Retrying...' : 'Try Again'}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-600 mb-4">
            {isNetworkError && "There seems to be a network connectivity issue."}
            {isChunkError && "The application needs to reload to get the latest version."}
            {!isNetworkError && !isChunkError && "An unexpected error occurred while loading this page."}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={reset}
            disabled={isRetrying}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? 'Retrying...' : isChunkError ? 'Reload Application' : 'Try Again'}
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md font-medium"
          >
            Go to Dashboard
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
              Error Details (Development)
            </summary>
            <pre className="mt-2 p-3 bg-slate-100 rounded text-xs overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}

        {errorId && (
          <p className="mt-4 text-xs text-slate-500">
            Error ID: {errorId}
          </p>
        )}
      </div>
    </div>
  )
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

export default ErrorBoundary
