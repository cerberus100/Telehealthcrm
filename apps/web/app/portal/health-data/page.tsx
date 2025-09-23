"use client"
import { useState } from 'react'

type HealthMetric = {
  id: string
  name: string
  value: string | number
  unit: string
  date: string
  trend: 'up' | 'down' | 'stable'
  target?: string
  status: 'normal' | 'warning' | 'critical'
}

const DEMO_METRICS: HealthMetric[] = [
  {
    id: 'bp_systolic',
    name: 'Blood Pressure (Systolic)',
    value: 128,
    unit: 'mmHg',
    date: new Date().toISOString(),
    trend: 'stable',
    target: '< 120',
    status: 'warning'
  },
  {
    id: 'bp_diastolic',
    name: 'Blood Pressure (Diastolic)',
    value: 82,
    unit: 'mmHg',
    date: new Date().toISOString(),
    trend: 'stable',
    target: '< 80',
    status: 'warning'
  },
  {
    id: 'heart_rate',
    name: 'Heart Rate',
    value: 72,
    unit: 'bpm',
    date: new Date().toISOString(),
    trend: 'stable',
    target: '60-100',
    status: 'normal'
  },
  {
    id: 'weight',
    name: 'Weight',
    value: 175.5,
    unit: 'lbs',
    date: new Date(Date.now() - 86400000).toISOString(),
    trend: 'down',
    target: '< 170',
    status: 'warning'
  },
  {
    id: 'glucose',
    name: 'Blood Glucose',
    value: 95,
    unit: 'mg/dL',
    date: new Date(Date.now() - 172800000).toISOString(),
    trend: 'stable',
    target: '70-100',
    status: 'normal'
  },
  {
    id: 'cholesterol',
    name: 'Total Cholesterol',
    value: 185,
    unit: 'mg/dL',
    date: new Date(Date.now() - 259200000).toISOString(),
    trend: 'down',
    target: '< 200',
    status: 'normal'
  }
]

const STATUS_COLORS = {
  'normal': 'text-green-700 bg-green-100',
  'warning': 'text-yellow-700 bg-yellow-100',
  'critical': 'text-red-700 bg-red-100'
}

const TREND_ICONS = {
  'up': '↗️',
  'down': '↘️',
  'stable': '➡️'
}

export default function HealthDataPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [metrics] = useState(DEMO_METRICS)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Health Data</h1>
        <div className="flex gap-2">
          {['1d', '7d', '30d', '90d'].map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Vital Signs Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.slice(0, 4).map(metric => (
          <div key={metric.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-slate-900">{metric.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[metric.status]}`}>
                {metric.status}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-slate-900">{metric.value}</span>
              <span className="text-sm text-slate-600 mb-1">{metric.unit}</span>
              <span className="text-lg">{TREND_ICONS[metric.trend]}</span>
            </div>
            {metric.target && (
              <p className="text-xs text-slate-500 mt-1">Target: {metric.target}</p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Last updated: {new Date(metric.date).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {/* Detailed Metrics Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-medium">Health Metrics History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-4 font-medium">Metric</th>
                <th className="p-4 font-medium">Latest Value</th>
                <th className="p-4 font-medium">Target Range</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Trend</th>
                <th className="p-4 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {metrics.map(metric => (
                <tr key={metric.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium">{metric.name}</td>
                  <td className="p-4">
                    <span className="font-semibold">{metric.value}</span>
                    <span className="text-slate-600 ml-1">{metric.unit}</span>
                  </td>
                  <td className="p-4 text-slate-600">{metric.target || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[metric.status]}`}>
                      {metric.status}
                    </span>
                  </td>
                  <td className="p-4 text-lg">{TREND_ICONS[metric.trend]}</td>
                  <td className="p-4 text-slate-600 text-xs">
                    {new Date(metric.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health Data Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">📊 Recent Trends</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span>Blood Pressure</span>
              <span className="text-green-700 font-medium">↘️ Improving</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
              <span>Heart Rate</span>
              <span className="text-blue-700 font-medium">➡️ Stable</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
              <span>Weight</span>
              <span className="text-yellow-700 font-medium">↗️ Needs attention</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">🎯 Health Goals</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span>Blood Pressure Control</span>
                <span className="text-xs text-slate-500">75%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span>Weight Management</span>
                <span className="text-xs text-slate-500">60%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span>Exercise Consistency</span>
                <span className="text-xs text-slate-500">90%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Export Health Data</h3>
            <p className="text-sm text-blue-700">
              Download your health metrics and trends in PDF or CSV format
            </p>
          </div>
          <div className="flex gap-2">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              Export PDF
            </button>
            <button className="bg-white border border-blue-300 text-blue-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50">
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
