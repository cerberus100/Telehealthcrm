import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'card' | 'row' | 'text' | 'circle'
  lines?: number
}

export function Skeleton({
  className = '',
  variant = 'text',
  lines = 1
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 animate-pulse rounded'

  if (variant === 'card') {
    return (
      <div className={`card p-6 space-y-4 ${className}`}>
        <div className={`${baseClasses} h-6 w-3/4`} />
        <div className={`${baseClasses} h-8 w-1/2`} />
        <div className={`${baseClasses} h-4 w-full`} />
        <div className={`${baseClasses} h-4 w-2/3`} />
      </div>
    )
  }

  if (variant === 'row') {
    return (
      <div className={`flex items-center space-x-4 py-3 ${className}`}>
        <div className={`${baseClasses} h-4 w-4 rounded-full`} />
        <div className={`${baseClasses} h-4 flex-1`} />
        <div className={`${baseClasses} h-4 w-20`} />
        <div className={`${baseClasses} h-4 w-16`} />
      </div>
    )
  }

  if (variant === 'circle') {
    return (
      <div className={`${baseClasses} w-10 h-10 rounded-full ${className}`} />
    )
  }

  // Text variant
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`${baseClasses} h-4 ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  )
}

export default Skeleton
