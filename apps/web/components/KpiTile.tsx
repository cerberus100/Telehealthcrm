"use client"

import React from 'react'

export function KpiTile({
  title,
  value,
  delta,
  trend = 'up',
  suffix,
  children,
}: {
  title: string
  value: string | number
  delta?: number
  trend?: 'up' | 'down'
  suffix?: string
  children?: React.ReactNode
}) {
  const deltaColor = delta === undefined ? 'text-slate-500' : delta >= 0 ? 'text-green-700' : 'text-red-700'
  const deltaPrefix = delta === undefined ? '' : delta >= 0 ? '+' : ''

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{title}</p>
        {delta !== undefined && (
          <span className={`text-xs font-medium ${deltaColor}`}>
            {deltaPrefix}{delta}% {trend === 'up' ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold text-slate-900">
          {value}{suffix ? <span className="text-base text-slate-500">{suffix}</span> : null}
        </div>
        {children}
      </div>
    </div>
  )
}


