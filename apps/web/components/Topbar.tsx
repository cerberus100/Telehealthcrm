import React from 'react'

interface TopbarProps {
  children: React.ReactNode
  className?: string
}

export function Topbar({ children, className = '' }: TopbarProps) {
  return (
    <div className={`topbar ${className}`}>
      {children}
    </div>
  )
}

export default Topbar
