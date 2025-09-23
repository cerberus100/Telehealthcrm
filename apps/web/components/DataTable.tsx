import React from 'react'
import { Card } from './Card'
import { Badge } from './Badge'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'

export interface TableColumn<T> {
  key: keyof T | string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: any, record: T) => React.ReactNode
  sortable?: boolean
}

export interface TableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  emptyMessage?: string
  emptyAction?: React.ReactNode
  className?: string
  onRowClick?: (record: T) => void
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  emptyAction,
  className = '',
  onRowClick
}: TableProps<T>) {
  if (loading) {
    return (
      <Card className={className}>
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="row" />
          ))}
        </div>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        action={emptyAction}
        className={className}
      />
    )
  }

  return (
    <Card className={className}>
      <table className="table">
        <thead>
          <tr className="tr">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="th"
                style={{
                  width: column.width,
                  textAlign: column.align === 'center' ? 'center' :
                           column.align === 'right' ? 'right' : 'left'
                }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record, index) => (
            <tr
              key={index}
              className={`tr ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(record)}
            >
              {columns.map((column) => {
                const value = record[column.key as keyof T]
                const content = column.render
                  ? column.render(value, record)
                  : String(value || '')

                return (
                  <td
                    key={String(column.key)}
                    className="td"
                    style={{
                      textAlign: column.align === 'center' ? 'center' :
                               column.align === 'right' ? 'right' : 'left'
                    }}
                  >
                    <div className={column.key === 'id' ? 'cell-mono' : ''}>
                      {content}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export default DataTable
