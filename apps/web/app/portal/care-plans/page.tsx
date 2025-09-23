"use client"
import { useState } from 'react'

type CarePlan = {
  id: string
  title: string
  description: string
  status: 'active' | 'completed' | 'paused'
  startDate: string
  endDate?: string
  progress: number
  tasks: {
    id: string
    title: string
    completed: boolean
    dueDate?: string
    notes?: string
  }[]
  providers: {
    name: string
    role: string
    contact: string
  }[]
}

const DEMO_CARE_PLANS: CarePlan[] = [
  {
    id: 'cp1',
    title: 'Hypertension Management',
    description: 'Comprehensive plan to manage high blood pressure through medication, diet, and lifestyle changes.',
    status: 'active',
    startDate: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
    progress: 75,
    tasks: [
      {
        id: 't1',
        title: 'Take Lisinopril 10mg daily',
        completed: true,
        dueDate: '2025-09-18',
        notes: 'Take with food to reduce stomach upset'
      },
      {
        id: 't2',
        title: 'Weekly blood pressure monitoring',
        completed: true,
        dueDate: '2025-09-18',
        notes: 'Use home BP monitor, log readings'
      },
      {
        id: 't3',
        title: 'Reduce sodium intake to <2300mg/day',
        completed: false,
        dueDate: '2025-09-18',
        notes: 'Track food labels and restaurant choices'
      },
      {
        id: 't4',
        title: '30 minutes of daily exercise',
        completed: true,
        dueDate: '2025-09-18',
        notes: 'Walking, swimming, or cycling preferred'
      },
      {
        id: 't5',
        title: 'Follow-up appointment with Dr. Johnson',
        completed: false,
        dueDate: '2025-09-25',
        notes: 'Bring BP log and discuss medication adjustments'
      }
    ],
    providers: [
      {
        name: 'Dr. Sarah Johnson',
        role: 'Primary Care Physician',
        contact: 'dr.johnson@eudaura.com'
      },
      {
        name: 'Lisa Chen, RN',
        role: 'Care Coordinator',
        contact: 'l.chen@eudaura.com'
      }
    ]
  },
  {
    id: 'cp2',
    title: 'Diabetes Prevention Program',
    description: 'Preventive care plan to reduce risk of developing type 2 diabetes through lifestyle modifications.',
    status: 'active',
    startDate: new Date(Date.now() - 604800000).toISOString(), // 7 days ago
    progress: 40,
    tasks: [
      {
        id: 't6',
        title: 'Attend diabetes education class',
        completed: true,
        notes: 'Completed online module on nutrition'
      },
      {
        id: 't7',
        title: 'Lose 5% of body weight',
        completed: false,
        notes: 'Current weight: 175 lbs, Target: 166 lbs'
      },
      {
        id: 't8',
        title: 'Establish exercise routine',
        completed: false,
        notes: 'Goal: 150 minutes of moderate activity per week'
      },
      {
        id: 't9',
        title: 'Meet with nutritionist',
        completed: false,
        dueDate: '2025-09-20',
        notes: 'Discuss meal planning and carb counting'
      }
    ],
    providers: [
      {
        name: 'Dr. Michael Torres',
        role: 'Endocrinologist',
        contact: 'dr.torres@eudaura.com'
      }
    ]
  }
]

const STATUS_COLORS = {
  'active': 'bg-blue-100 text-blue-800',
  'completed': 'bg-green-100 text-green-800',
  'paused': 'bg-yellow-100 text-yellow-800'
}

export default function CarePlansPage() {
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null)
  const [plans] = useState(DEMO_CARE_PLANS)

  const toggleTask = (planId: string, taskId: string) => {
    // In a real app, this would update the backend
    console.log('Toggle task:', planId, taskId)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Care Plans</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Care Plans List */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">My Care Plans</h2>
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                selectedPlan?.id === plan.id
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white hover:bg-slate-50'
              }`}
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{plan.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{plan.description}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[plan.status]}`}>
                  {plan.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{plan.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${plan.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Started: {new Date(plan.startDate).toLocaleDateString()}</span>
                  <span>{plan.tasks.filter(t => t.completed).length} of {plan.tasks.length} tasks</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Care Plan Detail */}
        <div className="bg-white rounded-lg border">
          {selectedPlan ? (
            <div className="p-6">
              <div className="border-b pb-4 mb-6">
                <h2 className="text-xl font-semibold text-slate-900">{selectedPlan.title}</h2>
                <p className="text-slate-600 mt-2">{selectedPlan.description}</p>
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedPlan.status]}`}>
                    {selectedPlan.status}
                  </span>
                  <span className="text-slate-500">
                    Started: {new Date(selectedPlan.startDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="mb-6">
                <h3 className="font-medium mb-3">Progress Overview</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-slate-50 rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedPlan.tasks.filter(t => t.completed).length}
                    </div>
                    <div className="text-slate-600">Tasks Completed</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded">
                    <div className="text-2xl font-bold text-green-600">{selectedPlan.progress}%</div>
                    <div className="text-slate-600">Overall Progress</div>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="mb-6">
                <h3 className="font-medium mb-3">Tasks</h3>
                <div className="space-y-3">
                  {selectedPlan.tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-3 rounded border ${
                        task.completed ? 'bg-green-50 border-green-200' : 'bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(selectedPlan.id, task.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.title}
                        </h4>
                        {task.notes && (
                          <p className="text-sm text-slate-600 mt-1">{task.notes}</p>
                        )}
                        {task.dueDate && (
                          <p className="text-xs text-slate-500 mt-1">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Care Team */}
              <div>
                <h3 className="font-medium mb-3">Care Team</h3>
                <div className="space-y-2">
                  {selectedPlan.providers.map((provider, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <div>
                        <h4 className="font-medium text-slate-900">{provider.name}</h4>
                        <p className="text-sm text-slate-600">{provider.role}</p>
                      </div>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Contact
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <p>Select a care plan to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
