import React from 'react'

type BadgeVariant = 'success' | 'info' | 'warn' | 'urgent' | 'default'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
  icon?: React.ReactNode
}

export function Badge({ children, variant = 'default', className = '', icon }: BadgeProps) {
  const baseClasses = 'badge'
  const variantClasses = {
    success: 'badge-success',
    info: 'badge-info',
    warn: 'badge-warn',
    urgent: 'badge-urgent',
    default: 'bg-gray-100 text-gray-700'
  }

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {variant === 'urgent' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  )
}

export default Badge
