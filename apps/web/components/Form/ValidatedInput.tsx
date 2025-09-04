"use client"
import { useState, useEffect, useId } from 'react'
import { z } from 'zod'
import { useAccessibility } from '../AccessibilityProvider'

interface ValidatedInputProps {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
  validation: z.ZodSchema
  value?: string
  onChange?: (value: string, isValid: boolean) => void
  onBlur?: () => void
  placeholder?: string
  helpText?: string
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  className?: string
  debounceMs?: number
}

export function ValidatedInput({
  name,
  label,
  type = 'text',
  validation,
  value = '',
  onChange,
  onBlur,
  placeholder,
  helpText,
  required = false,
  disabled = false,
  autoComplete,
  className = '',
  debounceMs = 300,
}: ValidatedInputProps) {
  const [internalValue, setInternalValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  
  const { announceMessage } = useAccessibility()
  const inputId = useId()
  const errorId = useId()
  const helpId = useId()

  // Debounced validation
  useEffect(() => {
    if (!touched && internalValue === value) return

    const timeoutId = setTimeout(async () => {
      setIsValidating(true)
      
      try {
        await validation.parseAsync(internalValue)
        setError(null)
        onChange?.(internalValue, true)
      } catch (err) {
        if (err instanceof z.ZodError) {
          const errorMessage = err.errors[0]?.message || 'Invalid input'
          setError(errorMessage)
          onChange?.(internalValue, false)
          
          // Announce validation errors to screen readers
          if (touched) {
            announceMessage(`${label}: ${errorMessage}`, 'assertive')
          }
        }
      } finally {
        setIsValidating(false)
      }
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [internalValue, validation, onChange, label, announceMessage, touched, debounceMs, value])

  // Sync with external value changes
  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInternalValue(newValue)
    if (!touched) setTouched(true)
  }

  const handleBlur = () => {
    setTouched(true)
    onBlur?.()
  }

  const hasError = touched && error
  const isValid = touched && !error && internalValue.length > 0

  return (
    <div className={`form-field ${className}`}>
      <label
        htmlFor={inputId}
        className={`block text-sm font-medium mb-1 ${
          hasError ? 'text-red-700' : 'text-slate-700'
        }`}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={type}
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={`${helpText ? helpId : ''} ${hasError ? errorId : ''}`.trim()}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${hasError 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : isValid
                ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
            }
          `}
        />

        {/* Validation status icons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isValidating && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400" />
          )}
          {!isValidating && isValid && (
            <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {!isValidating && hasError && (
            <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Help text */}
      {helpText && !hasError && (
        <p id={helpId} className="mt-1 text-sm text-slate-500">
          {helpText}
        </p>
      )}

      {/* Error message */}
      {hasError && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Validated Select Component
interface ValidatedSelectProps {
  name: string
  label: string
  validation: z.ZodSchema
  value?: string
  onChange?: (value: string, isValid: boolean) => void
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  helpText?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function ValidatedSelect({
  name,
  label,
  validation,
  value = '',
  onChange,
  options,
  placeholder,
  helpText,
  required = false,
  disabled = false,
  className = '',
}: ValidatedSelectProps) {
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  
  const { announceMessage } = useAccessibility()
  const selectId = useId()
  const errorId = useId()
  const helpId = useId()

  const validateValue = async (newValue: string) => {
    try {
      await validation.parseAsync(newValue)
      setError(null)
      onChange?.(newValue, true)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMessage = err.errors[0]?.message || 'Invalid selection'
        setError(errorMessage)
        onChange?.(newValue, false)
        
        if (touched) {
          announceMessage(`${label}: ${errorMessage}`, 'assertive')
        }
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    setTouched(true)
    validateValue(newValue)
  }

  const hasError = touched && error

  return (
    <div className={`form-field ${className}`}>
      <label
        htmlFor={selectId}
        className={`block text-sm font-medium mb-1 ${
          hasError ? 'text-red-700' : 'text-slate-700'
        }`}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <select
        id={selectId}
        name={name}
        value={value}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={`${helpText ? helpId : ''} ${hasError ? errorId : ''}`.trim()}
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${hasError 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
          }
        `}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      {/* Help text */}
      {helpText && !hasError && (
        <p id={helpId} className="mt-1 text-sm text-slate-500">
          {helpText}
        </p>
      )}

      {/* Error message */}
      {hasError && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Form validation schemas
export const FormSchemas = {
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  trackingNumber: z.string().min(5, 'Tracking number must be at least 5 characters'),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'),
  required: z.string().min(1, 'This field is required'),
  optional: z.string().optional(),
}
