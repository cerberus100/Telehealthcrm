"use client"
import React from 'react'

interface EudauraLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EudauraLogo({ size = 'md', className = '' }: EudauraLogoProps) {
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32', 
    lg: 'w-48 h-48'
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {/* Outer glowing ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-200 via-amber-100 to-slate-100 opacity-80 blur-sm" />
      
      {/* Main circle background */}
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800" />
      
      {/* Inner glow ring */}
      <div className="absolute inset-3 rounded-full border border-amber-200 opacity-60" />
      
      {/* Text container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-slate-100 font-light tracking-wider text-lg sm:text-xl md:text-2xl lg:text-3xl">
          eudaura
        </span>
      </div>
      
      {/* Sparkle effect */}
      <div className="absolute top-2 right-6 text-amber-200 opacity-80">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
        </svg>
      </div>
    </div>
  )
}

export default EudauraLogo
