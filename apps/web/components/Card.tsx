import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingClass = padding === 'none' ? '' : padding === 'sm' ? 'p-5' : padding === 'lg' ? 'p-8' : 'p-6'

  return (
    <div className={`card ${paddingClass} ${className}`}>
      {children}
    </div>
  )
}

export default Card
