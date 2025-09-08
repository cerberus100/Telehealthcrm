"use client"
import { useState, useCallback, useEffect, useId } from 'react'
import { z } from 'zod'
import { useAccessibility } from './AccessibilityProvider'

interface SearchFilter {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'between' | 'in'
  value: string | string[]
  label: string
}

interface SavedSearch {
  id: string
  name: string
  filters: SearchFilter[]
  createdAt: string
  lastUsed?: string
}

interface AdvancedSearchProps {
  fields: Array<{
    key: string
    label: string
    type: 'text' | 'number' | 'date' | 'select'
    options?: Array<{ value: string; label: string }>
  }>
  onSearch: (filters: SearchFilter[]) => void
  onSave?: (search: SavedSearch) => void
  savedSearches?: SavedSearch[]
  placeholder?: string
  className?: string
}

const operatorLabels = {
  equals: 'equals',
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  gt: 'greater than',
  lt: 'less than',
  between: 'between',
  in: 'in list',
}

export function AdvancedSearch({
  fields,
  onSearch,
  onSave,
  savedSearches = [],
  placeholder = "Search...",
  className = '',
}: AdvancedSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')
  const [filters, setFilters] = useState<SearchFilter[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [searchName, setSearchName] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  
  const { announceMessage } = useAccessibility()
  const searchId = useId()

  // Load search history from localStorage
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('search_history') || '[]')
      setSearchHistory(history.slice(0, 10)) // Keep last 10 searches
    } catch (error) {
      console.error('Failed to load search history:', error)
    }
  }, [])

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return
    
    setSearchHistory(prev => {
      const newHistory = [query, ...prev.filter(h => h !== query)].slice(0, 10)
      try {
        localStorage.setItem('search_history', JSON.stringify(newHistory))
      } catch (error) {
        console.error('Failed to save search history:', error)
      }
      return newHistory
    })
  }, [])

  const addFilter = useCallback(() => {
    const newFilter: SearchFilter = {
      id: `filter_${Date.now()}`,
      field: fields[0]?.key || '',
      operator: 'contains',
      value: '',
      label: fields[0]?.label || '',
    }
    setFilters(prev => [...prev, newFilter])
  }, [fields])

  const updateFilter = useCallback((id: string, updates: Partial<SearchFilter>) => {
    setFilters(prev => prev.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ))
  }, [])

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(filter => filter.id !== id))
  }, [])

  const handleQuickSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (quickSearch.trim()) {
      addToHistory(quickSearch)
      
      // Convert quick search to filters
      const quickFilters: SearchFilter[] = fields.map(field => ({
        id: `quick_${field.key}`,
        field: field.key,
        operator: 'contains' as const,
        value: quickSearch,
        label: field.label,
      }))
      
      onSearch(quickFilters)
      announceMessage(`Searching for "${quickSearch}"`, 'polite')
    }
  }, [quickSearch, fields, onSearch, addToHistory, announceMessage])

  const handleAdvancedSearch = useCallback(() => {
    const validFilters = filters.filter(f => f.field && f.value)
    onSearch(validFilters)
    
    if (validFilters.length > 0) {
      announceMessage(`Applied ${validFilters.length} search filters`, 'polite')
    }
  }, [filters, onSearch, announceMessage])

  const handleSaveSearch = useCallback(() => {
    if (!searchName.trim() || filters.length === 0) return

    const savedSearch: SavedSearch = {
      id: `saved_${Date.now()}`,
      name: searchName,
      filters: [...filters],
      createdAt: new Date().toISOString(),
    }

    onSave?.(savedSearch)
    setShowSaveDialog(false)
    setSearchName('')
    announceMessage(`Search "${searchName}" saved`, 'polite')
  }, [searchName, filters, onSave, announceMessage])

  const loadSavedSearch = useCallback((savedSearch: SavedSearch) => {
    setFilters([...savedSearch.filters])
    setIsExpanded(true)
    announceMessage(`Loaded search "${savedSearch.name}"`, 'polite')
  }, [announceMessage])

  const clearAllFilters = useCallback(() => {
    setFilters([])
    setQuickSearch('')
    onSearch([])
    announceMessage('Cleared all search filters', 'polite')
  }, [onSearch, announceMessage])

  const getOperatorOptions = (fieldType: string) => {
    switch (fieldType) {
      case 'number':
      case 'date':
        return ['equals', 'gt', 'lt', 'between']
      case 'select':
        return ['equals', 'in']
      default:
        return ['contains', 'equals', 'startsWith', 'endsWith']
    }
  }

  return (
    <div className={`advanced-search ${className}`}>
      {/* Quick Search */}
      <form onSubmit={handleQuickSearch} className="mb-4">
        <div className="relative">
          <input
            id={searchId}
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            list={`${searchId}-history`}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Search History Datalist */}
          <datalist id={`${searchId}-history`}>
            {searchHistory.map((query, index) => (
              <option key={index} value={query} />
            ))}
          </datalist>
        </div>
      </form>

      {/* Advanced Search Toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700"
          aria-expanded={isExpanded}
          aria-controls="advanced-filters"
        >
          <svg 
            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced Filters
        </button>

        {/* Saved Searches Dropdown */}
        {savedSearches.length > 0 && (
          <div className="relative">
            <select
              onChange={(e) => {
                const savedSearch = savedSearches.find(s => s.id === e.target.value)
                if (savedSearch) loadSavedSearch(savedSearch)
              }}
              className="text-sm border border-slate-300 rounded px-2 py-1"
            >
              <option value="">Load Saved Search</option>
              {savedSearches.map(search => (
                <option key={search.id} value={search.id}>
                  {search.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div id="advanced-filters" className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
          {filters.map((filter) => {
            const field = fields.find(f => f.key === filter.field)
            const operatorOptions = getOperatorOptions(field?.type || 'text')

            return (
              <div key={filter.id} className="flex items-center gap-3 p-3 bg-white rounded border">
                {/* Field Selection */}
                <select
                  value={filter.field}
                  onChange={(e) => {
                    const selectedField = fields.find(f => f.key === e.target.value)
                    updateFilter(filter.id, {
                      field: e.target.value,
                      label: selectedField?.label || '',
                      operator: getOperatorOptions(selectedField?.type || 'text')[0] as any,
                    })
                  }}
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                >
                  {fields.map(field => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>

                {/* Operator Selection */}
                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(filter.id, { operator: e.target.value as any })}
                  className="border border-slate-300 rounded px-2 py-1 text-sm"
                >
                  {operatorOptions.map(op => (
                    <option key={op} value={op}>
                      {operatorLabels[op as keyof typeof operatorLabels]}
                    </option>
                  ))}
                </select>

                {/* Value Input */}
                {field?.type === 'select' && filter.operator !== 'in' ? (
                  <select
                    value={filter.value as string}
                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="">Select value</option>
                    {field.options?.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'}
                    value={filter.value as string}
                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                    placeholder="Enter value"
                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                  />
                )}

                {/* Remove Filter */}
                <button
                  type="button"
                  onClick={() => removeFilter(filter.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                  aria-label="Remove filter"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addFilter}
                className="text-sm bg-brand-600 text-white px-3 py-1 rounded hover:bg-brand-700"
              >
                Add Filter
              </button>
              
              {filters.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-sm border border-slate-300 px-3 py-1 rounded hover:bg-slate-50"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {filters.length > 0 && onSave && (
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(true)}
                  className="text-sm border border-slate-300 px-3 py-1 rounded hover:bg-slate-50"
                >
                  Save Search
                </button>
              )}
              
              <button
                type="button"
                onClick={handleAdvancedSearch}
                className="text-sm bg-brand-600 text-white px-4 py-1 rounded hover:bg-brand-700"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Search</h3>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Enter search name"
              className="w-full border border-slate-300 rounded px-3 py-2 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={!searchName.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
