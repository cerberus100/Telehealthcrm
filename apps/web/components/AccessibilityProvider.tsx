"use client"
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { FocusScope } from '@react-aria/focus'
import { announce } from '@react-aria/live-announcer'

interface AccessibilityContextValue {
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void
  setFocusedElement: (element: HTMLElement | null) => void
  isReducedMotion: boolean
  isHighContrast: boolean
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isHighContrast, setIsHighContrast] = useState(false)

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    
    // Check for high contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: high)')
    setIsHighContrast(contrastQuery.matches)
    
    const handleContrastChange = (e: MediaQueryListEvent) => setIsHighContrast(e.matches)
    contrastQuery.addEventListener('change', handleContrastChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      contrastQuery.removeEventListener('change', handleContrastChange)
    }
  }, [])

  const announceMessage = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announce(message, priority)
  }

  const setFocusedElement = (element: HTMLElement | null) => {
    if (element) {
      element.focus()
    }
  }

  const value: AccessibilityContextValue = {
    announceMessage,
    setFocusedElement,
    isReducedMotion,
    isHighContrast,
  }

  return (
    <AccessibilityContext.Provider value={value}>
      <div role="application" aria-label="Teleplatform Healthcare Application" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-brand-600 focus:text-white focus:px-4 focus:py-2 focus:rounded">Skip to main content</a>
        {children}
      </div>
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}

// Screen reader only utility component
export function ScreenReaderOnly({ children }: { children: ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  )
}

// Focus trap for modals
export function FocusTrap({ children, active = true }: { children: ReactNode; active?: boolean }) {
  if (!active) return <>{children}</>
  
  return (
    <FocusScope contain restoreFocus autoFocus>
      {children}
    </FocusScope>
  )
}
