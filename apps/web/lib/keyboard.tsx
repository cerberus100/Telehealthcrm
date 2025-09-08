"use client"
import React, { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
  disabled?: boolean
}

interface KeyboardNavigationOptions {
  shortcuts?: KeyboardShortcut[]
  enableGlobalShortcuts?: boolean
  enableArrowNavigation?: boolean
  focusableSelector?: string
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    shortcuts = [],
    enableGlobalShortcuts = true,
    enableArrowNavigation = false,
    focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  } = options

  const router = useRouter()
  const shortcutsRef = useRef(shortcuts)
  const currentFocusIndex = useRef(-1)

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const getFocusableElements = useCallback(() => {
    return Array.from(document.querySelectorAll(focusableSelector)) as HTMLElement[]
  }, [focusableSelector])

  const focusElement = useCallback((index: number) => {
    const elements = getFocusableElements()
    if (elements[index]) {
      elements[index].focus()
      currentFocusIndex.current = index
    }
  }, [getFocusableElements])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if typing in an input field (unless it's a global shortcut)
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      (event.target as HTMLElement)?.tagName
    )

    // Global shortcuts (work everywhere)
    if (enableGlobalShortcuts) {
      // Ctrl/Cmd + K for global search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        // TODO: Open global search modal
        console.log('Global search triggered')
        return
      }

      // Escape key to close modals/drawers
      if (event.key === 'Escape') {
        event.preventDefault()
        // Close any open modals or drawers
        const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
        if (modals.length > 0) {
          const lastModal = modals[modals.length - 1] as HTMLElement
          const closeButton = lastModal.querySelector('[aria-label*="close"], [aria-label*="Close"], .modal-close, .drawer-close') as HTMLElement
          if (closeButton) {
            closeButton.click()
          }
        }
        return
      }

      // Navigation shortcuts
      if (!isTyping) {
        if ((event.ctrlKey || event.metaKey) && event.key === '1') {
          event.preventDefault()
          router.push('/')
          return
        }
        if ((event.ctrlKey || event.metaKey) && event.key === '2') {
          event.preventDefault()
          router.push('/shipments')
          return
        }
        if ((event.ctrlKey || event.metaKey) && event.key === '3') {
          event.preventDefault()
          router.push('/admin')
          return
        }
      }
    }

    // Custom shortcuts
    for (const shortcut of shortcutsRef.current) {
      if (shortcut.disabled) continue

      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey
      const metaMatches = !!shortcut.metaKey === event.metaKey
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey
      const altMatches = !!shortcut.altKey === event.altKey

      if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
        event.preventDefault()
        shortcut.action()
        return
      }
    }

    // Arrow key navigation
    if (enableArrowNavigation && !isTyping) {
      const elements = getFocusableElements()
      const currentIndex = elements.findIndex(el => el === document.activeElement)

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0
        focusElement(nextIndex)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
        focusElement(prevIndex)
      } else if (event.key === 'Home') {
        event.preventDefault()
        focusElement(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        focusElement(elements.length - 1)
      }
    }

    // Enter key to activate focused element
    if (event.key === 'Enter' && !isTyping) {
      const focusedElement = document.activeElement as HTMLElement
      if (focusedElement && focusedElement.tagName !== 'BUTTON' && focusedElement.tagName !== 'A') {
        // For custom interactive elements, trigger click
        if (focusedElement.getAttribute('role') === 'button' || focusedElement.onclick) {
          event.preventDefault()
          focusedElement.click()
        }
      }
    }
  }, [enableGlobalShortcuts, enableArrowNavigation, router, focusElement, getFocusableElements])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    focusElement,
    getFocusableElements,
  }
}

// Hook for table navigation
export function useTableNavigation(tableRef: React.RefObject<HTMLElement>) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!tableRef.current) return

    const rows = Array.from(tableRef.current.querySelectorAll('tbody tr')) as HTMLElement[]
    const currentRow = (event.target as HTMLElement)?.closest('tr') as HTMLElement
    const currentIndex = rows.indexOf(currentRow)

    if (currentIndex === -1) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (currentIndex < rows.length - 1) {
          const nextRow = rows[currentIndex + 1]
          if (nextRow) {
            const firstFocusable = nextRow.querySelector('button, [href], [tabindex]:not([tabindex="-1"])') as HTMLElement
            firstFocusable?.focus()
          }
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (currentIndex > 0) {
          const prevRow = rows[currentIndex - 1]
          if (prevRow) {
            const firstFocusable = prevRow.querySelector('button, [href], [tabindex]:not([tabindex="-1"])') as HTMLElement
            firstFocusable?.focus()
          }
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        // Find the primary action button in the row
        const primaryButton = currentRow.querySelector('.primary-action, [data-primary="true"], button:first-of-type') as HTMLElement
        primaryButton?.click()
        break
    }
  }, [tableRef])

  useEffect(() => {
    const table = tableRef.current
    if (table) {
      table.addEventListener('keydown', handleKeyDown)
      return () => table.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, tableRef])
}

// Hook for modal navigation
export function useModalNavigation(isOpen: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
}

// Global keyboard shortcuts reference
export const GLOBAL_SHORTCUTS = {
  SEARCH: 'Ctrl/Cmd + K',
  DASHBOARD: 'Ctrl/Cmd + 1',
  SHIPMENTS: 'Ctrl/Cmd + 2',
  ADMIN: 'Ctrl/Cmd + 3',
  ESCAPE: 'Esc',
  HELP: '?',
} as const

// Component to display keyboard shortcuts help
export function KeyboardShortcutsHelp({ shortcuts }: { shortcuts?: KeyboardShortcut[] }) {
  return (
    <div className="keyboard-shortcuts-help">
      <h3 className="text-sm font-medium mb-2">Keyboard Shortcuts</h3>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Search</span>
          <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs">⌘K</kbd>
        </div>
        <div className="flex justify-between">
          <span>Dashboard</span>
          <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs">⌘1</kbd>
        </div>
        <div className="flex justify-between">
          <span>Shipments</span>
          <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs">⌘2</kbd>
        </div>
        <div className="flex justify-between">
          <span>Close modal</span>
          <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs">Esc</kbd>
        </div>
        {shortcuts?.map((shortcut, index) => (
          <div key={index} className="flex justify-between">
            <span>{shortcut.description}</span>
            <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs">
              {shortcut.ctrlKey || shortcut.metaKey ? '⌘' : ''}
              {shortcut.shiftKey ? '⇧' : ''}
              {shortcut.altKey ? '⌥' : ''}
              {shortcut.key.toUpperCase()}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  )
}
