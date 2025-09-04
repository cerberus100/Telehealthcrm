'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { Protected, useAuth } from '../../lib/auth'
import Link from 'next/link'

export default function RequisitionsPage() {
  const { role } = useAuth()
  const [showUploadForm, setShowUploadForm] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['requisition-templates'],
    queryFn: Api.requisitionTemplates,
  })

  // Role guard: Labs can create, Marketers/Providers can view/use
  const canCreate = role === 'LAB_TECH' || role === 'ORG_ADMIN'
  const canView = canCreate || role === 'MARKETER' || role === 'DOCTOR'
  
  if (!canView) {
    return (
      <Protected>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-800 p-4 rounded">
            Access denied. Only Lab, Provider, and Marketing personnel can view requisitions.
          </div>
        </div>
      </Protected>
    )
  }

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    console.log('Uploading requisition:', {
      name: formData.get('name'),
      file: formData.get('file'),
    })
    setShowUploadForm(false)
    // TODO: Implement actual template upload and field mapping
  }

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Requisition Templates</h1>
          {canCreate && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Upload Template
            </button>
          )}
        </div>
        
        {showUploadForm && (
          <div className="bg-white p-6 rounded shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload New Template</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., COVID-19 Test Kit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Template File (PDF/DOCX)</label>
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.docx"
                  required
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload a PDF or Word document. Fields will be auto-mapped for digital completion.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Upload & Process
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        
        {isLoading && <div className="text-gray-500">Loading templates...</div>}
        {error && <div className="text-red-600">Error loading templates</div>}
        
        {data && (
          <div className="space-y-4">
            {data.items.map((template) => (
              <Link key={template.id} href={`/requisitions/${template.id}`}>
                <div className="bg-white p-4 rounded shadow hover:shadow-md cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-sm text-gray-600">Version {template.version}</p>
                      <p className="text-sm text-gray-500">
                        Fields: {template.fields.map(f => f.name).join(', ')}
                      </p>
                      {template.published_at && (
                        <p className="text-sm text-gray-500">
                          Published: {new Date(template.published_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        template.published_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {template.published_at ? 'Published' : 'Draft'}
                      </span>
                      {role === 'MARKETER' && (
                        <button className="text-blue-600 text-sm hover:underline">
                          Use Template
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            {data.items.length === 0 && (
              <p className="text-gray-500">
                {canCreate 
                  ? "No templates found. Upload your first requisition template to get started."
                  : "No templates available yet."
                }
              </p>
            )}
          </div>
        )}
      </div>
    </Protected>
  )
}
