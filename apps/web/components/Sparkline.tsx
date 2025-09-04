"use client"

import React from 'react'

export function Sparkline({ points, color = '#007DB8' }: { points: number[]; color?: string }) {
  if (!points || points.length === 0) return null
  const width = 120
  const height = 40
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = Math.max(1, max - min)
  const step = width / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-80">
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  )
}


