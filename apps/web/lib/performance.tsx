"use client"
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { FixedSizeList as List } from 'react-window'

// Debounce hook for expensive operations
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle hook for frequent events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0)
  const lastCallTimer = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      
      if (now - lastCall.current >= delay) {
        lastCall.current = now
        return callback(...args)
      } else {
        if (lastCallTimer.current) {
          clearTimeout(lastCallTimer.current)
        }
        
        lastCallTimer.current = setTimeout(() => {
          lastCall.current = Date.now()
          callback(...args)
        }, delay - (now - lastCall.current))
      }
    }) as T,
    [callback, delay]
  )
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        
        const isElementIntersecting = entry.isIntersecting
        setIsIntersecting(isElementIntersecting)
        
        if (isElementIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [ref, options, hasIntersected])

  return { isIntersecting, hasIntersected }
}

// Memoized search/filter hook
export function useMemoizedFilter<T>(
  items: T[],
  searchTerm: string,
  filterFn: (item: T, search: string) => boolean,
  sortFn?: (a: T, b: T) => number
) {
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  return useMemo(() => {
    let filtered = items
    
    if (debouncedSearchTerm) {
      filtered = items.filter(item => filterFn(item, debouncedSearchTerm))
    }
    
    if (sortFn) {
      filtered = [...filtered].sort(sortFn)
    }
    
    return filtered
  }, [items, debouncedSearchTerm, filterFn, sortFn])
}

// Virtual list component for large datasets
interface VirtualListProps<T> {
  items: T[]
  height: number
  width?: number | string
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
}

export function VirtualList<T>({
  items,
  height,
  width = '100%',
  itemHeight,
  renderItem,
  className,
  overscan = 5,
}: VirtualListProps<T>) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index]
    if (!item) return <div style={style} />
    
    return (
      <div style={style}>
        {renderItem(item, index)}
      </div>
    )
  }

  return (
    <List
      className={className}
      height={height}
      width={width}
      itemCount={items.length}
      itemSize={itemHeight}
      overscanCount={overscan}
    >
      {Row}
    </List>
  )
}

// Image lazy loading component
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  placeholder?: string
  className?: string
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({ 
  src, 
  alt, 
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+',
  className,
  onLoad,
  onError,
  ...props 
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder)
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null)
  const { hasIntersected } = useIntersectionObserver(
    { current: imageRef },
    { threshold: 0.1 }
  )

  useEffect(() => {
    if (hasIntersected && imageSrc === placeholder) {
      const img = new Image()
      img.onload = () => {
        setImageSrc(src)
        onLoad?.()
      }
      img.onerror = () => {
        onError?.()
      }
      img.src = src
    }
  }, [hasIntersected, src, placeholder, imageSrc, onLoad, onError])

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      className={className}
      {...props}
    />
  )
}

// Performance monitoring hook
export function usePerformanceMonitor(name: string) {
  const startTime = useRef<number>(Date.now())
  const [metrics, setMetrics] = useState<{
    renderTime: number
    memoryUsage?: number
  } | null>(null)

  useEffect(() => {
    const endTime = Date.now()
    const renderTime = endTime - startTime.current

    // Get memory usage if available
    const memoryUsage = (performance as any).memory?.usedJSHeapSize

    setMetrics({
      renderTime,
      memoryUsage,
    })

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance [${name}]:`, {
        renderTime: `${renderTime}ms`,
        memoryUsage: memoryUsage ? `${(memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      })
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production' && renderTime > 100) {
      // Report slow renders
      console.warn(`Slow render detected [${name}]: ${renderTime}ms`)
    }
  }, [name])

  return metrics
}

// Optimized table component with virtual scrolling
interface OptimizedTableProps<T> {
  data: T[]
  columns: Array<{
    key: keyof T
    label: string
    render?: (value: any, item: T) => React.ReactNode
    width?: number
  }>
  height?: number
  rowHeight?: number
  onRowClick?: (item: T, index: number) => void
  className?: string
}

export function OptimizedTable<T>({
  data,
  columns,
  height = 400,
  rowHeight = 50,
  onRowClick,
  className,
}: OptimizedTableProps<T>) {
  const tableRef = useRef<HTMLDivElement>(null)

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = data[index]
    if (!item) return <div style={style} />
    
    return (
      <div
        style={style}
        className={`flex items-center border-b border-slate-200 hover:bg-slate-50 ${
          onRowClick ? 'cursor-pointer' : ''
        }`}
        onClick={() => onRowClick?.(item, index)}
        role={onRowClick ? 'button' : undefined}
        tabIndex={onRowClick ? 0 : undefined}
      >
        {columns.map((column, colIndex) => {
          const value = item[column.key]
          const content = column.render ? column.render(value, item) : String(value)
          
          return (
            <div
              key={colIndex}
              className="px-4 py-2 flex-1 text-sm"
              style={{ width: column.width }}
            >
              {content}
            </div>
          )
        })}
      </div>
    )
  }, [data, columns, onRowClick])

  return (
    <div ref={tableRef} className={`optimized-table ${className || ''}`}>
      {/* Header */}
      <div className="flex bg-slate-100 border-b-2 border-slate-200 font-medium text-sm">
        {columns.map((column, index) => (
          <div
            key={index}
            className="px-4 py-3 flex-1"
            style={{ width: column.width }}
          >
            {column.label}
          </div>
        ))}
      </div>

      {/* Virtual scrolling body */}
      <List
        height={height}
        width="100%"
        itemCount={data.length}
        itemSize={rowHeight}
        overscanCount={10}
      >
        {Row}
      </List>
    </div>
  )
}

// Bundle size analyzer (development only)
export function analyzeBundleSize() {
  if (process.env.NODE_ENV !== 'development') return

  // Estimate component sizes
  const components = document.querySelectorAll('[data-component]')
  const sizes = Array.from(components).map(el => ({
    name: el.getAttribute('data-component'),
    size: el.innerHTML.length,
  }))

  console.table(sizes.sort((a, b) => b.size - a.size))
}

// React.memo with custom comparison
export function createMemoComponent<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
) {
  const MemoizedComponent = React.memo(Component, propsAreEqual)
  MemoizedComponent.displayName = `Memo(${Component.displayName || Component.name})`
  return MemoizedComponent
}
