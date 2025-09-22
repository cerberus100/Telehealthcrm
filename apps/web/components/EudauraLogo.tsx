"use client"
import React from 'react'

interface EudauraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'bg'
  className?: string
}

export function EudauraLogo({ size = 'md', className = '' }: EudauraLogoProps) {
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    bg: 'w-full h-full min-h-[100vh]'
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative flex items-center justify-center login-aura-ring`}>
      {/* Outer glowing ring - Gold aura */}
      <div className="absolute inset-0 rounded-full opacity-80 blur-sm" style={{background: 'radial-gradient(circle, var(--gold) 0%, rgba(199,168,103,0.4) 50%, rgba(247,245,239,0.2) 100%)'}} />

      {/* Main circle background - Sage green */}
      <div className="absolute inset-2 rounded-full" style={{background: 'radial-gradient(circle, var(--sage) 0%, #4A5E44 50%, #3F5139 100%)'}} />

      {/* Enhanced aura ring - SVG circle for stronger glow */}
      <svg className="absolute inset-3 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" className="login-aura-ring" />
      </svg>

      {/* Text container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-background font-light tracking-wider text-lg sm:text-xl md:text-2xl lg:text-3xl">
          eudaura
        </span>
      </div>

      {/* Sparkle effect - Gold */}
      <div className="absolute top-2 right-6 text-accent opacity-80">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
        </svg>
      </div>
    </div>
  )
}

export default EudauraLogo
