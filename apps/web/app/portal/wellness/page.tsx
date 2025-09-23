"use client"
import { useState } from 'react'

type WellnessTip = {
  id: string
  category: 'nutrition' | 'exercise' | 'sleep' | 'mental-health' | 'preventive'
  title: string
  description: string
  completed: boolean
  dueDate?: string
}

const DEMO_TIPS: WellnessTip[] = [
  {
    id: 'tip1',
    category: 'exercise',
    title: 'Daily Walk',
    description: 'Take a 30-minute brisk walk to improve cardiovascular health',
    completed: false,
    dueDate: '2025-09-18'
  },
  {
    id: 'tip2',
    category: 'nutrition',
    title: 'Hydration Goal',
    description: 'Drink at least 8 glasses of water throughout the day',
    completed: true
  },
  {
    id: 'tip3',
    category: 'sleep',
    title: 'Sleep Schedule',
    description: 'Aim for 7-8 hours of quality sleep tonight',
    completed: false,
    dueDate: '2025-09-18'
  },
  {
    id: 'tip4',
    category: 'mental-health',
    title: 'Mindfulness Practice',
    description: 'Practice 10 minutes of meditation or deep breathing',
    completed: false
  }
]

const CATEGORY_ICONS = {
  'exercise': '🏃',
  'nutrition': '🥗',
  'sleep': '😴',
  'mental-health': '🧘',
  'preventive': '🛡️'
}

const CATEGORY_COLORS = {
  'exercise': 'bg-green-100 text-green-800',
  'nutrition': 'bg-orange-100 text-orange-800',
  'sleep': 'bg-blue-100 text-blue-800',
  'mental-health': 'bg-purple-100 text-purple-800',
  'preventive': 'bg-red-100 text-red-800'
}

export default function WellnessPage() {
  const [tips, setTips] = useState(DEMO_TIPS)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const toggleTip = (tipId: string) => {
    setTips(prev => prev.map(tip =>
      tip.id === tipId ? { ...tip, completed: !tip.completed } : tip
    ))
  }

  const filteredTips = activeCategory === 'all'
    ? tips
    : tips.filter(tip => tip.category === activeCategory)

  const completedCount = tips.filter(tip => tip.completed).length
  const totalCount = tips.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Wellness Dashboard</h1>
        <div className="text-sm text-slate-600">
          {completedCount} of {totalCount} completed
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          <div className="text-sm text-slate-600">Completed</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalCount - completedCount}</div>
          <div className="text-sm text-slate-600">Remaining</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round((completedCount / totalCount) * 100)}%
          </div>
          <div className="text-sm text-slate-600">Progress</div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All ({totalCount})
        </button>
        {Object.entries(CATEGORY_ICONS).map(([category, icon]) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {icon} {category.replace('-', ' ')} ({tips.filter(t => t.category === category).length})
          </button>
        ))}
      </div>

      {/* Wellness Tips */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">
          {activeCategory === 'all' ? 'All Wellness Tips' : `${CATEGORY_ICONS[activeCategory as keyof typeof CATEGORY_ICONS]} ${activeCategory.replace('-', ' ')}`}
        </h2>

        <div className="grid gap-4">
          {filteredTips.map(tip => (
            <div
              key={tip.id}
              className={`rounded-lg border p-4 transition-colors ${
                tip.completed ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">
                      {CATEGORY_ICONS[tip.category]}
                    </span>
                    <div>
                      <h3 className="font-medium text-slate-900">{tip.title}</h3>
                      {tip.dueDate && (
                        <p className="text-xs text-slate-500">
                          Due: {new Date(tip.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{tip.description}</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[tip.category]}`}>
                      {tip.category.replace('-', ' ')}
                    </span>
                    {tip.completed && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleTip(tip.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tip.completed
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tip.completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wellness Resources */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Wellness Resources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Nutrition</h4>
            <p className="text-blue-700">Access meal planning tools and nutritional guidance</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Exercise Programs</h4>
            <p className="text-blue-700">View personalized workout plans and track progress</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Mental Health</h4>
            <p className="text-blue-700">Access mindfulness exercises and stress management resources</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Preventive Care</h4>
            <p className="text-blue-700">Schedule screenings and learn about preventive measures</p>
          </div>
        </div>
      </div>
    </div>
  )
}
